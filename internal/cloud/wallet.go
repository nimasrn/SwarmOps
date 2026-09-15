package cloud

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/nimasrn/SwarmOps/internal/sqlstore"
)

const (
	KindTopUp       = "topup"
	KindOrderCharge = "order_charge"
	KindUsage       = "usage"
	KindRefund      = "refund"
	KindAdjustment  = "adjustment"
)

// ledgerEntry is one balance change about to be written.
type ledgerEntry struct {
	amount         int64
	createdBy      uint64
	description    string
	idempotencyKey string
	kind           string
	referenceID    uint64
	referenceType  string
	userID         uint64
}

// applyTx writes one ledger row and moves the wallet balance with it, inside
// the caller's transaction.
//
// The wallet row is locked first, so every change to one wallet serialises
// behind the lock and each reads the balance the previous one committed. A
// change that would take the balance below zero is refused before anything is
// written; the CHECK constraint on wallets refuses it again if this check were
// ever wrong. An entry with an idempotency key that was already applied
// returns the original row instead of applying twice.
func (s *Service) applyTx(ctx context.Context, tx *sql.Tx, entry ledgerEntry) (Transaction, error) {
	if entry.amount == 0 {
		return Transaction{}, invalid("amount", "an amount of zero changes nothing")
	}
	var balance int64
	err := tx.QueryRowContext(ctx, "SELECT balance_rial FROM wallets WHERE user_id = ? FOR UPDATE", entry.userID).Scan(&balance)
	if errors.Is(err, sql.ErrNoRows) {
		return Transaction{}, ErrNotFound
	}
	if err != nil {
		return Transaction{}, err
	}
	if entry.idempotencyKey != "" {
		existing, found, err := transactionByKey(ctx, tx, entry.userID, entry.idempotencyKey)
		if err != nil {
			return Transaction{}, err
		}
		if found {
			if existing.Kind != entry.kind || existing.AmountRial != entry.amount {
				return Transaction{}, conflict("this idempotency key was already used for a different wallet change")
			}
			return existing, nil
		}
	}
	next := balance + entry.amount
	if next < 0 {
		return Transaction{}, ErrInsufficientFunds
	}
	now := s.now()
	result, err := tx.ExecContext(ctx, `INSERT INTO wallet_transactions (user_id, kind, amount_rial, balance_after_rial, reference_type, reference_id,
		description, idempotency_key, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		entry.userID, entry.kind, entry.amount, next, text(entry.referenceType), sql.NullInt64{Int64: int64(entry.referenceID), Valid: entry.referenceID != 0},
		entry.description, text(entry.idempotencyKey), sql.NullInt64{Int64: int64(entry.createdBy), Valid: entry.createdBy != 0}, now)
	if sqlstore.IsCheckViolation(err) {
		return Transaction{}, ErrInsufficientFunds
	}
	if err != nil {
		return Transaction{}, err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return Transaction{}, err
	}
	if _, err := tx.ExecContext(ctx, "UPDATE wallets SET balance_rial = ?, updated_at = ? WHERE user_id = ?", next, now, entry.userID); err != nil {
		if sqlstore.IsCheckViolation(err) {
			return Transaction{}, ErrInsufficientFunds
		}
		return Transaction{}, err
	}
	return Transaction{AmountRial: entry.amount, BalanceAfterRial: next, CreatedAt: now, Description: entry.description, ID: uint64(id),
		Kind: entry.kind, ReferenceID: entry.referenceID, ReferenceType: entry.referenceType, UserID: entry.userID}, nil
}

func transactionByKey(ctx context.Context, tx *sql.Tx, userID uint64, key string) (Transaction, bool, error) {
	transaction, err := scanTransaction(tx.QueryRowContext(ctx, transactionColumns+" WHERE user_id = ? AND idempotency_key = ?", userID, key))
	if errors.Is(err, sql.ErrNoRows) {
		return Transaction{}, false, nil
	}
	return transaction, err == nil, err
}

const transactionColumns = `SELECT id, user_id, kind, amount_rial, balance_after_rial, reference_type, reference_id, description, created_at FROM wallet_transactions`

type scanner interface {
	Scan(dest ...any) error
}

func scanTransaction(row scanner) (Transaction, error) {
	var transaction Transaction
	var referenceType sql.NullString
	var referenceID sql.NullInt64
	if err := row.Scan(&transaction.ID, &transaction.UserID, &transaction.Kind, &transaction.AmountRial, &transaction.BalanceAfterRial,
		&referenceType, &referenceID, &transaction.Description, &transaction.CreatedAt); err != nil {
		return Transaction{}, err
	}
	transaction.ReferenceType, transaction.ReferenceID = referenceType.String, uint64(referenceID.Int64)
	return transaction, nil
}

func (s *Service) Wallet(ctx context.Context, userID uint64) (Wallet, error) {
	ctx, cancel := s.context(ctx)
	defer cancel()
	wallet := Wallet{UserID: userID}
	err := s.db.Pool().QueryRowContext(ctx, "SELECT balance_rial, updated_at FROM wallets WHERE user_id = ?", userID).Scan(&wallet.BalanceRial, &wallet.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return Wallet{}, ErrNotFound
	}
	return wallet, err
}

// Transactions lists a wallet's ledger, newest first.
func (s *Service) Transactions(ctx context.Context, userID uint64, limit int) ([]Transaction, error) {
	if limit < 1 || limit > 500 {
		limit = 100
	}
	ctx, cancel := s.context(ctx)
	defer cancel()
	rows, err := s.db.Pool().QueryContext(ctx, transactionColumns+" WHERE user_id = ? ORDER BY id DESC LIMIT ?", userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	transactions := []Transaction{}
	for rows.Next() {
		transaction, err := scanTransaction(rows)
		if err != nil {
			return nil, err
		}
		transactions = append(transactions, transaction)
	}
	return transactions, rows.Err()
}

// TopUp credits a wallet from the simulated payment step. The idempotency key
// is what a real gateway callback would carry, so a retried callback cannot
// credit twice. A top-up that makes the wallet able to pay again resumes the
// customer's suspended projects.
func (s *Service) TopUp(ctx context.Context, userID uint64, amount int64, idempotencyKey string) (Transaction, error) {
	if amount < s.options.MinTopUpRial || amount > s.options.MaxTopUpRial {
		return Transaction{}, invalid("amountRial", fmt.Sprintf("top up between %d and %d rials", s.options.MinTopUpRial, s.options.MaxTopUpRial))
	}
	idempotencyKey = strings.TrimSpace(idempotencyKey)
	if idempotencyKey == "" || len(idempotencyKey) > 128 {
		return Transaction{}, invalid("idempotencyKey", "an idempotency key is required")
	}
	ctx, cancel := s.context(ctx)
	defer cancel()
	var transaction Transaction
	err := s.db.WithTx(ctx, func(tx *sql.Tx) error {
		var err error
		transaction, err = s.applyTx(ctx, tx, ledgerEntry{amount: amount, description: "Wallet top-up", idempotencyKey: idempotencyKey,
			kind: KindTopUp, userID: userID})
		return err
	})
	if err != nil {
		return Transaction{}, err
	}
	if _, err := s.ResumeFundedProjects(ctx, userID); err != nil {
		return transaction, fmt.Errorf("the top-up succeeded but resuming suspended projects failed: %w", err)
	}
	return transaction, nil
}

// Adjust is an administrator's correction, positive or negative, with a
// mandatory reason. It is a new ledger row: nothing already written changes.
func (s *Service) Adjust(ctx context.Context, admin User, userID uint64, amount int64, reason, idempotencyKey string) (Transaction, error) {
	if admin.Role != RoleAdmin {
		return Transaction{}, ErrForbidden
	}
	reason = strings.TrimSpace(reason)
	if len(reason) < 5 || len(reason) > 255 {
		return Transaction{}, invalid("reason", "state why the balance is being corrected")
	}
	ctx, cancel := s.context(ctx)
	defer cancel()
	var transaction Transaction
	err := s.db.WithTx(ctx, func(tx *sql.Tx) error {
		var err error
		transaction, err = s.applyTx(ctx, tx, ledgerEntry{amount: amount, createdBy: admin.ID, description: "Adjustment: " + reason,
			idempotencyKey: strings.TrimSpace(idempotencyKey), kind: KindAdjustment, userID: userID})
		return err
	})
	return transaction, err
}

// LedgerConsistent reports whether a wallet's balance equals the sum of its
// ledger. It is the invariant the concurrency tests hold the wallet to, and
// the admin panel shows it per customer.
func (s *Service) LedgerConsistent(ctx context.Context, userID uint64) (bool, error) {
	ctx, cancel := s.context(ctx)
	defer cancel()
	var balance, sum int64
	err := s.db.Pool().QueryRowContext(ctx, `SELECT w.balance_rial, COALESCE((SELECT SUM(t.amount_rial) FROM wallet_transactions t WHERE t.user_id = w.user_id), 0)
		FROM wallets w WHERE w.user_id = ?`, userID).Scan(&balance, &sum)
	if errors.Is(err, sql.ErrNoRows) {
		return false, ErrNotFound
	}
	return balance == sum, err
}
