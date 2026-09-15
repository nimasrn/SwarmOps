package remote

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/nimasrn/SwarmOps/internal/sqlstore"
)

// persistedServerState returns everything the database holds about servers —
// every profile column, every event, and the raw sealed key bytes — so a test
// can assert that no credential reached any of it.
func persistedServerState(t *testing.T, db *sqlstore.DB) []byte {
	t.Helper()
	profiles, err := loadServerRows(context.Background(), db)
	if err != nil {
		t.Fatal(err)
	}
	encoded, err := json.Marshal(profiles)
	if err != nil {
		t.Fatal(err)
	}
	rows, err := db.Pool().Query("SELECT api_key_sealed FROM server_keys")
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	for rows.Next() {
		var sealed []byte
		if err := rows.Scan(&sealed); err != nil {
			t.Fatal(err)
		}
		encoded = append(encoded, sealed...)
	}
	return encoded
}

func countServerKeys(t *testing.T, db *sqlstore.DB) int {
	t.Helper()
	var count int
	if err := db.Pool().QueryRow("SELECT COUNT(*) FROM server_keys").Scan(&count); err != nil {
		t.Fatal(err)
	}
	return count
}
