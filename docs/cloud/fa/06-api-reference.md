---
title: "سوارم‌آپس کلود (SwarmOps Cloud)"
subtitle: "مرجع API — فروشگاه و مدیریت تجارت"
date: "شهریور ۱۴۰۵"
toc-title: "فهرست مطالب"
abstract: |
  این مرجع دو رابط HTTP را که سوارم‌آپس کلود به هسته‌ی SwarmOps می‌افزاید مستند می‌کند: API فروشگاه در /api/store/v1 که مرورگر مشتریان به کار می‌برد و API مدیریت تجارت در /api/v1/commerce که کنسول مدیریت به کار می‌برد. برای هر نقطه‌ی پایانی روش و مسیر، محافظت اعمال‌شده، بدنه‌ی درخواست و پاسخ آمده است و قراردادهای مشترک همه‌ی نقاط پایانی — قالب JSON، احراز هویت و CSRF، محدودیت نرخ، یکتایی، صفحه‌بندی و مدل خطا — شرح داده می‌شوند. API عملیاتی که SwarmOps از پیش داشت خارج از دامنه‌ی این سند است. نام فیلدها، مسیرها و مقادیر همان است که در کد آمده و به انگلیسی باقی مانده است.
---

# قراردادها

## قالب داده

درخواست‌ها و پاسخ‌ها JSON با کدگذاری UTF-8 و `Content-Type: application/json` هستند. نام فیلدها camelCase است. زمان‌ها رشته‌های RFC 3339 در UTC هستند، مانند `2026-09-15T17:12:24.010856Z`. پول عدد صحیح **ریال** است (رابط‌ها آن را به تومان، یعنی ریال ÷ ۱۰، نشان می‌دهند). شناسه‌ها عدد صحیح‌اند، به جز شناسه‌ی فرمان که رشته است.

## احراز هویت

| API | نشست | تغییرات افزون بر آن نیاز دارند به |
|---|---|---|
| فروشگاه (`/api/store/v1`) | کوکی `swarmops_store_session` که ورود تنظیم می‌کند: HttpOnly، SameSite=Strict، Path=/، در صورت پیکربندی Secure، با انقضای همراه نشست (۱۲ ساعت) | سرآیند `X-CSRF-Token` برابر `csrfToken` که ورود یا `GET /auth/me` برگردانده است |
| مدیریت تجارت (`/api/v1/commerce`) | نشست اپراتور کنسول | سرآیند `X-CSRF-Token` و فعال بودن این هسته |

: احراز هویت دو رابط

خود توکن نشست هرگز در بدنه‌ی پاسخ نمی‌آید و فقط در کوکی جابه‌جا می‌شود.

در این سند ستون **محافظت** این اختصارها را به کار می‌برد:

| اختصار | معنا |
|---|---|
| **عمومی** | نشست لازم نیست. |
| **مشتری** | نشست معتبر فروشگاه. |
| **مشتری + CSRF** | نشست معتبر فروشگاه و سرآیند CSRF. |
| **اپراتور** | نشست معتبر اپراتور. |
| **اپراتور + CSRF + فعال** | نشست معتبر اپراتور، سرآیند CSRF و فعال بودن این هسته؛ هسته‌ی آماده‌به‌کار با ۴۰۹ پاسخ می‌دهد. |

: سطوح محافظت

## محدودیت نرخ

ثبت‌نام و ورود پس از هشت تلاش ناموفق از یک منبع در پانزده دقیقه، با `429 Too Many Requests` پاسخ می‌دهند. ثبت‌نام بر اساس نشانی کلاینت و ورود بر اساس نشانی کلاینت و ایمیل شمرده می‌شود. نشانی کلاینت فقط از پراکسی‌های مورد اعتماد پیکربندی‌شده `X-Forwarded-For` را می‌پذیرد.

## یکتایی

`POST /wallet/topups` و `POST /customers/{id}/adjustments` سرآیند `Idempotency-Key` را الزامی می‌دانند. تکرار درخواست با همان کلید برای همان مشتری، تراکنش اصلی را برمی‌گرداند و پولی جابه‌جا نمی‌کند. تأیید و بازپرداخت کلیدهایی مشتق از سفارش (`order-charge-<id>`، `cloud-order-<id>`، `order-refund-<id>`) دارند و بدون سرآیند یکتا هستند.

## صفحه‌بندی و فیلترها

نقاط پایانی فهرستی `limit` را از ۱ تا ۵۰۰ می‌پذیرند؛ مقدار ناموجود یا خارج از بازه یعنی ۱۰۰. برخی فهرست‌ها فیلتر `status` هم دارند. نتایج جز در موارد ذکرشده از جدید به قدیم مرتب‌اند.

## خطاها

هر خطا بدنه‌ای JSON با پیام `error` برای کاربر صفحه دارد؛ خطای اعتبارسنجی `field` را نیز نام می‌برد.

| وضعیت | معنا | بدنه |
|---|---|---|
| ۴۰۰ | بدنه JSON معتبر نیست یا فیلد ناشناخته دارد (حداکثر اندازه‌ی بدنه ۱ مگابایت). | `{"error"}` |
| ۴۰۱ | نشست ندارد، نشست منقضی شده یا اعتبارنامه نادرست است. | `{"error"}` |
| ۴۰۳ | توکن CSRF ناموجود یا نادرست، یا حساب اجازه‌ی این کار را ندارد. | `{"error"}` |
| ۴۰۴ | منبع وجود ندارد یا متعلق به مشتری دیگری است. | `{"error"}` |
| ۴۰۹ | تعارض: نام گرفته شده، سفارش دیگر در انتظار نیست، موجودی ناکافی است یا این هسته آماده‌به‌کار است. | `{"error"}`؛ ذخیره‌ی ناکافی `balanceRial` و `requiredRial` را هم برمی‌گرداند |
| ۴۲۲ | اعتبارسنجی ناموفق. | `{"error", "field"}` |
| ۴۲۹ | تلاش‌های بیش از حد ورود یا ثبت‌نام. | `{"error"}` |
| ۵۰۰ | شکست پیش‌بینی‌نشده؛ علت همراه شناسه‌ی درخواست ثبت می‌شود. | `{"error", "requestId"}` |
| ۵۰۳ | سرویس تجارت یا یک وابستگی (مخزن فرمان، دفتر ممیزی) در دسترس نیست. | `{"error"}` |

: مدل خطا

نمونه:

::: ltr
```json
HTTP/1.1 422 Unprocessable Entity

{"error": "use between 10 and 72 characters", "field": "password"}
```
:::

# بازنمایی منابع

قالب JSON هر منبع در سند انگلیسی با نمونه‌ی کامل آمده است. فیلدهای هر منبع:

| منبع | فیلدها | توضیح |
|---|---|---|
| `User` | `id`، `email`، `fullName`، `role`، `status`، `createdAt`، `lastLoginAt` | `role` یکی از `customer` یا `admin`؛ `status` یکی از `active` یا `suspended`. |
| `Session` | `csrfToken`، `expiresAt`، `user` | توکن نشست در بدنه نیست. |
| `Plan` | `id`، `code`، `name`، `category`، `description`، `descriptionFa`، `cpuMillicores`، `memoryMiB`، `diskGiB`، `hourlyPriceRial`، `monthlyPriceRial`، `features`، `featuresFa`، `active`، `sortOrder`، `updatedAt` | متن فارسی در `descriptionFa` و `featuresFa`؛ اگر خالی باشد فروشگاه متن انگلیسی را نشان می‌دهد. |
| `Wallet` | `userId`، `balanceRial`، `updatedAt` | |
| `Transaction` | `id`، `userId`، `kind`، `amountRial`، `balanceAfterRial`، `referenceType`، `referenceId`، `description`، `createdAt` | `kind` یکی از `topup`، `order_charge`، `usage`، `refund` یا `adjustment`؛ مبلغ برای خروج پول منفی است. |
| `Order` | `id`، `userId`، `status`، `upfrontRial`، `customerNote`، `customerEmail`، `reviewReason`، `placedAt`، `reviewedAt`، `updatedAt`، `items` | `status` یکی از `pending`، `rejected`، `cancelled`، `provisioning`، `active` یا `failed`؛ `customerEmail` فقط در پاسخ‌های مدیریت. |
| `OrderItem` | `id`، `planCode`، `planName`، `appName`، `image`، `port`، `hourlyPriceRial`، `monthlyPriceRial` | قیمت‌ها تصویر زمان سفارش‌اند. |
| `Project` | `id`، `userId`، `orderItemId`، `appName`، `planCode`، `planName`، `serverId`، `commandId`، `status`، `hourlyPriceRial`، `monthlyPriceRial`، `usageThisMonthRial`، `createdAt`، `activatedAt`، `suspendedAt` | `status` یکی از `provisioning`، `active`، `suspended`، `failed` یا `deleted`. |
| `Invoice` | `id`، `userId`، `number`، `status`، `periodStart`، `periodEnd`، `subtotalRial`، `taxRateBp`، `taxRial`، `totalRial`، `issuedAt`، `createdAt`، `lines` | `lines` فقط هنگام خواندن یک فاکتور؛ مالیات موجود در جمع *T* با نرخ *r* واحد پایه ⌊*T*·*r*/(10000 + *r*)⌋ و `subtotalRial` برابر `totalRial` منهای `taxRial`. |
| `InvoiceLine` | `id`، `projectId`، `description`، `quantityHours`، `amountRial` | |
| `Ticket` | `id`، `userId`، `subject`، `priority`، `status`، `projectId`، `customerEmail`، `createdAt`، `updatedAt`، `messages` | `messages` هنگام خواندن یک تیکت. |
| `TicketMessage` | `id`، `authorName`، `authorRole`، `body`، `createdAt` | |

: فیلدهای منابع

# API فروشگاه

مسیر پایه: `/api/store/v1`.

## خلاصه

| روش | مسیر | محافظت | موفقیت |
|---|--------------|---------|-------|
| GET | `/plans` | عمومی | ۲۰۰ `Plan[]` |
| POST | `/auth/register` | عمومی، با محدودیت نرخ | ۲۰۱ `User` |
| POST | `/auth/login` | عمومی، با محدودیت نرخ | ۲۰۰ `Session`، کوکی را تنظیم می‌کند |
| POST | `/auth/logout` | مشتری + CSRF | ۲۰۴، کوکی را پاک می‌کند |
| GET | `/auth/me` | مشتری | ۲۰۰ `Session` |
| GET | `/wallet` | مشتری | ۲۰۰ `{wallet, transactions}` |
| POST | `/wallet/topups` | مشتری + CSRF، `Idempotency-Key` | ۲۰۰ `Transaction` |
| GET | `/orders` | مشتری | ۲۰۰ `Order[]` |
| POST | `/orders` | مشتری + CSRF | ۲۰۱ `Order` |
| GET | `/orders/{id}` | مشتری | ۲۰۰ `Order` |
| POST | `/orders/{id}/cancel` | مشتری + CSRF | ۲۰۰ `Order` |
| GET | `/projects` | مشتری | ۲۰۰ `Project[]` |
| GET | `/invoices` | مشتری | ۲۰۰ `Invoice[]` |
| GET | `/invoices/{id}` | مشتری | ۲۰۰ `Invoice` با `lines` |
| GET | `/tickets` | مشتری | ۲۰۰ `Ticket[]` |
| POST | `/tickets` | مشتری + CSRF | ۲۰۱ `Ticket` |
| GET | `/tickets/{id}` | مشتری | ۲۰۰ `Ticket` با `messages` |
| POST | `/tickets/{id}/replies` | مشتری + CSRF | ۲۰۰ `Ticket` |
| POST | `/tickets/{id}/close` | مشتری + CSRF | ۲۰۰ `Ticket` |

: نقاط پایانی فروشگاه

## پلن‌ها

**`GET /plans`** پلن‌های در حال عرضه را به ترتیب نمایش برمی‌گرداند.

## ثبت‌نام و ورود

**`POST /auth/register`** حساب مشتری و کیف پول آن را می‌سازد:

::: ltr
```json
{"email": "sara.demo@example.com", "fullName": "Sara Ahmadi", "password": "at least ten characters"}
```
:::

ایمیل باید معتبر و استفاده‌نشده باشد، نام کامل الزامی است و گذرواژه ۱۰ تا ۷۲ نویسه. ایمیل تکراری ۴۰۹ می‌دهد. ثبت‌نام وارد نمی‌کند؛ فروشگاه پس از آن ورود را فرا می‌خواند.

**`POST /auth/login`** بدنه‌ی `{"email", "password"}` می‌گیرد، `Session` برمی‌گرداند و کوکی نشست را تنظیم می‌کند. اعتبارنامه‌ی نادرست ۴۰۱ و حساب معلق ۴۰۳ می‌دهد.

**`POST /auth/logout`** نشست را باطل می‌کند.

**`GET /auth/me`** نشست فعلی را همراه نسخه‌ی تازه‌ی توکن CSRF برمی‌گرداند. فروشگاه آن را هنگام بارگذاری صفحه و یک بار دیگر وقتی تغییری به دلیل توکن کهنه رد شود فرا می‌خواند.

## کیف پول

**`GET /wallet`** بدنه‌ی `{"wallet": Wallet, "transactions": Transaction[]}` را برمی‌گرداند؛ دفتر کل از جدید به قدیم و `limit` پذیرفته می‌شود.

**`POST /wallet/topups`** تأیید درگاه را شبیه‌سازی و کیف پول را اعتبار می‌دهد؛ سرآیند `Idempotency-Key` الزامی است.

::: ltr
```json
{"amountRial": 5000000}
```
:::

مبلغ باید بین ۱۰۰٬۰۰۰ و ۲٬۰۰۰٬۰۰۰٬۰۰۰ ریال باشد. شارژ موفق، پروژه‌های معلقی را که موجودی جدید توان پرداختشان را دارد از سر می‌گیرد.

## سفارش‌ها

**`POST /orders`** سفارش ثبت می‌کند:

::: ltr
```json
{"planCode": "starter", "appName": "sara-api", "image": "mendhak/http-https-echo:41",
 "port": 8080, "note": "This image answers /healthz on 8080."}
```
:::

| فیلد | قاعده |
|---|---|
| `planCode` | پلنی در حال عرضه. |
| `appName` | یک حرف کوچک و سپس حداکثر ۴۰ حرف کوچک، رقم یا خط تیره؛ در استفاده‌ی پروژه، سفارش در جریان یا برنامه نباشد (در غیر این صورت ۴۰۹). |
| `image` | بدون فاصله؛ یا digest (`@sha256:…`) یا برچسبی غیر از `latest`. |
| `port` | ۱ تا ۶۵۵۳۵؛ درگاهی که برنامه روی آن به `GET /healthz` پاسخ می‌دهد. |
| `note` | اختیاری، کمتر از ۵۰۰ نویسه. |

: فیلدهای سفارش

**`GET /orders`** و **`GET /orders/{id}`** سفارش‌های خود مشتری را می‌خوانند؛ سفارش مشتری دیگر ۴۰۴ می‌دهد.

**`POST /orders/{id}/cancel`** سفارش در انتظار را لغو می‌کند؛ سفارش غیرِ در انتظار ۴۰۹ می‌دهد.

## پروژه‌ها و فاکتورها

**`GET /projects`** پروژه‌های مشتری را با هزینه‌ی ماه جاری فهرست می‌کند. **`GET /invoices`** فاکتورها و **`GET /invoices/{id}`** یک فاکتور را با سطرهایش برمی‌گرداند.

## تیکت‌های پشتیبانی

**`POST /tickets`** تیکت باز می‌کند:

::: ltr
```json
{"subject": "How do I reach sara-api from the internet?",
 "body": "The project page says sara-api is active, …", "priority": "normal", "projectId": 3}
```
:::

- موضوع ۳ تا ۱۶۰ نویسه و بدنه کمتر از ۵٬۰۰۰ نویسه.
- `priority` یکی از `low`، `normal` یا `high`.
- `projectId` اختیاری است؛ صفر یعنی بدون پروژه و مقدار دیگر باید یکی از پروژه‌های خود مشتری باشد.

**`GET /tickets`** پارامترهای `status` (`open`، `answered`، `closed`) و `limit` را می‌پذیرد. **`POST /tickets/{id}/replies`** بدنه‌ی `{"body"}` می‌گیرد و **`POST /tickets/{id}/close`** تیکت را می‌بندد.

# API مدیریت تجارت

مسیر پایه: `/api/v1/commerce`. اگر سرویس تجارت روی کنترل‌گر فعال نباشد، همه‌ی نقاط پایانی ۵۰۳ می‌دهند.

## خلاصه

| روش | مسیر | محافظت | موفقیت |
|---|--------------|---------|-------|
| GET | `/overview` | اپراتور | ۲۰۰ `Overview` |
| GET | `/customers` | اپراتور | ۲۰۰ `CustomerAccount[]` |
| GET | `/customers/{id}/wallet` | اپراتور | ۲۰۰ `{wallet, transactions, ledgerConsistent}` |
| POST | `/customers/{id}/status` | اپراتور + CSRF + فعال | ۲۰۴ |
| POST | `/customers/{id}/adjustments` | اپراتور + CSRF + فعال، `Idempotency-Key` | ۲۰۰ `Transaction` |
| GET | `/plans` | اپراتور | ۲۰۰ `Plan[]` شامل پلن‌های خارج از عرضه |
| PUT | `/plans/{code}` | اپراتور + CSRF + فعال | ۲۰۰ `Plan` |
| GET | `/orders` | اپراتور | ۲۰۰ `Order[]` |
| POST | `/orders/{id}/confirm` | اپراتور + CSRF + فعال | ۲۰۰ `{order, project, command}` |
| POST | `/orders/{id}/reject` | اپراتور + CSRF + فعال | ۲۰۰ `Order` |
| GET | `/projects` | اپراتور | ۲۰۰ `Project[]` |
| GET | `/invoices` | اپراتور | ۲۰۰ `Invoice[]` |
| GET | `/invoices/{id}` | اپراتور | ۲۰۰ `Invoice` با `lines` |
| POST | `/invoices/issue` | اپراتور + CSRF + فعال | ۲۰۰ `{issued}` |
| POST | `/billing/run` | اپراتور + CSRF + فعال | ۲۰۰ `BillingResult` |
| GET | `/revenue` | اپراتور | ۲۰۰ `RevenueMonth[]` |
| GET | `/tickets` | اپراتور | ۲۰۰ `Ticket[]` |
| GET | `/tickets/{id}` | اپراتور | ۲۰۰ `Ticket` با `messages` |
| POST | `/tickets/{id}/replies` | اپراتور + CSRF + فعال | ۲۰۰ `Ticket` |
| POST | `/tickets/{id}/close` | اپراتور + CSRF + فعال | ۲۰۰ `Ticket` |

: نقاط پایانی مدیریت تجارت

هر تغییر به نام اپراتور در دفتر ممیزی ثبت می‌شود.

## نمای کلی و گزارش‌ها

**`GET /overview`** این فیلدها را برمی‌گرداند: `customers`، `pendingOrders`، `activeProjects`، `suspendedProjects`، `openTickets`، `revenueThisMonthRial` (هزینه‌ها منهای بازپرداخت‌ها از آغاز ماه) و `walletFloatRial` (مجموع موجودی نزد مشتریان).

**`GET /revenue?months=12`** برای هر ماه، از جدید به قدیم، `{"month", "chargedRial", "refundedRial", "toppedUpRial", "payingCustomers"}` برمی‌گرداند. `months` از ۱ تا ۶۰ است؛ مقدار ناموجود یا خارج از بازه یعنی ۱۲.

## مشتریان و کیف پول‌ها

**`GET /customers`** فهرستی از `CustomerAccount` با فیلدهای `userId`، `email`، `fullName`، `status`، `balanceRial`، `liveProjects`، `pendingOrders` و `createdAt` برمی‌گرداند.

**`GET /customers/{id}/wallet`** کیف پول، دفتر کل و `ledgerConsistent` را برمی‌گرداند که اگر موجودی با مجموع دفتر کل برابر باشد true است.

**`POST /customers/{id}/status`** بدنه‌ی `{"status": "active" | "suspended"}` می‌گیرد؛ تعلیق همه‌ی نشست‌های مشتری را باطل می‌کند.

**`POST /customers/{id}/adjustments`** اصلاحی ثبت می‌کند:

::: ltr
```json
{"amountRial": -50000, "reason": "Refund of a duplicate top-up"}
```
:::

مبلغ نباید صفر باشد، دلیل و سرآیند `Idempotency-Key` الزامی‌اند. اصلاحی که موجودی را منفی کند ۴۰۹ می‌دهد.

## پلن‌ها

**`PUT /plans/{code}`** پلن می‌سازد یا به‌روز می‌کند. بدنه همه‌ی فیلدهای `Plan` جز `id`، `category` و `updatedAt` است. قواعد:

- `code`: ۲ تا ۳۲ حرف کوچک، رقم یا خط تیره.
- `description` و `descriptionFa`: هر کدام کمتر از ۲۵۵ نویسه.
- `cpuMillicores`: ۱۰۰ تا ۶۴٬۰۰۰؛ `memoryMiB`: ۱۲۸ تا ۲۶۲٬۱۴۴.
- `hourlyPriceRial` بزرگ‌تر از صفر و `monthlyPriceRial` دست‌کم برابر قیمت ساعتی.
- `features` و `featuresFa`: هر کدام حداکثر ۱۲ مورد و هر مورد کمتر از ۱۶۰ نویسه؛ ذخیره هر دو فهرست را جایگزین می‌کند.

`active` برابر false پلن را از فروشگاه خارج می‌کند؛ سفارش‌های موجود قیمت خود را نگه می‌دارند.

## سفارش‌ها

**`GET /orders?status=pending`** سفارش‌های همه‌ی مشتریان را با فیلتر `status` فهرست می‌کند.

**`POST /orders/{id}/confirm`** سفارش در انتظار را روی یک سرور تأیید می‌کند؛ بدنه `{"serverId": "server-…"}` است. بررسی‌ها به ترتیب:

1. تغییرات فعال باشد (در غیر این صورت ۴۰۳).
2. مخزن فرمان قابل نوشتن باشد (در غیر این صورت ۵۰۳).
3. دفتر ممیزی قابل نوشتن باشد (در غیر این صورت ۵۰۳).
4. سرور ذخیره‌شده باشد (در غیر این صورت ۴۲۲ با `field: serverId`).
5. سرور به یک مدیر Swarm متصل باشد (در غیر این صورت ۴۰۹).
6. برنامه در برنامه‌ریزی روی آن سرور موفق شود (در غیر این صورت ۴۲۲ با پیام برنامه‌ریز).
7. کیف پول ۲۴ ساعت قیمت را داشته باشد (در غیر این صورت ۴۰۹ با `balanceRial` و `requiredRial`).

در صورت موفقیت، ساعت نخست کسر، پروژه ایجاد و استقرار در یک تراکنش در صف قرار می‌گیرد و پاسخ `{"order", "project", "command"}` است که `command.action` برابر `application.deploy` و `command.state` برابر `queued` است. سفارش و پروژه با پایان فرمان `active` یا `failed` می‌شوند و استقرار ناموفق خودکار بازپرداخت می‌شود.

**`POST /orders/{id}/reject`** بدنه‌ی `{"reason"}` می‌گیرد که الزامی است و به مشتری نشان داده می‌شود.

## پروژه‌ها، فاکتورها و صورتحساب

**`GET /projects?status=active`** پروژه‌های همه‌ی مشتریان را فهرست می‌کند.

**`POST /invoices/issue`** بدنه‌ی `{"month": "2026-08"}` به قالب `YYYY-MM` می‌گیرد و `{"issued": n}`، تعداد فاکتورهای ایجادشده، را برمی‌گرداند؛ صدور دوباره‌ی یک ماه چیزی ایجاد نمی‌کند. ماه نادرست ۴۲۲ با پیام `Give the month as YYYY-MM` می‌دهد.

**`POST /billing/run`** صورتحساب ساعتی را فوراً اجرا و `{"chargedHours", "chargedRial", "suspended"}` را برمی‌گرداند؛ ساعت‌های قبلاً حساب‌شده دوباره حساب نمی‌شوند.

## تیکت‌ها

**`GET /tickets?status=open`** تیکت‌های همه‌ی مشتریان را فهرست می‌کند. **`POST /tickets/{id}/replies`** بدنه‌ی `{"body"}` می‌گیرد و تیکت را `answered` می‌کند. **`POST /tickets/{id}/close`** آن را می‌بندد.

# نشست نمونه

فراخوانی‌های فروشگاه هنگامی که مشتری ثبت‌نام، شارژ و سفارش می‌کند:

::: ltr
```http
POST /api/store/v1/auth/register        → 201
POST /api/store/v1/auth/login           → 200  Set-Cookie: swarmops_store_session=…
GET  /api/store/v1/wallet               → 200
POST /api/store/v1/wallet/topups        → 200  (X-CSRF-Token, Idempotency-Key)
POST /api/store/v1/orders               → 201
```
:::

فراخوانی‌های کنسول هنگامی که مدیر سفارش را تأیید می‌کند:

::: ltr
```http
GET  /api/v1/commerce/orders?status=pending   → 200
POST /api/v1/commerce/orders/3/confirm        → 200  (X-CSRF-Token)
```
:::

این کدهای وضعیت همان‌هایی هستند که مرورگر در اجرای سرتاسری ثبت کرد (طرح و گزارش آزمون).
