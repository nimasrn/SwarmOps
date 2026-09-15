package cloud

import (
	"context"
	"time"
)

// Customers lists customer accounts with their balance and activity, read
// from the v_customer_accounts view.
func (s *Service) Customers(ctx context.Context, limit int) ([]CustomerAccount, error) {
	ctx, cancel := s.context(ctx)
	defer cancel()
	rows, err := s.db.Pool().QueryContext(ctx, `SELECT user_id, email, full_name, status, created_at, balance_rial, live_projects, pending_orders
		FROM v_customer_accounts ORDER BY created_at DESC, user_id DESC LIMIT ?`, boundedLimit(limit))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	accounts := []CustomerAccount{}
	for rows.Next() {
		var account CustomerAccount
		if err := rows.Scan(&account.UserID, &account.Email, &account.FullName, &account.Status, &account.CreatedAt, &account.BalanceRial,
			&account.LiveProjects, &account.PendingOrders); err != nil {
			return nil, err
		}
		accounts = append(accounts, account)
	}
	return accounts, rows.Err()
}

// Revenue reads the most recent months from the v_revenue_by_month view.
func (s *Service) Revenue(ctx context.Context, months int) ([]RevenueMonth, error) {
	if months < 1 || months > 60 {
		months = 12
	}
	ctx, cancel := s.context(ctx)
	defer cancel()
	rows, err := s.db.Pool().QueryContext(ctx, `SELECT month, charged_rial, refunded_rial, topped_up_rial, paying_customers
		FROM v_revenue_by_month ORDER BY month DESC LIMIT ?`, months)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	report := []RevenueMonth{}
	for rows.Next() {
		var month RevenueMonth
		if err := rows.Scan(&month.Month, &month.ChargedRial, &month.RefundedRial, &month.ToppedUpRial, &month.PayingCustomers); err != nil {
			return nil, err
		}
		report = append(report, month)
	}
	return report, rows.Err()
}

// AdminOverview gathers the figures the admin panel opens on.
func (s *Service) AdminOverview(ctx context.Context) (Overview, error) {
	ctx, cancel := s.context(ctx)
	defer cancel()
	now := s.now()
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	var overview Overview
	err := s.db.Pool().QueryRowContext(ctx, `SELECT
		(SELECT COUNT(*) FROM users WHERE role = 'customer'),
		(SELECT COUNT(*) FROM orders WHERE status = 'pending'),
		(SELECT COUNT(*) FROM projects WHERE status = 'active'),
		(SELECT COUNT(*) FROM projects WHERE status = 'suspended'),
		(SELECT COUNT(*) FROM support_tickets WHERE status = 'open'),
		(SELECT COALESCE(SUM(balance_rial), 0) FROM wallets),
		(SELECT COALESCE(-SUM(amount_rial), 0) FROM wallet_transactions WHERE kind IN ('order_charge', 'usage', 'refund') AND created_at >= ?)`, monthStart).
		Scan(&overview.Customers, &overview.PendingOrders, &overview.ActiveProjects, &overview.SuspendedProjects, &overview.OpenTickets,
			&overview.WalletFloatRial, &overview.RevenueMonthRial)
	return overview, err
}
