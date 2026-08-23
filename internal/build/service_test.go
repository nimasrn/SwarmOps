package build

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/nimasrn/SwarmOps/internal/dockerapi"
)

func TestRunSendsCappedBuildRequest(t *testing.T) {
	t.Parallel()
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/build" {
			t.Fatalf("path = %s", request.URL.Path)
		}
		if got := request.URL.Query().Get("memory"); got != "536870912" {
			t.Fatalf("memory = %q", got)
		}
		if got := request.URL.Query().Get("cpuquota"); got != "150000" {
			t.Fatalf("cpuquota = %q", got)
		}
		if got := request.Header.Get("X-Registry-Config"); got == "" {
			t.Fatal("missing encoded registry config")
		}
		if _, err := io.ReadAll(request.Body); err != nil {
			t.Fatal(err)
		}
		_, _ = response.Write([]byte(`{"stream":"done"}`))
	}))
	defer server.Close()
	docker, err := dockerapi.NewForURL(server.URL, server.Client())
	if err != nil {
		t.Fatal(err)
	}
	service := Service{Docker: docker, Enabled: true, ImagePrefixes: []string{"ghcr.io/example/"}, MaxCPUs: 2, MaxMemoryMiB: 1024, RegistryAuth: []byte(`{"auths":{}}`)}
	result, err := service.Run(context.Background(), Request{CPUs: 1.5, Image: "ghcr.io/example/api:2026.08.23", MemoryMiB: 512, Push: true}, strings.NewReader("tar"), "request-1")
	if err != nil {
		t.Fatalf("build: %v", err)
	}
	if result.Image != "ghcr.io/example/api:2026.08.23" || !result.Pushed {
		t.Fatalf("unexpected result: %#v", result)
	}
}

func TestRunRejectsUnboundedImageBeforeDocker(t *testing.T) {
	t.Parallel()
	service := Service{Enabled: true, ImagePrefixes: []string{"ghcr.io/example/"}, MaxCPUs: 1, MaxMemoryMiB: 256}
	if _, err := service.Run(context.Background(), Request{Image: "ghcr.io/example/api:latest"}, strings.NewReader(""), "request-1"); err == nil {
		t.Fatal("latest image was accepted")
	}
}
