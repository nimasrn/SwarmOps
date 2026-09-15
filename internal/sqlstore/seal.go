package sqlstore

import (
	"errors"
	"fmt"
	"strings"
)

// Purpose builds the associated data a sealed column is bound to. Binding to
// table, column and row key means ciphertext cannot be moved between rows or
// columns: opening it anywhere else fails authentication.
func Purpose(table, column string, key ...string) string {
	return "swarmops-sql:" + table + "." + column + ":" + strings.Join(key, "/")
}

// Seal encrypts one secret column value. An empty plaintext is stored as
// NULL by callers, so Seal never has to represent "no secret".
func (db *DB) Seal(purpose string, plaintext []byte) ([]byte, error) {
	if db == nil || db.sealer == nil {
		return nil, errors.New("sealed columns are not configured")
	}
	sealed, err := db.sealer.Seal(purpose, plaintext)
	if err != nil {
		return nil, fmt.Errorf("seal column: %w", err)
	}
	return sealed, nil
}

// Open decrypts one sealed column value bound to purpose.
func (db *DB) Open(purpose string, ciphertext []byte) ([]byte, error) {
	if db == nil || db.sealer == nil {
		return nil, errors.New("sealed columns are not configured")
	}
	plaintext, err := db.sealer.Open(purpose, ciphertext)
	if err != nil {
		return nil, fmt.Errorf("open sealed column: %w", err)
	}
	return plaintext, nil
}

// SealString is Seal for text secrets; the empty string seals to nil so it
// is stored as NULL.
func (db *DB) SealString(purpose, plaintext string) ([]byte, error) {
	if plaintext == "" {
		return nil, nil
	}
	return db.Seal(purpose, []byte(plaintext))
}

// OpenString is the inverse of SealString; NULL opens to "".
func (db *DB) OpenString(purpose string, ciphertext []byte) (string, error) {
	if len(ciphertext) == 0 {
		return "", nil
	}
	plaintext, err := db.Open(purpose, ciphertext)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}
