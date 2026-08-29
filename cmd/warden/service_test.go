package main

import (
	"context"
	"fmt"
	"reflect"
	"testing"
)

func TestAgentSystemdManagerRestartsProvisionerWithAgent(t *testing.T) {
	var calls []string
	manager := serviceManager{
		kind:       "systemd",
		name:       "swarmops-agent.service",
		companions: []string{"swarmops-agent-provisioner.service"},
		run: func(_ context.Context, executable string, arguments ...string) error {
			calls = append(calls, fmt.Sprint(append([]string{executable}, arguments...)))
			return nil
		},
	}
	if err := manager.Stop(context.Background()); err != nil {
		t.Fatal(err)
	}
	if err := manager.Start(context.Background()); err != nil {
		t.Fatal(err)
	}
	want := []string{
		fmt.Sprint([]string{systemctlPath(), "stop", "swarmops-agent.service"}),
		fmt.Sprint([]string{systemctlPath(), "stop", "swarmops-agent-provisioner.service"}),
		fmt.Sprint([]string{systemctlPath(), "start", "swarmops-agent-provisioner.service"}),
		fmt.Sprint([]string{systemctlPath(), "start", "swarmops-agent.service"}),
	}
	if !reflect.DeepEqual(calls, want) {
		t.Fatalf("service calls = %#v, want %#v", calls, want)
	}
}
