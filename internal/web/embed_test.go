package web

import (
	"bytes"
	"io/fs"
	"strings"
	"testing"
)

const publishedAgentInstaller = "https://github.com/nimasrn/SwarmOps/releases/latest/download/install-swarmops-agent.sh"

func TestEmbeddedConsoleUsesPublishedAgentInstaller(t *testing.T) {
	entries, err := fs.ReadDir(assets, "static/assets")
	if err != nil {
		t.Fatalf("read embedded console assets: %v", err)
	}

	found := false
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".js") {
			continue
		}
		content, err := assets.ReadFile("static/assets/" + entry.Name())
		if err != nil {
			t.Fatalf("read embedded console bundle %s: %v", entry.Name(), err)
		}
		if bytes.Contains(content, []byte("raw.githubusercontent.com/nimasrn/nim/")) {
			t.Fatalf("embedded console bundle %s still contains the obsolete monorepo installer URL", entry.Name())
		}
		found = found || bytes.Contains(content, []byte(publishedAgentInstaller))
	}
	if !found {
		t.Fatalf("embedded console does not contain the published agent installer URL")
	}
}
