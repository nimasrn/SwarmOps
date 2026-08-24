package main

import (
	"bytes"
	"strings"
	"testing"

	"golang.org/x/crypto/bcrypt"
)

func TestPasswordHash(t *testing.T) {
	password := []byte("correct horse battery staple")
	var output bytes.Buffer
	if err := passwordHash(bytes.NewReader(append(password, '\n')), &output); err != nil {
		t.Fatalf("passwordHash(): %v", err)
	}
	if err := bcrypt.CompareHashAndPassword([]byte(strings.TrimSpace(output.String())), password); err != nil {
		t.Fatalf("generated password hash does not match: %v", err)
	}
}

func TestPasswordHashRejectsShortPassword(t *testing.T) {
	if err := passwordHash(strings.NewReader("too short\n"), &bytes.Buffer{}); err == nil {
		t.Fatal("passwordHash() accepted a short password")
	}
}
