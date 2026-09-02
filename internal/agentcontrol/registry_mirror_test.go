package agentcontrol

import "testing"

func TestNormalizedRegistryMirrorsAcceptsHostsAndPreservesOrder(t *testing.T) {
	request := ProvisioningRequest{
		ApplyRegistryMirrors: true,
		Confirmation:         ProvisionConfirmation,
		RegistryMirrors:      []string{" mirror.example.com ", "http://10.0.0.5:5000", "https://second.example.com/"},
	}
	if err := request.Validate(); err != nil {
		t.Fatalf("validate: %v", err)
	}
	mirrors, err := request.NormalizedRegistryMirrors()
	if err != nil {
		t.Fatalf("normalize: %v", err)
	}
	expected := []string{"https://mirror.example.com", "http://10.0.0.5:5000", "https://second.example.com"}
	for index, want := range expected {
		if mirrors[index] != want {
			t.Fatalf("mirror %d = %q, want %q", index, mirrors[index], want)
		}
	}
}

func TestRegistryMirrorRejectsUnreviewableValues(t *testing.T) {
	for name, mirror := range map[string]string{
		"credentials": "https://user:pass@mirror.example.com",
		"path":        "https://mirror.example.com/v2/proxy",
		"query":       "https://mirror.example.com?token=1",
		"scheme":      "ftp://mirror.example.com",
	} {
		request := ProvisioningRequest{ApplyRegistryMirrors: true, Confirmation: ProvisionConfirmation, RegistryMirrors: []string{mirror}}
		if err := request.Validate(); err == nil {
			t.Fatalf("%s: expected rejection of %q", name, mirror)
		}
	}
}

func TestRegistryMirrorsRequireTheOperation(t *testing.T) {
	request := ProvisioningRequest{Confirmation: ProvisionConfirmation, UpdateOS: true, RegistryMirrors: []string{"https://mirror.example.com"}}
	if err := request.Validate(); err == nil {
		t.Fatal("expected mirrors without the operation to be rejected")
	}
}

// An empty list is the deliberate "stop using a mirror" request, so it must
// remain a valid operation on its own.
func TestRegistryMirrorClearingIsAValidOperation(t *testing.T) {
	request := ProvisioningRequest{ApplyRegistryMirrors: true, Confirmation: ProvisionConfirmation}
	if err := request.Validate(); err != nil {
		t.Fatalf("validate: %v", err)
	}
}

func TestDuplicateRegistryMirrorsAreRejected(t *testing.T) {
	request := ProvisioningRequest{ApplyRegistryMirrors: true, Confirmation: ProvisionConfirmation, RegistryMirrors: []string{"mirror.example.com", "https://mirror.example.com"}}
	if err := request.Validate(); err == nil {
		t.Fatal("expected duplicate mirrors to be rejected")
	}
}
