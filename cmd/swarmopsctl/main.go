// Command swarmopsctl is the trusted-workstation companion for operations
// that need a local path, most notably a resource-capped image build context.
package main

import (
	"archive/tar"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/moby/patternmatcher"
	"github.com/moby/patternmatcher/ignorefile"
	"golang.org/x/term"
)

const defaultContextLimit = 480 << 20

func main() {
	if len(os.Args) < 2 {
		usage(os.Stderr)
		os.Exit(2)
	}
	switch os.Args[1] {
	case "build":
		if err := build(os.Args[2:]); err != nil {
			fmt.Fprintln(os.Stderr, "swarmopsctl:", err)
			os.Exit(1)
		}
	case "help", "--help", "-h":
		usage(os.Stdout)
	default:
		fmt.Fprintf(os.Stderr, "unknown command %q\n", os.Args[1])
		usage(os.Stderr)
		os.Exit(2)
	}
}

func usage(writer io.Writer) {
	fmt.Fprint(writer, `SwarmOps trusted-workstation CLI

Usage:
  swarmopsctl build --url https://swarmops.example.invalid --username operator \
    --context ./service --image ghcr.io/example/service:2026.08.23 [options]

The password is prompted without echo from a terminal, or read only from stdin
when --password-stdin is supplied. It is never accepted as a command argument.
The local context honours .dockerignore, rejects symlinks/devices, and streams
an archive to SwarmOps; it is never interpreted as a manager filesystem path.

Build options:
  --dockerfile <path>       Dockerfile path within the context (default Dockerfile)
  --cpus <n>                Requested build vCPU cap (default 2)
  --memory-mib <n>          Requested RAM cap in MiB (default 2048)
  --push                    Request registry push after a successful build
  --password-stdin          Read password once from standard input
  --max-context-mib <n>     Local preflight source-content cap (default 480)
`)
}

func build(arguments []string) error {
	flags := flag.NewFlagSet("build", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	baseURL := flags.String("url", "", "SwarmOps URL")
	username := flags.String("username", "", "SwarmOps username")
	contextDir := flags.String("context", "", "local build context directory")
	image := flags.String("image", "", "immutable image reference")
	dockerfile := flags.String("dockerfile", "Dockerfile", "Dockerfile path")
	cpus := flags.Float64("cpus", 2, "build vCPU cap")
	memoryMiB := flags.Int64("memory-mib", 2048, "build RAM cap")
	push := flags.Bool("push", false, "push image after build")
	passwordStdin := flags.Bool("password-stdin", false, "read password from stdin")
	maxContextMiB := flags.Int64("max-context-mib", 480, "local source-content cap")
	if err := flags.Parse(arguments); err != nil {
		return err
	}
	if strings.TrimSpace(*baseURL) == "" || strings.TrimSpace(*username) == "" || strings.TrimSpace(*contextDir) == "" || strings.TrimSpace(*image) == "" {
		return errors.New("--url, --username, --context, and --image are required")
	}
	if *cpus <= 0 || *memoryMiB <= 0 || *maxContextMiB <= 0 {
		return errors.New("build resource and context limits must be positive")
	}
	endpoint, err := parseBaseURL(*baseURL)
	if err != nil {
		return err
	}
	password, err := readPassword(*passwordStdin)
	if err != nil {
		return err
	}
	jar, err := cookiejar.New(nil)
	if err != nil {
		return fmt.Errorf("create cookie jar: %w", err)
	}
	client := &http.Client{Jar: jar, Timeout: 35 * time.Minute}
	csrf, err := login(client, endpoint, *username, password)
	if err != nil {
		return err
	}
	archive, finished, err := archiveContext(*contextDir, *dockerfile, *maxContextMiB<<20)
	if err != nil {
		return err
	}
	defer archive.Close()
	buildURL := endpoint.ResolveReference(&url.URL{Path: strings.TrimSuffix(endpoint.Path, "/") + "/api/v1/builds"})
	ctx, cancel := context.WithTimeout(context.Background(), 35*time.Minute)
	defer cancel()
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, buildURL.String(), archive)
	if err != nil {
		return fmt.Errorf("create build request: %w", err)
	}
	request.Header.Set("Content-Type", "application/x-tar")
	request.Header.Set("X-CSRF-Token", csrf)
	request.Header.Set("X-SwarmOps-CPUs", fmt.Sprintf("%.4g", *cpus))
	request.Header.Set("X-SwarmOps-Dockerfile", *dockerfile)
	request.Header.Set("X-SwarmOps-Image", *image)
	request.Header.Set("X-SwarmOps-Memory-MiB", fmt.Sprint(*memoryMiB))
	request.Header.Set("X-SwarmOps-Push", fmt.Sprint(*push))
	response, err := client.Do(request)
	archiveErr := <-finished
	if err != nil {
		return fmt.Errorf("send build context: %w", err)
	}
	if archiveErr != nil {
		return archiveErr
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusAccepted {
		return responseError(response)
	}
	var result struct {
		Image string `json:"image"`
		Log   string `json:"log"`
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 8<<20)).Decode(&result); err != nil {
		return fmt.Errorf("decode build response: %w", err)
	}
	fmt.Printf("Built %s\n%s", result.Image, result.Log)
	return nil
}

func parseBaseURL(value string) (*url.URL, error) {
	parsed, err := url.Parse(strings.TrimRight(strings.TrimSpace(value), "/"))
	if err != nil || parsed.Scheme == "" || parsed.Host == "" || (parsed.Scheme != "https" && parsed.Scheme != "http") {
		return nil, errors.New("--url must be an http or https URL")
	}
	return parsed, nil
}

func readPassword(fromStdin bool) (string, error) {
	if fromStdin {
		value, err := io.ReadAll(io.LimitReader(os.Stdin, 4097))
		if err != nil {
			return "", fmt.Errorf("read password: %w", err)
		}
		password := strings.TrimRight(string(value), "\r\n")
		if password == "" || len(password) > 4096 {
			return "", errors.New("password from standard input is empty or too long")
		}
		return password, nil
	}
	if !term.IsTerminal(int(os.Stdin.Fd())) {
		return "", errors.New("standard input is not a terminal; use --password-stdin")
	}
	fmt.Fprint(os.Stderr, "SwarmOps password: ")
	value, err := term.ReadPassword(int(os.Stdin.Fd()))
	fmt.Fprintln(os.Stderr)
	if err != nil {
		return "", fmt.Errorf("read password: %w", err)
	}
	password := string(value)
	if password == "" {
		return "", errors.New("password is required")
	}
	return password, nil
}

func login(client *http.Client, endpoint *url.URL, username, password string) (string, error) {
	payload, err := json.Marshal(map[string]string{"username": username, "password": password})
	if err != nil {
		return "", err
	}
	loginURL := endpoint.ResolveReference(&url.URL{Path: strings.TrimSuffix(endpoint.Path, "/") + "/api/v1/auth/login"})
	request, err := http.NewRequest(http.MethodPost, loginURL.String(), bytes.NewReader(payload))
	if err != nil {
		return "", fmt.Errorf("create login request: %w", err)
	}
	request.Header.Set("Content-Type", "application/json")
	response, err := client.Do(request)
	if err != nil {
		return "", fmt.Errorf("log in to SwarmOps: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return "", responseError(response)
	}
	var session struct {
		CSRFToken string `json:"csrfToken"`
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 32<<10)).Decode(&session); err != nil {
		return "", fmt.Errorf("decode login response: %w", err)
	}
	if session.CSRFToken == "" {
		return "", errors.New("login response did not include a request token")
	}
	return session.CSRFToken, nil
}

func responseError(response *http.Response) error {
	body, _ := io.ReadAll(io.LimitReader(response.Body, 32<<10))
	var payload struct {
		Error string `json:"error"`
	}
	if json.Unmarshal(body, &payload) == nil && payload.Error != "" {
		return fmt.Errorf("SwarmOps returned %s: %s", response.Status, payload.Error)
	}
	return fmt.Errorf("SwarmOps returned %s", response.Status)
}

func archiveContext(root, dockerfile string, limit int64) (io.ReadCloser, <-chan error, error) {
	absoluteRoot, err := filepath.Abs(root)
	if err != nil {
		return nil, nil, fmt.Errorf("resolve context path: %w", err)
	}
	info, err := os.Stat(absoluteRoot)
	if err != nil {
		return nil, nil, fmt.Errorf("read context path: %w", err)
	}
	if !info.IsDir() {
		return nil, nil, errors.New("--context must name a directory")
	}
	if filepath.IsAbs(dockerfile) {
		return nil, nil, errors.New("--dockerfile must be a path within --context")
	}
	cleanDockerfile := filepath.ToSlash(filepath.Clean(dockerfile))
	if cleanDockerfile == "." || cleanDockerfile == ".." || strings.HasPrefix(cleanDockerfile, "../") {
		return nil, nil, errors.New("--dockerfile must be a path within --context")
	}
	matcher, err := dockerignore(absoluteRoot)
	if err != nil {
		return nil, nil, err
	}
	reader, writer := io.Pipe()
	finished := make(chan error, 1)
	go func() {
		err := writeArchive(writer, absoluteRoot, cleanDockerfile, limit, matcher)
		_ = writer.CloseWithError(err)
		finished <- err
	}()
	return reader, finished, nil
}

func dockerignore(root string) (*patternmatcher.PatternMatcher, error) {
	file, err := os.Open(filepath.Join(root, ".dockerignore"))
	if os.IsNotExist(err) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read .dockerignore: %w", err)
	}
	defer file.Close()
	patterns, err := ignorefile.ReadAll(file)
	if err != nil {
		return nil, fmt.Errorf("parse .dockerignore: %w", err)
	}
	matcher, err := patternmatcher.New(patterns)
	if err != nil {
		return nil, fmt.Errorf("compile .dockerignore: %w", err)
	}
	return matcher, nil
}

func writeArchive(writer *io.PipeWriter, root, dockerfile string, limit int64, matcher *patternmatcher.PatternMatcher) error {
	archive := tar.NewWriter(writer)
	defer archive.Close()
	var contentBytes int64
	return filepath.WalkDir(root, func(path string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		relative, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		if relative == "." {
			return nil
		}
		name := filepath.ToSlash(relative)
		ignored := false
		if matcher != nil && name != ".dockerignore" && name != dockerfile {
			ignored, err = matcher.MatchesOrParentMatches(name)
			if err != nil {
				return fmt.Errorf("match .dockerignore for %q: %w", name, err)
			}
		}
		if ignored {
			if entry.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		info, err := entry.Info()
		if err != nil {
			return err
		}
		if info.Mode()&os.ModeSymlink != 0 || info.Mode()&os.ModeType != 0 && !info.IsDir() {
			return fmt.Errorf("build context rejects symlink or special file %q", name)
		}
		header, err := tar.FileInfoHeader(info, "")
		if err != nil {
			return err
		}
		header.Name = name
		if info.IsDir() {
			header.Name += "/"
		}
		if err := archive.WriteHeader(header); err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}
		file, err := os.Open(path)
		if err != nil {
			return err
		}
		copied, copyErr := io.Copy(archive, io.LimitReader(file, limit-contentBytes+1))
		closeErr := file.Close()
		contentBytes += copied
		if copyErr != nil {
			return copyErr
		}
		if closeErr != nil {
			return closeErr
		}
		if contentBytes > limit {
			return fmt.Errorf("build context exceeds the local %d MiB cap", limit>>20)
		}
		return nil
	})
}
