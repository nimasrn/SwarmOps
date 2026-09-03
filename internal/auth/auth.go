// Package auth implements the deliberately small, single-admin session model.
// A production deployment supplies a bcrypt hash and HMAC key through Swarm
// secrets; no browser password or session secret is persisted by this package.
package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrInvalidSession     = errors.New("invalid session")
)

type Claims struct {
	CSRF     string `json:"csrf"`
	Expires  int64  `json:"exp"`
	IssuedAt int64  `json:"iat"`
	Username string `json:"sub"`
}

type Service struct {
	key          []byte
	passwordHash []byte
	ttl          time.Duration
	username     string
	now          func() time.Time
}

func New(username string, passwordHash, key []byte, ttl time.Duration) (*Service, error) {
	if strings.TrimSpace(username) == "" || len(passwordHash) == 0 || len(key) < 32 {
		return nil, fmt.Errorf("auth service has incomplete configuration")
	}
	if ttl <= 0 {
		return nil, fmt.Errorf("session ttl must be positive")
	}
	return &Service{key: append([]byte(nil), key...), passwordHash: append([]byte(nil), passwordHash...), ttl: ttl, username: username, now: time.Now}, nil
}

func (s *Service) Login(username, password string) (string, Claims, error) {
	if username != s.username || bcrypt.CompareHashAndPassword(s.passwordHash, []byte(password)) != nil {
		return "", Claims{}, ErrInvalidCredentials
	}
	now := s.now().UTC()
	csrf, err := randomToken(24)
	if err != nil {
		return "", Claims{}, fmt.Errorf("generate csrf token: %w", err)
	}
	claims := Claims{CSRF: csrf, Expires: now.Add(s.ttl).Unix(), IssuedAt: now.Unix(), Username: s.username}
	token, err := s.sign(claims)
	if err != nil {
		return "", Claims{}, err
	}
	return token, claims, nil
}

// Renew keeps a session that is still in active use from expiring underneath
// the operator. The token is stateless, so "still signed in" can only mean
// "re-issued while it was valid": once a verified session is past the halfway
// point of its lifetime, the next authenticated request mints a fresh one.
// The CSRF token is carried over so the console's cached value keeps working.
func (s *Service) Renew(claims Claims) (string, Claims, bool) {
	now := s.now().UTC()
	if now.Unix() < claims.IssuedAt+int64(s.ttl.Seconds())/2 {
		return "", claims, false
	}
	renewed := Claims{CSRF: claims.CSRF, Expires: now.Add(s.ttl).Unix(), IssuedAt: now.Unix(), Username: claims.Username}
	token, err := s.sign(renewed)
	if err != nil {
		return "", claims, false
	}
	return token, renewed, true
}

func (s *Service) sign(claims Claims) (string, error) {
	payload, err := json.Marshal(claims)
	if err != nil {
		return "", fmt.Errorf("encode session: %w", err)
	}
	encoded := base64.RawURLEncoding.EncodeToString(payload)
	mac := hmac.New(sha256.New, s.key)
	_, _ = mac.Write([]byte(encoded))
	return encoded + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil)), nil
}

func (s *Service) Verify(token string) (Claims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return Claims{}, ErrInvalidSession
	}
	provided, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return Claims{}, ErrInvalidSession
	}
	mac := hmac.New(sha256.New, s.key)
	_, _ = mac.Write([]byte(parts[0]))
	if !hmac.Equal(provided, mac.Sum(nil)) {
		return Claims{}, ErrInvalidSession
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return Claims{}, ErrInvalidSession
	}
	var claims Claims
	if json.Unmarshal(payload, &claims) != nil || claims.Username != s.username || claims.CSRF == "" || claims.Expires <= s.now().Unix() {
		return Claims{}, ErrInvalidSession
	}
	return claims, nil
}

func (s *Service) VerifyCSRF(claims Claims, token string) bool {
	return token != "" && hmac.Equal([]byte(claims.CSRF), []byte(token))
}

func randomToken(bytes int) (string, error) {
	value := make([]byte, bytes)
	if _, err := rand.Read(value); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(value), nil
}
