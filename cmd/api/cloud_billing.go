package main

import (
	"context"
	"log/slog"
	"time"

	"github.com/nimasrn/SwarmOps/internal/cloud"
)

// cloudBillingInterval is how often the controller looks for hours to bill.
// Each hour is charged once however often this runs, so a short interval only
// means a new hour is charged soon after it starts.
const cloudBillingInterval = 5 * time.Minute

// runCloudBilling charges running projects and issues last month's invoices.
// Only the active controller bills: a standby sharing the database skips
// every pass, and the idempotent hour and invoice keys make an overlap during
// a handoff harmless anyway.
func runCloudBilling(ctx context.Context, service *cloud.Service, active func() bool, logger *slog.Logger) {
	ticker := time.NewTicker(cloudBillingInterval)
	defer ticker.Stop()
	for {
		if active() {
			if result, err := service.RunBilling(ctx); err != nil {
				logger.Error("SwarmOps Cloud billing run failed", "error", err)
			} else if result.ChargedHours > 0 || result.Suspended > 0 {
				logger.Info("SwarmOps Cloud billing run", "charged_hours", result.ChargedHours, "charged_rial", result.ChargedRial, "suspended", result.Suspended)
			}
			lastMonth := time.Now().UTC().AddDate(0, -1, 0)
			if issued, err := service.IssueInvoices(ctx, lastMonth); err != nil {
				logger.Error("SwarmOps Cloud invoice run failed", "error", err)
			} else if issued > 0 {
				logger.Info("SwarmOps Cloud issued invoices", "month", lastMonth.Format("2006-01"), "issued", issued)
			}
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
