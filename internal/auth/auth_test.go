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
