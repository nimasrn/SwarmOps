package cloud

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/nimasrn/SwarmOps/internal/sqlstore"
)

// maxHoursPerRun bounds how far one billing run catches up for one project,
// so a controller that was down for a week bills in bounded transactions.
const maxHoursPerRun = 72

var errCannotPay = errors.New("the wallet cannot pay for this hour")

// RunBilling charges every active project for each whole hour it has not yet
// been charged for, up to and including the current hour: hosting is prepaid
// hour by hour, as it is on hourly-billed platforms.
//
// Each hour is its own transaction and its own usage_records row. The row's
// UNIQUE (project, hour) key makes a run idempotent: repeating it, or two runs
// overlapping, charges nothing twice. An hour is charged at the plan's hourly
// price until the month's charges reach the plan's monthly price, and at zero
// after that. A wallet that cannot pay for an hour suspends the project.
func (s *Service) RunBilling(ctx context.Context) (BillingResult, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()
	now := s.now()
	currentHour := now.Truncate(time.Hour)
	projects, err := s.billableProjects(ctx)
	if err != nil {
		return BillingResult{}, err
	}
	var result BillingResult
	var firstErr error
	for _, project := range projects {
		start := project.createdAt.Truncate(time.Hour)
		if project.lastBilled.Valid {
			start = project.lastBilled.Time.Add(time.Hour)
		}
		if project.resumedAt.Valid && project.resumedAt.Time.Truncate(time.Hour).After(start) {
			start = project.resumedAt.Time.Truncate(time.Hour)
		}
		for hour, done := start, 0; !hour.After(currentHour) && done < maxHoursPerRun; hour, done = hour.Add(time.Hour), done+1 {
			charged, billed, err := s.chargeHour(ctx, project, hour)
			if errors.Is(err, errCannotPay) {
				if err := s.suspend(ctx, project.Project); err != nil && firstErr == nil {
					firstErr = err
				}
				result.Suspended++
				break
			}
			if err != nil {
				if firstErr == nil {
					firstErr = fmt.Errorf("bill project %d for %s: %w", project.ID, hour.Format(time.RFC3339), err)
				}
				break
			}
			if billed {
				result.ChargedHours++
				result.ChargedRial += charged
			}
		}
	}
	return result, firstErr
}

type billableProject struct {
	Project
	createdAt  time.Time
	lastBilled sql.NullTime
	resumedAt  sql.NullTime
}

func (s *Service) billableProjects(ctx context.Context) ([]billableProject, error) {
	rows, err := s.db.Pool().QueryContext(ctx, `SELECT p.id, p.user_id, p.app_name, p.server_id, p.hourly_price_rial, p.monthly_price_rial, p.created_at,
		p.billing_resumed_at, (SELECT MAX(r.period_start) FROM usage_records r WHERE r.project_id = p.id)
		FROM projects p WHERE p.status = ? ORDER BY p.id`, ProjectActive)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var projects []billableProject
	for rows.Next() {
		var project billableProject
		if err := rows.Scan(&project.ID, &project.UserID, &project.AppName, &project.ServerID, &project.HourlyPriceRial, &project.MonthlyPriceRial,
			&project.createdAt, &project.resumedAt, &project.lastBilled); err != nil {
			return nil, err
		}
		project.Status = ProjectActive
		projects = append(projects, project)
	}
	return projects, rows.Err()
}

// chargeHour bills one project for one hour. It reports the amount charged and
// whether this call billed the hour at all; an hour already billed is neither.
func (s *Service) chargeHour(ctx context.Context, project billableProject, hour time.Time) (int64, bool, error) {
	var charged int64
	var billed bool
	err := s.db.WithTx(ctx, func(tx *sql.Tx) error {
		charged, billed = 0, false
		var status string
		if err := tx.QueryRowContext(ctx, "SELECT status FROM projects WHERE id = ? FOR UPDATE", project.ID).Scan(&status); err != nil {
			return err
		}
		if status != ProjectActive {
			return nil
		}
		monthStart := time.Date(hour.Year(), hour.Month(), 1, 0, 0, 0, 0, time.UTC)
		var monthToDate int64
		if err := tx.QueryRowContext(ctx, "SELECT COALESCE(SUM(amount_rial), 0) FROM usage_records WHERE project_id = ? AND period_start >= ? AND period_start < ?",
			project.ID, monthStart, monthStart.AddDate(0, 1, 0)).Scan(&monthToDate); err != nil {
			return err
		}
		amount := min(project.HourlyPriceRial, max(0, project.MonthlyPriceRial-monthToDate))
		now := s.now()
		result, err := tx.ExecContext(ctx, "INSERT INTO usage_records (project_id, period_start, amount_rial, created_at) VALUES (?, ?, ?, ?)",
			project.ID, hour, amount, now)
		if sqlstore.IsDuplicate(err) {
			return nil
		}
		if err != nil {
			return err
		}
		if amount > 0 {
			usageID, err := result.LastInsertId()
			if err != nil {
				return err
			}
			transaction, err := s.applyTx(ctx, tx, ledgerEntry{amount: -amount, description: fmt.Sprintf("%s, %s UTC", project.AppName, hour.Format("2006-01-02 15:00")),
				idempotencyKey: fmt.Sprintf("usage-%d-%s", project.ID, hour.Format("2006010215")), kind: KindUsage, referenceID: project.ID,
				referenceType: "project", userID: project.UserID})
			if errors.Is(err, ErrInsufficientFunds) {
				return errCannotPay
			}
			if err != nil {
				return err
			}
			if _, err := tx.ExecContext(ctx, "UPDATE usage_records SET wallet_transaction_id = ? WHERE id = ?", transaction.ID, usageID); err != nil {
				return err
			}
		}
		charged, billed = amount, true
		return nil
	})
	return charged, billed, err
}

func (s *Service) suspend(ctx context.Context, project Project) error {
	now := s.now()
	result, err := s.db.Pool().ExecContext(ctx, "UPDATE projects SET status = ?, suspended_at = ?, updated_at = ? WHERE id = ? AND status = ?",
		ProjectSuspended, now, now, project.ID, ProjectActive)
	if err != nil {
		return err
	}
	if affected, _ := result.RowsAffected(); affected == 0 || s.provisioner == nil {
		return nil
	}
	project.Status = ProjectSuspended
	if err := s.provisioner.Suspend(ctx, project); err != nil {
		return fmt.Errorf("stop suspended project %s: %w", project.AppName, err)
	}
	return nil
}

// ResumeFundedProjects reactivates each suspended project of a customer that
// the wallet now holds the reserve for. Billing restarts from the moment of
// resumption, so the suspended hours are never charged.
func (s *Service) ResumeFundedProjects(ctx context.Context, userID uint64) (int, error) {
	projects, err := s.loadProjects(ctx, "WHERE p.user_id = ? AND p.status = ? ORDER BY p.id", userID, ProjectSuspended)
	if err != nil || len(projects) == 0 {
		return 0, err
	}
	wallet, err := s.Wallet(ctx, userID)
	if err != nil {
		return 0, err
	}
	resumed := 0
	for _, project := range projects {
		if wallet.BalanceRial < project.HourlyPriceRial*s.options.ReserveHours {
			continue
		}
		now := s.now()
		result, err := s.db.Pool().ExecContext(ctx, "UPDATE projects SET status = ?, suspended_at = NULL, billing_resumed_at = ?, updated_at = ? WHERE id = ? AND status = ?",
			ProjectActive, now, now, project.ID, ProjectSuspended)
		if err != nil {
			return resumed, err
		}
		if affected, _ := result.RowsAffected(); affected == 0 {
			continue
		}
		resumed++
		if s.provisioner != nil {
			project.Status = ProjectActive
			if err := s.provisioner.Resume(ctx, project); err != nil {
				return resumed, fmt.Errorf("restart project %s: %w", project.AppName, err)
			}
		}
	}
	return resumed, nil
}
