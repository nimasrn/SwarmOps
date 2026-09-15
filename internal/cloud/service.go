// Package cloud is SwarmOps Cloud: the customer-facing commerce layer over
// the controller. Customers register, top up a wallet and order hosting plans;
// an administrator confirms each order, which charges the wallet and queues the
// application's deployment in one database transaction. Running projects are
// billed by the hour, capped at their plan's monthly price, and suspended when
// the wallet cannot pay.
//
// Every balance change is a row in an append-only ledger written under a lock
// on the owner's wallet row, so concurrent charges serialise and a wallet can
// never go negative: the database refuses it with a CHECK constraint even if
// the application check were ever wrong.
package cloud

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/nimasrn/SwarmOps/internal/queue"
	"github.com/nimasrn/SwarmOps/internal/sqlstore"
)

var (
	ErrNotFound           = errors.New("not found")
	ErrForbidden          = errors.New("this account is not allowed to do that")
	ErrConflict           = errors.New("conflict")
	ErrInsufficientFunds  = errors.New("the wallet balance is not enough")
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrSessionExpired     = errors.New("the session has expired")
)

// ValidationError names the input field a request got wrong.
type ValidationError struct {
	Field   string
	Message string
}

func (e *ValidationError) Error() string { return e.Field + ": " + e.Message }

func invalid(field, message string) error { return &ValidationError{Field: field, Message: message} }

// ConflictError is ErrConflict with the reason a person can act on.
type ConflictError struct{ Message string }

func (e *ConflictError) Error() string { return e.Message }
func (e *ConflictError) Unwrap() error { return ErrConflict }

func conflict(message string) error { return &ConflictError{Message: message} }

// CommandQueue is the part of the command ledger the commerce layer needs:
// enqueueing inside its own transaction.
type CommandQueue interface {
	SubmitInTx(ctx context.Context, tx *sql.Tx, input queue.SubmitInput) (queue.Submission, []string, error)
	ForgetInputs(ids []string)
}

// Provisioner stops and restarts a project's running application. The HTTP
// layer implements it by queueing the controller's existing service commands;
// suspension never deletes an application or its data.
type Provisioner interface {
	Suspend(ctx context.Context, project Project) error
	Resume(ctx context.Context, project Project) error
}

type Options struct {
	// BcryptCost is the password hashing cost. Tests lower it; production
	// keeps the default.
	BcryptCost int
	// SessionTTL is how long a customer session lasts.
	SessionTTL time.Duration
	// ReserveHours is how many hours of a plan's price a wallet must hold for
	// an order on it to be confirmed, or a suspended project to resume.
	ReserveHours int64
	// TaxRateBP is the value-added tax included in every price, in basis
	// points (1000 = 10%). Invoices state it; it is never added on top.
	TaxRateBP int64
	// MinTopUpRial and MaxTopUpRial bound one simulated top-up.
	MinTopUpRial int64
	MaxTopUpRial int64
	Now          func() time.Time
}

type Service struct {
	commands    CommandQueue
	db          *sqlstore.DB
	options     Options
	provisioner Provisioner
}

func New(db *sqlstore.DB, commands CommandQueue, provisioner Provisioner, options Options) (*Service, error) {
	if db == nil || commands == nil {
		return nil, fmt.Errorf("the cloud service needs a database and a command queue")
	}
	if options.BcryptCost == 0 {
		options.BcryptCost = 12
	}
	if options.SessionTTL <= 0 {
		options.SessionTTL = 12 * time.Hour
	}
	if options.ReserveHours <= 0 {
		options.ReserveHours = 24
	}
	if options.TaxRateBP == 0 {
		options.TaxRateBP = 1000
	}
	if options.MinTopUpRial <= 0 {
		options.MinTopUpRial = 100_000
	}
	if options.MaxTopUpRial <= 0 {
		options.MaxTopUpRial = 2_000_000_000
	}
	if options.Now == nil {
		options.Now = time.Now
	}
	return &Service{commands: commands, db: db, options: options, provisioner: provisioner}, nil
}

func (s *Service) now() time.Time { return s.options.Now().UTC().Truncate(time.Microsecond) }

func (s *Service) context(parent context.Context) (context.Context, context.CancelFunc) {
	return context.WithTimeout(parent, 20*time.Second)
}

func text(value string) sql.NullString { return sql.NullString{String: value, Valid: value != ""} }

func optionalTime(value sql.NullTime) *time.Time {
	if !value.Valid {
		return nil
	}
	result := value.Time
	return &result
}
