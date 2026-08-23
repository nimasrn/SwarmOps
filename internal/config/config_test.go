package config

import (
	"strings"
	"testing"
)

func TestLoadInsecureDevAuthRequiresExplicitMaterial(t *testing.T) {
	t.Setenv("SWARMOPS_INSECURE_DEV_AUTH", "true")
	t.Setenv("SWARMOPS_DATA_DIR", t.TempDir())

	for _, tc := range []struct {
		name     string
		password string
		session  string
		agent    string
		want     string
	}{
		{name: "password hash", want: "SWARMOPS_DEV_PASSWORD_HASH"},
		{name: "session key", password: "development-only-hash", want: "SWARMOPS_DEV_SESSION_KEY"},
		{name: "agent token", password: "development-only-hash", session: strings.Repeat("s", 32), want: "SWARMOPS_DEV_AGENT_TOKEN"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("SWARMOPS_DEV_PASSWORD_HASH", tc.password)
			t.Setenv("SWARMOPS_DEV_SESSION_KEY", tc.session)
			t.Setenv("SWARMOPS_DEV_AGENT_TOKEN", tc.agent)

			if _, err := Load(); err == nil || !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("Load() error = %v, want error containing %q", err, tc.want)
			}
		})
	}
}

func TestLoadInsecureDevAuthAcceptsExplicitMaterial(t *testing.T) {
	t.Setenv("SWARMOPS_INSECURE_DEV_AUTH", "true")
	t.Setenv("SWARMOPS_DATA_DIR", t.TempDir())
	t.Setenv("SWARMOPS_DEV_PASSWORD_HASH", "development-only-hash")
	t.Setenv("SWARMOPS_DEV_SESSION_KEY", strings.Repeat("s", 32))
	t.Setenv("SWARMOPS_DEV_AGENT_TOKEN", strings.Repeat("a", 32))

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if got := string(cfg.AgentToken); got != strings.Repeat("a", 32) {
		t.Fatalf("AgentToken = %q, want explicit development token", got)
	}
}
