package agent

import (
	"encoding/json"
	"testing"
)

func TestMergeRegistryMirrorsKeepsUnrelatedDaemonSettings(t *testing.T) {
	existing := []byte(`{"log-driver":"json-file","registry-mirrors":["https://old.example.com"]}`)
	encoded, err := mergeRegistryMirrors(existing, []string{"https://new.example.com"})
	if err != nil {
		t.Fatalf("merge: %v", err)
	}
	var settings map[string]any
	if err := json.Unmarshal(encoded, &settings); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if settings["log-driver"] != "json-file" {
		t.Fatalf("unrelated setting lost: %v", settings)
	}
	mirrors, _ := settings["registry-mirrors"].([]any)
	if len(mirrors) != 1 || mirrors[0] != "https://new.example.com" {
		t.Fatalf("mirrors = %v", settings["registry-mirrors"])
	}
}

func TestMergeRegistryMirrorsRemovesTheKeyWhenCleared(t *testing.T) {
	encoded, err := mergeRegistryMirrors([]byte(`{"registry-mirrors":["https://old.example.com"],"debug":true}`), nil)
	if err != nil {
		t.Fatalf("merge: %v", err)
	}
	var settings map[string]any
	if err := json.Unmarshal(encoded, &settings); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if _, present := settings["registry-mirrors"]; present {
		t.Fatalf("mirror key survived clearing: %s", encoded)
	}
	if settings["debug"] != true {
		t.Fatalf("unrelated setting lost: %s", encoded)
	}
}

// A daemon.json this process cannot parse must never be overwritten: the
// operator's configuration is worth more than the mirror change.
func TestMergeRegistryMirrorsRefusesUnparsableConfiguration(t *testing.T) {
	if _, err := mergeRegistryMirrors([]byte("{not json"), []string{"https://mirror.example.com"}); err == nil {
		t.Fatal("expected refusal")
	}
}

func TestMergeRegistryMirrorsHandlesAnAbsentFile(t *testing.T) {
	encoded, err := mergeRegistryMirrors(nil, []string{"https://mirror.example.com"})
	if err != nil {
		t.Fatalf("merge: %v", err)
	}
	var settings map[string]any
	if err := json.Unmarshal(encoded, &settings); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(settings) != 1 {
		t.Fatalf("unexpected settings: %s", encoded)
	}
}
