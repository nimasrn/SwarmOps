package source

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"testing"
)

func TestGitHubAdapterListsAndDiscoversAtImmutableRevision(t *testing.T) {
	commitSHA := strings.Repeat("a", 40)
	treeSHA := strings.Repeat("b", 40)
	compose := []byte("services:\n  api:\n    image: ghcr.io/acme/api:2026.08.25\n    ports: [\"8080\"]\n")
	dockerfile := []byte("FROM scratch\n")
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.Header.Get("Authorization") != "Bearer github-private-token" {
			http.Error(response, "missing auth", http.StatusUnauthorized)
			return
		}
		response.Header().Set("Content-Type", "application/json")
		switch request.URL.Path {
		case "/user":
			_, _ = io.WriteString(response, `{"login":"nima"}`)
		case "/user/repos":
			_, _ = io.WriteString(response, `[{"default_branch":"main","full_name":"acme/mono","html_url":"https://github.example/acme/mono","name":"mono","private":true}]`)
		case "/repos/acme/mono":
			_, _ = io.WriteString(response, `{"default_branch":"main","full_name":"acme/mono","html_url":"https://github.example/acme/mono","name":"mono","private":true}`)
		case "/repos/acme/mono/commits/main":
			_, _ = io.WriteString(response, `{"sha":"`+commitSHA+`","commit":{"tree":{"sha":"`+treeSHA+`"}}}`)
		case "/repos/acme/mono/git/trees/" + treeSHA:
			_, _ = io.WriteString(response, `{"truncated":false,"tree":[{"mode":"100644","path":"compose.yml","sha":"`+strings.Repeat("c", 40)+`","size":`+jsonNumber(len(compose))+`,"type":"blob"},{"mode":"100644","path":"Dockerfile","sha":"`+strings.Repeat("d", 40)+`","size":`+jsonNumber(len(dockerfile))+`,"type":"blob"}]}`)
		case "/repos/acme/mono/contents/compose.yml":
			_ = json.NewEncoder(response).Encode(map[string]any{"content": base64.StdEncoding.EncodeToString(compose), "encoding": "base64", "size": len(compose), "type": "file"})
		case "/repos/acme/mono/contents/Dockerfile":
			_ = json.NewEncoder(response).Encode(map[string]any{"content": base64.StdEncoding.EncodeToString(dockerfile), "encoding": "base64", "size": len(dockerfile), "type": "file"})
		default:
			http.NotFound(response, request)
		}
	}))
	defer server.Close()
	parsed, err := url.Parse(server.URL)
	if err != nil {
		t.Fatal(err)
	}
	directory := t.TempDir()
	store, err := NewStore(directory, bytes.Repeat([]byte{31}, 32))
	if err != nil {
		t.Fatal(err)
	}
	service, err := NewService(store, Options{AllowedHosts: []string{parsed.Host}, AllowHTTP: true, HTTPClient: server.Client(), ImagePrefix: "ghcr.io/acme"})
	if err != nil {
		t.Fatal(err)
	}
	connection, err := service.CreateConnection(context.Background(), ConnectionInput{BaseURL: server.URL, Kind: ProviderGitHub, Name: "GitHub test", Token: "github-private-token"})
	if err != nil {
		t.Fatal(err)
	}
	repositories, err := service.Repositories(context.Background(), connection.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(repositories) != 1 || repositories[0].ID != "acme/mono" || !repositories[0].Private {
		t.Fatalf("repositories = %#v", repositories)
	}
	plan, err := service.Discover(context.Background(), DiscoverRequest{ConnectionID: connection.ID, Ref: "main", RepositoryID: "acme/mono"})
	if err != nil {
		t.Fatal(err)
	}
	if plan.Revision.SHA != commitSHA || len(plan.ComposeFiles) != 1 || len(plan.Dockerfiles) != 1 {
		t.Fatalf("plan = %#v", plan)
	}
	if strings.Contains(string(mustJSON(t, service.Connections())), "github-private-token") {
		t.Fatal("connection response leaked provider token")
	}
}

func TestPrivateProviderRequiresExplicitHostAllowList(t *testing.T) {
	_, err := normalizeConnectionInput(ConnectionInput{BaseURL: "https://git.internal.example/api/v4", Kind: ProviderGitLab, Name: "Private GitLab", Token: "private-token"}, Options{})
	if err == nil || !strings.Contains(err.Error(), "SWARMOPS_SOURCE_ALLOWED_HOSTS") {
		t.Fatalf("expected host policy error, got %v", err)
	}
}

func TestProviderRedirectCannotLeaveApprovedHost(t *testing.T) {
	destination := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.Header.Get("Authorization") != "" || request.Header.Get("Private-Token") != "" {
			t.Error("provider credential reached redirected host")
		}
		_, _ = io.WriteString(response, `{"login":"attacker"}`)
	}))
	defer destination.Close()
	sourceServer := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		http.Redirect(response, request, destination.URL+"/user", http.StatusFound)
	}))
	defer sourceServer.Close()
	parsed, _ := url.Parse(sourceServer.URL)
	adapter, err := newProvider(storedConnection{Connection: Connection{BaseURL: sourceServer.URL, Kind: ProviderGitLab}, Token: "private-token"}, Options{AllowedHosts: []string{parsed.Host}, AllowHTTP: true, HTTPClient: sourceServer.Client()})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.Identity(context.Background()); err == nil || !strings.Contains(err.Error(), "unapproved host") {
		t.Fatalf("cross-host redirect error = %v", err)
	}
}

func TestGitLabAdapterUsesProjectIDAndEncodedNestedFilePath(t *testing.T) {
	commitSHA := strings.Repeat("e", 40)
	var sawEncodedFilePath bool
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.Header.Get("Private-Token") != "gitlab-private-token" {
			http.Error(response, "missing auth", http.StatusUnauthorized)
			return
		}
		response.Header().Set("Content-Type", "application/json")
		switch request.URL.Path {
		case "/api/v4/projects":
			_, _ = io.WriteString(response, `[{"default_branch":"main","id":7,"name":"mono","path_with_namespace":"acme/mono","visibility":"private","web_url":"https://gitlab.example/acme/mono"}]`)
		case "/api/v4/projects/7":
			_, _ = io.WriteString(response, `{"default_branch":"main","id":7,"name":"mono","path_with_namespace":"acme/mono","visibility":"private","web_url":"https://gitlab.example/acme/mono"}`)
		case "/api/v4/projects/7/repository/commits/main":
			_, _ = io.WriteString(response, `{"id":"`+commitSHA+`"}`)
		case "/api/v4/projects/7/repository/tree":
			_, _ = io.WriteString(response, `[{"id":"`+strings.Repeat("f", 40)+`","mode":"100644","name":"compose.yaml","path":"deploy/compose.yaml","type":"blob"}]`)
		case "/api/v4/projects/7/repository/files/deploy/compose.yaml/raw":
			sawEncodedFilePath = strings.Contains(request.URL.EscapedPath(), "deploy%2Fcompose.yaml")
			response.Header().Set("Content-Type", "text/plain")
			_, _ = io.WriteString(response, "services: {}\n")
		default:
			http.NotFound(response, request)
		}
	}))
	defer server.Close()
	parsed, _ := url.Parse(server.URL)
	adapter, err := newProvider(storedConnection{Connection: Connection{BaseURL: server.URL + "/api/v4", Kind: ProviderGitLab}, Token: "gitlab-private-token"}, Options{AllowedHosts: []string{parsed.Host}, AllowHTTP: true, HTTPClient: server.Client()})
	if err != nil {
		t.Fatal(err)
	}
	repositories, err := adapter.ListRepositories(context.Background())
	if err != nil || len(repositories) != 1 || repositories[0].ID != "7" {
		t.Fatalf("repositories = %#v err=%v", repositories, err)
	}
	repository, err := adapter.Repository(context.Background(), "7")
	if err != nil || repository.Path != "acme/mono" {
		t.Fatalf("repository = %#v err=%v", repository, err)
	}
	revision, err := adapter.ResolveRevision(context.Background(), "7", "main")
	if err != nil || revision.SHA != commitSHA {
		t.Fatalf("revision = %#v err=%v", revision, err)
	}
	tree, err := adapter.ListTree(context.Background(), "7", revision)
	if err != nil || len(tree) != 1 || tree[0].Path != "deploy/compose.yaml" {
		t.Fatalf("tree = %#v err=%v", tree, err)
	}
	data, err := adapter.ReadFile(context.Background(), "7", revision, "deploy/compose.yaml")
	if err != nil || string(data) != "services: {}\n" || !sawEncodedFilePath {
		t.Fatalf("file = %q encoded=%v err=%v", data, sawEncodedFilePath, err)
	}
}

func TestGiteaCompatibleAdapterUsesTokenAndRecursiveTree(t *testing.T) {
	commitSHA := strings.Repeat("1", 40)
	treeSHA := strings.Repeat("2", 40)
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.Header.Get("Authorization") != "token gitea-private-token" {
			http.Error(response, "missing auth", http.StatusUnauthorized)
			return
		}
		response.Header().Set("Content-Type", "application/json")
		switch request.URL.Path {
		case "/api/v1/user/repos":
			_, _ = io.WriteString(response, `[{"default_branch":"main","full_name":"acme/private","html_url":"https://git.example/acme/private","name":"private","private":true}]`)
		case "/api/v1/repos/acme/private":
			_, _ = io.WriteString(response, `{"default_branch":"main","full_name":"acme/private","html_url":"https://git.example/acme/private","name":"private","private":true}`)
		case "/api/v1/repos/acme/private/commits/main":
			_, _ = io.WriteString(response, `{"sha":"`+commitSHA+`","commit":{"tree":{"sha":"`+treeSHA+`"}}}`)
		case "/api/v1/repos/acme/private/git/trees/" + commitSHA:
			if request.URL.Query().Get("recursive") != "true" {
				http.Error(response, "recursive required", http.StatusBadRequest)
				return
			}
			_, _ = io.WriteString(response, `{"truncated":false,"tree":[{"mode":"100644","path":"Dockerfile","sha":"`+treeSHA+`","size":13,"type":"blob"}]}`)
		case "/api/v1/repos/acme/private/contents/Dockerfile":
			_ = json.NewEncoder(response).Encode(map[string]any{"content": base64.StdEncoding.EncodeToString([]byte("FROM scratch\n")), "encoding": "base64", "size": 13, "type": "file"})
		default:
			http.NotFound(response, request)
		}
	}))
	defer server.Close()
	parsed, _ := url.Parse(server.URL)
	adapter, err := newProvider(storedConnection{Connection: Connection{BaseURL: server.URL + "/api/v1", Kind: ProviderGitea}, Token: "gitea-private-token"}, Options{AllowedHosts: []string{parsed.Host}, AllowHTTP: true, HTTPClient: server.Client()})
	if err != nil {
		t.Fatal(err)
	}
	repositories, err := adapter.ListRepositories(context.Background())
	if err != nil || len(repositories) != 1 || repositories[0].ID != "acme/private" {
		t.Fatalf("repositories = %#v err=%v", repositories, err)
	}
	revision, err := adapter.ResolveRevision(context.Background(), "acme/private", "main")
	if err != nil {
		t.Fatal(err)
	}
	tree, err := adapter.ListTree(context.Background(), "acme/private", revision)
	if err != nil || len(tree) != 1 {
		t.Fatalf("tree = %#v err=%v", tree, err)
	}
	data, err := adapter.ReadFile(context.Background(), "acme/private", revision, "Dockerfile")
	if err != nil || string(data) != "FROM scratch\n" {
		t.Fatalf("file = %q err=%v", data, err)
	}
}

func jsonNumber(value int) string { return strconv.Itoa(value) }

func mustJSON(t *testing.T, value any) []byte {
	t.Helper()
	encoded, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	return encoded
}
