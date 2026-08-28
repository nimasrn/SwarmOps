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
		switch request.URL.Path {
		case "/build":
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
		case "/images/ghcr.io/example/api/push":
			if request.URL.Query().Get("tag") != "2026.08.23" || request.Header.Get("X-Registry-Auth") == "" {
				t.Fatalf("unsafe push request query=%s auth=%q", request.URL.RawQuery, request.Header.Get("X-Registry-Auth"))
			}
			_, _ = response.Write([]byte(`{"status":"pushed"}`))
		default:
			t.Fatalf("path = %s", request.URL.Path)
		}
	}))
	defer server.Close()
	docker, err := dockerapi.NewForURL(server.URL, server.Client())
	if err != nil {
		t.Fatal(err)
	}
	service := Service{Docker: docker, Enabled: true, ImagePrefixes: []string{"ghcr.io/example/"}, MaxCPUs: 2, MaxMemoryMiB: 1024, RegistryAuth: []byte(`{"auths":{"ghcr.io":{"auth":"dXNlcjp0b2tlbg=="}}}`)}
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

func TestBuildLogReportsOnlyRealErrorEntries(t *testing.T) {
	t.Parallel()
	for _, tc := range []struct {
		name string
		log  string
		want bool
	}{
		{
			name: "error entry",
			log:  "{\"stream\":\"Step 1/2\"}\n{\"errorDetail\":{\"message\":\"boom\"},\"error\":\"boom\"}\n",
			want: true,
		},
		{
			name: "plain error entry",
			log:  "{\"stream\":\"pull ok\"}\n{\"error\":\"manifest unknown\"}\n",
			want: true,
		},
		{
			name: "successful stream that echoes the word error",
			log:  "{\"stream\":\"echo quoted-error-string\"}\n{\"stream\":\"Successfully built abc\\n\"}\n",
			want: false,
		},
		{
			name: "non-JSON fallback still detects legacy marker",
			log:  "some engine wrote \"error\" text",
			want: true,
		},
	} {
		if got := buildLogReportsError(tc.log); got != tc.want {
			t.Errorf("%s: buildLogReportsError = %t, want %t", tc.name, got, tc.want)
		}
	}
}

func TestRegistryAuthHeaderSelectsOnlyTheRequestedRegistry(t *testing.T) {
	header, err := registryAuthHeader([]byte(`{"auths":{"ghcr.io":{"auth":"Z2g="},"registry.example":{"auth":"cHJpdmF0ZQ=="}}}`), "registry.example/team/api")
	if err != nil || header == "" {
		t.Fatalf("registry auth header = %q err=%v", header, err)
	}
	if _, err := registryAuthHeader([]byte(`{"auths":{"ghcr.io":{"auth":"Z2g="}}}`), "registry.example/team/api"); err == nil {
		t.Fatal("credential for a different registry was accepted")
	}
}
