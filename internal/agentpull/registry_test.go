package agentpull

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"encoding/pem"
	"testing"
)

func TestEnrollmentCodeIsSingleUseAndRegistrySurvivesRestart(t *testing.T) {
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		t.Fatal(err)
	}
	registry, err := OpenRegistry(t.TempDir(), key, 9)
	if err != nil {
		t.Fatal(err)
	}
	token, err := registry.CreateEnrollment("worker-a")
	if err != nil {
		t.Fatal(err)
	}
	csr := testCSR(t)
	enrollment, err := registry.Enroll(EnrollInput{CSR: csr, Code: token.Code, NodeName: "ignored", Protocol: ProtocolVersion})
	if err != nil {
		t.Fatal(err)
	}
	if enrollment.AgentID == "" || enrollment.AuthorityEpoch != 9 || enrollment.Certificate == "" || enrollment.CACertificate == "" {
		t.Fatalf("incomplete enrollment: %#v", enrollment)
	}
	if _, err := registry.Enroll(EnrollInput{CSR: csr, Code: token.Code, NodeName: "worker-a", Protocol: ProtocolVersion}); err == nil {
		t.Fatal("expected spent code rejection")
	}
}

func TestStandaloneClaimRequiresApprovalAndRedeemsOnce(t *testing.T) {
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		t.Fatal(err)
	}
	registry, err := OpenRegistry(t.TempDir(), key, 12)
	if err != nil {
		t.Fatal(err)
	}
	ticket, err := registry.StartClaim(EnrollInput{CSR: testCSR(t), NodeName: "worker-standalone", Protocol: ProtocolVersion})
	if err != nil {
		t.Fatal(err)
	}
	if ticket.Code == "" || ticket.ClaimID == "" || ticket.ClaimSecret == "" {
		t.Fatalf("incomplete claim ticket: %#v", ticket)
	}
	if _, ready, err := registry.RedeemClaim(ticket.ClaimID, ticket.ClaimSecret); err != nil || ready {
		t.Fatalf("claim should remain pending before approval: ready=%v err=%v", ready, err)
	}
	registry.SetAuthorityEpoch(13)
	approval, err := registry.ApproveClaim(ticket.Code)
	if err != nil {
		t.Fatal(err)
	}
	if approval.AgentID == "" || approval.Name != "worker-standalone" {
		t.Fatalf("unexpected approval: %#v", approval)
	}
	enrollment, ready, err := registry.RedeemClaim(ticket.ClaimID, ticket.ClaimSecret)
	if err != nil || !ready {
		t.Fatalf("approved claim was not redeemable: ready=%v err=%v", ready, err)
	}
	if enrollment.AgentID != approval.AgentID || enrollment.AuthorityEpoch != 13 || enrollment.Certificate == "" {
		t.Fatalf("unexpected standalone enrollment: %#v", enrollment)
	}
	if _, _, err := registry.RedeemClaim(ticket.ClaimID, ticket.ClaimSecret); err == nil {
		t.Fatal("expected redeemed claim to be single use")
	}
}

func testCSR(t *testing.T) string {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	der, err := x509.CreateCertificateRequest(rand.Reader, &x509.CertificateRequest{}, key)
	if err != nil {
		t.Fatal(err)
	}
	return string(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE REQUEST", Bytes: der}))
}
