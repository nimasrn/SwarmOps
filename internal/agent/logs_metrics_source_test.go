package agent

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/nimasrn/SwarmOps/internal/dockerapi"
)

func sourceDocker(t *testing.T, routes map[string]string) *dockerapi.Client {
	t.Helper()
	backend := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		for suffix, body := range routes {
			if strings.Contains(request.URL.Path, suffix) {
				response.Header().Set("Content-Type", "application/json")
				_, _ = response.Write([]byte(body))
				return
			}
		}
		http.NotFound(response, request)
	}))
	t.Cleanup(backend.Close)
	client, err := dockerapi.NewForURL(backend.URL, backend.Client())
	if err != nil {
		t.Fatal(err)
	}
	return client
}

func TestLogStoreOpensTheVolumeTheEngineNames(t *testing.T) {
	t.Parallel()
	root := t.TempDir()
	mount := filepath.Join(root, "volumes", "swarmops-logs_swarmops_logs", "_data")
	if err := os.MkdirAll(filepath.Join(mount, "records"), 0o750); err != nil {
		t.Fatal(err)
	}
	docker := sourceDocker(t, map[string]string{"/volumes/": `{"Name":"swarmops-logs_swarmops_logs","Mountpoint":"` + mount + `"}`})
	server := &Server{config: Config{Docker: docker, LogsVolume: "swarmops-logs_swarmops_logs"}}

	if _, err := server.logStore(context.Background()); err != nil {
		t.Fatal(err)
	}
}

func TestLogStoreJoinsTheEnginePathToAContainerHostRoot(t *testing.T) {
	t.Parallel()
	// The engine answers with a host path. An agent in a container sees it
	// under its host mount, and joining the two is what makes the same binary
	// work in both topologies.
	hostRoot := t.TempDir()
	if err := os.MkdirAll(filepath.Join(hostRoot, "var/lib/docker/volumes/logs/_data/records"), 0o750); err != nil {
		t.Fatal(err)
	}
	docker := sourceDocker(t, map[string]string{"/volumes/": `{"Name":"logs","Mountpoint":"/var/lib/docker/volumes/logs/_data"}`})
	server := &Server{config: Config{Docker: docker, HostRoot: hostRoot, LogsVolume: "logs"}}

	if _, err := server.logStore(context.Background()); err != nil {
		t.Fatal(err)
	}
}

func TestLogStoreFailsWhenTheCollectorHasNeverRun(t *testing.T) {
	t.Parallel()
	// An absent root is a cluster that is not collecting. Reporting that as an
	// empty store would show "no records" for a pipeline that is not deployed.
	docker := sourceDocker(t, map[string]string{"/volumes/": `{"Name":"logs","Mountpoint":"` + filepath.Join(t.TempDir(), "absent") + `"}`})
	server := &Server{config: Config{Docker: docker, LogsVolume: "logs"}}

	if _, err := server.logStore(context.Background()); err == nil {
		t.Fatal("expected an error for a log root that does not exist")
	}
}

func TestLogStoreFailsWithoutDocker(t *testing.T) {
	t.Parallel()
	server := &Server{config: Config{LogsVolume: "logs"}}

	if _, err := server.logStore(context.Background()); err == nil {
		t.Fatal("expected an error when there is no engine to resolve the volume")
	}
}

func TestPrometheusBaseURLUsesTheNodeLocalBridgeAddress(t *testing.T) {
	t.Parallel()
	docker := sourceDocker(t, map[string]string{"/containers/json": `[
	  {"Id":"other","Labels":{"com.docker.swarm.service.name":"swarmops-observability_jaeger"},"NetworkSettings":{"Networks":{"docker_gwbridge":{"IPAddress":"172.18.0.9"}}}},
	  {"Id":"prom","Labels":{"com.docker.swarm.service.name":"swarmops-observability_prometheus"},"NetworkSettings":{"Networks":{"route-prometheus":{"IPAddress":"10.0.7.4"},"docker_gwbridge":{"IPAddress":"172.18.0.5"}}}}]`})
	server := &Server{config: Config{Docker: docker, PrometheusService: "swarmops-observability_prometheus", PrometheusPort: 9090}}

	base, err := server.prometheusBaseURL(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	// The overlay address is deliberately NOT chosen: a host-native agent
	// cannot route to it.
	if base != "http://172.18.0.5:9090" {
		t.Fatalf("base = %q, want the docker_gwbridge address", base)
	}
}

func TestPrometheusBaseURLPrefersAnExplicitOverride(t *testing.T) {
	t.Parallel()
	server := &Server{config: Config{PrometheusBaseURL: "http://swarmops-prometheus.swarmops.internal:8081", PrometheusService: "swarmops-observability_prometheus"}}

	base, err := server.prometheusBaseURL(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if base != "http://swarmops-prometheus.swarmops.internal:8081" {
		t.Fatalf("base = %q, want the configured override", base)
	}
}

func TestPrometheusBaseURLFailsWhenNoTaskRunsHere(t *testing.T) {
	t.Parallel()
	docker := sourceDocker(t, map[string]string{"/containers/json": `[]`})
	server := &Server{config: Config{Docker: docker, PrometheusService: "swarmops-observability_prometheus"}}

	if _, err := server.prometheusBaseURL(context.Background()); err == nil {
		t.Fatal("expected an error on a machine that is not running Prometheus")
	}
}
