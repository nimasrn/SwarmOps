Generated from the live schema created by migrations 0001 to 0009. Key: PRI primary, UNI unique, MUL indexed.

## Commerce tables

### `users`

Customer and administrator accounts with bcrypt password hashes.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `id` | `bigint(20) unsigned` | no | PRI | auto_increment |  |
| `email` | `varchar(254)` | no | UNI |  |  |
| `full_name` | `varchar(120)` | no |  |  |  |
| `password_hash` | `varchar(100)` | no |  |  |  |
| `role` | `varchar(16)` | no | MUL |  |  |
| `status` | `varchar(16)` | no |  | 'active' |  |
| `created_at` | `datetime(6)` | no |  |  |  |
| `updated_at` | `datetime(6)` | no |  |  |  |
| `last_login_at` | `datetime(6)` | yes |  |  |  |

**Check constraints:**

- `ck_users_role`: `role in ('customer','admin')`
- `ck_users_status`: `status in ('active','suspended')`

### `user_sessions`

Storefront sessions: token hash, CSRF token, expiry and revocation.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `token_hash` | `char(64)` | no | PRI |  |  |
| `user_id` | `bigint(20) unsigned` | no | MUL |  | `users.id` |
| `csrf_token` | `varchar(64)` | no |  |  |  |
| `created_at` | `datetime(6)` | no |  |  |  |
| `expires_at` | `datetime(6)` | no |  |  |  |
| `revoked_at` | `datetime(6)` | yes |  |  |  |

**Foreign keys:**

- `fk_user_sessions_user` → `users` (On delete CASCADE)

### `product_categories`

Groups of plans shown in the storefront.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `id` | `smallint(5) unsigned` | no | PRI | auto_increment |  |
| `code` | `varchar(32)` | no | UNI |  |  |
| `name` | `varchar(80)` | no |  |  |  |
| `description` | `varchar(255)` | no |  |  |  |

### `plans`

The products: CPU, memory, disk, hourly price and monthly cap.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `id` | `int(10) unsigned` | no | PRI | auto_increment |  |
| `category_id` | `smallint(5) unsigned` | no | MUL |  | `product_categories.id` |
| `code` | `varchar(32)` | no | UNI |  |  |
| `name` | `varchar(64)` | no |  |  |  |
| `description` | `varchar(255)` | no |  |  |  |
| `description_fa` | `varchar(255)` | no |  | '' |  |
| `cpu_millicores` | `int(10) unsigned` | no |  |  |  |
| `memory_mib` | `int(10) unsigned` | no |  |  |  |
| `disk_gib` | `int(10) unsigned` | no |  |  |  |
| `hourly_price_rial` | `bigint(20) unsigned` | no |  |  |  |
| `monthly_price_rial` | `bigint(20) unsigned` | no |  |  |  |
| `is_active` | `tinyint(1)` | no | MUL | 1 |  |
| `sort_order` | `smallint(5) unsigned` | no |  | 0 |  |
| `created_at` | `datetime(6)` | no |  |  |  |
| `updated_at` | `datetime(6)` | no |  |  |  |

**Foreign keys:**

- `fk_plans_category` → `product_categories` (On delete RESTRICT)

**Check constraints:**

- `ck_plans_prices`: `hourly_price_rial > 0 and monthly_price_rial >= hourly_price_rial`
- `ck_plans_resources`: `cpu_millicores > 0 and memory_mib > 0`

### `plan_features`

Marketing features listed for a plan.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `plan_id` | `int(10) unsigned` | no | PRI |  | `plans.id` |
| `locale` | `varchar(8)` | no | PRI | 'en' |  |
| `position` | `smallint(5) unsigned` | no | PRI |  |  |
| `feature` | `varchar(160)` | no |  |  |  |

**Foreign keys:**

- `fk_plan_features_plan` → `plans` (On delete CASCADE)

**Check constraints:**

- `ck_plan_features_locale`: `locale in ('en','fa')`

### `wallets`

One prepaid wallet per user; the cached balance is never negative.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `user_id` | `bigint(20) unsigned` | no | PRI |  | `users.id` |
| `balance_rial` | `bigint(20)` | no |  | 0 |  |
| `updated_at` | `datetime(6)` | no |  |  |  |

**Foreign keys:**

- `fk_wallets_user` → `users` (On delete RESTRICT)

**Check constraints:**

- `ck_wallets_non_negative`: `balance_rial >= 0`

### `wallet_transactions`

The append-only wallet ledger with idempotency keys.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `id` | `bigint(20) unsigned` | no | PRI | auto_increment |  |
| `user_id` | `bigint(20) unsigned` | no | MUL |  | `wallets.user_id` |
| `kind` | `varchar(16)` | no | MUL |  |  |
| `amount_rial` | `bigint(20)` | no |  |  |  |
| `balance_after_rial` | `bigint(20)` | no |  |  |  |
| `reference_type` | `varchar(32)` | yes |  |  |  |
| `reference_id` | `bigint(20) unsigned` | yes |  |  |  |
| `description` | `varchar(255)` | no |  |  |  |
| `idempotency_key` | `varchar(128)` | yes |  |  |  |
| `created_by` | `bigint(20) unsigned` | yes | MUL |  | `users.id` |
| `created_at` | `datetime(6)` | no |  |  |  |

**Foreign keys:**

- `fk_wallet_transactions_creator` → `users` (On delete RESTRICT)
- `fk_wallet_transactions_wallet` → `wallets` (On delete RESTRICT)

**Check constraints:**

- `ck_wallet_transactions_amount`: `amount_rial <> 0`
- `ck_wallet_transactions_balance`: `balance_after_rial >= 0`
- `ck_wallet_transactions_kind`: `kind in ('topup','order_charge','usage','refund','adjustment')`

### `orders`

Customer orders and their review.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `id` | `bigint(20) unsigned` | no | PRI | auto_increment |  |
| `user_id` | `bigint(20) unsigned` | no | MUL |  | `users.id` |
| `status` | `varchar(16)` | no | MUL |  |  |
| `customer_note` | `varchar(500)` | yes |  |  |  |
| `upfront_rial` | `bigint(20) unsigned` | no |  | 0 |  |
| `reviewer_id` | `bigint(20) unsigned` | yes | MUL |  | `users.id` |
| `review_reason` | `varchar(500)` | yes |  |  |  |
| `placed_at` | `datetime(6)` | no |  |  |  |
| `reviewed_at` | `datetime(6)` | yes |  |  |  |
| `updated_at` | `datetime(6)` | no |  |  |  |

**Foreign keys:**

- `fk_orders_reviewer` → `users` (On delete RESTRICT)
- `fk_orders_user` → `users` (On delete RESTRICT)

**Check constraints:**

- `ck_orders_review`: `status in ('pending','cancelled') or reviewed_at is not null`
- `ck_orders_status`: `status in ('pending','rejected','cancelled','provisioning','active','failed')`

### `order_items`

What an order asks for, with the prices copied at the time of ordering.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `id` | `bigint(20) unsigned` | no | PRI | auto_increment |  |
| `order_id` | `bigint(20) unsigned` | no | MUL |  | `orders.id` |
| `plan_id` | `int(10) unsigned` | no | MUL |  | `plans.id` |
| `app_name` | `varchar(41)` | no |  |  |  |
| `image` | `varchar(512)` | no |  |  |  |
| `port` | `smallint(5) unsigned` | no |  |  |  |
| `hourly_price_rial` | `bigint(20) unsigned` | no |  |  |  |
| `monthly_price_rial` | `bigint(20) unsigned` | no |  |  |  |

**Foreign keys:**

- `fk_order_items_order` → `orders` (On delete CASCADE)
- `fk_order_items_plan` → `plans` (On delete RESTRICT)

**Check constraints:**

- `ck_order_items_port`: `port > 0`

### `projects`

Applications created by confirmed orders, with their billing state.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `id` | `bigint(20) unsigned` | no | PRI | auto_increment |  |
| `user_id` | `bigint(20) unsigned` | no | MUL |  | `users.id` |
| `order_item_id` | `bigint(20) unsigned` | no | UNI |  | `order_items.id` |
| `plan_id` | `int(10) unsigned` | no | MUL |  | `plans.id` |
| `app_name` | `varchar(41)` | no | UNI |  |  |
| `status` | `varchar(16)` | no | MUL |  |  |
| `server_id` | `varchar(64)` | no |  |  |  |
| `command_id` | `char(36)` | yes |  |  |  |
| `hourly_price_rial` | `bigint(20) unsigned` | no |  |  |  |
| `monthly_price_rial` | `bigint(20) unsigned` | no |  |  |  |
| `created_at` | `datetime(6)` | no |  |  |  |
| `activated_at` | `datetime(6)` | yes |  |  |  |
| `suspended_at` | `datetime(6)` | yes |  |  |  |
| `billing_resumed_at` | `datetime(6)` | yes |  |  |  |
| `deleted_at` | `datetime(6)` | yes |  |  |  |
| `updated_at` | `datetime(6)` | no |  |  |  |

**Foreign keys:**

- `fk_projects_order_item` → `order_items` (On delete RESTRICT)
- `fk_projects_plan` → `plans` (On delete RESTRICT)
- `fk_projects_user` → `users` (On delete RESTRICT)

**Check constraints:**

- `ck_projects_status`: `status in ('provisioning','active','suspended','failed','deleted')`

### `usage_records`

One charged hour of one project; UNIQUE(project, hour) prevents double billing.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `id` | `bigint(20) unsigned` | no | PRI | auto_increment |  |
| `project_id` | `bigint(20) unsigned` | no | MUL |  | `projects.id` |
| `period_start` | `datetime` | no |  |  |  |
| `amount_rial` | `bigint(20) unsigned` | no |  |  |  |
| `wallet_transaction_id` | `bigint(20) unsigned` | yes | MUL |  | `wallet_transactions.id` |
| `invoice_id` | `bigint(20) unsigned` | yes | MUL |  | `invoices.id` |
| `created_at` | `datetime(6)` | no |  |  |  |

**Foreign keys:**

- `fk_usage_records_invoice` → `invoices` (On delete RESTRICT)
- `fk_usage_records_project` → `projects` (On delete RESTRICT)
- `fk_usage_records_transaction` → `wallet_transactions` (On delete RESTRICT)

### `invoices`

Monthly, tax-inclusive invoices; total equals subtotal plus tax.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `id` | `bigint(20) unsigned` | no | PRI | auto_increment |  |
| `number` | `varchar(24)` | no | UNI |  |  |
| `user_id` | `bigint(20) unsigned` | no | MUL |  | `users.id` |
| `period_start` | `date` | no |  |  |  |
| `period_end` | `date` | no |  |  |  |
| `status` | `varchar(16)` | no |  |  |  |
| `subtotal_rial` | `bigint(20) unsigned` | no |  |  |  |
| `tax_rate_bp` | `smallint(5) unsigned` | no |  |  |  |
| `tax_rial` | `bigint(20) unsigned` | no |  |  |  |
| `total_rial` | `bigint(20) unsigned` | no |  |  |  |
| `issued_at` | `datetime(6)` | yes |  |  |  |
| `created_at` | `datetime(6)` | no |  |  |  |

**Foreign keys:**

- `fk_invoices_user` → `users` (On delete RESTRICT)

**Check constraints:**

- `ck_invoices_period`: `period_end >= period_start`
- `ck_invoices_status`: `status in ('draft','issued','paid','void')`
- `ck_invoices_total`: `total_rial = subtotal_rial + tax_rial`

### `invoice_lines`

One line per project per invoice: hours and amount.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `id` | `bigint(20) unsigned` | no | PRI | auto_increment |  |
| `invoice_id` | `bigint(20) unsigned` | no | MUL |  | `invoices.id` |
| `project_id` | `bigint(20) unsigned` | yes | MUL |  | `projects.id` |
| `description` | `varchar(255)` | no |  |  |  |
| `quantity_hours` | `int(10) unsigned` | no |  |  |  |
| `amount_rial` | `bigint(20) unsigned` | no |  |  |  |

**Foreign keys:**

- `fk_invoice_lines_invoice` → `invoices` (On delete CASCADE)
- `fk_invoice_lines_project` → `projects` (On delete SET NULL)

### `support_tickets`

Customer support conversations.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `id` | `bigint(20) unsigned` | no | PRI | auto_increment |  |
| `user_id` | `bigint(20) unsigned` | no | MUL |  | `users.id` |
| `project_id` | `bigint(20) unsigned` | yes | MUL |  | `projects.id` |
| `subject` | `varchar(160)` | no |  |  |  |
| `status` | `varchar(16)` | no | MUL | 'open' |  |
| `priority` | `varchar(8)` | no |  | 'normal' |  |
| `created_at` | `datetime(6)` | no |  |  |  |
| `updated_at` | `datetime(6)` | no |  |  |  |

**Foreign keys:**

- `fk_support_tickets_project` → `projects` (On delete SET NULL)
- `fk_support_tickets_user` → `users` (On delete RESTRICT)

**Check constraints:**

- `ck_support_tickets_priority`: `priority in ('low','normal','high')`
- `ck_support_tickets_status`: `status in ('open','answered','closed')`

### `ticket_messages`

Messages within a support ticket.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `id` | `bigint(20) unsigned` | no | PRI | auto_increment |  |
| `ticket_id` | `bigint(20) unsigned` | no | MUL |  | `support_tickets.id` |
| `author_id` | `bigint(20) unsigned` | no | MUL |  | `users.id` |
| `body` | `text` | no |  |  |  |
| `created_at` | `datetime(6)` | no |  |  |  |

**Foreign keys:**

- `fk_ticket_messages_author` → `users` (On delete RESTRICT)
- `fk_ticket_messages_ticket` → `support_tickets` (On delete CASCADE)

## Platform tables

### `agents`

Enrolled pull agents and their certificate serials.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `id` | `varchar(64)` | no | PRI |  |  |
| `name` | `varchar(96)` | no |  |  |  |
| `certificate_expires_at` | `datetime(6)` | no |  |  |  |

### `agent_ca`

The single certificate authority that signs machine-agent client certificates; its key is sealed.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `id` | `tinyint(3) unsigned` | no | PRI |  |  |
| `certificate_pem` | `text` | no |  |  |  |
| `private_key_sealed` | `varbinary(4096)` | no |  |  |  |
| `created_at` | `datetime(6)` | no |  |  |  |

**Check constraints:**

- `ck_agent_ca_singleton`: `id = 1`

### `agent_claims`

Install-first claim codes an agent presents before an administrator approves it.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `id` | `varchar(64)` | no | PRI |  |  |
| `name` | `varchar(96)` | no |  |  |  |
| `csr` | `text` | no |  |  |  |
| `code_digest` | `char(64)` | no | UNI |  |  |
| `secret_digest` | `char(64)` | no |  |  |  |
| `expires_at` | `datetime(6)` | no | MUL |  |  |
| `enrollment_agent_id` | `varchar(64)` | yes |  |  |  |
| `enrollment_authority_epoch` | `bigint(20) unsigned` | yes |  |  |  |
| `enrollment_certificate` | `text` | yes |  |  |  |
| `enrollment_expires_at` | `datetime(6)` | yes |  |  |  |
| `position` | `int(10) unsigned` | no |  |  |  |

### `agent_enrollment_tokens`

One-time enrollment tokens (stored as hashes) for dashboard-generated install commands.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `code_digest` | `char(64)` | no | PRI |  |  |
| `name` | `varchar(96)` | yes |  |  |  |
| `expires_at` | `datetime(6)` | no | MUL |  |  |

### `applications`

Applications SwarmOps renders and deploys, with their image, port and resource limits.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `name` | `varchar(41)` | no | PRI |  |  |
| `image` | `varchar(512)` | no |  |  |  |
| `port` | `smallint(5) unsigned` | no |  |  |  |
| `replicas` | `int(10) unsigned` | no |  |  |  |
| `cpus` | `double` | no |  |  |  |
| `memory_mib` | `bigint(20)` | no |  |  |  |
| `plan` | `varchar(32)` | yes |  |  |  |
| `domain` | `varchar(253)` | yes | UNI |  |  |
| `resolver` | `varchar(64)` | yes |  |  |  |
| `backend` | `varchar(41)` | yes |  |  |  |
| `database_delivery` | `varchar(32)` | yes |  |  |  |
| `health_path` | `varchar(201)` | yes |  |  |  |
| `metrics` | `tinyint(1)` | no |  | 0 |  |
| `metrics_path` | `varchar(201)` | yes |  |  |  |
| `metrics_port` | `smallint(5) unsigned` | yes |  |  |  |
| `tracing` | `tinyint(1)` | no |  | 0 |  |
| `created_at` | `datetime(6)` | no |  |  |  |
| `updated_at` | `datetime(6)` | no |  |  |  |

**Check constraints:**

- `ck_applications_resources`: `cpus > 0 and memory_mib > 0 and port > 0`

### `application_databases`

Managed database engines an application depends on.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `application_name` | `varchar(41)` | no | PRI |  | `applications.name` |
| `engine` | `varchar(16)` | no | PRI |  |  |
| `position` | `smallint(5) unsigned` | no |  |  |  |

**Foreign keys:**

- `fk_application_databases_application` → `applications` (On delete CASCADE)

### `application_database_credentials`

Sealed credentials an application uses for each managed database engine.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `application_name` | `varchar(41)` | no | PRI |  |  |
| `engine` | `varchar(16)` | no | PRI |  |  |
| `uri_sealed` | `varbinary(4096)` | no |  |  |  |
| `updated_at` | `datetime(6)` | no |  |  |  |

### `application_database_env`

Environment variable names through which database credentials reach an application.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `application_name` | `varchar(41)` | no | PRI |  | `applications.name` |
| `engine` | `varchar(16)` | no | PRI |  |  |
| `position` | `smallint(5) unsigned` | no | PRI |  |  |
| `env_name` | `varchar(64)` | no |  |  |  |

**Foreign keys:**

- `fk_application_database_env_application` → `applications` (On delete CASCADE)

### `application_env`

An application's environment variables; values are sealed.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `application_name` | `varchar(41)` | no | PRI |  | `applications.name` |
| `env_key` | `varchar(64)` | no | PRI |  |  |
| `env_value_sealed` | `varbinary(8192)` | no |  |  |  |

**Foreign keys:**

- `fk_application_env_application` → `applications` (On delete CASCADE)

### `application_health_command`

The ordered arguments of an application's custom health command.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `application_name` | `varchar(41)` | no | PRI |  | `applications.name` |
| `position` | `smallint(5) unsigned` | no | PRI |  |  |
| `argument` | `varchar(1024)` | no |  |  |  |

**Foreign keys:**

- `fk_application_health_command_application` → `applications` (On delete CASCADE)

### `application_outcomes`

The latest start outcome of each application.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `application_name` | `varchar(41)` | no | PRI |  | `applications.name` |
| `started` | `tinyint(1)` | no |  | 0 |  |
| `started_at` | `datetime(6)` | yes |  |  |  |
| `last_attempt_at` | `datetime(6)` | yes |  |  |  |
| `last_command_id` | `varchar(64)` | yes |  |  |  |
| `failure_summary` | `text` | yes |  |  |  |

**Foreign keys:**

- `fk_application_outcomes_application` → `applications` (On delete CASCADE)

### `audit_events`

Append-only record of every operator and customer action.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `seq` | `bigint(20) unsigned` | no | PRI | auto_increment |  |
| `id` | `char(32)` | no | UNI |  |  |
| `occurred_at` | `datetime(6)` | no | MUL |  |  |
| `actor` | `varchar(190)` | no | MUL |  |  |
| `action` | `varchar(190)` | no |  |  |  |
| `target` | `varchar(512)` | no |  |  |  |
| `outcome` | `varchar(64)` | no |  |  |  |
| `request_id` | `varchar(128)` | yes |  |  |  |

### `audit_event_details`

Key-value details of an audit event.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `event_seq` | `bigint(20) unsigned` | no | PRI |  | `audit_events.seq` |
| `detail_key` | `varchar(190)` | no | PRI |  |  |
| `detail_value` | `text` | no |  |  |  |

**Foreign keys:**

- `fk_audit_event_details_event` → `audit_events` (On delete CASCADE)

### `commands`

The durable command queue: action, target, state, attempts, leases and failure details.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `seq` | `bigint(20) unsigned` | no | UNI | auto_increment |  |
| `id` | `char(36)` | no | PRI |  |  |
| `action` | `varchar(64)` | no | MUL |  |  |
| `actor` | `varchar(190)` | no | MUL |  |  |
| `server_id` | `varchar(64)` | no | MUL |  |  |
| `node_id` | `varchar(64)` | no |  | '' |  |
| `cluster_id` | `varchar(64)` | no |  |  |  |
| `target` | `varchar(512)` | no |  |  |  |
| `state` | `varchar(20)` | no | MUL |  |  |
| `attempt` | `int(10) unsigned` | no |  | 0 |  |
| `max_attempts` | `tinyint(3) unsigned` | no |  |  |  |
| `auto_retry` | `tinyint(1)` | no |  |  |  |
| `authority_epoch` | `bigint(20) unsigned` | no |  |  |  |
| `request_id` | `varchar(128)` | yes |  |  |  |
| `idempotency_key` | `varchar(128)` | no |  |  |  |
| `payload_digest` | `char(64)` | yes |  |  |  |
| `has_artifact` | `tinyint(1)` | no |  | 0 |  |
| `lease_id` | `varchar(64)` | yes |  |  |  |
| `lease_expires_at` | `datetime(6)` | yes |  |  |  |
| `last_attempt_at` | `datetime(6)` | yes |  |  |  |
| `next_attempt_at` | `datetime(6)` | yes |  |  |  |
| `last_error` | `text` | yes |  |  |  |
| `failure_code` | `varchar(64)` | yes |  |  |  |
| `failure_summary` | `text` | yes |  |  |  |
| `recovery_hint` | `text` | yes |  |  |  |
| `created_at` | `datetime(6)` | no |  |  |  |
| `updated_at` | `datetime(6)` | no | MUL |  |  |

**Check constraints:**

- `ck_commands_attempts`: `max_attempts between 1 and 8`
- `ck_commands_epoch`: `authority_epoch >= 1`
- `ck_commands_state`: `state in ('uploading','queued','leased','preparing','running','retry_scheduled','succeeded','failed','needs_attention','superseded','cancelled')`

### `command_events`

Timeline of state changes and evidence for each command.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `command_id` | `char(36)` | no | PRI |  | `commands.id` |
| `sequence` | `int(10) unsigned` | no | PRI |  |  |
| `state` | `varchar(20)` | no |  |  |  |
| `evidence` | `varchar(1024)` | yes |  |  |  |
| `occurred_at` | `datetime(6)` | no |  |  |  |

**Foreign keys:**

- `fk_command_events_command` → `commands` (On delete CASCADE)

### `command_locks`

Named locks serialising commands that must not run concurrently.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `lock_name` | `varchar(80)` | no | PRI |  |  |

### `command_outputs`

Sealed output streams captured from a command's execution.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `command_id` | `char(36)` | no | PRI |  | `commands.id` |
| `output_sealed` | `mediumblob` | no |  |  |  |
| `retained_at` | `datetime(6)` | no |  |  |  |

**Foreign keys:**

- `fk_command_outputs_command` → `commands` (On delete CASCADE)

### `command_payloads`

Sealed input payload of a command.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `command_id` | `char(36)` | no | PRI |  | `commands.id` |
| `payload_sealed` | `mediumblob` | no |  |  |  |

**Foreign keys:**

- `fk_command_payloads_command` → `commands` (On delete CASCADE)

### `core_authority`

The single row holding the authority epoch and the active core.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `id` | `tinyint(3) unsigned` | no | PRI |  |  |
| `active_id` | `varchar(64)` | yes |  |  |  |
| `authority_epoch` | `bigint(20) unsigned` | no |  |  |  |
| `updated_at` | `datetime(6)` | no |  |  |  |

**Check constraints:**

- `ck_core_authority_epoch`: `authority_epoch >= 1`
- `ck_core_authority_singleton`: `id = 1`

### `core_handoffs`

Planned movements of authority between core members.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `id` | `tinyint(3) unsigned` | no | PRI |  |  |
| `from_id` | `varchar(64)` | no | MUL |  | `core_members.id` |
| `to_id` | `varchar(64)` | no | MUL |  | `core_members.id` |
| `state` | `varchar(16)` | no |  |  |  |
| `prepared_at` | `datetime(6)` | no |  |  |  |
| `fenced_at` | `datetime(6)` | yes |  |  |  |

**Foreign keys:**

- `fk_core_handoffs_from` → `core_members` (On delete RESTRICT)
- `fk_core_handoffs_to` → `core_members` (On delete RESTRICT)

**Check constraints:**

- `ck_core_handoffs_distinct`: `from_id <> to_id`
- `ck_core_handoffs_fenced_time`: `state <> 'fenced' or fenced_at is not null`
- `ck_core_handoffs_singleton`: `id = 1`
- `ck_core_handoffs_state`: `state in ('prepared','fenced')`

### `core_members`

Known core instances and their roles.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `id` | `varchar(64)` | no | PRI |  |  |
| `name` | `varchar(96)` | no |  |  |  |
| `endpoint` | `varchar(512)` | no |  | '' |  |
| `role` | `varchar(16)` | no |  |  |  |
| `replica_state` | `varchar(32)` | no |  |  |  |
| `agent_server_id` | `varchar(64)` | yes |  |  |  |
| `last_checkpoint_at` | `datetime(6)` | yes |  |  |  |
| `position` | `smallint(5) unsigned` | no |  |  |  |

**Check constraints:**

- `ck_core_members_replica_state`: `replica_state in ('awaiting_restore','verified')`
- `ck_core_members_role`: `role in ('active','standby')`

### `database_credentials`

Sealed administrative credentials of managed database engines.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `engine` | `varchar(16)` | no | PRI |  |  |
| `uri_sealed` | `varbinary(4096)` | no |  |  |  |
| `updated_at` | `datetime(6)` | no |  |  |  |

### `dependency_bindings`

Declared network dependencies between routed services.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `cluster_id` | `varchar(64)` | no | PRI |  | `routing_clusters.cluster_id` |
| `caller_service` | `varchar(128)` | no | PRI |  |  |
| `target_route` | `varchar(64)` | no | PRI |  |  |
| `name` | `varchar(64)` | no | PRI | '' |  |
| `delivery` | `varchar(32)` | no |  |  |  |
| `version` | `int(11)` | no |  |  |  |

**Foreign keys:**

- `fk_dependency_bindings_cluster` → `routing_clusters` (On delete CASCADE)

### `dns_credential_versions`

Versions of DNS provider credentials; secrets are sealed.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `cluster_id` | `varchar(64)` | no | PRI |  | `routing_clusters.cluster_id` |
| `credential_id` | `varchar(64)` | no | PRI |  |  |
| `version` | `int(10) unsigned` | no | PRI |  |  |
| `name` | `varchar(96)` | no |  |  |  |
| `provider` | `varchar(32)` | no |  |  |  |
| `account_id` | `varchar(128)` | yes |  |  |  |
| `email` | `varchar(254)` | yes |  |  |  |
| `secret_name` | `varchar(128)` | no |  |  |  |
| `state` | `varchar(16)` | no |  |  |  |
| `created_at` | `datetime(6)` | no |  |  |  |
| `validated_at` | `datetime(6)` | yes |  |  |  |
| `secret_sealed` | `varbinary(8192)` | yes |  |  |  |

**Foreign keys:**

- `fk_dns_credential_versions_cluster` → `routing_clusters` (On delete CASCADE)

**Check constraints:**

- `ck_dns_credential_versions_secret`: `state = 'removed' or secret_sealed is not null`
- `ck_dns_credential_versions_state`: `state in ('sealed','validated','removed')`

### `dns_records`

DNS records SwarmOps manages at providers.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `cluster_id` | `varchar(64)` | no | PRI |  | `routing_clusters.cluster_id` |
| `id` | `varchar(64)` | no | PRI |  |  |
| `zone` | `varchar(253)` | no |  |  |  |
| `name` | `varchar(253)` | no |  |  |  |
| `type` | `varchar(8)` | no |  |  |  |
| `content` | `varchar(512)` | no |  |  |  |
| `ttl` | `int(10) unsigned` | no |  |  |  |
| `proxied` | `tinyint(1)` | no |  |  |  |
| `managed` | `tinyint(1)` | no |  |  |  |
| `adopted` | `tinyint(1)` | no |  |  |  |
| `credential_id` | `varchar(64)` | no |  |  |  |
| `provider_record_id` | `varchar(128)` | yes |  |  |  |
| `version` | `int(11)` | no |  |  |  |

**Foreign keys:**

- `fk_dns_records_cluster` → `routing_clusters` (On delete CASCADE)

### `routes`

Declared routes: protocol, scope, TLS, target port and health check.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `cluster_id` | `varchar(64)` | no | PRI |  | `routing_clusters.cluster_id` |
| `route_key` | `varchar(64)` | no | PRI |  |  |
| `service_key` | `varchar(128)` | no |  |  |  |
| `protocol` | `varchar(8)` | no |  |  |  |
| `scope` | `varchar(16)` | no |  |  |  |
| `tls_mode` | `varchar(16)` | no |  |  |  |
| `listen_port` | `smallint(5) unsigned` | yes |  |  |  |
| `target_port` | `smallint(5) unsigned` | no |  |  |  |
| `path_prefix` | `varchar(256)` | yes |  |  |  |
| `health_kind` | `varchar(32)` | no |  | '' |  |
| `health_path` | `varchar(256)` | yes |  |  |  |
| `health_timeout_seconds` | `smallint(5) unsigned` | no |  | 0 |  |
| `dns_reference` | `varchar(64)` | yes |  |  |  |
| `resolver` | `varchar(64)` | yes |  |  |  |
| `enabled` | `tinyint(1)` | no |  |  |  |
| `managed` | `tinyint(1)` | no |  |  |  |
| `metrics` | `tinyint(1)` | no |  |  |  |
| `access_logs` | `tinyint(1)` | no |  |  |  |
| `public_allow` | `tinyint(1)` | no |  |  |  |
| `is_sensitive` | `tinyint(1)` | no |  |  |  |
| `version` | `int(11)` | no |  |  |  |

**Foreign keys:**

- `fk_routes_cluster` → `routing_clusters` (On delete CASCADE)

**Check constraints:**

- `ck_routes_protocol`: `protocol in ('http','tcp','udp')`

### `route_certificates`

Certificates observed on the gateway.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `cluster_id` | `varchar(64)` | no | PRI |  | `routes.cluster_id` |
| `route_key` | `varchar(64)` | no | PRI |  | `routes.route_key` |
| `state` | `varchar(32)` | no |  |  |  |
| `issuer` | `varchar(256)` | yes |  |  |  |
| `fingerprint` | `varchar(128)` | yes |  |  |  |
| `resolver` | `varchar(64)` | no |  | '' |  |
| `handshake_valid` | `tinyint(1)` | no |  |  |  |
| `failure_summary` | `text` | yes |  |  |  |
| `last_attempt` | `datetime(6)` | yes |  |  |  |
| `not_before` | `datetime(6)` | yes |  |  |  |
| `not_after` | `datetime(6)` | yes | MUL |  |  |
| `version` | `int(11)` | no |  |  |  |

**Foreign keys:**

- `fk_route_certificates_route` → `routes` (On delete CASCADE)

### `route_certificate_domains`

Domains covered by a gateway certificate.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `cluster_id` | `varchar(64)` | no | PRI |  | `route_certificates.cluster_id` |
| `route_key` | `varchar(64)` | no | PRI |  | `route_certificates.route_key` |
| `position` | `smallint(5) unsigned` | no | PRI |  |  |
| `domain` | `varchar(253)` | no |  |  |  |

**Foreign keys:**

- `fk_route_certificate_domains_certificate` → `route_certificates` (On delete CASCADE)

### `route_hosts`

Host names and aliases of a route.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `cluster_id` | `varchar(64)` | no | PRI |  | `routes.cluster_id` |
| `route_key` | `varchar(64)` | no | PRI |  | `routes.route_key` |
| `kind` | `varchar(4)` | no | PRI |  |  |
| `position` | `smallint(5) unsigned` | no | PRI |  |  |
| `hostname` | `varchar(253)` | no |  |  |  |

**Foreign keys:**

- `fk_route_hosts_route` → `routes` (On delete CASCADE)

**Check constraints:**

- `ck_route_hosts_kind`: `kind in ('host','sni')`

### `route_runtime`

The gateway's observed runtime state of a route.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `cluster_id` | `varchar(64)` | no | PRI |  | `routing_clusters.cluster_id` |
| `route_key` | `varchar(64)` | no | PRI |  |  |
| `protocol` | `varchar(8)` | no |  |  |  |
| `router` | `varchar(256)` | no |  | '' |  |
| `service` | `varchar(256)` | no |  | '' |  |
| `state` | `varchar(32)` | no |  | '' |  |
| `observed_at` | `datetime(6)` | no |  |  |  |
| `version` | `int(11)` | no |  |  |  |

**Foreign keys:**

- `fk_route_runtime_cluster` → `routing_clusters` (On delete CASCADE)

### `route_runtime_entry_points`

Entry points a route is observed on.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `cluster_id` | `varchar(64)` | no | PRI |  | `route_runtime.cluster_id` |
| `route_key` | `varchar(64)` | no | PRI |  | `route_runtime.route_key` |
| `position` | `smallint(5) unsigned` | no | PRI |  |  |
| `entry_point` | `varchar(64)` | no |  |  |  |

**Foreign keys:**

- `fk_route_runtime_entry_points_runtime` → `route_runtime` (On delete CASCADE)

### `route_runtime_errors`

Errors the gateway reports for a route.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `cluster_id` | `varchar(64)` | no | PRI |  | `route_runtime.cluster_id` |
| `route_key` | `varchar(64)` | no | PRI |  | `route_runtime.route_key` |
| `position` | `smallint(5) unsigned` | no | PRI |  |  |
| `message` | `varchar(256)` | no |  |  |  |

**Foreign keys:**

- `fk_route_runtime_errors_runtime` → `route_runtime` (On delete CASCADE)

### `routing_clusters`

Per-cluster gateway settings and cutover plans (JSON documents).

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `cluster_id` | `varchar(64)` | no | PRI |  |  |
| `settings_json` | `longtext` | no |  |  |  |
| `cutover_json` | `longtext` | yes |  |  |  |
| `cutover_rollback_json` | `longtext` | yes |  |  |  |
| `updated_at` | `datetime(6)` | no |  |  |  |

**Check constraints:**

- `ck_routing_clusters_settings`: `json_valid(settings_json)`
- `cutover_json`: `json_valid(cutover_json)`
- `cutover_rollback_json`: `json_valid(cutover_rollback_json)`
- `settings_json`: `json_valid(settings_json)`

### `routing_domains`

Domains a cluster may route.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `cluster_id` | `varchar(64)` | no | PRI |  | `routing_clusters.cluster_id` |
| `zone` | `varchar(253)` | no | PRI |  |  |
| `note` | `varchar(512)` | yes |  |  |  |
| `created_at` | `datetime(6)` | yes |  |  |  |
| `version` | `int(11)` | no |  |  |  |

**Foreign keys:**

- `fk_routing_domains_cluster` → `routing_clusters` (On delete CASCADE)

### `schema_migrations`

Applied schema migrations with their checksums.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `version` | `int(10) unsigned` | no | PRI |  |  |
| `name` | `varchar(200)` | no |  |  |  |
| `checksum` | `char(64)` | no |  |  |  |
| `applied_at` | `datetime(6)` | no |  |  |  |

### `servers`

Saved servers, their connection details and last observed agent and Swarm health.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `id` | `varchar(64)` | no | PRI |  |  |
| `name` | `varchar(96)` | no | MUL |  |  |
| `host` | `varchar(253)` | no |  |  |  |
| `port` | `smallint(5) unsigned` | no |  | 0 |  |
| `username` | `varchar(190)` | no |  | '' |  |
| `authentication` | `varchar(32)` | no |  |  |  |
| `connection_type` | `varchar(32)` | yes |  |  |  |
| `api_url` | `varchar(512)` | yes |  |  |  |
| `host_key_fingerprint` | `varchar(128)` | no |  | '' |  |
| `tls_certificate_fingerprint` | `varchar(128)` | yes |  |  |  |
| `docker_available` | `tinyint(1)` | no |  | 0 |  |
| `docker_version` | `varchar(64)` | yes |  |  |  |
| `swarm_control_available` | `tinyint(1)` | no |  | 0 |  |
| `swarm_state` | `varchar(32)` | yes |  |  |  |
| `last_connected_at` | `datetime(6)` | yes |  |  |  |
| `agent_version` | `varchar(64)` | yes |  |  |  |
| `agent_checked_at` | `datetime(6)` | yes |  |  |  |
| `agent_detail` | `text` | yes |  |  |  |
| `agent_last_failure_at` | `datetime(6)` | yes |  |  |  |
| `agent_last_reachable_at` | `datetime(6)` | yes |  |  |  |
| `agent_protocol_version` | `int(10) unsigned` | no |  | 0 |  |
| `agent_state` | `varchar(16)` | yes |  |  |  |
| `agent_summary` | `varchar(1024)` | yes |  |  |  |
| `agent_uptime_seconds` | `bigint(20) unsigned` | no |  | 0 |  |
| `update_automatic` | `tinyint(1)` | no |  | 0 |  |
| `update_checked_at` | `datetime(6)` | yes |  |  |  |
| `update_last_updated_at` | `datetime(6)` | yes |  |  |  |
| `update_requested_at` | `datetime(6)` | yes |  |  |  |
| `update_revision` | `varchar(128)` | yes |  |  |  |
| `update_state` | `varchar(32)` | yes |  |  |  |
| `update_version` | `varchar(64)` | yes |  |  |  |
| `updated_at` | `datetime(6)` | no |  |  |  |

**Check constraints:**

- `ck_servers_agent_state`: `agent_state is null or agent_state in ('healthy','degraded','unknown','unhealthy')`

### `server_agent_events`

History of machine-agent health observations per server.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `server_id` | `varchar(64)` | no | PRI |  | `servers.id` |
| `position` | `smallint(5) unsigned` | no | PRI |  |  |
| `code` | `varchar(64)` | no |  |  |  |
| `level` | `varchar(16)` | no |  |  |  |
| `message` | `text` | no |  |  |  |
| `occurred_at` | `datetime(6)` | no |  |  |  |
| `source` | `varchar(32)` | no |  |  |  |

**Foreign keys:**

- `fk_server_agent_events_server` → `servers` (On delete CASCADE)

### `server_keys`

Sealed SSH or API keys of saved servers.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `server_id` | `varchar(64)` | no | PRI |  | `servers.id` |
| `api_key_sealed` | `varbinary(1024)` | no |  |  |  |
| `updated_at` | `datetime(6)` | no |  |  |  |

**Foreign keys:**

- `fk_server_keys_server` → `servers` (On delete CASCADE)

### `service_route_declarations`

How each service participates in routing.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `cluster_id` | `varchar(64)` | no | PRI |  | `routing_clusters.cluster_id` |
| `service_key` | `varchar(128)` | no | PRI |  |  |
| `role` | `varchar(32)` | no |  |  |  |
| `reason` | `varchar(512)` | yes |  |  |  |
| `version` | `int(11)` | no |  |  |  |

**Foreign keys:**

- `fk_service_route_declarations_cluster` → `routing_clusters` (On delete CASCADE)

### `source_connections`

Git provider connections; tokens are sealed.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `id` | `char(32)` | no | PRI |  |  |
| `kind` | `varchar(32)` | no |  |  |  |
| `name` | `varchar(190)` | no | MUL |  |  |
| `base_url` | `varchar(512)` | no |  |  |  |
| `account` | `varchar(190)` | yes |  |  |  |
| `token_sealed` | `varbinary(8192)` | no |  |  |  |
| `created_at` | `datetime(6)` | no |  |  |  |
| `updated_at` | `datetime(6)` | no |  |  |  |

### `source_private_hosts`

Private Git hosts allowed for source deployments.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `host` | `varchar(253)` | no | PRI |  |  |
| `position` | `smallint(5) unsigned` | no | UNI |  |  |

### `source_settings`

The single row of source-to-deploy settings.

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `id` | `tinyint(3) unsigned` | no | PRI |  |  |
| `enabled` | `tinyint(1)` | no |  |  |  |
| `build_enabled` | `tinyint(1)` | no |  |  |  |
| `image_prefix` | `varchar(255)` | no |  | '' |  |
| `registry_server` | `varchar(253)` | no |  | '' |  |
| `registry_username` | `varchar(190)` | no |  | '' |  |
| `registry_password_sealed` | `varbinary(4096)` | yes |  |  |  |
| `updated_at` | `datetime(6)` | no |  |  |  |

**Check constraints:**

- `ck_source_settings_build_requires_enabled`: `build_enabled = 0 or enabled = 1`
- `ck_source_settings_singleton`: `id = 1`

