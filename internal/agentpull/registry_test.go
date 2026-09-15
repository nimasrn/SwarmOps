package agentpull

import (
	"bytes"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"encoding/pem"
	"sync"
	"testing"

	"github.com/nimasrn/SwarmOps/internal/sqlstore/sqltest"
)

func TestEnrollmentCodeIsSingleUseAndRegistrySurvivesRestart(t *testing.T) {
	db := sqltest.Open(t)
	registry, err := OpenRegistry(db, 9)
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

	restarted, err := OpenRegistry(db, 9)
	if err != nil {
		t.Fatal(err)
	}
	if restarted.state.CACertPEM != registry.state.CACertPEM {
		t.Fatal("a restarted registry generated a new CA instead of loading the existing one")
	}
	if !restarted.hasAgent(enrollment.AgentID) {
		t.Fatal("an enrolled agent was forgotten across a restart")
	}
	if _, err := restarted.Renew(enrollment.AgentID, testCSR(t)); err != nil {
		t.Fatalf("renew after restart: %v", err)
	}
	var sealed []byte
	if err := db.Pool().QueryRow("SELECT private_key_sealed FROM agent_ca WHERE id = 1").Scan(&sealed); err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(sealed, []byte("PRIVATE KEY")) {
		t.Fatal("the agent CA private key was stored in the clear")
	}
}

// Many enrolments racing for one code must produce exactly one agent: the
// lock on agent_ca makes spending a code atomic across goroutines, and it
// would across controller processes too.
func TestAnEnrollmentCodeIsSpentExactlyOnceUnderConcurrency(t *testing.T) {
	db := sqltest.Open(t)
	registry, err := OpenRegistry(db, 1)
	if err != nil {
		t.Fatal(err)
	}
	second, err := OpenRegistry(db, 1)
	if err != nil {
		t.Fatal(err)
	}
	token, err := registry.CreateEnrollment("")
	if err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	var mu sync.Mutex
	successes := 0
	for index := range 8 {
		wg.Add(1)
		target := registry
		if index%2 == 1 {
			target = second
		}
		csr := testCSR(t)
		go func() {
			defer wg.Done()
			if _, err := target.Enroll(EnrollInput{CSR: csr, Code: token.Code, NodeName: "racer", Protocol: ProtocolVersion}); err == nil {
				mu.Lock()
				successes++
				mu.Unlock()
			}
		}()
	}
	wg.Wait()
	var agents int
	if err := db.Pool().QueryRow("SELECT COUNT(*) FROM agents").Scan(&agents); err != nil {
		t.Fatal(err)
	}
	if successes != 1 || agents != 1 {
		t.Fatalf("successes=%d agents=%d, want exactly one of each", successes, agents)
	}
}

func TestStandaloneClaimRequiresApprovalAndRedeemsOnce(t *testing.T) {
	registry, err := OpenRegistry(sqltest.Open(t), 12)
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
