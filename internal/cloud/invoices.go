package cloud

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

// IssueInvoices writes one invoice per customer for the usage billed in the
// calendar month containing month, and reports how many it issued.
//
// Hosting is prepaid from the wallet, so an invoice records charges that were
// already paid and is issued as paid. Prices include value-added tax: the
// invoice states the tax contained in the total rather than adding it on top,
// so the total always equals what left the wallet. Issuing again for the same
// month issues nothing: the UNIQUE (customer, period) key and the invoice_id
// on each usage row both prevent it.
func (s *Service) IssueInvoices(ctx context.Context, month time.Time) (int, error) {
	month = month.UTC()
	start := time.Date(month.Year(), month.Month(), 1, 0, 0, 0, 0, time.UTC)
	end := start.AddDate(0, 1, 0)
	periodEnd := end.AddDate(0, 0, -1)
	ctx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()
	rows, err := s.db.Pool().QueryContext(ctx, `SELECT DISTINCT p.user_id FROM usage_records r JOIN projects p ON p.id = r.project_id
		WHERE r.invoice_id IS NULL AND r.period_start >= ? AND r.period_start < ? ORDER BY p.user_id`, start, end)
	if err != nil {
		return 0, err
	}
	var customers []uint64
	for rows.Next() {
		var userID uint64
		if err := rows.Scan(&userID); err != nil {
			_ = rows.Close()
			return 0, err
		}
		customers = append(customers, userID)
	}
	if err := rows.Close(); err != nil {
		return 0, err
	}
	issued := 0
	for _, userID := range customers {
		created, err := s.issueInvoice(ctx, userID, start, end, periodEnd)
		if err != nil {
			return issued, fmt.Errorf("invoice customer %d for %s: %w", userID, start.Format("2006-01"), err)
		}
		if created {
			issued++
		}
	}
	return issued, nil
}

func (s *Service) issueInvoice(ctx context.Context, userID uint64, start, end, periodEnd time.Time) (bool, error) {
	created := false
	err := s.db.WithTx(ctx, func(tx *sql.Tx) error {
		created = false
		var existing uint64
		err := tx.QueryRowContext(ctx, "SELECT id FROM invoices WHERE user_id = ? AND period_start = ? AND period_end = ?", userID, start, periodEnd).Scan(&existing)
		if err == nil {
			return nil
		}
		if !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		// Lock the rows this invoice will claim before summing them, so a
		// billing run cannot add an hour between the sum and the claim.
		locked, err := tx.QueryContext(ctx, `SELECT r.id FROM usage_records r JOIN projects p ON p.id = r.project_id
			WHERE p.user_id = ? AND r.invoice_id IS NULL AND r.period_start >= ? AND r.period_start < ? FOR UPDATE`, userID, start, end)
		if err != nil {
			return err
		}
		var usageIDs []any
		for locked.Next() {
			var id uint64
			if err := locked.Scan(&id); err != nil {
				_ = locked.Close()
				return err
			}
			usageIDs = append(usageIDs, id)
		}
		if err := locked.Close(); err != nil {
			return err
		}
		if len(usageIDs) == 0 {
			return nil
		}
		lines, err := tx.QueryContext(ctx, `SELECT p.id, p.app_name, pl.name, COUNT(*), SUM(r.amount_rial)
			FROM usage_records r JOIN projects p ON p.id = r.project_id JOIN plans pl ON pl.id = p.plan_id
			WHERE r.id IN (`+placeholders(len(usageIDs))+`) GROUP BY p.id, p.app_name, pl.name ORDER BY p.id`, usageIDs...)
		if err != nil {
			return err
		}
		var invoiceLines []InvoiceLine
		var total int64
		for lines.Next() {
			var line InvoiceLine
			var appName, planName string
			if err := lines.Scan(&line.ProjectID, &appName, &planName, &line.QuantityHours, &line.AmountRial); err != nil {
				_ = lines.Close()
				return err
			}
			line.Description = fmt.Sprintf("%s on the %s plan, %s", appName, planName, start.Format("January 2006"))
			total += line.AmountRial
			invoiceLines = append(invoiceLines, line)
		}
		if err := lines.Close(); err != nil {
			return err
		}
		tax := total * s.options.TaxRateBP / (10000 + s.options.TaxRateBP)
		now := s.now()
		placeholder := fmt.Sprintf("PENDING-%d-%s", userID, start.Format("200601"))
		result, err := tx.ExecContext(ctx, `INSERT INTO invoices (number, user_id, period_start, period_end, status, subtotal_rial, tax_rate_bp, tax_rial,
			total_rial, issued_at, created_at) VALUES (?, ?, ?, ?, 'paid', ?, ?, ?, ?, ?, ?)`,
			placeholder, userID, start, periodEnd, total-tax, s.options.TaxRateBP, tax, total, now, now)
		if err != nil {
			return err
		}
		invoiceID, err := result.LastInsertId()
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, "UPDATE invoices SET number = ? WHERE id = ?", fmt.Sprintf("INV-%s-%06d", start.Format("200601"), invoiceID), invoiceID); err != nil {
			return err
		}
		for _, line := range invoiceLines {
			if _, err := tx.ExecContext(ctx, "INSERT INTO invoice_lines (invoice_id, project_id, description, quantity_hours, amount_rial) VALUES (?, ?, ?, ?, ?)",
				invoiceID, line.ProjectID, line.Description, line.QuantityHours, line.AmountRial); err != nil {
				return err
			}
		}
		if _, err := tx.ExecContext(ctx, "UPDATE usage_records SET invoice_id = ? WHERE id IN ("+placeholders(len(usageIDs))+")",
			append([]any{invoiceID}, usageIDs...)...); err != nil {
			return err
		}
		created = true
		return nil
	})
	return created, err
}

const invoiceColumns = `SELECT id, number, user_id, period_start, period_end, status, subtotal_rial, tax_rate_bp, tax_rial, total_rial, issued_at, created_at FROM invoices`

// Invoices lists one customer's invoices, or everyone's when userID is zero.
func (s *Service) Invoices(ctx context.Context, userID uint64, limit int) ([]Invoice, error) {
	ctx, cancel := s.context(ctx)
	defer cancel()
	query, args := invoiceColumns+" ORDER BY period_start DESC, id DESC LIMIT ?", []any{boundedLimit(limit)}
	if userID != 0 {
		query, args = invoiceColumns+" WHERE user_id = ? ORDER BY period_start DESC, id DESC LIMIT ?", []any{userID, boundedLimit(limit)}
	}
	rows, err := s.db.Pool().QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	invoices := []Invoice{}
	for rows.Next() {
		invoice, err := scanInvoice(rows)
		if err != nil {
			return nil, err
		}
		invoices = append(invoices, invoice)
	}
	return invoices, rows.Err()
}

func scanInvoice(row scanner) (Invoice, error) {
	var invoice Invoice
	var issued sql.NullTime
	if err := row.Scan(&invoice.ID, &invoice.Number, &invoice.UserID, &invoice.PeriodStart, &invoice.PeriodEnd, &invoice.Status, &invoice.SubtotalRial,
		&invoice.TaxRateBP, &invoice.TaxRial, &invoice.TotalRial, &issued, &invoice.CreatedAt); err != nil {
		return Invoice{}, err
	}
	invoice.IssuedAt = optionalTime(issued)
	return invoice, nil
}

// Invoice returns one invoice with its lines. A non-zero userID restricts it
// to that customer; another customer's invoice is reported as not found.
func (s *Service) Invoice(ctx context.Context, userID, invoiceID uint64) (Invoice, error) {
	ctx, cancel := s.context(ctx)
	defer cancel()
	invoice, err := scanInvoice(s.db.Pool().QueryRowContext(ctx, invoiceColumns+" WHERE id = ?", invoiceID))
	if errors.Is(err, sql.ErrNoRows) || (err == nil && userID != 0 && invoice.UserID != userID) {
		return Invoice{}, ErrNotFound
	}
	if err != nil {
		return Invoice{}, err
	}
	rows, err := s.db.Pool().QueryContext(ctx, "SELECT id, project_id, description, quantity_hours, amount_rial FROM invoice_lines WHERE invoice_id = ? ORDER BY id", invoiceID)
	if err != nil {
		return Invoice{}, err
	}
	defer rows.Close()
	invoice.Lines = []InvoiceLine{}
	for rows.Next() {
		var line InvoiceLine
		var projectID sql.NullInt64
		if err := rows.Scan(&line.ID, &projectID, &line.Description, &line.QuantityHours, &line.AmountRial); err != nil {
			return Invoice{}, err
		}
		line.ProjectID = uint64(projectID.Int64)
		invoice.Lines = append(invoice.Lines, line)
	}
	return invoice, rows.Err()
}
