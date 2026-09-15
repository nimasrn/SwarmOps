package cloud

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/nimasrn/SwarmOps/internal/domain"
	"github.com/nimasrn/SwarmOps/internal/ops"
	"github.com/nimasrn/SwarmOps/internal/queue"
	"github.com/nimasrn/SwarmOps/internal/sqlstore/sqltest"
	"golang.org/x/crypto/bcrypt"
)

type testClock struct {
	mu  sync.Mutex
	now time.Time
}

func (c *testClock) Now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.now
}

func (c *testClock) Advance(d time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.now = c.now.Add(d)
}

// failingQueue wraps the real command ledger and can be told to refuse, to
// prove that a confirmation which cannot queue its deployment leaves nothing
// behind.
type failingQueue struct {
	fail  error
	store *queue.Store
}

func (q *failingQueue) SubmitInTx(ctx context.Context, tx *sql.Tx, input queue.SubmitInput) (queue.Submission, []string, error) {
	if q.fail != nil {
		return queue.Submission{}, nil, q.fail
	}
	return q.store.SubmitInTx(ctx, tx, input)
}

func (q *failingQueue) ForgetInputs(ids []string) { q.store.ForgetInputs(ids) }

type recordingProvisioner struct {
	mu        sync.Mutex
	resumed   []string
	suspended []string
}

func (p *recordingProvisioner) Suspend(_ context.Context, project Project) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.suspended = append(p.suspended, project.AppName)
	return nil
}

func (p *recordingProvisioner) Resume(_ context.Context, project Project) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.resumed = append(p.resumed, project.AppName)
	return nil
}

type fixture struct {
	clock       *testClock
	commands    *failingQueue
	provisioner *recordingProvisioner
	service     *Service
}

func newFixture(t *testing.T) fixture {
	t.Helper()
	db := sqltest.Open(t)
	store, err := queue.Open(db, t.TempDir(), sqltest.Key(), 100)
	if err != nil {
		t.Fatal(err)
	}
	clock := &testClock{now: time.Date(2026, 9, 10, 10, 30, 0, 0, time.UTC)}
	commands := &failingQueue{store: store}
	provisioner := &recordingProvisioner{}
	service, err := New(db, commands, provisioner, Options{BcryptCost: bcrypt.MinCost, ReserveHours: 2, TaxRateBP: 1000, Now: clock.Now})
	if err != nil {
		t.Fatal(err)
	}
	return fixture{clock: clock, commands: commands, provisioner: provisioner, service: service}
}

func (f fixture) customer(t *testing.T, email string, balance int64) User {
	t.Helper()
	user, err := f.service.Register(context.Background(), email, "Test Customer", "correct-horse-battery")
	if err != nil {
		t.Fatal(err)
	}
	if balance > 0 {
		if _, err := f.service.TopUp(context.Background(), user.ID, balance, "initial-"+email); err != nil {
			t.Fatal(err)
		}
	}
	return user
}

func (f fixture) admin(t *testing.T) User {
	t.Helper()
	admin, err := f.service.EnsureOperator(context.Background(), "operator")
	if err != nil {
		t.Fatal(err)
	}
	return admin
}

func (f fixture) plan(t *testing.T, code string, hourly, monthly int64) Plan {
	t.Helper()
	plan, err := f.service.SavePlan(context.Background(), PlanInput{Active: true, Code: code, CPUMillicores: 500, Description: "test plan",
		DiskGiB: 10, Features: []string{"one", "two"}, HourlyPriceRial: hourly, MemoryMiB: 512, MonthlyPriceRial: monthly, Name: "Test " + code})
	if err != nil {
		t.Fatal(err)
	}
	return plan
}

func (f fixture) order(t *testing.T, customer User, planCode, appName string) Order {
	t.Helper()
	order, err := f.service.PlaceOrder(context.Background(), customer.ID, OrderInput{AppName: appName, Image: "ghcr.io/acme/" + appName + ":1.0.0", PlanCode: planCode, Port: 8080})
	if err != nil {
		t.Fatal(err)
	}
	return order
}

func (f fixture) balance(t *testing.T, userID uint64) int64 {
	t.Helper()
	wallet, err := f.service.Wallet(context.Background(), userID)
	if err != nil {
		t.Fatal(err)
	}
	return wallet.BalanceRial
}

func TestRegisterLoginAndSessionsAreSafe(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	ctx := context.Background()
	user := f.customer(t, "Ada@Example.com", 0)
	if user.Email != "ada@example.com" || user.Role != RoleCustomer {
		t.Fatalf("registered user = %#v", user)
	}
	if _, err := f.service.Register(ctx, "ada@example.com", "Someone Else", "another-long-password"); !errors.Is(err, ErrConflict) {
		t.Fatalf("duplicate email = %v, want conflict", err)
	}
	if _, err := f.service.Register(ctx, "x@operators.swarmops.invalid", "Impostor", "another-long-password"); err == nil {
		t.Fatal("a customer registered under the reserved operator domain")
	}
	if _, err := f.service.Login(ctx, "ada@example.com", "wrong-password"); !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("wrong password = %v", err)
	}
	if _, err := f.service.Login(ctx, "nobody@example.com", "correct-horse-battery"); !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("unknown email = %v", err)
	}
	session, err := f.service.Login(ctx, "ADA@example.com", "correct-horse-battery")
	if err != nil {
		t.Fatal(err)
	}
	var stored int
	if err := f.service.db.Pool().QueryRow("SELECT COUNT(*) FROM user_sessions WHERE token_hash = ?", session.Token).Scan(&stored); err != nil {
		t.Fatal(err)
	}
	if stored != 0 {
		t.Fatal("a session token was stored in the clear")
	}
	resolved, err := f.service.Authenticate(ctx, session.Token)
	if err != nil || resolved.User.ID != user.ID || !VerifyCSRF(resolved, session.CSRFToken) || VerifyCSRF(resolved, "forged") {
		t.Fatalf("authenticate = %#v, %v", resolved, err)
	}
	if err := f.service.Logout(ctx, session.Token); err != nil {
		t.Fatal(err)
	}
	if _, err := f.service.Authenticate(ctx, session.Token); !errors.Is(err, ErrSessionExpired) {
		t.Fatalf("session after logout = %v", err)
	}
	second, err := f.service.Login(ctx, "ada@example.com", "correct-horse-battery")
	if err != nil {
		t.Fatal(err)
	}
	f.clock.Advance(13 * time.Hour)
	if _, err := f.service.Authenticate(ctx, second.Token); !errors.Is(err, ErrSessionExpired) {
		t.Fatalf("expired session = %v", err)
	}
}

func TestASuspendedCustomerLosesEverySession(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	ctx := context.Background()
	user := f.customer(t, "bob@example.com", 0)
	session, err := f.service.Login(ctx, "bob@example.com", "correct-horse-battery")
	if err != nil {
		t.Fatal(err)
	}
	if err := f.service.SetCustomerStatus(ctx, user.ID, "suspended"); err != nil {
		t.Fatal(err)
	}
	if _, err := f.service.Authenticate(ctx, session.Token); err == nil {
		t.Fatal("a suspended customer's session still authenticated")
	}
	if _, err := f.service.Login(ctx, "bob@example.com", "correct-horse-battery"); !errors.Is(err, ErrForbidden) {
		t.Fatalf("suspended login = %v", err)
	}
}

// Fifty charges race for one wallet. The row lock must serialise them so that
// exactly as many succeed as the balance covers, the balance never goes below
// zero, and it still equals the sum of the ledger afterwards.
func TestConcurrentChargesNeverOverdrawAndMatchTheLedger(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	ctx := context.Background()
	user := f.customer(t, "race@example.com", 1_000_000)
	var wg sync.WaitGroup
	var mu sync.Mutex
	succeeded, refused := 0, 0
	for index := range 50 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			err := f.service.db.WithTx(ctx, func(tx *sql.Tx) error {
				_, err := f.service.applyTx(ctx, tx, ledgerEntry{amount: -30_000, description: "race", idempotencyKey: fmt.Sprintf("race-%d", index), kind: KindUsage, userID: user.ID})
				return err
			})
			mu.Lock()
			defer mu.Unlock()
			switch {
			case err == nil:
				succeeded++
			case errors.Is(err, ErrInsufficientFunds):
				refused++
			default:
				t.Error(err)
			}
		}()
	}
	wg.Wait()
	if succeeded != 33 || refused != 17 {
		t.Fatalf("succeeded=%d refused=%d, want 33 and 17", succeeded, refused)
	}
	if balance := f.balance(t, user.ID); balance != 10_000 {
		t.Fatalf("balance = %d, want 10000", balance)
	}
	if consistent, err := f.service.LedgerConsistent(ctx, user.ID); err != nil || !consistent {
		t.Fatalf("ledger consistent = %t, %v", consistent, err)
	}
}

func TestATopUpIsCreditedOncePerIdempotencyKey(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	ctx := context.Background()
	user := f.customer(t, "pay@example.com", 0)
	for range 3 {
		if _, err := f.service.TopUp(ctx, user.ID, 500_000, "gateway-callback-1"); err != nil {
			t.Fatal(err)
		}
	}
	if balance := f.balance(t, user.ID); balance != 500_000 {
		t.Fatalf("balance after a repeated callback = %d", balance)
	}
	if _, err := f.service.TopUp(ctx, user.ID, 900_000, "gateway-callback-1"); !errors.Is(err, ErrConflict) {
		t.Fatalf("reused key with another amount = %v", err)
	}
	if _, err := f.service.TopUp(ctx, user.ID, 10, "tiny"); err == nil {
		t.Fatal("a top-up below the minimum was accepted")
	}
}

func TestConfirmingAnOrderChargesProvisionsAndQueuesTogether(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	ctx := context.Background()
	f.plan(t, "small", 10_000, 5_000_000)
	customer := f.customer(t, "shop@example.com", 200_000)
	order := f.order(t, customer, "small", "shop")
	if order.Status != OrderPending || len(order.Items) != 1 || order.Items[0].HourlyPriceRial != 10_000 {
		t.Fatalf("placed order = %#v", order)
	}
	confirmed, project, command, err := f.service.ConfirmOrder(ctx, f.admin(t), order.ID, ProvisionTarget{AuthorityEpoch: 1, RequestID: "req-1", ServerID: "server-1"})
	if err != nil {
		t.Fatal(err)
	}
	if confirmed.Status != OrderProvisioning || confirmed.UpfrontRial != 10_000 || project.Status != ProjectProvisioning || project.CommandID != command.ID {
		t.Fatalf("confirmed = %#v project = %#v", confirmed, project)
	}
	if command.Action != DeployAction || command.Target != "application/shop" || command.ServerID != "server-1" || command.State != domain.CommandQueued {
		t.Fatalf("queued command = %#v", command)
	}
	if balance := f.balance(t, customer.ID); balance != 190_000 {
		t.Fatalf("balance after confirmation = %d", balance)
	}
	record, found, err := f.commands.store.ClaimDue()
	if err != nil || !found {
		t.Fatalf("claim = %v, %t", err, found)
	}
	var payload struct {
		Spec ops.ApplicationSpec `json:"spec"`
	}
	if err := json.Unmarshal(record.Payload, &payload); err != nil {
		t.Fatal(err)
	}
	if payload.Spec.Name != "shop" || payload.Spec.CPUs != 0.5 || payload.Spec.MemoryMiB != 512 || payload.Spec.Port != 8080 {
		t.Fatalf("deployment spec = %#v", payload.Spec)
	}
	if _, _, _, err := f.service.ConfirmOrder(ctx, f.admin(t), order.ID, ProvisionTarget{AuthorityEpoch: 1, ServerID: "server-1"}); !errors.Is(err, ErrConflict) {
		t.Fatalf("confirming twice = %v", err)
	}
}

// If the deployment cannot be queued, the confirmation must leave no trace:
// no charge, no project, no usage, and the order still waiting for review.
func TestAConfirmationThatCannotQueueItsDeploymentChargesNothing(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	ctx := context.Background()
	f.plan(t, "small", 10_000, 5_000_000)
	customer := f.customer(t, "atomic@example.com", 200_000)
	order := f.order(t, customer, "small", "atomic")
	f.commands.fail = errors.New("command ledger unavailable")
	if _, _, _, err := f.service.ConfirmOrder(ctx, f.admin(t), order.ID, ProvisionTarget{AuthorityEpoch: 1, ServerID: "server-1"}); err == nil {
		t.Fatal("confirmation succeeded without queueing its deployment")
	}
	if balance := f.balance(t, customer.ID); balance != 200_000 {
		t.Fatalf("the wallet was charged for a deployment that was never queued: %d", balance)
	}
	var projects, usage int
	if err := f.service.db.Pool().QueryRow("SELECT (SELECT COUNT(*) FROM projects), (SELECT COUNT(*) FROM usage_records)").Scan(&projects, &usage); err != nil {
		t.Fatal(err)
	}
	reloaded, err := f.service.Order(ctx, order.ID)
	if err != nil || projects != 0 || usage != 0 || reloaded.Status != OrderPending {
		t.Fatalf("after a failed confirmation: projects=%d usage=%d order=%q err=%v", projects, usage, reloaded.Status, err)
	}
	if consistent, _ := f.service.LedgerConsistent(ctx, customer.ID); !consistent {
		t.Fatal("the ledger diverged from the balance")
	}
}

func TestConfirmationRequiresTheReserve(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	f.plan(t, "small", 100_000, 5_000_000)
	customer := f.customer(t, "poor@example.com", 150_000)
	order := f.order(t, customer, "small", "poor")
	_, _, _, err := f.service.ConfirmOrder(context.Background(), f.admin(t), order.ID, ProvisionTarget{AuthorityEpoch: 1, ServerID: "server-1"})
	var funds *FundsError
	if !errors.As(err, &funds) || funds.Required != 200_000 || !errors.Is(err, ErrInsufficientFunds) {
		t.Fatalf("confirmation under the reserve = %v", err)
	}
}

func TestTheDeploymentOutcomeActivatesOrFailsAndRefundsOnce(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	ctx := context.Background()
	f.plan(t, "small", 10_000, 5_000_000)
	customer := f.customer(t, "outcome@example.com", 500_000)
	admin := f.admin(t)

	good := f.order(t, customer, "small", "good")
	_, _, goodCommand, err := f.service.ConfirmOrder(ctx, admin, good.ID, ProvisionTarget{AuthorityEpoch: 1, ServerID: "server-1"})
	if err != nil {
		t.Fatal(err)
	}
	goodCommand.State = domain.CommandSucceeded
	if err := f.service.OnCommandTransition(ctx, goodCommand); err != nil {
		t.Fatal(err)
	}
	if order, _ := f.service.Order(ctx, good.ID); order.Status != OrderActive {
		t.Fatalf("succeeded order = %q", order.Status)
	}

	bad := f.order(t, customer, "small", "bad")
	_, badProject, badCommand, err := f.service.ConfirmOrder(ctx, admin, bad.ID, ProvisionTarget{AuthorityEpoch: 1, ServerID: "server-1"})
	if err != nil {
		t.Fatal(err)
	}
	before := f.balance(t, customer.ID)
	badCommand.State = domain.CommandNeedsAttention
	for range 2 {
		if err := f.service.OnCommandTransition(ctx, badCommand); err != nil {
			t.Fatal(err)
		}
	}
	if after := f.balance(t, customer.ID); after != before+10_000 {
		t.Fatalf("refund: balance %d -> %d, want exactly one 10000 refund", before, after)
	}
	project, err := f.service.Project(ctx, badProject.ID)
	if err != nil || project.Status != ProjectFailed {
		t.Fatalf("failed project = %#v, %v", project, err)
	}
	if project.UsageThisMonth != 0 {
		t.Fatalf("a refunded project still shows %d rial of usage", project.UsageThisMonth)
	}
	// The month's invoice bills only the hour that was kept.
	if _, err := f.service.IssueInvoices(ctx, f.clock.Now()); err != nil {
		t.Fatal(err)
	}
	invoices, err := f.service.Invoices(ctx, customer.ID, 10)
	if err != nil || len(invoices) != 1 || invoices[0].TotalRial != 10_000 {
		t.Fatalf("invoices after a refund = %#v, %v; want one invoice of 10000", invoices, err)
	}
}

// Billing charges each hour once, never more than the plan's monthly price in
// a month, and repeating a run charges nothing.
func TestBillingIsHourlyCappedAndIdempotent(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	ctx := context.Background()
	f.plan(t, "capped", 10_000, 30_000)
	customer := f.customer(t, "billing@example.com", 1_000_000)
	order := f.order(t, customer, "capped", "billed")
	_, project, command, err := f.service.ConfirmOrder(ctx, f.admin(t), order.ID, ProvisionTarget{AuthorityEpoch: 1, ServerID: "server-1"})
	if err != nil {
		t.Fatal(err)
	}
	command.State = domain.CommandSucceeded
	if err := f.service.OnCommandTransition(ctx, command); err != nil {
		t.Fatal(err)
	}
	f.clock.Advance(5 * time.Hour)
	first, err := f.service.RunBilling(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if first.ChargedHours != 5 || first.ChargedRial != 20_000 {
		t.Fatalf("first run = %#v, want 5 hours and 20000 rials (the cap is reached after the third hour)", first)
	}
	second, err := f.service.RunBilling(ctx)
	if err != nil || second.ChargedHours != 0 || second.ChargedRial != 0 {
		t.Fatalf("repeated run = %#v, %v", second, err)
	}
	if balance := f.balance(t, customer.ID); balance != 1_000_000-30_000 {
		t.Fatalf("balance = %d", balance)
	}
	reloaded, err := f.service.Project(ctx, project.ID)
	if err != nil || reloaded.UsageThisMonth != 30_000 {
		t.Fatalf("usage this month = %d, %v", reloaded.UsageThisMonth, err)
	}
}

func TestAWalletThatCannotPaySuspendsAndATopUpResumesWithoutBackCharging(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	ctx := context.Background()
	f.plan(t, "hourly", 100_000, 50_000_000)
	customer := f.customer(t, "empty@example.com", 200_000)
	order := f.order(t, customer, "hourly", "thrifty")
	_, project, command, err := f.service.ConfirmOrder(ctx, f.admin(t), order.ID, ProvisionTarget{AuthorityEpoch: 1, ServerID: "server-1"})
	if err != nil {
		t.Fatal(err)
	}
	command.State = domain.CommandSucceeded
	if err := f.service.OnCommandTransition(ctx, command); err != nil {
		t.Fatal(err)
	}
	f.clock.Advance(3 * time.Hour)
	result, err := f.service.RunBilling(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if result.ChargedHours != 1 || result.Suspended != 1 || f.balance(t, customer.ID) != 0 {
		t.Fatalf("billing an emptying wallet = %#v, balance %d", result, f.balance(t, customer.ID))
	}
	if suspended, _ := f.service.Project(ctx, project.ID); suspended.Status != ProjectSuspended || len(f.provisioner.suspended) != 1 {
		t.Fatalf("project after running out = %q, provisioner %v", suspended.Status, f.provisioner.suspended)
	}
	f.clock.Advance(5 * time.Hour)
	if _, err := f.service.TopUp(ctx, customer.ID, 1_000_000, "rescue"); err != nil {
		t.Fatal(err)
	}
	if resumed, _ := f.service.Project(ctx, project.ID); resumed.Status != ProjectActive || len(f.provisioner.resumed) != 1 {
		t.Fatalf("project after top-up = %q, provisioner %v", resumed.Status, f.provisioner.resumed)
	}
	result, err = f.service.RunBilling(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if result.ChargedHours != 1 || f.balance(t, customer.ID) != 900_000 {
		t.Fatalf("after resuming = %#v, balance %d; the suspended hours must not be charged", result, f.balance(t, customer.ID))
	}
}

func TestInvoicesStateIncludedTaxAndAreIssuedOnce(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	ctx := context.Background()
	f.plan(t, "invoiced", 11_000, 50_000_000)
	customer := f.customer(t, "invoice@example.com", 1_000_000)
	order := f.order(t, customer, "invoiced", "invoiced")
	_, _, command, err := f.service.ConfirmOrder(ctx, f.admin(t), order.ID, ProvisionTarget{AuthorityEpoch: 1, ServerID: "server-1"})
	if err != nil {
		t.Fatal(err)
	}
	command.State = domain.CommandSucceeded
	if err := f.service.OnCommandTransition(ctx, command); err != nil {
		t.Fatal(err)
	}
	f.clock.Advance(2 * time.Hour)
	if _, err := f.service.RunBilling(ctx); err != nil {
		t.Fatal(err)
	}
	month := f.clock.Now()
	for attempt, want := range []int{1, 0} {
		issued, err := f.service.IssueInvoices(ctx, month)
		if err != nil || issued != want {
			t.Fatalf("issue attempt %d = %d, %v; want %d", attempt+1, issued, err, want)
		}
	}
	invoices, err := f.service.Invoices(ctx, customer.ID, 10)
	if err != nil || len(invoices) != 1 {
		t.Fatalf("invoices = %#v, %v", invoices, err)
	}
	invoice, err := f.service.Invoice(ctx, customer.ID, invoices[0].ID)
	if err != nil {
		t.Fatal(err)
	}
	if invoice.TotalRial != 33_000 || invoice.TaxRial != 3_000 || invoice.SubtotalRial != 30_000 || invoice.Status != "paid" {
		t.Fatalf("invoice totals = %#v", invoice)
	}
	if len(invoice.Lines) != 1 || invoice.Lines[0].QuantityHours != 3 || invoice.Number != fmt.Sprintf("INV-202609-%06d", invoice.ID) {
		t.Fatalf("invoice lines = %#v number = %q", invoice.Lines, invoice.Number)
	}
	other := f.customer(t, "nosy@example.com", 0)
	if _, err := f.service.Invoice(ctx, other.ID, invoice.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("another customer's invoice = %v", err)
	}
}

func TestOrdersRefuseTakenNamesAndInvalidApplications(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	ctx := context.Background()
	f.plan(t, "small", 10_000, 5_000_000)
	customer := f.customer(t, "names@example.com", 0)
	f.order(t, customer, "small", "unique")
	if _, err := f.service.PlaceOrder(ctx, customer.ID, OrderInput{AppName: "unique", Image: "ghcr.io/acme/x:1", PlanCode: "small", Port: 80}); !errors.Is(err, ErrConflict) {
		t.Fatalf("taken name = %v", err)
	}
	var validation *ValidationError
	if _, err := f.service.PlaceOrder(ctx, customer.ID, OrderInput{AppName: "Not A Name!", Image: "ghcr.io/acme/x:1", PlanCode: "small", Port: 80}); !errors.As(err, &validation) {
		t.Fatalf("invalid name = %v", err)
	}
	if _, err := f.service.PlaceOrder(ctx, customer.ID, OrderInput{AppName: "planless", Image: "ghcr.io/acme/x:1", PlanCode: "missing", Port: 80}); !errors.As(err, &validation) {
		t.Fatalf("unknown plan = %v", err)
	}
	other := f.customer(t, "other@example.com", 0)
	orders, err := f.service.Orders(ctx, customer.ID, 10)
	if err != nil || len(orders) != 1 {
		t.Fatalf("orders = %#v, %v", orders, err)
	}
	if _, err := f.service.CancelOrder(ctx, other.ID, orders[0].ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("cancelling another customer's order = %v", err)
	}
	if cancelled, err := f.service.CancelOrder(ctx, customer.ID, orders[0].ID); err != nil || cancelled.Status != OrderCancelled {
		t.Fatalf("cancel = %#v, %v", cancelled, err)
	}
}

func TestTicketsAreVisibleOnlyToTheirCustomerAndAdministrators(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	ctx := context.Background()
	customer := f.customer(t, "help@example.com", 0)
	ticket, err := f.service.OpenTicket(ctx, customer, "Domain not working", "My domain shows an error.", "high", 0)
	if err != nil {
		t.Fatal(err)
	}
	other := f.customer(t, "stranger@example.com", 0)
	if _, err := f.service.Ticket(ctx, other, ticket.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("a stranger read the ticket: %v", err)
	}
	answered, err := f.service.ReplyTicket(ctx, f.admin(t), ticket.ID, "Point the CNAME at the gateway.")
	if err != nil || answered.Status != TicketAnswered || len(answered.Messages) != 2 || answered.Messages[1].AuthorRole != RoleAdmin {
		t.Fatalf("admin reply = %#v, %v", answered, err)
	}
	closed, err := f.service.CloseTicket(ctx, customer, ticket.ID)
	if err != nil || closed.Status != TicketClosed {
		t.Fatalf("close = %#v, %v", closed, err)
	}
	if _, err := f.service.ReplyTicket(ctx, customer, ticket.ID, "one more thing"); !errors.Is(err, ErrConflict) {
		t.Fatalf("reply to a closed ticket = %v", err)
	}
}

func TestReportsReadTheViews(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	ctx := context.Background()
	f.plan(t, "small", 10_000, 5_000_000)
	customer := f.customer(t, "report@example.com", 300_000)
	f.order(t, customer, "small", "reported")
	accounts, err := f.service.Customers(ctx, 10)
	if err != nil || len(accounts) != 1 || accounts[0].BalanceRial != 300_000 || accounts[0].PendingOrders != 1 {
		t.Fatalf("customers = %#v, %v", accounts, err)
	}
	revenue, err := f.service.Revenue(ctx, 12)
	if err != nil || len(revenue) != 1 || revenue[0].ToppedUpRial != 300_000 {
		t.Fatalf("revenue = %#v, %v", revenue, err)
	}
	overview, err := f.service.AdminOverview(ctx)
	if err != nil || overview.Customers != 1 || overview.PendingOrders != 1 || overview.WalletFloatRial != 300_000 {
		t.Fatalf("overview = %#v, %v", overview, err)
	}
	plans, err := f.service.Plans(ctx, false)
	if err != nil || len(plans) < 6 {
		t.Fatalf("catalogue = %d plans, %v", len(plans), err)
	}
}

// A plan keeps a Persian description and features beside the English ones,
// and saving it again replaces both lists.
func TestPlansKeepEnglishAndPersianText(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	ctx := context.Background()
	input := PlanInput{Active: true, Code: "bilingual", CPUMillicores: 500, Description: "A web service", DescriptionFa: "یک سرویس وب",
		DiskGiB: 10, Features: []string{"Hourly billing"}, FeaturesFa: []string{"صورتحساب ساعتی", " ", "پشتیبانی"},
		HourlyPriceRial: 5000, MemoryMiB: 512, MonthlyPriceRial: 3_000_000, Name: "Bilingual"}
	plan, err := f.service.SavePlan(ctx, input)
	if err != nil {
		t.Fatal(err)
	}
	if plan.DescriptionFa != "یک سرویس وب" || len(plan.Features) != 1 || len(plan.FeaturesFa) != 2 || plan.FeaturesFa[1] != "پشتیبانی" {
		t.Fatalf("saved plan = %#v", plan)
	}
	input.FeaturesFa = nil
	plan, err = f.service.SavePlan(ctx, input)
	if err != nil || len(plan.FeaturesFa) != 0 || len(plan.Features) != 1 {
		t.Fatalf("resaved plan = %#v, %v", plan, err)
	}
	input.FeaturesFa = make([]string, 13)
	if _, err := f.service.SavePlan(ctx, input); err == nil {
		t.Fatal("thirteen Persian features were accepted")
	}
}

// The seeded catalogue promises only what an order provides, in both
// languages.
func TestSeededPlansOnlyPromiseWhatAnOrderProvides(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	withdrawn := map[string]bool{
		"HTTPS domain with automatic certificate": true, "Prometheus metrics endpoint": true, "Prometheus metrics and tracing": true,
		"Managed database attachment": true, "Priority support": true,
	}
	for _, code := range []string{"starter", "basic", "standard", "plus", "pro"} {
		plan, err := f.service.PlanByCode(context.Background(), code)
		if err != nil {
			t.Fatal(err)
		}
		if len(plan.Features) != 4 || len(plan.FeaturesFa) != 4 || plan.DescriptionFa == "" {
			t.Fatalf("%s: features %d, Persian features %d, Persian description %q", code, len(plan.Features), len(plan.FeaturesFa), plan.DescriptionFa)
		}
		for _, feature := range plan.Features {
			if withdrawn[feature] {
				t.Fatalf("%s still promises %q", code, feature)
			}
		}
	}
}
