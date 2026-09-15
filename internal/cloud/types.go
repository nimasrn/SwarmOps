package cloud

import "time"

type User struct {
	CreatedAt   time.Time  `json:"createdAt"`
	Email       string     `json:"email"`
	FullName    string     `json:"fullName"`
	ID          uint64     `json:"id"`
	LastLoginAt *time.Time `json:"lastLoginAt,omitempty"`
	Role        string     `json:"role"`
	Status      string     `json:"status"`
}

// Session is what Login returns. Token is shown to the browser once, as a
// cookie; only its hash is stored.
type Session struct {
	CSRFToken string    `json:"csrfToken"`
	ExpiresAt time.Time `json:"expiresAt"`
	Token     string    `json:"-"`
	User      User      `json:"user"`
}

type Plan struct {
	Active           bool      `json:"active"`
	Category         string    `json:"category"`
	Code             string    `json:"code"`
	CPUMillicores    uint32    `json:"cpuMillicores"`
	Description      string    `json:"description"`
	DiskGiB          uint32    `json:"diskGiB"`
	Features         []string  `json:"features"`
	HourlyPriceRial  int64     `json:"hourlyPriceRial"`
	ID               uint32    `json:"id"`
	MemoryMiB        uint32    `json:"memoryMiB"`
	MonthlyPriceRial int64     `json:"monthlyPriceRial"`
	Name             string    `json:"name"`
	SortOrder        uint16    `json:"sortOrder"`
	UpdatedAt        time.Time `json:"updatedAt"`
}

type PlanInput struct {
	Active           bool     `json:"active"`
	Code             string   `json:"code"`
	CPUMillicores    uint32   `json:"cpuMillicores"`
	Description      string   `json:"description"`
	DiskGiB          uint32   `json:"diskGiB"`
	Features         []string `json:"features"`
	HourlyPriceRial  int64    `json:"hourlyPriceRial"`
	MemoryMiB        uint32   `json:"memoryMiB"`
	MonthlyPriceRial int64    `json:"monthlyPriceRial"`
	Name             string   `json:"name"`
	SortOrder        uint16   `json:"sortOrder"`
}

type Wallet struct {
	BalanceRial int64     `json:"balanceRial"`
	UpdatedAt   time.Time `json:"updatedAt"`
	UserID      uint64    `json:"userId"`
}

type Transaction struct {
	AmountRial       int64     `json:"amountRial"`
	BalanceAfterRial int64     `json:"balanceAfterRial"`
	CreatedAt        time.Time `json:"createdAt"`
	Description      string    `json:"description"`
	ID               uint64    `json:"id"`
	Kind             string    `json:"kind"`
	ReferenceID      uint64    `json:"referenceId,omitempty"`
	ReferenceType    string    `json:"referenceType,omitempty"`
	UserID           uint64    `json:"userId"`
}

type OrderInput struct {
	AppName  string `json:"appName"`
	Image    string `json:"image"`
	Note     string `json:"note"`
	PlanCode string `json:"planCode"`
	Port     uint16 `json:"port"`
}

type OrderItem struct {
	AppName          string `json:"appName"`
	HourlyPriceRial  int64  `json:"hourlyPriceRial"`
	ID               uint64 `json:"id"`
	Image            string `json:"image"`
	MonthlyPriceRial int64  `json:"monthlyPriceRial"`
	PlanCode         string `json:"planCode"`
	PlanName         string `json:"planName"`
	Port             uint16 `json:"port"`
}

type Order struct {
	CustomerEmail string      `json:"customerEmail,omitempty"`
	CustomerNote  string      `json:"customerNote,omitempty"`
	ID            uint64      `json:"id"`
	Items         []OrderItem `json:"items"`
	PlacedAt      time.Time   `json:"placedAt"`
	ReviewReason  string      `json:"reviewReason,omitempty"`
	ReviewedAt    *time.Time  `json:"reviewedAt,omitempty"`
	Status        string      `json:"status"`
	UpfrontRial   int64       `json:"upfrontRial"`
	UpdatedAt     time.Time   `json:"updatedAt"`
	UserID        uint64      `json:"userId"`
}

type Project struct {
	ActivatedAt      *time.Time `json:"activatedAt,omitempty"`
	AppName          string     `json:"appName"`
	CommandID        string     `json:"commandId,omitempty"`
	CreatedAt        time.Time  `json:"createdAt"`
	HourlyPriceRial  int64      `json:"hourlyPriceRial"`
	ID               uint64     `json:"id"`
	MonthlyPriceRial int64      `json:"monthlyPriceRial"`
	OrderItemID      uint64     `json:"orderItemId"`
	PlanCode         string     `json:"planCode"`
	PlanName         string     `json:"planName"`
	ServerID         string     `json:"serverId"`
	Status           string     `json:"status"`
	SuspendedAt      *time.Time `json:"suspendedAt,omitempty"`
	UsageThisMonth   int64      `json:"usageThisMonthRial"`
	UserID           uint64     `json:"userId"`
}

// ProvisionTarget is where and under whose authority an order's application
// is deployed when an administrator confirms it.
type ProvisionTarget struct {
	AuthorityEpoch uint64
	RequestID      string
	ServerID       string
}

type Invoice struct {
	CreatedAt    time.Time     `json:"createdAt"`
	ID           uint64        `json:"id"`
	IssuedAt     *time.Time    `json:"issuedAt,omitempty"`
	Lines        []InvoiceLine `json:"lines,omitempty"`
	Number       string        `json:"number"`
	PeriodEnd    time.Time     `json:"periodEnd"`
	PeriodStart  time.Time     `json:"periodStart"`
	Status       string        `json:"status"`
	SubtotalRial int64         `json:"subtotalRial"`
	TaxRateBP    int64         `json:"taxRateBp"`
	TaxRial      int64         `json:"taxRial"`
	TotalRial    int64         `json:"totalRial"`
	UserID       uint64        `json:"userId"`
}

type InvoiceLine struct {
	AmountRial    int64  `json:"amountRial"`
	Description   string `json:"description"`
	ID            uint64 `json:"id"`
	ProjectID     uint64 `json:"projectId,omitempty"`
	QuantityHours int64  `json:"quantityHours"`
}

type Ticket struct {
	CreatedAt     time.Time       `json:"createdAt"`
	CustomerEmail string          `json:"customerEmail,omitempty"`
	ID            uint64          `json:"id"`
	Messages      []TicketMessage `json:"messages,omitempty"`
	Priority      string          `json:"priority"`
	ProjectID     uint64          `json:"projectId,omitempty"`
	Status        string          `json:"status"`
	Subject       string          `json:"subject"`
	UpdatedAt     time.Time       `json:"updatedAt"`
	UserID        uint64          `json:"userId"`
}

type TicketMessage struct {
	AuthorName string    `json:"authorName"`
	AuthorRole string    `json:"authorRole"`
	Body       string    `json:"body"`
	CreatedAt  time.Time `json:"createdAt"`
	ID         uint64    `json:"id"`
}

type CustomerAccount struct {
	BalanceRial   int64     `json:"balanceRial"`
	CreatedAt     time.Time `json:"createdAt"`
	Email         string    `json:"email"`
	FullName      string    `json:"fullName"`
	LiveProjects  int64     `json:"liveProjects"`
	PendingOrders int64     `json:"pendingOrders"`
	Status        string    `json:"status"`
	UserID        uint64    `json:"userId"`
}

type RevenueMonth struct {
	ChargedRial     int64  `json:"chargedRial"`
	Month           string `json:"month"`
	PayingCustomers int64  `json:"payingCustomers"`
	RefundedRial    int64  `json:"refundedRial"`
	ToppedUpRial    int64  `json:"toppedUpRial"`
}

type Overview struct {
	ActiveProjects    int64 `json:"activeProjects"`
	Customers         int64 `json:"customers"`
	OpenTickets       int64 `json:"openTickets"`
	PendingOrders     int64 `json:"pendingOrders"`
	RevenueMonthRial  int64 `json:"revenueThisMonthRial"`
	SuspendedProjects int64 `json:"suspendedProjects"`
	WalletFloatRial   int64 `json:"walletFloatRial"`
}

// BillingResult reports one billing run.
type BillingResult struct {
	ChargedHours int64 `json:"chargedHours"`
	ChargedRial  int64 `json:"chargedRial"`
	Suspended    int64 `json:"suspended"`
}
