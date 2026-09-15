package cloud

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/nimasrn/SwarmOps/internal/domain"
	"github.com/nimasrn/SwarmOps/internal/ops"
	"github.com/nimasrn/SwarmOps/internal/queue"
)

const (
	OrderPending      = "pending"
	OrderRejected     = "rejected"
	OrderCancelled    = "cancelled"
	OrderProvisioning = "provisioning"
	OrderActive       = "active"
	OrderFailed       = "failed"

	ProjectProvisioning = "provisioning"
	ProjectActive       = "active"
	ProjectSuspended    = "suspended"
	ProjectFailed       = "failed"
	ProjectDeleted      = "deleted"

	// DeployAction is the controller command an order is provisioned with.
	// It is the same command an operator queues from the console.
	DeployAction = "application.deploy"
)

// ApplicationSpec is the deployment an order on plan asks for. The plan's
// resources become the application's reservation and hard limit, and the
// controller's own validation decides whether the name, image and port are
// acceptable, so a customer can never order something an operator could not
// deploy.
func ApplicationSpec(plan Plan, appName, image string, port uint16) (ops.ApplicationSpec, error) {
	spec := ops.ApplicationSpec{
		CPUs:      float64(plan.CPUMillicores) / 1000,
		Image:     strings.TrimSpace(image),
		MemoryMiB: int64(plan.MemoryMiB),
		Name:      strings.ToLower(strings.TrimSpace(appName)),
		Port:      port,
		Replicas:  1,
	}.Normalize()
	if err := spec.Validate(); err != nil {
		return spec, invalid("application", err.Error())
	}
	return spec, nil
}

// PlaceOrder records a customer's order for one application on one plan. It
// charges nothing: the wallet is charged only when an administrator confirms.
func (s *Service) PlaceOrder(ctx context.Context, userID uint64, input OrderInput) (Order, error) {
	plan, err := s.PlanByCode(ctx, input.PlanCode)
	if errors.Is(err, ErrNotFound) || (err == nil && !plan.Active) {
		return Order{}, invalid("planCode", "choose an available plan")
	}
	if err != nil {
		return Order{}, err
	}
	spec, err := ApplicationSpec(plan, input.AppName, input.Image, input.Port)
	if err != nil {
		return Order{}, err
	}
	note := strings.TrimSpace(input.Note)
	if utf8.RuneCountInString(note) > 500 {
		return Order{}, invalid("note", "keep the note under 500 characters")
	}
	ctx, cancel := s.context(ctx)
	defer cancel()
	now := s.now()
	var orderID int64
	err = s.db.WithTx(ctx, func(tx *sql.Tx) error {
		if err := nameAvailableTx(ctx, tx, spec.Name); err != nil {
			return err
		}
		result, err := tx.ExecContext(ctx, "INSERT INTO orders (user_id, status, customer_note, placed_at, updated_at) VALUES (?, ?, ?, ?, ?)",
			userID, OrderPending, text(note), now, now)
		if err != nil {
			return err
		}
		if orderID, err = result.LastInsertId(); err != nil {
			return err
		}
		_, err = tx.ExecContext(ctx, `INSERT INTO order_items (order_id, plan_id, app_name, image, port, hourly_price_rial, monthly_price_rial)
			VALUES (?, ?, ?, ?, ?, ?, ?)`, orderID, plan.ID, spec.Name, spec.Image, spec.Port, plan.HourlyPriceRial, plan.MonthlyPriceRial)
		return err
	})
	if err != nil {
		return Order{}, err
	}
	return s.Order(ctx, uint64(orderID))
}

// nameAvailableTx refuses an application name that a project, an order still
// in flight, or an operator's own application already uses. The UNIQUE key on
// projects.app_name settles a race between two orders that both pass it.
func nameAvailableTx(ctx context.Context, tx *sql.Tx, name string) error {
	var taken int
	err := tx.QueryRowContext(ctx, `SELECT
		(SELECT COUNT(*) FROM projects WHERE app_name = ? AND status <> 'deleted') +
		(SELECT COUNT(*) FROM order_items i JOIN orders o ON o.id = i.order_id WHERE i.app_name = ? AND o.status IN ('pending', 'provisioning', 'active')) +
		(SELECT COUNT(*) FROM applications WHERE name = ?)`, name, name, name).Scan(&taken)
	if err != nil {
		return err
	}
	if taken > 0 {
		return conflict(fmt.Sprintf("the application name %q is already taken", name))
	}
	return nil
}

const orderColumns = `SELECT o.id, o.user_id, u.email, o.status, o.customer_note, o.upfront_rial, o.review_reason, o.placed_at, o.reviewed_at, o.updated_at
	FROM orders o JOIN users u ON u.id = o.user_id`

func (s *Service) loadOrders(ctx context.Context, where string, args ...any) ([]Order, error) {
	rows, err := s.db.Pool().QueryContext(ctx, orderColumns+" "+where, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	orders := []Order{}
	index := map[uint64]int{}
	ids := []any{}
	for rows.Next() {
		var order Order
		var note, reason sql.NullString
		var reviewed sql.NullTime
		if err := rows.Scan(&order.ID, &order.UserID, &order.CustomerEmail, &order.Status, &note, &order.UpfrontRial, &reason,
			&order.PlacedAt, &reviewed, &order.UpdatedAt); err != nil {
			return nil, err
		}
		order.CustomerNote, order.ReviewReason, order.ReviewedAt = note.String, reason.String, optionalTime(reviewed)
		order.Items = []OrderItem{}
		index[order.ID] = len(orders)
		ids = append(ids, order.ID)
		orders = append(orders, order)
	}
	if err := rows.Err(); err != nil || len(ids) == 0 {
		return orders, err
	}
	items, err := s.db.Pool().QueryContext(ctx, `SELECT i.order_id, i.id, i.app_name, i.image, i.port, i.hourly_price_rial, i.monthly_price_rial, p.code, p.name
		FROM order_items i JOIN plans p ON p.id = i.plan_id WHERE i.order_id IN (`+placeholders(len(ids))+`) ORDER BY i.id`, ids...)
	if err != nil {
		return nil, err
	}
	defer items.Close()
	for items.Next() {
		var orderID uint64
		var item OrderItem
		if err := items.Scan(&orderID, &item.ID, &item.AppName, &item.Image, &item.Port, &item.HourlyPriceRial, &item.MonthlyPriceRial,
			&item.PlanCode, &item.PlanName); err != nil {
			return nil, err
		}
		orders[index[orderID]].Items = append(orders[index[orderID]].Items, item)
	}
	return orders, items.Err()
}

func placeholders(count int) string {
	return strings.TrimSuffix(strings.Repeat("?,", count), ",")
}

func (s *Service) Order(ctx context.Context, orderID uint64) (Order, error) {
	orders, err := s.loadOrders(ctx, "WHERE o.id = ?", orderID)
	if err != nil {
		return Order{}, err
	}
	if len(orders) == 0 {
		return Order{}, ErrNotFound
	}
	return orders[0], nil
}

// CustomerOrder returns an order only to the customer who placed it. Another
// customer's order is reported as not found, so ids reveal nothing.
func (s *Service) CustomerOrder(ctx context.Context, userID, orderID uint64) (Order, error) {
	order, err := s.Order(ctx, orderID)
	if err != nil {
		return Order{}, err
	}
	if order.UserID != userID {
		return Order{}, ErrNotFound
	}
	return order, nil
}

func (s *Service) Orders(ctx context.Context, userID uint64, limit int) ([]Order, error) {
	return s.loadOrders(ctx, "WHERE o.user_id = ? ORDER BY o.placed_at DESC, o.id DESC LIMIT ?", userID, boundedLimit(limit))
}

// AllOrders lists orders for administrators, optionally in one status. The
// pending queue is oldest first, so the order waiting longest is reviewed first.
func (s *Service) AllOrders(ctx context.Context, status string, limit int) ([]Order, error) {
	if status == "" {
		return s.loadOrders(ctx, "ORDER BY o.placed_at DESC, o.id DESC LIMIT ?", boundedLimit(limit))
	}
	order := "DESC"
	if status == OrderPending {
		order = "ASC"
	}
	return s.loadOrders(ctx, "WHERE o.status = ? ORDER BY o.placed_at "+order+", o.id "+order+" LIMIT ?", status, boundedLimit(limit))
}

func boundedLimit(limit int) int {
	if limit < 1 || limit > 500 {
		return 100
	}
	return limit
}

func (s *Service) CancelOrder(ctx context.Context, userID, orderID uint64) (Order, error) {
	ctx, cancel := s.context(ctx)
	defer cancel()
	err := s.db.WithTx(ctx, func(tx *sql.Tx) error {
		var owner uint64
		var status string
		err := tx.QueryRowContext(ctx, "SELECT user_id, status FROM orders WHERE id = ? FOR UPDATE", orderID).Scan(&owner, &status)
		if errors.Is(err, sql.ErrNoRows) || (err == nil && owner != userID) {
			return ErrNotFound
		}
		if err != nil {
			return err
		}
		if status != OrderPending {
			return conflict("only an order that is still pending can be cancelled")
		}
		_, err = tx.ExecContext(ctx, "UPDATE orders SET status = ?, updated_at = ? WHERE id = ?", OrderCancelled, s.now(), orderID)
		return err
	})
	if err != nil {
		return Order{}, err
	}
	return s.Order(ctx, orderID)
}

func (s *Service) RejectOrder(ctx context.Context, reviewer User, orderID uint64, reason string) (Order, error) {
	if reviewer.Role != RoleAdmin {
		return Order{}, ErrForbidden
	}
	reason = strings.TrimSpace(reason)
	if utf8.RuneCountInString(reason) < 5 || utf8.RuneCountInString(reason) > 500 {
		return Order{}, invalid("reason", "tell the customer why the order was rejected")
	}
	ctx, cancel := s.context(ctx)
	defer cancel()
	err := s.db.WithTx(ctx, func(tx *sql.Tx) error {
		if _, err := lockPendingOrder(ctx, tx, orderID); err != nil {
			return err
		}
		now := s.now()
		_, err := tx.ExecContext(ctx, "UPDATE orders SET status = ?, reviewer_id = ?, review_reason = ?, reviewed_at = ?, updated_at = ? WHERE id = ?",
			OrderRejected, reviewer.ID, reason, now, now, orderID)
		return err
	})
	if err != nil {
		return Order{}, err
	}
	return s.Order(ctx, orderID)
}

func lockPendingOrder(ctx context.Context, tx *sql.Tx, orderID uint64) (uint64, error) {
	var userID uint64
	var status string
	err := tx.QueryRowContext(ctx, "SELECT user_id, status FROM orders WHERE id = ? FOR UPDATE", orderID).Scan(&userID, &status)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, ErrNotFound
	}
	if err != nil {
		return 0, err
	}
	if status != OrderPending {
		return 0, conflict(fmt.Sprintf("this order is %s, not pending", status))
	}
	return userID, nil
}

// ConfirmOrder is the administrator accepting an order. In ONE transaction it
// locks the order and the customer's wallet, requires the wallet to hold the
// plan's reserve, charges the first hour, creates the project and its first
// usage record, and queues the application's deployment in the controller's
// command ledger.
//
// Because the command ledger lives in the same database, this is a
// transactional outbox: if any step fails, including queueing the deployment,
// nothing was charged and nothing will be deployed. There is no window in
// which a customer has paid for a deployment that was never requested, or a
// deployment runs that nobody paid for.
func (s *Service) ConfirmOrder(ctx context.Context, reviewer User, orderID uint64, target ProvisionTarget) (Order, Project, domain.Command, error) {
	if reviewer.Role != RoleAdmin {
		return Order{}, Project{}, domain.Command{}, ErrForbidden
	}
	target.ServerID = strings.TrimSpace(target.ServerID)
	if target.ServerID == "" {
		return Order{}, Project{}, domain.Command{}, invalid("serverId", "choose the server to deploy the application on")
	}
	ctx, cancel := s.context(ctx)
	defer cancel()
	var command domain.Command
	var projectID int64
	var cleanup []string
	err := s.db.WithTx(ctx, func(tx *sql.Tx) error {
		cleanup = nil
		userID, err := lockPendingOrder(ctx, tx, orderID)
		if err != nil {
			return err
		}
		var itemID uint64
		var plan Plan
		var appName, image string
		var port uint16
		var hourly, monthly int64
		if err := tx.QueryRowContext(ctx, `SELECT i.id, i.app_name, i.image, i.port, i.hourly_price_rial, i.monthly_price_rial, p.cpu_millicores, p.memory_mib
			FROM order_items i JOIN plans p ON p.id = i.plan_id WHERE i.order_id = ? ORDER BY i.id LIMIT 1`, orderID).
			Scan(&itemID, &appName, &image, &port, &hourly, &monthly, &plan.CPUMillicores, &plan.MemoryMiB); err != nil {
			return err
		}
		spec, err := ApplicationSpec(plan, appName, image, port)
		if err != nil {
			return err
		}
		var balance int64
		if err := tx.QueryRowContext(ctx, "SELECT balance_rial FROM wallets WHERE user_id = ? FOR UPDATE", userID).Scan(&balance); err != nil {
			return err
		}
		if balance < hourly*s.options.ReserveHours {
			return &FundsError{Required: hourly * s.options.ReserveHours, Balance: balance}
		}
		now := s.now()
		charge, err := s.applyTx(ctx, tx, ledgerEntry{amount: -hourly, description: fmt.Sprintf("First hour of %s", appName),
			idempotencyKey: fmt.Sprintf("order-charge-%d", orderID), kind: KindOrderCharge, referenceID: orderID, referenceType: "order", userID: userID})
		if err != nil {
			return err
		}
		result, err := tx.ExecContext(ctx, `INSERT INTO projects (user_id, order_item_id, plan_id, app_name, status, server_id, hourly_price_rial,
			monthly_price_rial, created_at, updated_at) SELECT ?, i.id, i.plan_id, i.app_name, ?, ?, i.hourly_price_rial, i.monthly_price_rial, ?, ?
			FROM order_items i WHERE i.id = ?`, userID, ProjectProvisioning, target.ServerID, now, now, itemID)
		if err != nil {
			if strings.Contains(err.Error(), "uq_projects_app_name") {
				return conflict(fmt.Sprintf("the application name %q was taken by another order", appName))
			}
			return err
		}
		if projectID, err = result.LastInsertId(); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, "INSERT INTO usage_records (project_id, period_start, amount_rial, wallet_transaction_id, created_at) VALUES (?, ?, ?, ?, ?)",
			projectID, now.Truncate(time.Hour), hourly, charge.ID, now); err != nil {
			return err
		}
		payload, err := json.Marshal(struct {
			Spec ops.ApplicationSpec `json:"spec"`
		}{Spec: spec})
		if err != nil {
			return err
		}
		submission, forget, err := s.commands.SubmitInTx(ctx, tx, queue.SubmitInput{
			Action:         DeployAction,
			Actor:          reviewer.FullName,
			AuthorityEpoch: target.AuthorityEpoch,
			AutoRetry:      true,
			ClusterID:      "default",
			IdempotencyKey: fmt.Sprintf("cloud-order-%d", orderID),
			MaxAttempts:    3,
			Payload:        payload,
			RequestID:      target.RequestID,
			ServerID:       target.ServerID,
			Target:         "application/" + spec.Name,
		})
		if err != nil {
			return fmt.Errorf("queue the deployment: %w", err)
		}
		command, cleanup = submission.Command, forget
		if _, err := tx.ExecContext(ctx, "UPDATE projects SET command_id = ? WHERE id = ?", command.ID, projectID); err != nil {
			return err
		}
		_, err = tx.ExecContext(ctx, "UPDATE orders SET status = ?, upfront_rial = ?, reviewer_id = ?, reviewed_at = ?, updated_at = ? WHERE id = ?",
			OrderProvisioning, hourly, reviewer.ID, now, now, orderID)
		return err
	})
	if err != nil {
		return Order{}, Project{}, domain.Command{}, err
	}
	s.commands.ForgetInputs(cleanup)
	order, err := s.Order(ctx, orderID)
	if err != nil {
		return Order{}, Project{}, domain.Command{}, err
	}
	project, err := s.Project(ctx, uint64(projectID))
	return order, project, command, err
}

// FundsError is ErrInsufficientFunds with the numbers a reviewer needs.
type FundsError struct {
	Balance  int64
	Required int64
}

func (e *FundsError) Error() string {
	return fmt.Sprintf("the wallet holds %d rials but %d are required", e.Balance, e.Required)
}
func (e *FundsError) Unwrap() error { return ErrInsufficientFunds }

// OnCommandTransition moves a project and its order forward when the
// deployment command that provisions it reaches an outcome. A deployment that
// ended without succeeding refunds the upfront charge, exactly once.
func (s *Service) OnCommandTransition(ctx context.Context, command domain.Command) error {
	if command.Action != DeployAction || !strings.HasPrefix(command.Target, "application/") {
		return nil
	}
	succeeded := command.State == domain.CommandSucceeded
	failed := command.State == domain.CommandNeedsAttention || command.State == domain.CommandFailed || command.State == domain.CommandCancelled
	if !succeeded && !failed {
		return nil
	}
	ctx, cancel := s.context(ctx)
	defer cancel()
	return s.db.WithTx(ctx, func(tx *sql.Tx) error {
		var projectID, userID, orderID uint64
		var status string
		err := tx.QueryRowContext(ctx, `SELECT p.id, p.user_id, p.status, i.order_id FROM projects p JOIN order_items i ON i.id = p.order_item_id
			WHERE p.command_id = ? FOR UPDATE`, command.ID).Scan(&projectID, &userID, &status, &orderID)
		if errors.Is(err, sql.ErrNoRows) {
			return nil
		}
		if err != nil {
			return err
		}
		if status != ProjectProvisioning {
			return nil
		}
		now := s.now()
		if succeeded {
			if _, err := tx.ExecContext(ctx, "UPDATE projects SET status = ?, activated_at = ?, updated_at = ? WHERE id = ?", ProjectActive, now, now, projectID); err != nil {
				return err
			}
			_, err := tx.ExecContext(ctx, "UPDATE orders SET status = ?, updated_at = ? WHERE id = ? AND status = ?", OrderActive, now, orderID, OrderProvisioning)
			return err
		}
		if _, err := tx.ExecContext(ctx, "UPDATE projects SET status = ?, updated_at = ? WHERE id = ?", ProjectFailed, now, projectID); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, "UPDATE orders SET status = ?, updated_at = ? WHERE id = ? AND status = ?", OrderFailed, now, orderID, OrderProvisioning); err != nil {
			return err
		}
		// The hour charged at confirmation is refunded below, so its usage
		// row goes with it: otherwise the project would still show the hour
		// as spent and the month's invoice would bill money already returned.
		if _, err := tx.ExecContext(ctx, "DELETE FROM usage_records WHERE project_id = ? AND invoice_id IS NULL", projectID); err != nil {
			return err
		}
		var charged int64
		if err := tx.QueryRowContext(ctx, "SELECT COALESCE(-SUM(amount_rial), 0) FROM wallet_transactions WHERE user_id = ? AND reference_type = 'order' AND reference_id = ? AND kind = ?",
			userID, orderID, KindOrderCharge).Scan(&charged); err != nil {
			return err
		}
		if charged <= 0 {
			return nil
		}
		_, err = s.applyTx(ctx, tx, ledgerEntry{amount: charged, description: "Refund: the deployment did not succeed",
			idempotencyKey: fmt.Sprintf("order-refund-%d", orderID), kind: KindRefund, referenceID: orderID, referenceType: "order", userID: userID})
		return err
	})
}

const projectColumns = `SELECT p.id, p.user_id, p.order_item_id, p.app_name, p.status, p.server_id, p.command_id, p.hourly_price_rial, p.monthly_price_rial,
	p.created_at, p.activated_at, p.suspended_at, pl.code, pl.name,
	COALESCE((SELECT SUM(r.amount_rial) FROM usage_records r WHERE r.project_id = p.id AND r.period_start >= ?), 0)
	FROM projects p JOIN plans pl ON pl.id = p.plan_id`

func (s *Service) loadProjects(ctx context.Context, where string, args ...any) ([]Project, error) {
	now := s.now()
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	rows, err := s.db.Pool().QueryContext(ctx, projectColumns+" "+where, append([]any{monthStart}, args...)...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	projects := []Project{}
	for rows.Next() {
		var project Project
		var commandID sql.NullString
		var activated, suspended sql.NullTime
		if err := rows.Scan(&project.ID, &project.UserID, &project.OrderItemID, &project.AppName, &project.Status, &project.ServerID, &commandID,
			&project.HourlyPriceRial, &project.MonthlyPriceRial, &project.CreatedAt, &activated, &suspended, &project.PlanCode, &project.PlanName,
			&project.UsageThisMonth); err != nil {
			return nil, err
		}
		project.CommandID, project.ActivatedAt, project.SuspendedAt = commandID.String, optionalTime(activated), optionalTime(suspended)
		projects = append(projects, project)
	}
	return projects, rows.Err()
}

func (s *Service) Project(ctx context.Context, projectID uint64) (Project, error) {
	projects, err := s.loadProjects(ctx, "WHERE p.id = ?", projectID)
	if err != nil {
		return Project{}, err
	}
	if len(projects) == 0 {
		return Project{}, ErrNotFound
	}
	return projects[0], nil
}

func (s *Service) Projects(ctx context.Context, userID uint64) ([]Project, error) {
	return s.loadProjects(ctx, "WHERE p.user_id = ? AND p.status <> 'deleted' ORDER BY p.created_at DESC, p.id DESC", userID)
}

func (s *Service) AllProjects(ctx context.Context, status string, limit int) ([]Project, error) {
	if status == "" {
		return s.loadProjects(ctx, "ORDER BY p.created_at DESC, p.id DESC LIMIT ?", boundedLimit(limit))
	}
	return s.loadProjects(ctx, "WHERE p.status = ? ORDER BY p.created_at DESC, p.id DESC LIMIT ?", status, boundedLimit(limit))
}
