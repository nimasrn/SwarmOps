package cloud

import (
	"context"
	"database/sql"
	"errors"
	"regexp"
	"strings"
	"unicode/utf8"
)

var planCodePattern = regexp.MustCompile(`^[a-z][a-z0-9-]{1,31}$`)

// Plans lists the catalogue in display order, each with its English and
// Persian features.
func (s *Service) Plans(ctx context.Context, includeInactive bool) ([]Plan, error) {
	ctx, cancel := s.context(ctx)
	defer cancel()
	query := `SELECT p.id, c.code, p.code, p.name, p.description, p.description_fa, p.cpu_millicores, p.memory_mib, p.disk_gib,
		p.hourly_price_rial, p.monthly_price_rial, p.is_active, p.sort_order, p.updated_at
		FROM plans p JOIN product_categories c ON c.id = p.category_id`
	if !includeInactive {
		query += " WHERE p.is_active = TRUE"
	}
	rows, err := s.db.Pool().QueryContext(ctx, query+" ORDER BY p.sort_order, p.id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	plans := []Plan{}
	index := map[uint32]int{}
	for rows.Next() {
		var plan Plan
		if err := rows.Scan(&plan.ID, &plan.Category, &plan.Code, &plan.Name, &plan.Description, &plan.DescriptionFa, &plan.CPUMillicores,
			&plan.MemoryMiB, &plan.DiskGiB, &plan.HourlyPriceRial, &plan.MonthlyPriceRial, &plan.Active, &plan.SortOrder, &plan.UpdatedAt); err != nil {
			return nil, err
		}
		plan.Features = []string{}
		plan.FeaturesFa = []string{}
		index[plan.ID] = len(plans)
		plans = append(plans, plan)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	features, err := s.db.Pool().QueryContext(ctx, "SELECT plan_id, locale, feature FROM plan_features ORDER BY plan_id, locale, position")
	if err != nil {
		return nil, err
	}
	defer features.Close()
	for features.Next() {
		var planID uint32
		var locale, feature string
		if err := features.Scan(&planID, &locale, &feature); err != nil {
			return nil, err
		}
		position, found := index[planID]
		if !found {
			continue
		}
		if locale == "fa" {
			plans[position].FeaturesFa = append(plans[position].FeaturesFa, feature)
		} else {
			plans[position].Features = append(plans[position].Features, feature)
		}
	}
	return plans, features.Err()
}

// PlanByCode returns one plan, active or not.
func (s *Service) PlanByCode(ctx context.Context, code string) (Plan, error) {
	plans, err := s.Plans(ctx, true)
	if err != nil {
		return Plan{}, err
	}
	for _, plan := range plans {
		if plan.Code == strings.TrimSpace(code) {
			return plan, nil
		}
	}
	return Plan{}, ErrNotFound
}

// SavePlan creates a plan or updates the one with the same code. A price
// change never reaches an order already placed: items copy their prices.
func (s *Service) SavePlan(ctx context.Context, input PlanInput) (Plan, error) {
	input.Code = strings.ToLower(strings.TrimSpace(input.Code))
	input.Name = strings.TrimSpace(input.Name)
	input.Description = strings.TrimSpace(input.Description)
	input.DescriptionFa = strings.TrimSpace(input.DescriptionFa)
	switch {
	case !planCodePattern.MatchString(input.Code):
		return Plan{}, invalid("code", "use 2-32 lowercase letters, digits or hyphens")
	case utf8.RuneCountInString(input.Name) < 2 || utf8.RuneCountInString(input.Name) > 64:
		return Plan{}, invalid("name", "enter a plan name")
	case utf8.RuneCountInString(input.Description) > 255:
		return Plan{}, invalid("description", "keep the description under 255 characters")
	case utf8.RuneCountInString(input.DescriptionFa) > 255:
		return Plan{}, invalid("descriptionFa", "keep the Persian description under 255 characters")
	case input.CPUMillicores < 100 || input.CPUMillicores > 64000:
		return Plan{}, invalid("cpuMillicores", "CPU must be between 100 and 64000 millicores")
	case input.MemoryMiB < 128 || input.MemoryMiB > 262144:
		return Plan{}, invalid("memoryMiB", "memory must be between 128 MiB and 256 GiB")
	case input.HourlyPriceRial <= 0:
		return Plan{}, invalid("hourlyPriceRial", "the hourly price must be positive")
	case input.MonthlyPriceRial < input.HourlyPriceRial:
		return Plan{}, invalid("monthlyPriceRial", "the monthly cap cannot be lower than one hour")
	case len(input.Features) > 12:
		return Plan{}, invalid("features", "list at most 12 features")
	case len(input.FeaturesFa) > 12:
		return Plan{}, invalid("featuresFa", "list at most 12 Persian features")
	}
	ctx, cancel := s.context(ctx)
	defer cancel()
	now := s.now()
	err := s.db.WithTx(ctx, func(tx *sql.Tx) error {
		var categoryID uint16
		if err := tx.QueryRowContext(ctx, "SELECT id FROM product_categories WHERE code = 'app'").Scan(&categoryID); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO plans (category_id, code, name, description, description_fa, cpu_millicores, memory_mib, disk_gib,
			hourly_price_rial, monthly_price_rial, is_active, sort_order, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), description_fa = VALUES(description_fa),
			 cpu_millicores = VALUES(cpu_millicores), memory_mib = VALUES(memory_mib), disk_gib = VALUES(disk_gib),
			 hourly_price_rial = VALUES(hourly_price_rial), monthly_price_rial = VALUES(monthly_price_rial), is_active = VALUES(is_active),
			 sort_order = VALUES(sort_order), updated_at = VALUES(updated_at)`,
			categoryID, input.Code, input.Name, input.Description, input.DescriptionFa, input.CPUMillicores, input.MemoryMiB, input.DiskGiB,
			input.HourlyPriceRial, input.MonthlyPriceRial, input.Active, input.SortOrder, now, now); err != nil {
			return err
		}
		var planID uint32
		if err := tx.QueryRowContext(ctx, "SELECT id FROM plans WHERE code = ?", input.Code).Scan(&planID); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, "DELETE FROM plan_features WHERE plan_id = ?", planID); err != nil {
			return err
		}
		if err := insertFeatures(ctx, tx, planID, "en", "features", input.Features); err != nil {
			return err
		}
		return insertFeatures(ctx, tx, planID, "fa", "featuresFa", input.FeaturesFa)
	})
	if err != nil {
		return Plan{}, err
	}
	plan, err := s.PlanByCode(ctx, input.Code)
	if errors.Is(err, ErrNotFound) {
		return Plan{}, err
	}
	return plan, err
}

// insertFeatures writes one language's features in order, skipping blank
// lines.
func insertFeatures(ctx context.Context, tx *sql.Tx, planID uint32, locale, field string, features []string) error {
	position := 0
	for _, feature := range features {
		feature = strings.TrimSpace(feature)
		if feature == "" {
			continue
		}
		if utf8.RuneCountInString(feature) > 160 {
			return invalid(field, "keep each feature under 160 characters")
		}
		if _, err := tx.ExecContext(ctx, "INSERT INTO plan_features (plan_id, locale, position, feature) VALUES (?, ?, ?, ?)",
			planID, locale, position, feature); err != nil {
			return err
		}
		position++
	}
	return nil
}
