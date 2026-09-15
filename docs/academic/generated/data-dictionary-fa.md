این بخش از طرح‌واره‌ی واقعی ساخته‌شده با مهاجرت‌های 0001 تا 0009 تولید شده است. کلید: PRI اصلی، UNI یکتا، MUL نمایه‌شده.

## جدول‌های تجارت

### `users`

حساب‌های مشتری و مدیر با درهم‌سازی bcrypt گذرواژه.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `id` | `bigint(20) unsigned` | خیر | PRI | auto_increment |  |
| `email` | `varchar(254)` | خیر | UNI |  |  |
| `full_name` | `varchar(120)` | خیر |  |  |  |
| `password_hash` | `varchar(100)` | خیر |  |  |  |
| `role` | `varchar(16)` | خیر | MUL |  |  |
| `status` | `varchar(16)` | خیر |  | 'active' |  |
| `created_at` | `datetime(6)` | خیر |  |  |  |
| `updated_at` | `datetime(6)` | خیر |  |  |  |
| `last_login_at` | `datetime(6)` | بله |  |  |  |

**قیدهای CHECK:**

- `ck_users_role`: `role in ('customer','admin')`
- `ck_users_status`: `status in ('active','suspended')`

### `user_sessions`

نشست‌های فروشگاه: درهم‌سازی توکن، توکن CSRF، انقضا و ابطال.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `token_hash` | `char(64)` | خیر | PRI |  |  |
| `user_id` | `bigint(20) unsigned` | خیر | MUL |  | `users.id` |
| `csrf_token` | `varchar(64)` | خیر |  |  |  |
| `created_at` | `datetime(6)` | خیر |  |  |  |
| `expires_at` | `datetime(6)` | خیر |  |  |  |
| `revoked_at` | `datetime(6)` | بله |  |  |  |

**کلیدهای خارجی:**

- `fk_user_sessions_user` → `users` (هنگام حذف CASCADE)

### `product_categories`

گروه‌های پلن که در فروشگاه نمایش داده می‌شوند.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `id` | `smallint(5) unsigned` | خیر | PRI | auto_increment |  |
| `code` | `varchar(32)` | خیر | UNI |  |  |
| `name` | `varchar(80)` | خیر |  |  |  |
| `description` | `varchar(255)` | خیر |  |  |  |

### `plans`

محصولات: پردازنده، حافظه، دیسک، قیمت ساعتی و سقف ماهانه، با توضیح انگلیسی و فارسی.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `id` | `int(10) unsigned` | خیر | PRI | auto_increment |  |
| `category_id` | `smallint(5) unsigned` | خیر | MUL |  | `product_categories.id` |
| `code` | `varchar(32)` | خیر | UNI |  |  |
| `name` | `varchar(64)` | خیر |  |  |  |
| `description` | `varchar(255)` | خیر |  |  |  |
| `description_fa` | `varchar(255)` | خیر |  | '' |  |
| `cpu_millicores` | `int(10) unsigned` | خیر |  |  |  |
| `memory_mib` | `int(10) unsigned` | خیر |  |  |  |
| `disk_gib` | `int(10) unsigned` | خیر |  |  |  |
| `hourly_price_rial` | `bigint(20) unsigned` | خیر |  |  |  |
| `monthly_price_rial` | `bigint(20) unsigned` | خیر |  |  |  |
| `is_active` | `tinyint(1)` | خیر | MUL | 1 |  |
| `sort_order` | `smallint(5) unsigned` | خیر |  | 0 |  |
| `created_at` | `datetime(6)` | خیر |  |  |  |
| `updated_at` | `datetime(6)` | خیر |  |  |  |

**کلیدهای خارجی:**

- `fk_plans_category` → `product_categories` (هنگام حذف RESTRICT)

**قیدهای CHECK:**

- `ck_plans_prices`: `hourly_price_rial > 0 and monthly_price_rial >= hourly_price_rial`
- `ck_plans_resources`: `cpu_millicores > 0 and memory_mib > 0`

### `plan_features`

ویژگی‌های فهرست‌شده‌ی یک پلن به هر زبان.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `plan_id` | `int(10) unsigned` | خیر | PRI |  | `plans.id` |
| `locale` | `varchar(8)` | خیر | PRI | 'en' |  |
| `position` | `smallint(5) unsigned` | خیر | PRI |  |  |
| `feature` | `varchar(160)` | خیر |  |  |  |

**کلیدهای خارجی:**

- `fk_plan_features_plan` → `plans` (هنگام حذف CASCADE)

**قیدهای CHECK:**

- `ck_plan_features_locale`: `locale in ('en','fa')`

### `wallets`

یک کیف پول پیش‌پرداخت برای هر کاربر؛ موجودی نهان هرگز منفی نمی‌شود.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `user_id` | `bigint(20) unsigned` | خیر | PRI |  | `users.id` |
| `balance_rial` | `bigint(20)` | خیر |  | 0 |  |
| `updated_at` | `datetime(6)` | خیر |  |  |  |

**کلیدهای خارجی:**

- `fk_wallets_user` → `users` (هنگام حذف RESTRICT)

**قیدهای CHECK:**

- `ck_wallets_non_negative`: `balance_rial >= 0`

### `wallet_transactions`

دفتر کل فقط‌افزودنی کیف پول با کلیدهای یکتایی.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `id` | `bigint(20) unsigned` | خیر | PRI | auto_increment |  |
| `user_id` | `bigint(20) unsigned` | خیر | MUL |  | `wallets.user_id` |
| `kind` | `varchar(16)` | خیر | MUL |  |  |
| `amount_rial` | `bigint(20)` | خیر |  |  |  |
| `balance_after_rial` | `bigint(20)` | خیر |  |  |  |
| `reference_type` | `varchar(32)` | بله |  |  |  |
| `reference_id` | `bigint(20) unsigned` | بله |  |  |  |
| `description` | `varchar(255)` | خیر |  |  |  |
| `idempotency_key` | `varchar(128)` | بله |  |  |  |
| `created_by` | `bigint(20) unsigned` | بله | MUL |  | `users.id` |
| `created_at` | `datetime(6)` | خیر |  |  |  |

**کلیدهای خارجی:**

- `fk_wallet_transactions_creator` → `users` (هنگام حذف RESTRICT)
- `fk_wallet_transactions_wallet` → `wallets` (هنگام حذف RESTRICT)

**قیدهای CHECK:**

- `ck_wallet_transactions_amount`: `amount_rial <> 0`
- `ck_wallet_transactions_balance`: `balance_after_rial >= 0`
- `ck_wallet_transactions_kind`: `kind in ('topup','order_charge','usage','refund','adjustment')`

### `orders`

سفارش‌های مشتری و بازبینی آن‌ها.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `id` | `bigint(20) unsigned` | خیر | PRI | auto_increment |  |
| `user_id` | `bigint(20) unsigned` | خیر | MUL |  | `users.id` |
| `status` | `varchar(16)` | خیر | MUL |  |  |
| `customer_note` | `varchar(500)` | بله |  |  |  |
| `upfront_rial` | `bigint(20) unsigned` | خیر |  | 0 |  |
| `reviewer_id` | `bigint(20) unsigned` | بله | MUL |  | `users.id` |
| `review_reason` | `varchar(500)` | بله |  |  |  |
| `placed_at` | `datetime(6)` | خیر |  |  |  |
| `reviewed_at` | `datetime(6)` | بله |  |  |  |
| `updated_at` | `datetime(6)` | خیر |  |  |  |

**کلیدهای خارجی:**

- `fk_orders_reviewer` → `users` (هنگام حذف RESTRICT)
- `fk_orders_user` → `users` (هنگام حذف RESTRICT)

**قیدهای CHECK:**

- `ck_orders_review`: `status in ('pending','cancelled') or reviewed_at is not null`
- `ck_orders_status`: `status in ('pending','rejected','cancelled','provisioning','active','failed')`

### `order_items`

آنچه سفارش می‌خواهد، با قیمت‌های کپی‌شده در زمان ثبت.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `id` | `bigint(20) unsigned` | خیر | PRI | auto_increment |  |
| `order_id` | `bigint(20) unsigned` | خیر | MUL |  | `orders.id` |
| `plan_id` | `int(10) unsigned` | خیر | MUL |  | `plans.id` |
| `app_name` | `varchar(41)` | خیر |  |  |  |
| `image` | `varchar(512)` | خیر |  |  |  |
| `port` | `smallint(5) unsigned` | خیر |  |  |  |
| `hourly_price_rial` | `bigint(20) unsigned` | خیر |  |  |  |
| `monthly_price_rial` | `bigint(20) unsigned` | خیر |  |  |  |

**کلیدهای خارجی:**

- `fk_order_items_order` → `orders` (هنگام حذف CASCADE)
- `fk_order_items_plan` → `plans` (هنگام حذف RESTRICT)

**قیدهای CHECK:**

- `ck_order_items_port`: `port > 0`

### `projects`

برنامه‌هایی که از سفارش‌های تأییدشده ایجاد می‌شوند، با وضعیت صورتحساب.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `id` | `bigint(20) unsigned` | خیر | PRI | auto_increment |  |
| `user_id` | `bigint(20) unsigned` | خیر | MUL |  | `users.id` |
| `order_item_id` | `bigint(20) unsigned` | خیر | UNI |  | `order_items.id` |
| `plan_id` | `int(10) unsigned` | خیر | MUL |  | `plans.id` |
| `app_name` | `varchar(41)` | خیر | UNI |  |  |
| `status` | `varchar(16)` | خیر | MUL |  |  |
| `server_id` | `varchar(64)` | خیر |  |  |  |
| `command_id` | `char(36)` | بله |  |  |  |
| `hourly_price_rial` | `bigint(20) unsigned` | خیر |  |  |  |
| `monthly_price_rial` | `bigint(20) unsigned` | خیر |  |  |  |
| `created_at` | `datetime(6)` | خیر |  |  |  |
| `activated_at` | `datetime(6)` | بله |  |  |  |
| `suspended_at` | `datetime(6)` | بله |  |  |  |
| `billing_resumed_at` | `datetime(6)` | بله |  |  |  |
| `deleted_at` | `datetime(6)` | بله |  |  |  |
| `updated_at` | `datetime(6)` | خیر |  |  |  |

**کلیدهای خارجی:**

- `fk_projects_order_item` → `order_items` (هنگام حذف RESTRICT)
- `fk_projects_plan` → `plans` (هنگام حذف RESTRICT)
- `fk_projects_user` → `users` (هنگام حذف RESTRICT)

**قیدهای CHECK:**

- `ck_projects_status`: `status in ('provisioning','active','suspended','failed','deleted')`

### `usage_records`

یک ساعت حساب‌شده‌ی یک پروژه؛ UNIQUE(project, hour) از صورتحساب دوباره جلوگیری می‌کند.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `id` | `bigint(20) unsigned` | خیر | PRI | auto_increment |  |
| `project_id` | `bigint(20) unsigned` | خیر | MUL |  | `projects.id` |
| `period_start` | `datetime` | خیر |  |  |  |
| `amount_rial` | `bigint(20) unsigned` | خیر |  |  |  |
| `wallet_transaction_id` | `bigint(20) unsigned` | بله | MUL |  | `wallet_transactions.id` |
| `invoice_id` | `bigint(20) unsigned` | بله | MUL |  | `invoices.id` |
| `created_at` | `datetime(6)` | خیر |  |  |  |

**کلیدهای خارجی:**

- `fk_usage_records_invoice` → `invoices` (هنگام حذف RESTRICT)
- `fk_usage_records_project` → `projects` (هنگام حذف RESTRICT)
- `fk_usage_records_transaction` → `wallet_transactions` (هنگام حذف RESTRICT)

### `invoices`

فاکتورهای ماهانه با مالیات منظورشده؛ جمع برابر جمع جزء به‌علاوه‌ی مالیات است.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `id` | `bigint(20) unsigned` | خیر | PRI | auto_increment |  |
| `number` | `varchar(24)` | خیر | UNI |  |  |
| `user_id` | `bigint(20) unsigned` | خیر | MUL |  | `users.id` |
| `period_start` | `date` | خیر |  |  |  |
| `period_end` | `date` | خیر |  |  |  |
| `status` | `varchar(16)` | خیر |  |  |  |
| `subtotal_rial` | `bigint(20) unsigned` | خیر |  |  |  |
| `tax_rate_bp` | `smallint(5) unsigned` | خیر |  |  |  |
| `tax_rial` | `bigint(20) unsigned` | خیر |  |  |  |
| `total_rial` | `bigint(20) unsigned` | خیر |  |  |  |
| `issued_at` | `datetime(6)` | بله |  |  |  |
| `created_at` | `datetime(6)` | خیر |  |  |  |

**کلیدهای خارجی:**

- `fk_invoices_user` → `users` (هنگام حذف RESTRICT)

**قیدهای CHECK:**

- `ck_invoices_period`: `period_end >= period_start`
- `ck_invoices_status`: `status in ('draft','issued','paid','void')`
- `ck_invoices_total`: `total_rial = subtotal_rial + tax_rial`

### `invoice_lines`

یک سطر برای هر پروژه در هر فاکتور: ساعت‌ها و مبلغ.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `id` | `bigint(20) unsigned` | خیر | PRI | auto_increment |  |
| `invoice_id` | `bigint(20) unsigned` | خیر | MUL |  | `invoices.id` |
| `project_id` | `bigint(20) unsigned` | بله | MUL |  | `projects.id` |
| `description` | `varchar(255)` | خیر |  |  |  |
| `quantity_hours` | `int(10) unsigned` | خیر |  |  |  |
| `amount_rial` | `bigint(20) unsigned` | خیر |  |  |  |

**کلیدهای خارجی:**

- `fk_invoice_lines_invoice` → `invoices` (هنگام حذف CASCADE)
- `fk_invoice_lines_project` → `projects` (هنگام حذف SET NULL)

### `support_tickets`

گفتگوهای پشتیبانی مشتری.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `id` | `bigint(20) unsigned` | خیر | PRI | auto_increment |  |
| `user_id` | `bigint(20) unsigned` | خیر | MUL |  | `users.id` |
| `project_id` | `bigint(20) unsigned` | بله | MUL |  | `projects.id` |
| `subject` | `varchar(160)` | خیر |  |  |  |
| `status` | `varchar(16)` | خیر | MUL | 'open' |  |
| `priority` | `varchar(8)` | خیر |  | 'normal' |  |
| `created_at` | `datetime(6)` | خیر |  |  |  |
| `updated_at` | `datetime(6)` | خیر |  |  |  |

**کلیدهای خارجی:**

- `fk_support_tickets_project` → `projects` (هنگام حذف SET NULL)
- `fk_support_tickets_user` → `users` (هنگام حذف RESTRICT)

**قیدهای CHECK:**

- `ck_support_tickets_priority`: `priority in ('low','normal','high')`
- `ck_support_tickets_status`: `status in ('open','answered','closed')`

### `ticket_messages`

پیام‌های درون یک تیکت پشتیبانی.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `id` | `bigint(20) unsigned` | خیر | PRI | auto_increment |  |
| `ticket_id` | `bigint(20) unsigned` | خیر | MUL |  | `support_tickets.id` |
| `author_id` | `bigint(20) unsigned` | خیر | MUL |  | `users.id` |
| `body` | `text` | خیر |  |  |  |
| `created_at` | `datetime(6)` | خیر |  |  |  |

**کلیدهای خارجی:**

- `fk_ticket_messages_author` → `users` (هنگام حذف RESTRICT)
- `fk_ticket_messages_ticket` → `support_tickets` (هنگام حذف CASCADE)

## جدول‌های سکو

### `agents`

عامل‌های کششی ثبت‌شده و شماره‌ی سریال گواهی‌هایشان.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `id` | `varchar(64)` | خیر | PRI |  |  |
| `name` | `varchar(96)` | خیر |  |  |  |
| `certificate_expires_at` | `datetime(6)` | خیر |  |  |  |

### `agent_ca`

مرجع گواهی یگانه‌ای که گواهی‌های کلاینت عامل ماشین را امضا می‌کند؛ کلید آن مهروموم شده است.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `id` | `tinyint(3) unsigned` | خیر | PRI |  |  |
| `certificate_pem` | `text` | خیر |  |  |  |
| `private_key_sealed` | `varbinary(4096)` | خیر |  |  |  |
| `created_at` | `datetime(6)` | خیر |  |  |  |

**قیدهای CHECK:**

- `ck_agent_ca_singleton`: `id = 1`

### `agent_claims`

کدهای ادعای نصب‌اول که عامل پیش از تأیید مدیر ارائه می‌کند.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `id` | `varchar(64)` | خیر | PRI |  |  |
| `name` | `varchar(96)` | خیر |  |  |  |
| `csr` | `text` | خیر |  |  |  |
| `code_digest` | `char(64)` | خیر | UNI |  |  |
| `secret_digest` | `char(64)` | خیر |  |  |  |
| `expires_at` | `datetime(6)` | خیر | MUL |  |  |
| `enrollment_agent_id` | `varchar(64)` | بله |  |  |  |
| `enrollment_authority_epoch` | `bigint(20) unsigned` | بله |  |  |  |
| `enrollment_certificate` | `text` | بله |  |  |  |
| `enrollment_expires_at` | `datetime(6)` | بله |  |  |  |
| `position` | `int(10) unsigned` | خیر |  |  |  |

### `agent_enrollment_tokens`

توکن‌های یک‌بارمصرف ثبت (ذخیره‌شده به‌صورت درهم‌سازی) برای فرمان‌های نصبی که داشبورد تولید می‌کند.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `code_digest` | `char(64)` | خیر | PRI |  |  |
| `name` | `varchar(96)` | بله |  |  |  |
| `expires_at` | `datetime(6)` | خیر | MUL |  |  |

### `applications`

برنامه‌هایی که SwarmOps تولید و مستقر می‌کند، با ایمیج، درگاه و محدودیت منابع.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `name` | `varchar(41)` | خیر | PRI |  |  |
| `image` | `varchar(512)` | خیر |  |  |  |
| `port` | `smallint(5) unsigned` | خیر |  |  |  |
| `replicas` | `int(10) unsigned` | خیر |  |  |  |
| `cpus` | `double` | خیر |  |  |  |
| `memory_mib` | `bigint(20)` | خیر |  |  |  |
| `plan` | `varchar(32)` | بله |  |  |  |
| `domain` | `varchar(253)` | بله | UNI |  |  |
| `resolver` | `varchar(64)` | بله |  |  |  |
| `backend` | `varchar(41)` | بله |  |  |  |
| `database_delivery` | `varchar(32)` | بله |  |  |  |
| `health_path` | `varchar(201)` | بله |  |  |  |
| `metrics` | `tinyint(1)` | خیر |  | 0 |  |
| `metrics_path` | `varchar(201)` | بله |  |  |  |
| `metrics_port` | `smallint(5) unsigned` | بله |  |  |  |
| `tracing` | `tinyint(1)` | خیر |  | 0 |  |
| `created_at` | `datetime(6)` | خیر |  |  |  |
| `updated_at` | `datetime(6)` | خیر |  |  |  |

**قیدهای CHECK:**

- `ck_applications_resources`: `cpus > 0 and memory_mib > 0 and port > 0`

### `application_databases`

موتورهای پایگاه داده‌ی مدیریت‌شده‌ای که برنامه به آن‌ها وابسته است.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `application_name` | `varchar(41)` | خیر | PRI |  | `applications.name` |
| `engine` | `varchar(16)` | خیر | PRI |  |  |
| `position` | `smallint(5) unsigned` | خیر |  |  |  |

**کلیدهای خارجی:**

- `fk_application_databases_application` → `applications` (هنگام حذف CASCADE)

### `application_database_credentials`

اعتبارنامه‌های مهروموم‌شده‌ای که برنامه برای هر موتور پایگاه داده‌ی مدیریت‌شده به کار می‌برد.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `application_name` | `varchar(41)` | خیر | PRI |  |  |
| `engine` | `varchar(16)` | خیر | PRI |  |  |
| `uri_sealed` | `varbinary(4096)` | خیر |  |  |  |
| `updated_at` | `datetime(6)` | خیر |  |  |  |

### `application_database_env`

نام متغیرهای محیطی که اعتبارنامه‌های پایگاه داده از طریق آن‌ها به برنامه می‌رسند.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `application_name` | `varchar(41)` | خیر | PRI |  | `applications.name` |
| `engine` | `varchar(16)` | خیر | PRI |  |  |
| `position` | `smallint(5) unsigned` | خیر | PRI |  |  |
| `env_name` | `varchar(64)` | خیر |  |  |  |

**کلیدهای خارجی:**

- `fk_application_database_env_application` → `applications` (هنگام حذف CASCADE)

### `application_env`

متغیرهای محیطی برنامه؛ مقادیر مهروموم شده‌اند.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `application_name` | `varchar(41)` | خیر | PRI |  | `applications.name` |
| `env_key` | `varchar(64)` | خیر | PRI |  |  |
| `env_value_sealed` | `varbinary(8192)` | خیر |  |  |  |

**کلیدهای خارجی:**

- `fk_application_env_application` → `applications` (هنگام حذف CASCADE)

### `application_health_command`

آرگومان‌های مرتب فرمان سفارشی بررسی سلامت برنامه.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `application_name` | `varchar(41)` | خیر | PRI |  | `applications.name` |
| `position` | `smallint(5) unsigned` | خیر | PRI |  |  |
| `argument` | `varchar(1024)` | خیر |  |  |  |

**کلیدهای خارجی:**

- `fk_application_health_command_application` → `applications` (هنگام حذف CASCADE)

### `application_outcomes`

آخرین نتیجه‌ی راه‌اندازی هر برنامه.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `application_name` | `varchar(41)` | خیر | PRI |  | `applications.name` |
| `started` | `tinyint(1)` | خیر |  | 0 |  |
| `started_at` | `datetime(6)` | بله |  |  |  |
| `last_attempt_at` | `datetime(6)` | بله |  |  |  |
| `last_command_id` | `varchar(64)` | بله |  |  |  |
| `failure_summary` | `text` | بله |  |  |  |

**کلیدهای خارجی:**

- `fk_application_outcomes_application` → `applications` (هنگام حذف CASCADE)

### `audit_events`

سابقه‌ی فقط‌افزودنی هر اقدام اپراتور و مشتری.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `seq` | `bigint(20) unsigned` | خیر | PRI | auto_increment |  |
| `id` | `char(32)` | خیر | UNI |  |  |
| `occurred_at` | `datetime(6)` | خیر | MUL |  |  |
| `actor` | `varchar(190)` | خیر | MUL |  |  |
| `action` | `varchar(190)` | خیر |  |  |  |
| `target` | `varchar(512)` | خیر |  |  |  |
| `outcome` | `varchar(64)` | خیر |  |  |  |
| `request_id` | `varchar(128)` | بله |  |  |  |

### `audit_event_details`

جزئیات کلید-مقدار یک رویداد ممیزی.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `event_seq` | `bigint(20) unsigned` | خیر | PRI |  | `audit_events.seq` |
| `detail_key` | `varchar(190)` | خیر | PRI |  |  |
| `detail_value` | `text` | خیر |  |  |  |

**کلیدهای خارجی:**

- `fk_audit_event_details_event` → `audit_events` (هنگام حذف CASCADE)

### `commands`

صف پایدار فرمان‌ها: کنش، هدف، وضعیت، تلاش‌ها، اجاره‌ها و جزئیات شکست.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `seq` | `bigint(20) unsigned` | خیر | UNI | auto_increment |  |
| `id` | `char(36)` | خیر | PRI |  |  |
| `action` | `varchar(64)` | خیر | MUL |  |  |
| `actor` | `varchar(190)` | خیر | MUL |  |  |
| `server_id` | `varchar(64)` | خیر | MUL |  |  |
| `node_id` | `varchar(64)` | خیر |  | '' |  |
| `cluster_id` | `varchar(64)` | خیر |  |  |  |
| `target` | `varchar(512)` | خیر |  |  |  |
| `state` | `varchar(20)` | خیر | MUL |  |  |
| `attempt` | `int(10) unsigned` | خیر |  | 0 |  |
| `max_attempts` | `tinyint(3) unsigned` | خیر |  |  |  |
| `auto_retry` | `tinyint(1)` | خیر |  |  |  |
| `authority_epoch` | `bigint(20) unsigned` | خیر |  |  |  |
| `request_id` | `varchar(128)` | بله |  |  |  |
| `idempotency_key` | `varchar(128)` | خیر |  |  |  |
| `payload_digest` | `char(64)` | بله |  |  |  |
| `has_artifact` | `tinyint(1)` | خیر |  | 0 |  |
| `lease_id` | `varchar(64)` | بله |  |  |  |
| `lease_expires_at` | `datetime(6)` | بله |  |  |  |
| `last_attempt_at` | `datetime(6)` | بله |  |  |  |
| `next_attempt_at` | `datetime(6)` | بله |  |  |  |
| `last_error` | `text` | بله |  |  |  |
| `failure_code` | `varchar(64)` | بله |  |  |  |
| `failure_summary` | `text` | بله |  |  |  |
| `recovery_hint` | `text` | بله |  |  |  |
| `created_at` | `datetime(6)` | خیر |  |  |  |
| `updated_at` | `datetime(6)` | خیر | MUL |  |  |

**قیدهای CHECK:**

- `ck_commands_attempts`: `max_attempts between 1 and 8`
- `ck_commands_epoch`: `authority_epoch >= 1`
- `ck_commands_state`: `state in ('uploading','queued','leased','preparing','running','retry_scheduled','succeeded','failed','needs_attention','superseded','cancelled')`

### `command_events`

خط زمانی تغییر وضعیت و شواهد هر فرمان.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `command_id` | `char(36)` | خیر | PRI |  | `commands.id` |
| `sequence` | `int(10) unsigned` | خیر | PRI |  |  |
| `state` | `varchar(20)` | خیر |  |  |  |
| `evidence` | `varchar(1024)` | بله |  |  |  |
| `occurred_at` | `datetime(6)` | خیر |  |  |  |

**کلیدهای خارجی:**

- `fk_command_events_command` → `commands` (هنگام حذف CASCADE)

### `command_locks`

قفل‌های نام‌داری که فرمان‌های غیرهم‌زمان را پشت سر هم اجرا می‌کنند.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `lock_name` | `varchar(80)` | خیر | PRI |  |  |

### `command_outputs`

جریان‌های خروجی مهروموم‌شده‌ی اجرای یک فرمان.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `command_id` | `char(36)` | خیر | PRI |  | `commands.id` |
| `output_sealed` | `mediumblob` | خیر |  |  |  |
| `retained_at` | `datetime(6)` | خیر |  |  |  |

**کلیدهای خارجی:**

- `fk_command_outputs_command` → `commands` (هنگام حذف CASCADE)

### `command_payloads`

محموله‌ی ورودی مهروموم‌شده‌ی یک فرمان.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `command_id` | `char(36)` | خیر | PRI |  | `commands.id` |
| `payload_sealed` | `mediumblob` | خیر |  |  |  |

**کلیدهای خارجی:**

- `fk_command_payloads_command` → `commands` (هنگام حذف CASCADE)

### `core_authority`

سطر یگانه‌ی دوره‌ی اقتدار و هسته‌ی فعال.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `id` | `tinyint(3) unsigned` | خیر | PRI |  |  |
| `active_id` | `varchar(64)` | بله |  |  |  |
| `authority_epoch` | `bigint(20) unsigned` | خیر |  |  |  |
| `updated_at` | `datetime(6)` | خیر |  |  |  |

**قیدهای CHECK:**

- `ck_core_authority_epoch`: `authority_epoch >= 1`
- `ck_core_authority_singleton`: `id = 1`

### `core_handoffs`

جابه‌جایی‌های برنامه‌ریزی‌شده‌ی اقتدار میان اعضای هسته.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `id` | `tinyint(3) unsigned` | خیر | PRI |  |  |
| `from_id` | `varchar(64)` | خیر | MUL |  | `core_members.id` |
| `to_id` | `varchar(64)` | خیر | MUL |  | `core_members.id` |
| `state` | `varchar(16)` | خیر |  |  |  |
| `prepared_at` | `datetime(6)` | خیر |  |  |  |
| `fenced_at` | `datetime(6)` | بله |  |  |  |

**کلیدهای خارجی:**

- `fk_core_handoffs_from` → `core_members` (هنگام حذف RESTRICT)
- `fk_core_handoffs_to` → `core_members` (هنگام حذف RESTRICT)

**قیدهای CHECK:**

- `ck_core_handoffs_distinct`: `from_id <> to_id`
- `ck_core_handoffs_fenced_time`: `state <> 'fenced' or fenced_at is not null`
- `ck_core_handoffs_singleton`: `id = 1`
- `ck_core_handoffs_state`: `state in ('prepared','fenced')`

### `core_members`

نمونه‌های شناخته‌شده‌ی هسته و نقش‌هایشان.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `id` | `varchar(64)` | خیر | PRI |  |  |
| `name` | `varchar(96)` | خیر |  |  |  |
| `endpoint` | `varchar(512)` | خیر |  | '' |  |
| `role` | `varchar(16)` | خیر |  |  |  |
| `replica_state` | `varchar(32)` | خیر |  |  |  |
| `agent_server_id` | `varchar(64)` | بله |  |  |  |
| `last_checkpoint_at` | `datetime(6)` | بله |  |  |  |
| `position` | `smallint(5) unsigned` | خیر |  |  |  |

**قیدهای CHECK:**

- `ck_core_members_replica_state`: `replica_state in ('awaiting_restore','verified')`
- `ck_core_members_role`: `role in ('active','standby')`

### `database_credentials`

اعتبارنامه‌های مدیریتی مهروموم‌شده‌ی موتورهای پایگاه داده‌ی مدیریت‌شده.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `engine` | `varchar(16)` | خیر | PRI |  |  |
| `uri_sealed` | `varbinary(4096)` | خیر |  |  |  |
| `updated_at` | `datetime(6)` | خیر |  |  |  |

### `dependency_bindings`

وابستگی‌های شبکه‌ای اعلام‌شده میان سرویس‌های مسیریابی‌شده.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `cluster_id` | `varchar(64)` | خیر | PRI |  | `routing_clusters.cluster_id` |
| `caller_service` | `varchar(128)` | خیر | PRI |  |  |
| `target_route` | `varchar(64)` | خیر | PRI |  |  |
| `name` | `varchar(64)` | خیر | PRI | '' |  |
| `delivery` | `varchar(32)` | خیر |  |  |  |
| `version` | `int(11)` | خیر |  |  |  |

**کلیدهای خارجی:**

- `fk_dependency_bindings_cluster` → `routing_clusters` (هنگام حذف CASCADE)

### `dns_credential_versions`

نسخه‌های اعتبارنامه‌ی ارائه‌دهندگان DNS؛ رازها مهروموم شده‌اند.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `cluster_id` | `varchar(64)` | خیر | PRI |  | `routing_clusters.cluster_id` |
| `credential_id` | `varchar(64)` | خیر | PRI |  |  |
| `version` | `int(10) unsigned` | خیر | PRI |  |  |
| `name` | `varchar(96)` | خیر |  |  |  |
| `provider` | `varchar(32)` | خیر |  |  |  |
| `account_id` | `varchar(128)` | بله |  |  |  |
| `email` | `varchar(254)` | بله |  |  |  |
| `secret_name` | `varchar(128)` | خیر |  |  |  |
| `state` | `varchar(16)` | خیر |  |  |  |
| `created_at` | `datetime(6)` | خیر |  |  |  |
| `validated_at` | `datetime(6)` | بله |  |  |  |
| `secret_sealed` | `varbinary(8192)` | بله |  |  |  |

**کلیدهای خارجی:**

- `fk_dns_credential_versions_cluster` → `routing_clusters` (هنگام حذف CASCADE)

**قیدهای CHECK:**

- `ck_dns_credential_versions_secret`: `state = 'removed' or secret_sealed is not null`
- `ck_dns_credential_versions_state`: `state in ('sealed','validated','removed')`

### `dns_records`

رکوردهای DNS که SwarmOps نزد ارائه‌دهندگان مدیریت می‌کند.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `cluster_id` | `varchar(64)` | خیر | PRI |  | `routing_clusters.cluster_id` |
| `id` | `varchar(64)` | خیر | PRI |  |  |
| `zone` | `varchar(253)` | خیر |  |  |  |
| `name` | `varchar(253)` | خیر |  |  |  |
| `type` | `varchar(8)` | خیر |  |  |  |
| `content` | `varchar(512)` | خیر |  |  |  |
| `ttl` | `int(10) unsigned` | خیر |  |  |  |
| `proxied` | `tinyint(1)` | خیر |  |  |  |
| `managed` | `tinyint(1)` | خیر |  |  |  |
| `adopted` | `tinyint(1)` | خیر |  |  |  |
| `credential_id` | `varchar(64)` | خیر |  |  |  |
| `provider_record_id` | `varchar(128)` | بله |  |  |  |
| `version` | `int(11)` | خیر |  |  |  |

**کلیدهای خارجی:**

- `fk_dns_records_cluster` → `routing_clusters` (هنگام حذف CASCADE)

### `routes`

مسیرهای اعلام‌شده: پروتکل، دامنه، TLS، درگاه هدف و بررسی سلامت.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `cluster_id` | `varchar(64)` | خیر | PRI |  | `routing_clusters.cluster_id` |
| `route_key` | `varchar(64)` | خیر | PRI |  |  |
| `service_key` | `varchar(128)` | خیر |  |  |  |
| `protocol` | `varchar(8)` | خیر |  |  |  |
| `scope` | `varchar(16)` | خیر |  |  |  |
| `tls_mode` | `varchar(16)` | خیر |  |  |  |
| `listen_port` | `smallint(5) unsigned` | بله |  |  |  |
| `target_port` | `smallint(5) unsigned` | خیر |  |  |  |
| `path_prefix` | `varchar(256)` | بله |  |  |  |
| `health_kind` | `varchar(32)` | خیر |  | '' |  |
| `health_path` | `varchar(256)` | بله |  |  |  |
| `health_timeout_seconds` | `smallint(5) unsigned` | خیر |  | 0 |  |
| `dns_reference` | `varchar(64)` | بله |  |  |  |
| `resolver` | `varchar(64)` | بله |  |  |  |
| `enabled` | `tinyint(1)` | خیر |  |  |  |
| `managed` | `tinyint(1)` | خیر |  |  |  |
| `metrics` | `tinyint(1)` | خیر |  |  |  |
| `access_logs` | `tinyint(1)` | خیر |  |  |  |
| `public_allow` | `tinyint(1)` | خیر |  |  |  |
| `is_sensitive` | `tinyint(1)` | خیر |  |  |  |
| `version` | `int(11)` | خیر |  |  |  |

**کلیدهای خارجی:**

- `fk_routes_cluster` → `routing_clusters` (هنگام حذف CASCADE)

**قیدهای CHECK:**

- `ck_routes_protocol`: `protocol in ('http','tcp','udp')`

### `route_certificates`

گواهی‌های مشاهده‌شده روی دروازه.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `cluster_id` | `varchar(64)` | خیر | PRI |  | `routes.cluster_id` |
| `route_key` | `varchar(64)` | خیر | PRI |  | `routes.route_key` |
| `state` | `varchar(32)` | خیر |  |  |  |
| `issuer` | `varchar(256)` | بله |  |  |  |
| `fingerprint` | `varchar(128)` | بله |  |  |  |
| `resolver` | `varchar(64)` | خیر |  | '' |  |
| `handshake_valid` | `tinyint(1)` | خیر |  |  |  |
| `failure_summary` | `text` | بله |  |  |  |
| `last_attempt` | `datetime(6)` | بله |  |  |  |
| `not_before` | `datetime(6)` | بله |  |  |  |
| `not_after` | `datetime(6)` | بله | MUL |  |  |
| `version` | `int(11)` | خیر |  |  |  |

**کلیدهای خارجی:**

- `fk_route_certificates_route` → `routes` (هنگام حذف CASCADE)

### `route_certificate_domains`

دامنه‌هایی که یک گواهی دروازه پوشش می‌دهد.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `cluster_id` | `varchar(64)` | خیر | PRI |  | `route_certificates.cluster_id` |
| `route_key` | `varchar(64)` | خیر | PRI |  | `route_certificates.route_key` |
| `position` | `smallint(5) unsigned` | خیر | PRI |  |  |
| `domain` | `varchar(253)` | خیر |  |  |  |

**کلیدهای خارجی:**

- `fk_route_certificate_domains_certificate` → `route_certificates` (هنگام حذف CASCADE)

### `route_hosts`

نام‌های میزبان و نام‌های مستعار یک مسیر.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `cluster_id` | `varchar(64)` | خیر | PRI |  | `routes.cluster_id` |
| `route_key` | `varchar(64)` | خیر | PRI |  | `routes.route_key` |
| `kind` | `varchar(4)` | خیر | PRI |  |  |
| `position` | `smallint(5) unsigned` | خیر | PRI |  |  |
| `hostname` | `varchar(253)` | خیر |  |  |  |

**کلیدهای خارجی:**

- `fk_route_hosts_route` → `routes` (هنگام حذف CASCADE)

**قیدهای CHECK:**

- `ck_route_hosts_kind`: `kind in ('host','sni')`

### `route_runtime`

وضعیت زمان اجرای مشاهده‌شده‌ی یک مسیر در دروازه.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `cluster_id` | `varchar(64)` | خیر | PRI |  | `routing_clusters.cluster_id` |
| `route_key` | `varchar(64)` | خیر | PRI |  |  |
| `protocol` | `varchar(8)` | خیر |  |  |  |
| `router` | `varchar(256)` | خیر |  | '' |  |
| `service` | `varchar(256)` | خیر |  | '' |  |
| `state` | `varchar(32)` | خیر |  | '' |  |
| `observed_at` | `datetime(6)` | خیر |  |  |  |
| `version` | `int(11)` | خیر |  |  |  |

**کلیدهای خارجی:**

- `fk_route_runtime_cluster` → `routing_clusters` (هنگام حذف CASCADE)

### `route_runtime_entry_points`

نقاط ورودی که مسیر روی آن‌ها مشاهده شده است.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `cluster_id` | `varchar(64)` | خیر | PRI |  | `route_runtime.cluster_id` |
| `route_key` | `varchar(64)` | خیر | PRI |  | `route_runtime.route_key` |
| `position` | `smallint(5) unsigned` | خیر | PRI |  |  |
| `entry_point` | `varchar(64)` | خیر |  |  |  |

**کلیدهای خارجی:**

- `fk_route_runtime_entry_points_runtime` → `route_runtime` (هنگام حذف CASCADE)

### `route_runtime_errors`

خطاهایی که دروازه برای یک مسیر گزارش می‌کند.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `cluster_id` | `varchar(64)` | خیر | PRI |  | `route_runtime.cluster_id` |
| `route_key` | `varchar(64)` | خیر | PRI |  | `route_runtime.route_key` |
| `position` | `smallint(5) unsigned` | خیر | PRI |  |  |
| `message` | `varchar(256)` | خیر |  |  |  |

**کلیدهای خارجی:**

- `fk_route_runtime_errors_runtime` → `route_runtime` (هنگام حذف CASCADE)

### `routing_clusters`

تنظیمات دروازه و برنامه‌های جابه‌جایی هر خوشه (سندهای JSON).

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `cluster_id` | `varchar(64)` | خیر | PRI |  |  |
| `settings_json` | `longtext` | خیر |  |  |  |
| `cutover_json` | `longtext` | بله |  |  |  |
| `cutover_rollback_json` | `longtext` | بله |  |  |  |
| `updated_at` | `datetime(6)` | خیر |  |  |  |

**قیدهای CHECK:**

- `ck_routing_clusters_settings`: `json_valid(settings_json)`
- `cutover_json`: `json_valid(cutover_json)`
- `cutover_rollback_json`: `json_valid(cutover_rollback_json)`
- `settings_json`: `json_valid(settings_json)`

### `routing_domains`

دامنه‌هایی که یک خوشه می‌تواند مسیریابی کند.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `cluster_id` | `varchar(64)` | خیر | PRI |  | `routing_clusters.cluster_id` |
| `zone` | `varchar(253)` | خیر | PRI |  |  |
| `note` | `varchar(512)` | بله |  |  |  |
| `created_at` | `datetime(6)` | بله |  |  |  |
| `version` | `int(11)` | خیر |  |  |  |

**کلیدهای خارجی:**

- `fk_routing_domains_cluster` → `routing_clusters` (هنگام حذف CASCADE)

### `schema_migrations`

مهاجرت‌های اعمال‌شده‌ی طرح‌واره با جمع‌آزمای آن‌ها.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `version` | `int(10) unsigned` | خیر | PRI |  |  |
| `name` | `varchar(200)` | خیر |  |  |  |
| `checksum` | `char(64)` | خیر |  |  |  |
| `applied_at` | `datetime(6)` | خیر |  |  |  |

### `servers`

سرورهای ذخیره‌شده، جزئیات اتصال و آخرین سلامت مشاهده‌شده‌ی عامل و Swarm.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `id` | `varchar(64)` | خیر | PRI |  |  |
| `name` | `varchar(96)` | خیر | MUL |  |  |
| `host` | `varchar(253)` | خیر |  |  |  |
| `port` | `smallint(5) unsigned` | خیر |  | 0 |  |
| `username` | `varchar(190)` | خیر |  | '' |  |
| `authentication` | `varchar(32)` | خیر |  |  |  |
| `connection_type` | `varchar(32)` | بله |  |  |  |
| `api_url` | `varchar(512)` | بله |  |  |  |
| `host_key_fingerprint` | `varchar(128)` | خیر |  | '' |  |
| `tls_certificate_fingerprint` | `varchar(128)` | بله |  |  |  |
| `docker_available` | `tinyint(1)` | خیر |  | 0 |  |
| `docker_version` | `varchar(64)` | بله |  |  |  |
| `swarm_control_available` | `tinyint(1)` | خیر |  | 0 |  |
| `swarm_state` | `varchar(32)` | بله |  |  |  |
| `last_connected_at` | `datetime(6)` | بله |  |  |  |
| `agent_version` | `varchar(64)` | بله |  |  |  |
| `agent_checked_at` | `datetime(6)` | بله |  |  |  |
| `agent_detail` | `text` | بله |  |  |  |
| `agent_last_failure_at` | `datetime(6)` | بله |  |  |  |
| `agent_last_reachable_at` | `datetime(6)` | بله |  |  |  |
| `agent_protocol_version` | `int(10) unsigned` | خیر |  | 0 |  |
| `agent_state` | `varchar(16)` | بله |  |  |  |
| `agent_summary` | `varchar(1024)` | بله |  |  |  |
| `agent_uptime_seconds` | `bigint(20) unsigned` | خیر |  | 0 |  |
| `update_automatic` | `tinyint(1)` | خیر |  | 0 |  |
| `update_checked_at` | `datetime(6)` | بله |  |  |  |
| `update_last_updated_at` | `datetime(6)` | بله |  |  |  |
| `update_requested_at` | `datetime(6)` | بله |  |  |  |
| `update_revision` | `varchar(128)` | بله |  |  |  |
| `update_state` | `varchar(32)` | بله |  |  |  |
| `update_version` | `varchar(64)` | بله |  |  |  |
| `updated_at` | `datetime(6)` | خیر |  |  |  |

**قیدهای CHECK:**

- `ck_servers_agent_state`: `agent_state is null or agent_state in ('healthy','degraded','unknown','unhealthy')`

### `server_agent_events`

سابقه‌ی مشاهدات سلامت عامل ماشین برای هر سرور.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `server_id` | `varchar(64)` | خیر | PRI |  | `servers.id` |
| `position` | `smallint(5) unsigned` | خیر | PRI |  |  |
| `code` | `varchar(64)` | خیر |  |  |  |
| `level` | `varchar(16)` | خیر |  |  |  |
| `message` | `text` | خیر |  |  |  |
| `occurred_at` | `datetime(6)` | خیر |  |  |  |
| `source` | `varchar(32)` | خیر |  |  |  |

**کلیدهای خارجی:**

- `fk_server_agent_events_server` → `servers` (هنگام حذف CASCADE)

### `server_keys`

کلیدهای SSH یا API مهروموم‌شده‌ی سرورهای ذخیره‌شده.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `server_id` | `varchar(64)` | خیر | PRI |  | `servers.id` |
| `api_key_sealed` | `varbinary(1024)` | خیر |  |  |  |
| `updated_at` | `datetime(6)` | خیر |  |  |  |

**کلیدهای خارجی:**

- `fk_server_keys_server` → `servers` (هنگام حذف CASCADE)

### `service_route_declarations`

نحوه‌ی مشارکت هر سرویس در مسیریابی.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `cluster_id` | `varchar(64)` | خیر | PRI |  | `routing_clusters.cluster_id` |
| `service_key` | `varchar(128)` | خیر | PRI |  |  |
| `role` | `varchar(32)` | خیر |  |  |  |
| `reason` | `varchar(512)` | بله |  |  |  |
| `version` | `int(11)` | خیر |  |  |  |

**کلیدهای خارجی:**

- `fk_service_route_declarations_cluster` → `routing_clusters` (هنگام حذف CASCADE)

### `source_connections`

اتصالات ارائه‌دهندگان Git؛ توکن‌ها مهروموم شده‌اند.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `id` | `char(32)` | خیر | PRI |  |  |
| `kind` | `varchar(32)` | خیر |  |  |  |
| `name` | `varchar(190)` | خیر | MUL |  |  |
| `base_url` | `varchar(512)` | خیر |  |  |  |
| `account` | `varchar(190)` | بله |  |  |  |
| `token_sealed` | `varbinary(8192)` | خیر |  |  |  |
| `created_at` | `datetime(6)` | خیر |  |  |  |
| `updated_at` | `datetime(6)` | خیر |  |  |  |

### `source_private_hosts`

میزبان‌های خصوصی Git مجاز برای استقرار از کد منبع.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `host` | `varchar(253)` | خیر | PRI |  |  |
| `position` | `smallint(5) unsigned` | خیر | UNI |  |  |

### `source_settings`

سطر یگانه‌ی تنظیمات استقرار از کد منبع.

| ستون | نوع | تهی‌پذیر | کلید | پیش‌فرض | ارجاع |
|---|---|---|---|---|---|
| `id` | `tinyint(3) unsigned` | خیر | PRI |  |  |
| `enabled` | `tinyint(1)` | خیر |  |  |  |
| `build_enabled` | `tinyint(1)` | خیر |  |  |  |
| `image_prefix` | `varchar(255)` | خیر |  | '' |  |
| `registry_server` | `varchar(253)` | خیر |  | '' |  |
| `registry_username` | `varchar(190)` | خیر |  | '' |  |
| `registry_password_sealed` | `varbinary(4096)` | بله |  |  |  |
| `updated_at` | `datetime(6)` | خیر |  |  |  |

**قیدهای CHECK:**

- `ck_source_settings_build_requires_enabled`: `build_enabled = 0 or enabled = 1`
- `ck_source_settings_singleton`: `id = 1`

