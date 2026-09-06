package apihttp

import (
	"testing"

	"github.com/nimasrn/SwarmOps/internal/domain"
)

func TestServerIsHostMatchesOnTheLeadingLabel(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name     string
		profile  domain.Server
		hostname string
		want     bool
	}{
		{name: "name matches exactly", profile: domain.Server{Name: "db-1"}, hostname: "db-1", want: true},
		{name: "host matches exactly", profile: domain.Server{Name: "stateful", Host: "db-1"}, hostname: "db-1", want: true},
		{name: "enrollment is qualified", profile: domain.Server{Host: "db-1.internal.example.com"}, hostname: "db-1", want: true},
		{name: "swarm hostname is qualified", profile: domain.Server{Host: "db-1"}, hostname: "db-1.internal.example.com", want: true},
		{name: "case differs", profile: domain.Server{Name: "DB-1"}, hostname: "db-1", want: true},
		// A prefix is not a host. `db-10` answering for `db-1` would silently
		// send every log query to the wrong machine.
		{name: "different host with a shared prefix", profile: domain.Server{Name: "db-10"}, hostname: "db-1", want: false},
		{name: "unrelated host", profile: domain.Server{Name: "edge-1"}, hostname: "db-1", want: false},
		{name: "empty hostname matches nothing", profile: domain.Server{Name: "db-1"}, hostname: "   ", want: false},
		{name: "empty profile matches nothing", profile: domain.Server{}, hostname: "db-1", want: false},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()
			if got := serverIsHost(testCase.profile, testCase.hostname); got != testCase.want {
				t.Fatalf("serverIsHost(%+v, %q) = %v, want %v", testCase.profile, testCase.hostname, got, testCase.want)
			}
		})
	}
}
