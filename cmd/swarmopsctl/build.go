package main

import (
	"archive/tar"
	"bytes"
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/moby/patternmatcher"
	"github.com/moby/patternmatcher/ignorefile"
	"github.com/nimasrn/SwarmOps/internal/cli"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/term"
)

// buildTimeout bounds one context upload and the queued acknowledgement. A
// build itself runs on the machine agent and outlives this process.
const buildTimeout = 35 * time.Minute

func passwordHash(arguments []string) error {
	flags := flag.NewFlagSet("password-hash", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	stdin := flags.Bool("stdin", false, "read the password once from stdin")
	if err := flags.Parse(arguments); err != nil {
		return err
	}
	if !*stdin || flags.NArg() != 0 {
		return errors.New("password-hash requires --stdin and no positional arguments")
	}
	input, err := io.ReadAll(io.LimitReader(os.Stdin, 4097))
	if err != nil {
		return fmt.Errorf("read password: %w", err)
	}
	password := bytes.TrimSuffix(input, []byte("\n"))
	password = bytes.TrimSuffix(password, []byte("\r"))
	defer func() {
		for index := range input {
			input[index] = 0
		}
	}()
	if len(password) < 16 {
		return errors.New("password must contain at least 16 bytes")
	}
	hash, err := hashPassword(password)
	if err != nil {
		return err
	}
	_, err = fmt.Fprintln(os.Stdout, hash)
	return err
}

func hashPassword(password []byte) (string, error) {
	hash, err := bcrypt.GenerateFromPassword(password, bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("hash password: %w", err)
	}
	return string(hash), nil
}

// build is the trusted-workstation image build: a local directory becomes a
// tar stream the controller hands to a machine agent. It logs in for itself
// rather than reading the profile, because it predates the profile and is the
// one command a fresh workstation may run before `login`.
func build(arguments []string) error {
	flags := flag.NewFlagSet("build", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	baseURL := flags.String("url", "", "SwarmOps URL")
	serverID := flags.String("server-id", "", "connected remote server profile")
	coreFingerprint := flags.String("core-fingerprint", "", "exact SHA-256 Core certificate fingerprint")
	clusterID := flags.String("cluster-id", "", "explicit cluster target")
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
	if strings.TrimSpace(*baseURL) == "" || strings.TrimSpace(*username) == "" || strings.TrimSpace(*clusterID) == "" || strings.TrimSpace(*serverID) == "" || strings.TrimSpace(*contextDir) == "" || strings.TrimSpace(*image) == "" {
		return errors.New("--url, --username, --cluster-id, --server-id, --context, and --image are required")
	}
	if *clusterID != cli.ClusterID {
		return errors.New("v1 requires --cluster-id default")
	}
	if *cpus <= 0 || *memoryMiB <= 0 || *maxContextMiB <= 0 {
		return errors.New("build resource and context limits must be positive")
	}
	password, err := readPassword(*passwordStdin)
	if err != nil {
		return err
	}
	client, err := cli.New(*baseURL, *coreFingerprint, buildTimeout)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), buildTimeout)
	defer cancel()
	if err := client.Login(ctx, *username, password); err != nil {
		return err
	}
	client.WithServer(*serverID)
	command, err := submitBuild(ctx, client, buildInput{
		contextDir:    *contextDir,
		cpus:          *cpus,
		dockerfile:    *dockerfile,
		image:         *image,
		maxContextMiB: *maxContextMiB,
		memoryMiB:     *memoryMiB,
		push:          *push,
	})
	if err != nil {
		return err
	}
	fmt.Printf("Build command queued: %s\n", command.ID)
	return nil
}

type buildInput struct {
	contextDir    string
	cpus          float64
	dockerfile    string
	image         string
	maxContextMiB int64
	memoryMiB     int64
	push          bool
}

// submitBuild streams the context and reports the queued command. A context
// that fails midway still leaves a durable command, so the caller is told the
// ID rather than being left thinking nothing happened.
func submitBuild(ctx context.Context, client *cli.Client, input buildInput) (queuedCommand, error) {
	archive, finished, err := archiveContext(input.contextDir, input.dockerfile, input.maxContextMiB<<20)
	if err != nil {
		return queuedCommand{}, err
	}
	defer archive.Close()
	command, err := client.SubmitStream(ctx, "/api/v1/builds", "build", "application/x-tar", archive, map[string]string{
		"X-SwarmOps-CPUs":       fmt.Sprintf("%.4g", input.cpus),
		"X-SwarmOps-Dockerfile": input.dockerfile,
		"X-SwarmOps-Image":      input.image,
		"X-SwarmOps-Memory-MiB": fmt.Sprint(input.memoryMiB),
		"X-SwarmOps-Push":       fmt.Sprint(input.push),
	})
	archiveErr := <-finished
	if err != nil {
		return queuedCommand{}, err
	}
	if archiveErr != nil {
		return queuedCommand{ID: command.ID}, fmt.Errorf("build input did not finish; SwarmOps retained command %s for operator attention: %w", command.ID, archiveErr)
	}
	return queuedCommand{ID: command.ID}, nil
}

type queuedCommand struct{ ID string }

// newCommandIdempotencyKey names one build submission.
func newCommandIdempotencyKey() (string, error) { return cli.IdempotencyKey("build") }

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
