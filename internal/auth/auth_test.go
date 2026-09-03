package auth

import (
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"
)

func TestServiceLoginAndVerify(t *testing.T) {
	t.Parallel()
	hash, err := bcrypt.GenerateFromPassword([]byte("correct horse battery staple"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	service, err := New("operator", hash, []byte("01234567890123456789012345678901"), time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	token, claims, err := service.Login("operator", "correct horse battery staple")
	if err != nil {
		t.Fatalf("login: %v", err)
	}
	if !service.VerifyCSRF(claims, claims.CSRF) {
		t.Fatal("expected csrf token to verify")
	}
	verified, err := service.Verify(token)
	if err != nil || verified.Username != "operator" {
		t.Fatalf("verify = %#v, %v", verified, err)
	}
	if _, _, err := service.Login("operator", "wrong"); err != ErrInvalidCredentials {
		t.Fatalf("wrong password error = %v", err)
	}
	if _, err := service.Verify(token + "tamper"); err != ErrInvalidSession {
		t.Fatalf("tampered token error = %v", err)
	}
}

func TestLoginLimiterBlocksAndResets(t *testing.T) {
	t.Parallel()
	limiter := NewLoginLimiter(2, time.Minute)
	now := time.Date(2026, 8, 23, 0, 0, 0, 0, time.UTC)
	limiter.now = func() time.Time { return now }
	if !limiter.Allow("operator|client") {
		t.Fatal("fresh key should be allowed")
	}
	limiter.Failure("operator|client")
	limiter.Failure("operator|client")
	if limiter.Allow("operator|client") {
		t.Fatal("key should be blocked after max attempts")
	}
	now = now.Add(time.Minute + time.Second)
	if !limiter.Allow("operator|client") {
		t.Fatal("key should be allowed after window")
	}
	limiter.Success("operator|client")
	if !limiter.Allow("operator|client") {
		t.Fatal("successful login should clear attempts")
	}
}

func TestRenewExtendsOnlyAfterHalfLife(t *testing.T) {
	hash, err := bcrypt.GenerateFromPassword([]byte("correct horse"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	service, err := New("operator", hash, []byte("01234567890123456789012345678901"), 12*time.Hour)
	if err != nil {
		t.Fatalf("new: %v", err)
	}
	base := time.Now().UTC()
	service.now = func() time.Time { return base }
	_, claims, err := service.Login("operator", "correct horse")
	if err != nil {
		t.Fatalf("login: %v", err)
	}

	service.now = func() time.Time { return base.Add(5 * time.Hour) }
	if _, _, ok := service.Renew(claims); ok {
		t.Fatalf("renewed a session that is not yet halfway through its lifetime")
	}

	service.now = func() time.Time { return base.Add(11 * time.Hour) }
	token, renewed, ok := service.Renew(claims)
	if !ok {
		t.Fatalf("expected renewal past the half-life")
	}
	if renewed.CSRF != claims.CSRF {
		t.Fatalf("renewal changed the csrf token")
	}
	if renewed.Expires <= claims.Expires {
		t.Fatalf("renewal did not extend expiry: %d <= %d", renewed.Expires, claims.Expires)
	}
	service.now = func() time.Time { return base.Add(13 * time.Hour) }
	if _, err := service.Verify(token); err != nil {
		t.Fatalf("renewed token rejected past the original expiry: %v", err)
	}
}
