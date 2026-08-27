package agentcontrol

import "testing"

func TestProvisioningRequestAcceptsOnlyClosedSafePlan(t *testing.T) {
	t.Parallel()
	request := ProvisioningRequest{
		ApplyUFW:        true,
		Confirmation:    ProvisionConfirmation,
		ControllerCIDRs: []string{"10.20.0.0/16"},
		InitializeSwarm: true,
		InstallDocker:   true,
		SwarmPeerCIDRs:  []string{"10.30.0.0/16"},
	}
	if err := request.Validate(); err != nil {
		t.Fatal(err)
	}
	controllers, err := request.NormalizedControllerCIDRs()
	if err != nil || len(controllers) != 1 || controllers[0] != "10.20.0.0/16" {
		t.Fatalf("controllers = %#v, err=%v", controllers, err)
	}
}

func TestProvisioningRequestRejectsUnsafeOrAmbiguousPlan(t *testing.T) {
	t.Parallel()
	for name, request := range map[string]ProvisioningRequest{
		"missing confirmation": {InstallDocker: true},
		"empty plan":           {Confirmation: ProvisionConfirmation},
		"two Docker intents":   {Confirmation: ProvisionConfirmation, InstallDocker: true, UpdateDocker: true},
		"firewall open":        {Confirmation: ProvisionConfirmation, ApplyUFW: true, ControllerCIDRs: []string{"10.20.0.0/16"}},
		"loopback firewall":    {Confirmation: ProvisionConfirmation, ApplyUFW: true, ControllerCIDRs: []string{"127.0.0.0/8"}, SwarmPeerCIDRs: []string{"10.30.0.0/16"}},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			if err := request.Validate(); err == nil {
				t.Fatal("unsafe provisioning request was accepted")
			}
		})
	}
}
