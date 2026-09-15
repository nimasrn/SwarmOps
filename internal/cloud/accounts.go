package cloud

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"net/mail"
	"strings"
	"unicode/utf8"

	"github.com/nimasrn/SwarmOps/internal/sqlstore"
	"golang.org/x/crypto/bcrypt"
)

const (
	RoleCustomer = "customer"
	RoleAdmin    = "admin"

	// operatorEmailDomain is the reserved .invalid top-level domain (RFC 2606).
	// Console operators get an admin row under it so a reviewed order can name
	// its reviewer; nothing can sign in with such an address.
	operatorEmailDomain = "operators.swarmops.invalid"
)

// dummyHash is compared against when an email is unknown, so a login for an
// address that does not exist takes as long as one with a wrong password.
var dummyHash, _ = bcrypt.GenerateFromPassword([]byte("swarmops-timing-equaliser"), bcrypt.DefaultCost)

func normalizeEmail(value string) (string, error) {
	value = strings.ToLower(strings.TrimSpace(value))
	address, err := mail.ParseAddress(value)
	if err != nil || address.Address != value || len(value) > 254 || strings.HasSuffix(value, "."+operatorEmailDomain) || strings.HasSuffix(value, "@"+operatorEmailDomain) {
		return "", invalid("email", "enter a valid email address")
	}
	return value, nil
}

// Register creates a customer account and its empty wallet together.
func (s *Service) Register(ctx context.Context, email, fullName, password string) (User, error) {
	email, err := normalizeEmail(email)
	if err != nil {
		return User{}, err
	}
	fullName = strings.TrimSpace(fullName)
	if utf8.RuneCountInString(fullName) < 2 || utf8.RuneCountInString(fullName) > 120 {
		return User{}, invalid("fullName", "enter your name")
	}
	if utf8.RuneCountInString(password) < 10 || len(password) > 72 {
		return User{}, invalid("password", "use between 10 and 72 characters")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), s.options.BcryptCost)
	if err != nil {
		return User{}, fmt.Errorf("hash password: %w", err)
	}
	ctx, cancel := s.context(ctx)
	defer cancel()
	now := s.now()
	var user User
	err = s.db.WithTx(ctx, func(tx *sql.Tx) error {
		result, err := tx.ExecContext(ctx, `INSERT INTO users (email, full_name, password_hash, role, status, created_at, updated_at)
			VALUES (?, ?, ?, ?, 'active', ?, ?)`, email, fullName, string(hash), RoleCustomer, now, now)
		if sqlstore.IsDuplicate(err) {
			return conflict("an account with this email already exists")
		}
		if err != nil {
			return err
		}
		id, err := result.LastInsertId()
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, "INSERT INTO wallets (user_id, balance_rial, updated_at) VALUES (?, 0, ?)", id, now); err != nil {
			return err
		}
		user = User{CreatedAt: now, Email: email, FullName: fullName, ID: uint64(id), Role: RoleCustomer, Status: "active"}
		return nil
	})
	return user, err
}

// Login checks a customer's password and opens a session. The session token is
// returned once and only its SHA-256 is stored.
func (s *Service) Login(ctx context.Context, email, password string) (Session, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	ctx, cancel := s.context(ctx)
	defer cancel()
	var user User
	var hash string
	var lastLogin sql.NullTime
	err := s.db.Pool().QueryRowContext(ctx, `SELECT id, email, full_name, password_hash, role, status, created_at, last_login_at
		FROM users WHERE email = ? AND role = ?`, email, RoleCustomer).
		Scan(&user.ID, &user.Email, &user.FullName, &hash, &user.Role, &user.Status, &user.CreatedAt, &lastLogin)
	if errors.Is(err, sql.ErrNoRows) {
		_ = bcrypt.CompareHashAndPassword(dummyHash, []byte(password))
		return Session{}, ErrInvalidCredentials
	}
	if err != nil {
		return Session{}, err
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) != nil {
		return Session{}, ErrInvalidCredentials
	}
	if user.Status != "active" {
		return Session{}, ErrForbidden
	}
	token, err := randomToken(32)
	if err != nil {
		return Session{}, err
	}
	csrf, err := randomToken(32)
	if err != nil {
		return Session{}, err
	}
	now := s.now()
	expires := now.Add(s.options.SessionTTL)
	err = s.db.WithTx(ctx, func(tx *sql.Tx) error {
		if _, err := tx.ExecContext(ctx, "INSERT INTO user_sessions (token_hash, user_id, csrf_token, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
			hashToken(token), user.ID, csrf, now, expires); err != nil {
			return err
		}
		_, err := tx.ExecContext(ctx, "UPDATE users SET last_login_at = ? WHERE id = ?", now, user.ID)
		return err
	})
	if err != nil {
		return Session{}, err
	}
	user.LastLoginAt = &now
	return Session{CSRFToken: csrf, ExpiresAt: expires, Token: token, User: user}, nil
}

// Authenticate resolves a session cookie to its active, unexpired session.
func (s *Service) Authenticate(ctx context.Context, token string) (Session, error) {
	if len(token) < 20 || len(token) > 128 {
		return Session{}, ErrSessionExpired
	}
	ctx, cancel := s.context(ctx)
	defer cancel()
	var session Session
	var lastLogin sql.NullTime
	err := s.db.Pool().QueryRowContext(ctx, `SELECT s.csrf_token, s.expires_at, u.id, u.email, u.full_name, u.role, u.status, u.created_at, u.last_login_at
		FROM user_sessions s JOIN users u ON u.id = s.user_id
		WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ?`, hashToken(token), s.now()).
		Scan(&session.CSRFToken, &session.ExpiresAt, &session.User.ID, &session.User.Email, &session.User.FullName,
			&session.User.Role, &session.User.Status, &session.User.CreatedAt, &lastLogin)
	if errors.Is(err, sql.ErrNoRows) {
		return Session{}, ErrSessionExpired
	}
	if err != nil {
		return Session{}, err
	}
	if session.User.Status != "active" {
		return Session{}, ErrForbidden
	}
	session.User.LastLoginAt = optionalTime(lastLogin)
	session.Token = token
	return session, nil
}

// VerifyCSRF compares a request's CSRF header with its session's token in
// constant time.
func VerifyCSRF(session Session, token string) bool {
	return token != "" && subtle.ConstantTimeCompare([]byte(session.CSRFToken), []byte(token)) == 1
}

func (s *Service) Logout(ctx context.Context, token string) error {
	ctx, cancel := s.context(ctx)
	defer cancel()
	_, err := s.db.Pool().ExecContext(ctx, "UPDATE user_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL", s.now(), hashToken(token))
	return err
}

// EnsureOperator returns the admin row that stands for a console operator,
// creating it the first time that operator reviews something. The row has no
// usable password: operators sign in through the console's own login.
func (s *Service) EnsureOperator(ctx context.Context, username string) (User, error) {
	username = strings.ToLower(strings.TrimSpace(username))
	if username == "" || strings.ContainsAny(username, "@ \t\r\n") || len(username) > 64 {
		return User{}, invalid("username", "operator username is invalid")
	}
	email := username + "@" + operatorEmailDomain
	ctx, cancel := s.context(ctx)
	defer cancel()
	now := s.now()
	if _, err := s.db.Pool().ExecContext(ctx, `INSERT INTO users (email, full_name, password_hash, role, status, created_at, updated_at)
		VALUES (?, ?, '!', ?, 'active', ?, ?) ON DUPLICATE KEY UPDATE email = email`, email, username, RoleAdmin, now, now); err != nil {
		return User{}, err
	}
	var user User
	err := s.db.Pool().QueryRowContext(ctx, "SELECT id, email, full_name, role, status, created_at FROM users WHERE email = ?", email).
		Scan(&user.ID, &user.Email, &user.FullName, &user.Role, &user.Status, &user.CreatedAt)
	if err != nil {
		return User{}, err
	}
	if user.Role != RoleAdmin {
		return User{}, ErrForbidden
	}
	return user, nil
}

// SetCustomerStatus suspends or reactivates a customer account. Suspending
// ends every open session at once.
func (s *Service) SetCustomerStatus(ctx context.Context, userID uint64, status string) error {
	if status != "active" && status != "suspended" {
		return invalid("status", "status must be active or suspended")
	}
	ctx, cancel := s.context(ctx)
	defer cancel()
	return s.db.WithTx(ctx, func(tx *sql.Tx) error {
		result, err := tx.ExecContext(ctx, "UPDATE users SET status = ?, updated_at = ? WHERE id = ? AND role = ?", status, s.now(), userID, RoleCustomer)
		if err != nil {
			return err
		}
		if affected, _ := result.RowsAffected(); affected == 0 {
			var exists int
			if err := tx.QueryRowContext(ctx, "SELECT 1 FROM users WHERE id = ? AND role = ?", userID, RoleCustomer).Scan(&exists); err != nil {
				return ErrNotFound
			}
		}
		if status == "suspended" {
			_, err = tx.ExecContext(ctx, "UPDATE user_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL", s.now(), userID)
		}
		return err
	})
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func randomToken(bytes int) (string, error) {
	value := make([]byte, bytes)
	if _, err := rand.Read(value); err != nil {
		return "", fmt.Errorf("generate token: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(value), nil
}
