package agent

import (
	"context"
	"encoding/json"
	"net"
	"net/netip"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/nimasrn/SwarmOps/internal/agentcontrol"
)

// A Swarm is advertised on the address a PEER uses to reach this machine.
// Getting this wrong forms a cluster that cannot talk to itself, and it was
// wrong in two independent ways.

func advertiseCandidates(pairs ...string) []advertiseCandidate {
	candidates := make([]advertiseCandidate, 0, len(pairs)/2)
	for index := 0; index+1 < len(pairs); index += 2 {
		candidates = append(candidates, advertiseCandidate{
			Interface: pairs[index],
			Address:   netip.MustParseAddr(pairs[index+1]),
		})
	}
	return candidates
}

// docker0 is 172.17.0.1 on every Docker host on earth and is reachable from
// nowhere else.
func TestAdvertiseAddressIgnoresContainerInterfaces(t *testing.T) {
	address, err := chooseAdvertiseAddress(advertiseCandidates(
		"docker0", "172.17.0.1",
		"eth0", "192.168.1.5",
		"veth9a1f", "172.18.0.3",
		"br-4f2a", "172.19.0.1",
	))
	if err != nil {
		t.Fatalf("choose: %v", err)
	}
	if address != "192.168.1.5" {
		t.Fatalf("expected the machine's own LAN address, got %s", address)
	}
}

// "172.17.0.1" sorts before "192.168.1.5" as TEXT, which is how a host on a
// 192.168 network ended up advertising Docker's bridge.
func TestAdvertiseAddressComparesAddressesNotStrings(t *testing.T) {
	address, err := chooseAdvertiseAddress(advertiseCandidates(
		"eth1", "192.168.1.5",
		"eth0", "10.0.0.11",
	))
	if err != nil {
		t.Fatalf("choose: %v", err)
	}
	if address != "10.0.0.11" {
		t.Fatalf("expected the numerically lowest address, got %s", address)
	}
}

// A host whose only interface is named unusually is stranded by refusing, so
// the previous behaviour remains the fallback rather than an error.
func TestAdvertiseAddressFallsBackWhenEverythingLooksLikeAContainerInterface(t *testing.T) {
	address, err := chooseAdvertiseAddress(advertiseCandidates("docker0", "172.17.0.1"))
	if err != nil {
		t.Fatalf("choose: %v", err)
	}
	if address != "172.17.0.1" {
		t.Fatalf("expected the fallback, got %s", address)
	}
}

func TestAdvertiseAddressNeedsAtLeastOneCandidate(t *testing.T) {
	if _, err := chooseAdvertiseAddress(nil); err == nil {
		t.Fatal("a machine with no usable address must say so")
	}
}

// The provisioning helper reads to EOF to prove it received exactly ONE
// request — a second object on the same connection would be a second host
// operation nobody authorised.
//
// That check only terminates when the SENDER closes its write half, and for a
// long time the agent did not. Both processes then waited for the other: every
// host operation appeared to hang and failed forty-five minutes later as
// "invalid request", which is a message about the request rather than about
// the deadlock that actually happened.
//
// This drives the socket protocol directly rather than going through
// provision(), which validates before it dials, and it sends a request the
// helper will refuse — what is under test is the handshake, and running a real
// package or Swarm operation would change the machine running the tests.
func TestProvisioningHelperNeedsTheWriteHalfClosed(t *testing.T) {
	// Not t.TempDir(): its path embeds the test name, and a unix socket path
	// is capped at 104 bytes on macOS, which this test name alone exceeds.
	directory, err := os.MkdirTemp("", "sw")
	if err != nil {
		t.Fatalf("temp dir: %v", err)
	}
	defer os.RemoveAll(directory)
	socketPath := filepath.Join(directory, "p.sock")

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	served := make(chan error, 1)
	go func() { served <- ServeProvisioner(ctx, socketPath, 9180) }()

	deadline := time.Now().Add(5 * time.Second)
	for {
		if _, err := os.Stat(socketPath); err == nil {
			break
		}
		select {
		case err := <-served:
			t.Fatalf("the helper stopped before it listened: %v", err)
		default:
		}
		if time.Now().After(deadline) {
			t.Fatal("the helper never created its socket")
		}
		time.Sleep(10 * time.Millisecond)
	}

	// A plan with no operation in it. The helper refuses it, which is the fast
	// path being timed.
	request := agentcontrol.ProvisioningRequest{Confirmation: agentcontrol.ProvisionConfirmation}

	send := func(closeWrite bool) error {
		connection, err := net.Dial("unix", socketPath)
		if err != nil {
			return err
		}
		defer connection.Close()
		if err := json.NewEncoder(connection).Encode(request); err != nil {
			return err
		}
		if closeWrite {
			if err := connection.(*net.UnixConn).CloseWrite(); err != nil {
				return err
			}
		}
		_ = connection.SetReadDeadline(time.Now().Add(2 * time.Second))
		var response provisionerResponse
		return json.NewDecoder(connection).Decode(&response)
	}

	if err := send(false); err == nil {
		t.Fatal("without closing the write half the helper cannot see the end of the request, so it must not have answered")
	}
	if err := send(true); err != nil {
		t.Fatalf("with the write half closed the helper must answer promptly: %v", err)
	}
}
