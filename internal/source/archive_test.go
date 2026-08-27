package source

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"io"
	"testing"
)

func TestNormalizeBuildArchiveSelectsContextAndStripsProviderRoot(t *testing.T) {
	archive := testArchive(t, []archiveEntry{
		{name: "repo-sha/apps/api/Dockerfile", body: "FROM scratch\n"},
		{name: "repo-sha/apps/api/main", body: "binary", mode: 0o755},
		{name: "repo-sha/apps/web/Dockerfile", body: "FROM nginx\n"},
	})
	contextReader, err := normalizeBuildArchive(io.NopCloser(bytes.NewReader(archive)), "apps/api", 1<<20)
	if err != nil {
		t.Fatal(err)
	}
	defer contextReader.Close()
	tarReader := tar.NewReader(contextReader)
	files := map[string]string{}
	modes := map[string]int64{}
	for {
		header, err := tarReader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatal(err)
		}
		body, err := io.ReadAll(tarReader)
		if err != nil {
			t.Fatal(err)
		}
		files[header.Name] = string(body)
		modes[header.Name] = header.Mode
	}
	if len(files) != 2 || files["Dockerfile"] != "FROM scratch\n" || files["main"] != "binary" {
		t.Fatalf("normalized files = %#v", files)
	}
	if modes["main"] != 0o755 || modes["Dockerfile"] != 0o644 {
		t.Fatalf("normalized modes = %#v", modes)
	}
}

func TestNormalizeBuildArchiveRejectsSymlinkInsideSelectedContext(t *testing.T) {
	archive := testArchive(t, []archiveEntry{{name: "repo-sha/app/Dockerfile", body: "FROM scratch\n"}, {name: "repo-sha/app/link", kind: tar.TypeSymlink, link: "/etc/passwd"}})
	contextReader, err := normalizeBuildArchive(io.NopCloser(bytes.NewReader(archive)), "app", 1<<20)
	if err != nil {
		t.Fatal(err)
	}
	defer contextReader.Close()
	if _, err := io.ReadAll(contextReader); err == nil {
		t.Fatal("expected selected symlink to be rejected")
	}
}

type archiveEntry struct {
	body string
	kind byte
	link string
	mode int64
	name string
}

func testArchive(t *testing.T, entries []archiveEntry) []byte {
	t.Helper()
	var buffer bytes.Buffer
	gzipWriter := gzip.NewWriter(&buffer)
	tarWriter := tar.NewWriter(gzipWriter)
	for _, entry := range entries {
		kind := entry.kind
		if kind == 0 {
			kind = tar.TypeReg
		}
		mode := entry.mode
		if mode == 0 {
			mode = 0o644
		}
		header := &tar.Header{Name: entry.name, Mode: mode, Typeflag: kind, Linkname: entry.link}
		if kind == tar.TypeReg {
			header.Size = int64(len(entry.body))
		}
		if err := tarWriter.WriteHeader(header); err != nil {
			t.Fatal(err)
		}
		if kind == tar.TypeReg {
			if _, err := io.WriteString(tarWriter, entry.body); err != nil {
				t.Fatal(err)
			}
		}
	}
	if err := tarWriter.Close(); err != nil {
		t.Fatal(err)
	}
	if err := gzipWriter.Close(); err != nil {
		t.Fatal(err)
	}
	return buffer.Bytes()
}
