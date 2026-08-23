package main

import (
	"archive/tar"
	"bytes"
	"io"
	"os"
	"path/filepath"
	"testing"
)

func TestArchiveContextRejectsDockerfileOutsideContext(t *testing.T) {
	t.Parallel()
	root := t.TempDir()
	for _, dockerfile := range []string{"../Dockerfile", "/tmp/Dockerfile", "."} {
		if _, _, err := archiveContext(root, dockerfile, 1<<20); err == nil {
			t.Fatalf("archiveContext(%q) accepted an unsafe Dockerfile path", dockerfile)
		}
	}
}

func TestArchiveContextHonorsDockerignoreButKeepsDockerfile(t *testing.T) {
	t.Parallel()
	root := t.TempDir()
	for name, content := range map[string]string{
		".dockerignore": "ignored.txt\nDockerfile\n",
		"Dockerfile":    "FROM scratch\n",
		"ignored.txt":   "secret\n",
		"visible.txt":   "included\n",
	} {
		if err := os.WriteFile(filepath.Join(root, name), []byte(content), 0o600); err != nil {
			t.Fatal(err)
		}
	}

	reader, finished, err := archiveContext(root, "Dockerfile", 1<<20)
	if err != nil {
		t.Fatal(err)
	}
	data, readErr := io.ReadAll(reader)
	closeErr := reader.Close()
	archiveErr := <-finished
	if readErr != nil || closeErr != nil || archiveErr != nil {
		t.Fatalf("archive errors: read=%v close=%v write=%v", readErr, closeErr, archiveErr)
	}

	entries := map[string]bool{}
	archive := tar.NewReader(bytes.NewReader(data))
	for {
		header, err := archive.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatal(err)
		}
		entries[header.Name] = true
	}
	if !entries["Dockerfile"] || !entries["visible.txt"] || !entries[".dockerignore"] {
		t.Fatalf("expected Dockerfile, visible file, and .dockerignore; got %#v", entries)
	}
	if entries["ignored.txt"] {
		t.Fatalf("ignored file was included: %#v", entries)
	}
}
