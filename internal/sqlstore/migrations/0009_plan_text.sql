-- Plans carry Persian text beside English, and the seeded features describe
-- what an order actually provides. The seed in 0008 promised an HTTPS domain,
-- metrics, tracing, managed databases and priority support, none of which a
-- storefront order delivers. Only text still exactly as seeded is replaced, so
-- anything an administrator has written since is kept.

ALTER TABLE plans ADD COLUMN description_fa VARCHAR(255) NOT NULL DEFAULT '' AFTER description;

-- The foreign key on plan_id needs an index while the primary key changes.
ALTER TABLE plan_features ADD KEY ix_plan_features_plan (plan_id);

ALTER TABLE plan_features
  ADD COLUMN locale VARCHAR(8) NOT NULL DEFAULT 'en' AFTER plan_id,
  DROP PRIMARY KEY,
  ADD PRIMARY KEY (plan_id, locale, position),
  ADD CONSTRAINT ck_plan_features_locale CHECK (locale IN ('en', 'fa'));

ALTER TABLE plan_features DROP KEY ix_plan_features_plan;

UPDATE product_categories
SET description = 'A container application with a health check, resource limits and hourly billing.'
WHERE code = 'app' AND description = 'A container application with its own domain, health check and metrics.';

DELETE f FROM plan_features f
JOIN plans p ON p.id = f.plan_id
WHERE p.code IN ('starter', 'basic', 'standard', 'plus', 'pro')
  AND f.locale = 'en'
  AND f.feature IN ('HTTPS domain with automatic certificate', 'Health-checked rolling deploys', 'Billed per hour, capped monthly',
    'Prometheus metrics endpoint', 'Prometheus metrics and tracing', 'Managed database attachment', 'Priority support');

INSERT INTO plan_features (plan_id, locale, position, feature)
SELECT p.id, 'en', seed.position, seed.feature
FROM plans p
CROSS JOIN (
  SELECT 0 AS position, 'Runs on Docker Swarm and is replaced if its health check fails' AS feature
  UNION ALL SELECT 1, 'CPU and memory limits enforced by the platform'
  UNION ALL SELECT 2, 'Billed per hour, never above the monthly price'
  UNION ALL SELECT 3, 'Support tickets answered by the operators'
) seed
WHERE p.code IN ('starter', 'basic', 'standard', 'plus', 'pro')
  AND NOT EXISTS (SELECT 1 FROM plan_features x WHERE x.plan_id = p.id AND x.locale = 'en');

INSERT INTO plan_features (plan_id, locale, position, feature)
SELECT p.id, 'fa', seed.position, seed.feature
FROM plans p
CROSS JOIN (
  SELECT 0 AS position, 'روی داکر سوارم اجرا می‌شود و اگر بررسی سلامت آن ناموفق باشد جایگزین می‌شود' AS feature
  UNION ALL SELECT 1, 'محدودیت پردازنده و حافظه را سکو اعمال می‌کند'
  UNION ALL SELECT 2, 'صورتحساب ساعتی، هرگز بیشتر از قیمت ماهانه'
  UNION ALL SELECT 3, 'پاسخ به تیکت‌های پشتیبانی توسط اپراتورها'
) seed
WHERE p.code IN ('starter', 'basic', 'standard', 'plus', 'pro')
  AND NOT EXISTS (SELECT 1 FROM plan_features x WHERE x.plan_id = p.id AND x.locale = 'fa');

UPDATE plans
SET description_fa = CASE code
  WHEN 'starter' THEN 'یک API کوچک، یک ربات یا یک وب‌سایت شخصی.'
  WHEN 'basic' THEN 'یک سرویس وب معمولی با ترافیک پایدار.'
  WHEN 'standard' THEN 'یک سرویس تولیدی که برای هر درخواست کار واقعی انجام می‌دهد.'
  WHEN 'plus' THEN 'یک محیط اجرای سنگین‌تر یا حافظه‌ی کاری بزرگ‌تر.'
  WHEN 'pro' THEN 'بزرگ‌ترین اندازه‌ی سلف‌سرویس.'
END
WHERE code IN ('starter', 'basic', 'standard', 'plus', 'pro') AND description_fa = '';
