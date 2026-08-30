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

// Joining an existing Swarm is the capability that made a separate
// configuration-management tool necessary. These are the rules that let it be
// a typed operation instead.

func TestJoinRequiresAManagerAddressAndAToken(t *testing.T) {
	base := ProvisioningRequest{Confirmation: ProvisionConfirmation, JoinSwarm: true}
	if err := base.Validate(); err == nil {
		t.Fatal("a join with no manager address must be refused")
	}
	withAddress := base
	withAddress.JoinAddress = "10.0.0.11"
	if err := withAddress.Validate(); err == nil {
		t.Fatal("a join with no token must be refused")
	}
	complete := withAddress
	complete.JoinToken = "SWMTKN-1-abcdefghijklmnopqrstuvwxyz-0123456789abcdef"
	if err := complete.Validate(); err != nil {
		t.Fatalf("a complete join must be accepted: %v", err)
	}
}

// A hostname would make the join target depend on whatever DNS the machine
// happens to be using, which is not something an operator can review.
func TestJoinAddressMustBeALiteralAddress(t *testing.T) {
	for _, address := range []string{"manager.internal", "127.0.0.1", "0.0.0.0", "", "10.0.0.11:2377"} {
		request := ProvisioningRequest{
			Confirmation: ProvisionConfirmation, JoinSwarm: true, JoinAddress: address,
			JoinToken: "SWMTKN-1-abcdefghijklmnopqrstuvwxyz-0123456789abcdef",
		}
		if err := request.Validate(); err == nil {
			t.Fatalf("%q must be refused as a join address", address)
		}
	}
}

// The token becomes part of a command line on the machine.
func TestJoinTokenShapeIsChecked(t *testing.T) {
	for _, token := range []string{
		"", "not-a-token", "SWMTKN-1-short",
		"SWMTKN-1-abc; rm -rf /", "SWMTKN-1-abc def ghi jkl mno pqr stu",
		"--advertise-addr=10.0.0.1 SWMTKN-1-abcdefghijklmnop",
	} {
		request := ProvisioningRequest{
			Confirmation: ProvisionConfirmation, JoinSwarm: true,
			JoinAddress: "10.0.0.11", JoinToken: token,
		}
		if err := request.Validate(); err == nil {
			t.Fatalf("%q must be refused as a join token", token)
		}
	}
}

// A host that did both would silently abandon whichever ran first.
func TestSwarmInitAndJoinAreMutuallyExclusive(t *testing.T) {
	request := ProvisioningRequest{
		Confirmation: ProvisionConfirmation, InitializeSwarm: true, JoinSwarm: true,
		JoinAddress: "10.0.0.11", JoinToken: "SWMTKN-1-abcdefghijklmnopqrstuvwxyz-0123456789abcdef",
	}
	if err := request.Validate(); err == nil {
		t.Fatal("initialising and joining at once must be refused")
	}
}

// The controller boundary is where a join is deliberately incomplete: the
// token is read from the manager when the command runs, so a request that
// carries one has bypassed that and is refused.
func TestSubmissionRefusesAJoinTokenAndRequiresOneLater(t *testing.T) {
	submitted := ProvisioningRequest{Confirmation: ProvisionConfirmation, JoinSwarm: true}
	if err := submitted.ValidateWithoutJoinToken(); err != nil {
		t.Fatalf("a join without a token must be submittable: %v", err)
	}
	carrying := submitted
	carrying.JoinToken = "SWMTKN-1-abcdefghijklmnopqrstuvwxyz-0123456789abcdef"
	if err := carrying.ValidateWithoutJoinToken(); err == nil {
		t.Fatal("a submitted request must never carry a join token")
	}
}

func TestJoinDetailsWithoutTheJoinOperationAreRefused(t *testing.T) {
	request := ProvisioningRequest{Confirmation: ProvisionConfirmation, UpdateOS: true, JoinAddress: "10.0.0.11"}
	if err := request.Validate(); err == nil {
		t.Fatal("join details without the join operation must be refused")
	}
}
