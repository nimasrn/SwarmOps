package source

import (
	"archive/tar"
	"compress/gzip"
	"fmt"
	"io"
	"path"
	"strings"
	"time"
)

const maxBuildContextFiles = 20000

// normalizeBuildArchive converts the provider's commit tar.gz into a plain,
// deterministic Docker build-context tar. The provider-created top directory
// and monorepo context prefix are stripped, and only regular files are
// accepted. No checkout or source file is ever written to controller disk.
func normalizeBuildArchive(archive io.ReadCloser, contextPath string, maxBytes int64) (io.ReadCloser, error) {
	if archive == nil {
		return nil, fmt.Errorf("provider archive is required")
	}
	if maxBytes <= 0 {
		return nil, fmt.Errorf("build context size limit is invalid")
	}
	contextPath = strings.Trim(strings.TrimSpace(contextPath), "/")
	if contextPath != "" {
		clean, err := cleanRepositoryPath(contextPath)
		if err != nil {
			return nil, fmt.Errorf("invalid build context path")
		}
		contextPath = clean
	}
	gzipReader, err := gzip.NewReader(archive)
	if err != nil {
		return nil, fmt.Errorf("open provider archive: %w", err)
	}
	reader, writer := io.Pipe()
	go func() {
		err := writeNormalizedBuildTar(tar.NewReader(gzipReader), writer, contextPath, maxBytes)
		closeErr := gzipReader.Close()
		archiveErr := archive.Close()
		if err == nil {
			err = closeErr
		}
		if err == nil {
			err = archiveErr
		}
		_ = writer.CloseWithError(err)
	}()
	return reader, nil
}

func writeNormalizedBuildTar(source *tar.Reader, destination io.Writer, contextPath string, maxBytes int64) (err error) {
	output := tar.NewWriter(destination)
	defer func() {
		if closeErr := output.Close(); err == nil && closeErr != nil {
			err = fmt.Errorf("close normalized build context: %w", closeErr)
		}
	}()
	var root string
	var total int64
	files := 0
	found := false
	for {
		header, err := source.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return fmt.Errorf("read provider archive: %w", err)
		}
		name, archiveRoot, err := archiveRelativePath(header.Name)
		if err != nil {
			return err
		}
		if root == "" {
			root = archiveRoot
		} else if archiveRoot != root {
			return fmt.Errorf("provider archive contains more than one repository root")
		}
		if name == "" {
			continue
		}
		relative, selected := withinContext(name, contextPath)
		if !selected || relative == "" {
			continue
		}
		switch header.Typeflag {
		case tar.TypeDir:
			continue
		case tar.TypeReg, tar.TypeRegA:
		default:
			return fmt.Errorf("build context contains a symbolic link or special file at %q", name)
		}
		if header.Size < 0 || header.Size > maxBytes-total {
			return fmt.Errorf("build context exceeds the %d byte limit", maxBytes)
		}
		files++
		if files > maxBuildContextFiles {
			return fmt.Errorf("build context exceeds the %d file limit", maxBuildContextFiles)
		}
		mode := int64(0o644)
		if header.Mode&0o111 != 0 {
			mode = 0o755
		}
		normalized := &tar.Header{
			AccessTime: time.Time{},
			ChangeTime: time.Time{},
			Format:     tar.FormatPAX,
			Gid:        0,
			Mode:       mode,
			ModTime:    time.Unix(0, 0).UTC(),
			Name:       relative,
			Size:       header.Size,
			Typeflag:   tar.TypeReg,
			Uid:        0,
		}
		if err := output.WriteHeader(normalized); err != nil {
			return fmt.Errorf("write normalized build header: %w", err)
		}
		written, err := io.CopyN(output, source, header.Size)
		if err != nil || written != header.Size {
			return fmt.Errorf("copy normalized build file: %w", err)
		}
		total += written
		found = true
	}
	if !found {
		return fmt.Errorf("selected build context contains no regular files")
	}
	return nil
}

func archiveRelativePath(value string) (relative, root string, err error) {
	value = strings.TrimSuffix(strings.TrimSpace(value), "/")
	if value == "" || strings.HasPrefix(value, "/") || strings.ContainsAny(value, "\\\r\n\x00") {
		return "", "", fmt.Errorf("provider archive contains an invalid path")
	}
	clean := path.Clean(value)
	if clean == "." || clean == ".." || strings.HasPrefix(clean, "../") || clean != value {
		return "", "", fmt.Errorf("provider archive contains an invalid path")
	}
	parts := strings.Split(clean, "/")
	root = parts[0]
	if root == "." || root == ".." || root == "" {
		return "", "", fmt.Errorf("provider archive contains an invalid root")
	}
	if len(parts) == 1 {
		return "", root, nil
	}
	return strings.Join(parts[1:], "/"), root, nil
}

func withinContext(name, contextPath string) (string, bool) {
	if contextPath == "" {
		return name, true
	}
	if name == contextPath {
		return "", true
	}
	prefix := contextPath + "/"
	if !strings.HasPrefix(name, prefix) {
		return "", false
	}
	return strings.TrimPrefix(name, prefix), true
}
