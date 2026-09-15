-- SwarmOps Cloud: the customer-facing commerce layer. Customers register,
-- top up a wallet, order hosting plans; an administrator confirms each order,
-- which charges the wallet and provisions the application in one transaction.
-- All money is stored as whole Iranian rials in BIGINT columns: never a
-- floating-point type, so no amount is ever rounded.

CREATE TABLE users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(254) NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  role VARCHAR(16) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  last_login_at DATETIME(6) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY ix_users_role (role, created_at),
  CONSTRAINT ck_users_role CHECK (role IN ('customer', 'admin')),
  CONSTRAINT ck_users_status CHECK (status IN ('active', 'suspended'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Only the SHA-256 of a session token is stored, so a copy of this table does
-- not contain a usable session.
CREATE TABLE user_sessions (
  token_hash CHAR(64) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  csrf_token VARCHAR(64) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  revoked_at DATETIME(6) NULL,
  PRIMARY KEY (token_hash),
  KEY ix_user_sessions_user (user_id, expires_at),
  CONSTRAINT fk_user_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE product_categories (
  id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(32) NOT NULL,
  name VARCHAR(80) NOT NULL,
  description VARCHAR(255) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_product_categories_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A plan is the product a customer buys. Its resource columns become the
-- application's CPU and memory limits when an order for it is provisioned.
CREATE TABLE plans (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_id SMALLINT UNSIGNED NOT NULL,
  code VARCHAR(32) NOT NULL,
  name VARCHAR(64) NOT NULL,
  description VARCHAR(255) NOT NULL,
  cpu_millicores INT UNSIGNED NOT NULL,
  memory_mib INT UNSIGNED NOT NULL,
  disk_gib INT UNSIGNED NOT NULL,
  hourly_price_rial BIGINT UNSIGNED NOT NULL,
  monthly_price_rial BIGINT UNSIGNED NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_plans_code (code),
  KEY ix_plans_catalogue (is_active, sort_order),
  CONSTRAINT ck_plans_resources CHECK (cpu_millicores > 0 AND memory_mib > 0),
  CONSTRAINT ck_plans_prices CHECK (hourly_price_rial > 0 AND monthly_price_rial >= hourly_price_rial),
  CONSTRAINT fk_plans_category FOREIGN KEY (category_id) REFERENCES product_categories (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE plan_features (
  plan_id INT UNSIGNED NOT NULL,
  position SMALLINT UNSIGNED NOT NULL,
  feature VARCHAR(160) NOT NULL,
  PRIMARY KEY (plan_id, position),
  CONSTRAINT fk_plan_features_plan FOREIGN KEY (plan_id) REFERENCES plans (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- balance_rial is derived data: it always equals the sum of the owner's
-- wallet_transactions. It is kept on the row, deliberately denormalised, so a
-- charge can lock one row and check one CHECK constraint instead of summing the
-- whole ledger under a lock. The ledger test proves the two never diverge.
CREATE TABLE wallets (
  user_id BIGINT UNSIGNED NOT NULL,
  balance_rial BIGINT NOT NULL DEFAULT 0,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (user_id),
  CONSTRAINT ck_wallets_non_negative CHECK (balance_rial >= 0),
  CONSTRAINT fk_wallets_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The append-only ledger. A row is never updated or deleted; a mistake is
-- corrected by a new adjustment row.
CREATE TABLE wallet_transactions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  kind VARCHAR(16) NOT NULL,
  amount_rial BIGINT NOT NULL,
  balance_after_rial BIGINT NOT NULL,
  reference_type VARCHAR(32) NULL,
  reference_id BIGINT UNSIGNED NULL,
  description VARCHAR(255) NOT NULL,
  idempotency_key VARCHAR(128) NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_wallet_transactions_idempotency (user_id, idempotency_key),
  KEY ix_wallet_transactions_user (user_id, created_at),
  KEY ix_wallet_transactions_kind (kind, created_at),
  CONSTRAINT ck_wallet_transactions_kind CHECK (kind IN ('topup', 'order_charge', 'usage', 'refund', 'adjustment')),
  CONSTRAINT ck_wallet_transactions_amount CHECK (amount_rial <> 0),
  CONSTRAINT ck_wallet_transactions_balance CHECK (balance_after_rial >= 0),
  CONSTRAINT fk_wallet_transactions_wallet FOREIGN KEY (user_id) REFERENCES wallets (user_id),
  CONSTRAINT fk_wallet_transactions_creator FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  status VARCHAR(16) NOT NULL,
  customer_note VARCHAR(500) NULL,
  upfront_rial BIGINT UNSIGNED NOT NULL DEFAULT 0,
  reviewer_id BIGINT UNSIGNED NULL,
  review_reason VARCHAR(500) NULL,
  placed_at DATETIME(6) NOT NULL,
  reviewed_at DATETIME(6) NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  KEY ix_orders_queue (status, placed_at),
  KEY ix_orders_user (user_id, placed_at),
  CONSTRAINT ck_orders_status CHECK (status IN ('pending', 'rejected', 'cancelled', 'provisioning', 'active', 'failed')),
  CONSTRAINT ck_orders_review CHECK (status IN ('pending', 'cancelled') OR reviewed_at IS NOT NULL),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_orders_reviewer FOREIGN KEY (reviewer_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Prices are copied onto the item when the order is placed, so a later price
-- change never alters what a customer agreed to.
CREATE TABLE order_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  plan_id INT UNSIGNED NOT NULL,
  app_name VARCHAR(41) NOT NULL,
  image VARCHAR(512) NOT NULL,
  port SMALLINT UNSIGNED NOT NULL,
  hourly_price_rial BIGINT UNSIGNED NOT NULL,
  monthly_price_rial BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  KEY ix_order_items_order (order_id),
  CONSTRAINT ck_order_items_port CHECK (port > 0),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_plan FOREIGN KEY (plan_id) REFERENCES plans (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The customer's running application. command_id names the deploy command;
-- it is not a foreign key because succeeded commands are pruned from history.
CREATE TABLE projects (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  order_item_id BIGINT UNSIGNED NOT NULL,
  plan_id INT UNSIGNED NOT NULL,
  app_name VARCHAR(41) NOT NULL,
  status VARCHAR(16) NOT NULL,
  server_id VARCHAR(64) NOT NULL,
  command_id CHAR(36) NULL,
  hourly_price_rial BIGINT UNSIGNED NOT NULL,
  monthly_price_rial BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(6) NOT NULL,
  activated_at DATETIME(6) NULL,
  suspended_at DATETIME(6) NULL,
  -- Billing restarts from this instant after a suspension ends, so the hours a
  -- project spent suspended are never charged when it is reactivated.
  billing_resumed_at DATETIME(6) NULL,
  deleted_at DATETIME(6) NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_projects_app_name (app_name),
  UNIQUE KEY uq_projects_order_item (order_item_id),
  KEY ix_projects_user (user_id, status),
  KEY ix_projects_billable (status, activated_at),
  CONSTRAINT ck_projects_status CHECK (status IN ('provisioning', 'active', 'suspended', 'failed', 'deleted')),
  CONSTRAINT fk_projects_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_projects_order_item FOREIGN KEY (order_item_id) REFERENCES order_items (id),
  CONSTRAINT fk_projects_plan FOREIGN KEY (plan_id) REFERENCES plans (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE invoices (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  number VARCHAR(24) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status VARCHAR(16) NOT NULL,
  subtotal_rial BIGINT UNSIGNED NOT NULL,
  tax_rate_bp SMALLINT UNSIGNED NOT NULL,
  tax_rial BIGINT UNSIGNED NOT NULL,
  total_rial BIGINT UNSIGNED NOT NULL,
  issued_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_invoices_number (number),
  UNIQUE KEY uq_invoices_period (user_id, period_start, period_end),
  CONSTRAINT ck_invoices_status CHECK (status IN ('draft', 'issued', 'paid', 'void')),
  CONSTRAINT ck_invoices_period CHECK (period_end >= period_start),
  CONSTRAINT ck_invoices_total CHECK (total_rial = subtotal_rial + tax_rial),
  CONSTRAINT fk_invoices_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE invoice_lines (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  invoice_id BIGINT UNSIGNED NOT NULL,
  project_id BIGINT UNSIGNED NULL,
  description VARCHAR(255) NOT NULL,
  quantity_hours INT UNSIGNED NOT NULL,
  amount_rial BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  KEY ix_invoice_lines_invoice (invoice_id),
  CONSTRAINT fk_invoice_lines_invoice FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE CASCADE,
  CONSTRAINT fk_invoice_lines_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row per project per billed hour. The UNIQUE key is what makes billing
-- idempotent: a billing run that is repeated, or two that overlap, cannot
-- charge the same hour twice.
CREATE TABLE usage_records (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id BIGINT UNSIGNED NOT NULL,
  period_start DATETIME NOT NULL,
  amount_rial BIGINT UNSIGNED NOT NULL,
  wallet_transaction_id BIGINT UNSIGNED NULL,
  invoice_id BIGINT UNSIGNED NULL,
  created_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usage_records_hour (project_id, period_start),
  KEY ix_usage_records_uninvoiced (invoice_id, period_start),
  CONSTRAINT fk_usage_records_project FOREIGN KEY (project_id) REFERENCES projects (id),
  CONSTRAINT fk_usage_records_transaction FOREIGN KEY (wallet_transaction_id) REFERENCES wallet_transactions (id),
  CONSTRAINT fk_usage_records_invoice FOREIGN KEY (invoice_id) REFERENCES invoices (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE support_tickets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  project_id BIGINT UNSIGNED NULL,
  subject VARCHAR(160) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'open',
  priority VARCHAR(8) NOT NULL DEFAULT 'normal',
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  KEY ix_support_tickets_queue (status, updated_at),
  KEY ix_support_tickets_user (user_id, updated_at),
  CONSTRAINT ck_support_tickets_status CHECK (status IN ('open', 'answered', 'closed')),
  CONSTRAINT ck_support_tickets_priority CHECK (priority IN ('low', 'normal', 'high')),
  CONSTRAINT fk_support_tickets_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_support_tickets_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ticket_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ticket_id BIGINT UNSIGNED NOT NULL,
  author_id BIGINT UNSIGNED NOT NULL,
  body TEXT NOT NULL,
  created_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  KEY ix_ticket_messages_ticket (ticket_id, created_at),
  CONSTRAINT fk_ticket_messages_ticket FOREIGN KEY (ticket_id) REFERENCES support_tickets (id) ON DELETE CASCADE,
  CONSTRAINT fk_ticket_messages_author FOREIGN KEY (author_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Reference data: the catalogue a fresh installation starts with. The prices
-- are illustrative and editable from the admin panel.
INSERT INTO product_categories (code, name, description) VALUES
  ('app', 'Application hosting', 'A container application with its own domain, health check and metrics.');

INSERT INTO plans (category_id, code, name, description, cpu_millicores, memory_mib, disk_gib, hourly_price_rial, monthly_price_rial, is_active, sort_order, created_at, updated_at) VALUES
  (1, 'starter', 'Starter', 'A small API, a bot, or a personal site.', 250, 256, 5, 4000, 2700000, TRUE, 10, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
  (1, 'basic', 'Basic', 'A typical web service with steady traffic.', 500, 512, 10, 7500, 5000000, TRUE, 20, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
  (1, 'standard', 'Standard', 'A production service doing real work per request.', 1000, 1024, 20, 13000, 9000000, TRUE, 30, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
  (1, 'plus', 'Plus', 'A heavier runtime or a larger working set.', 2000, 2048, 40, 24000, 16500000, TRUE, 40, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
  (1, 'pro', 'Pro', 'The largest self-service size.', 4000, 4096, 80, 45000, 30000000, TRUE, 50, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6));

INSERT INTO plan_features (plan_id, position, feature) VALUES
  (1, 0, 'HTTPS domain with automatic certificate'), (1, 1, 'Health-checked rolling deploys'), (1, 2, 'Billed per hour, capped monthly'),
  (2, 0, 'HTTPS domain with automatic certificate'), (2, 1, 'Health-checked rolling deploys'), (2, 2, 'Prometheus metrics endpoint'),
  (3, 0, 'HTTPS domain with automatic certificate'), (3, 1, 'Prometheus metrics and tracing'), (3, 2, 'Managed database attachment'),
  (4, 0, 'HTTPS domain with automatic certificate'), (4, 1, 'Prometheus metrics and tracing'), (4, 2, 'Managed database attachment'),
  (5, 0, 'HTTPS domain with automatic certificate'), (5, 1, 'Prometheus metrics and tracing'), (5, 2, 'Priority support');

-- Report views for the admin panel.

CREATE VIEW v_customer_accounts AS
SELECT u.id AS user_id, u.email, u.full_name, u.status, u.created_at,
       COALESCE(w.balance_rial, 0) AS balance_rial,
       (SELECT COUNT(*) FROM projects p WHERE p.user_id = u.id AND p.status IN ('provisioning', 'active', 'suspended')) AS live_projects,
       (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id AND o.status = 'pending') AS pending_orders
FROM users u
LEFT JOIN wallets w ON w.user_id = u.id
WHERE u.role = 'customer';

CREATE VIEW v_order_queue AS
SELECT o.id AS order_id, o.placed_at, u.id AS user_id, u.email, COALESCE(w.balance_rial, 0) AS balance_rial,
       i.app_name, pl.code AS plan_code, pl.name AS plan_name, i.hourly_price_rial, i.monthly_price_rial
FROM orders o
JOIN users u ON u.id = o.user_id
JOIN order_items i ON i.order_id = o.id
JOIN plans pl ON pl.id = i.plan_id
LEFT JOIN wallets w ON w.user_id = o.user_id
WHERE o.status = 'pending';

CREATE VIEW v_revenue_by_month AS
SELECT DATE_FORMAT(t.created_at, '%Y-%m') AS month,
       SUM(CASE WHEN t.kind IN ('order_charge', 'usage') THEN -t.amount_rial ELSE 0 END) AS charged_rial,
       SUM(CASE WHEN t.kind = 'refund' THEN t.amount_rial ELSE 0 END) AS refunded_rial,
       SUM(CASE WHEN t.kind = 'topup' THEN t.amount_rial ELSE 0 END) AS topped_up_rial,
       COUNT(DISTINCT t.user_id) AS paying_customers
FROM wallet_transactions t
GROUP BY DATE_FORMAT(t.created_at, '%Y-%m');
