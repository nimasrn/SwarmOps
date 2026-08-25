package agent

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"syscall"

	"github.com/nimasrn/SwarmOps/internal/dockerapi"
	"github.com/nimasrn/SwarmOps/internal/mobility"
)

const (
	defaultMobilityTransferMaxBytes int64 = 64 << 30
	maxMobilityFiles                      = 1_000_000
)

// VolumeReceipt proves the exact encrypted transport stream accepted by a
// target machine agent. It contains no archive paths or content.
type VolumeReceipt struct {
	Bytes  int64  `json:"bytes"`
	Digest string `json:"digest"`
}

// VolumeTransfer is intentionally narrower than a file API. It can archive,
// restore, or retire only the closed set of SwarmOps durable local volumes.
// No request can select a filesystem path, executable, image, or tar member.
type VolumeTransfer interface {
	Export(context.Context, string, io.Writer) (VolumeReceipt, error)
	Restore(context.Context, string, string, io.Reader) (VolumeReceipt, error)
	Remove(context.Context, string) error
}

type systemVolumeTransfer struct {
	docker      *dockerapi.Client
	maxBytes    int64
	transferDir string
}

func newSystemVolumeTransfer(docker *dockerapi.Client, transferDir string, maxBytes int64) VolumeTransfer {
	if maxBytes <= 0 {
		maxBytes = defaultMobilityTransferMaxBytes
	}
	if transferDir == "" {
		transferDir = "/var/lib/swarmops-agent/transfers"
	}
	return &systemVolumeTransfer{docker: docker, maxBytes: maxBytes, transferDir: transferDir}
}

func (s *Server) volumeArchive(response http.ResponseWriter, request *http.Request) {
	if !s.authorized(request) {
		http.Error(response, "unauthorized", http.StatusUnauthorized)
		return
	}
	if !s.managed.Managed() {
		http.Error(response, "agent is not managed by a control plane", http.StatusConflict)
		return
	}
	volume, ok := managedVolume(request.PathValue("name"))
	if !ok || s.config.VolumeTransfer == nil {
		http.Error(response, "managed volume transfer is unavailable", http.StatusNotFound)
		return
	}
	response.Header().Set("Content-Type", "application/gzip")
	response.Header().Set("Cache-Control", "no-store")
	if _, err := s.config.VolumeTransfer.Export(request.Context(), volume, response); err != nil {
		// The response is a streaming archive, so a meaningful error status can
		// only be returned before its first member. Do not leak an agent or
		// filesystem error into a machine-facing response either way.
		return
	}
}

func (s *Server) volumeRestore(response http.ResponseWriter, request *http.Request) {
	if !s.authorized(request) {
		http.Error(response, "unauthorized", http.StatusUnauthorized)
		return
	}
	if !s.managed.Managed() {
		http.Error(response, "agent is not managed by a control plane", http.StatusConflict)
		return
	}
	volume, ok := managedVolume(request.PathValue("name"))
	migrationID := request.Header.Get("X-SwarmOps-Migration-ID")
	if !ok || !mobility.ValidMigrationID(migrationID) || s.config.VolumeTransfer == nil {
		http.Error(response, "invalid managed volume restore", http.StatusBadRequest)
		return
	}
	request.Body = http.MaxBytesReader(response, request.Body, s.mobilityTransferMaxBytes()+1)
	defer request.Body.Close()
	receipt, err := s.config.VolumeTransfer.Restore(request.Context(), volume, migrationID, request.Body)
	if err != nil {
		http.Error(response, "managed volume restore failed", http.StatusBadGateway)
		return
	}
	writeJSON(response, receipt)
}

func (s *Server) volumeRemove(response http.ResponseWriter, request *http.Request) {
	if !s.authorized(request) {
		http.Error(response, "unauthorized", http.StatusUnauthorized)
		return
	}
	if !s.managed.Managed() {
		http.Error(response, "agent is not managed by a control plane", http.StatusConflict)
		return
	}
	volume, ok := managedVolume(request.PathValue("name"))
	if !ok || s.config.VolumeTransfer == nil {
		http.Error(response, "managed volume transfer is unavailable", http.StatusNotFound)
		return
	}
	if err := s.config.VolumeTransfer.Remove(request.Context(), volume); err != nil {
		http.Error(response, "managed source cleanup failed", http.StatusConflict)
		return
	}
	response.WriteHeader(http.StatusNoContent)
}

func (s *Server) mobilityTransferMaxBytes() int64 {
	if s.config.MobilityTransferMaxBytes > 0 {
		return s.config.MobilityTransferMaxBytes
	}
	return defaultMobilityTransferMaxBytes
}

func managedVolume(value string) (string, bool) {
	value = strings.TrimSpace(value)
	return value, mobility.IsManagedVolume(value)
}

func (v *systemVolumeTransfer) Export(ctx context.Context, volume string, output io.Writer) (VolumeReceipt, error) {
	mount, err := v.mountpoint(ctx, volume)
	if err != nil {
		return VolumeReceipt{}, err
	}
	if output == nil {
		return VolumeReceipt{}, fmt.Errorf("archive output is required")
	}
	digest := sha256.New()
	limited := &limitedWriter{limit: v.maxBytes, writer: io.MultiWriter(output, digest)}
	gzipWriter := gzip.NewWriter(limited)
	tarWriter := tar.NewWriter(gzipWriter)
	state := archiveState{maxBytes: v.maxBytes}
	err = filepath.WalkDir(mount, func(path string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if err := ctx.Err(); err != nil {
			return err
		}
		if path == mount {
			return nil
		}
		relative, err := filepath.Rel(mount, path)
		if err != nil {
			return err
		}
		if err := cleanArchivePath(relative); err != nil {
			return err
		}
		info, err := entry.Info()
		if err != nil {
			return err
		}
		if entry.Type()&os.ModeSymlink != 0 || !info.Mode().IsRegular() && !info.IsDir() {
			return fmt.Errorf("managed volume contains an unsupported file type")
		}
		state.files++
		if state.files > maxMobilityFiles {
			return fmt.Errorf("managed volume contains too many files")
		}
		if info.Mode().IsRegular() {
			state.uncompressed += info.Size()
			if state.uncompressed > v.maxBytes {
				return fmt.Errorf("managed volume exceeds transfer limit")
			}
		}
		header, err := tar.FileInfoHeader(info, "")
		if err != nil {
			return err
		}
		header.Name = filepath.ToSlash(relative)
		if info.IsDir() {
			header.Name += "/"
		}
		applyOwner(header, info)
		if err := tarWriter.WriteHeader(header); err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}
		file, err := os.Open(path)
		if err != nil {
			return err
		}
		_, copyErr := io.Copy(tarWriter, &contextReader{ctx: ctx, reader: file})
		closeErr := file.Close()
		if copyErr != nil {
			return copyErr
		}
		return closeErr
	})
	if closeErr := tarWriter.Close(); err == nil {
		err = closeErr
	}
	if closeErr := gzipWriter.Close(); err == nil {
		err = closeErr
	}
	if err != nil {
		return VolumeReceipt{}, err
	}
	return VolumeReceipt{Bytes: limited.written, Digest: hex.EncodeToString(digest.Sum(nil))}, nil
}

func (v *systemVolumeTransfer) Restore(ctx context.Context, volume, migrationID string, input io.Reader) (VolumeReceipt, error) {
	if input == nil || !mobility.ValidMigrationID(migrationID) {
		return VolumeReceipt{}, fmt.Errorf("managed volume archive is invalid")
	}
	mount, err := v.prepareTargetMount(ctx, volume)
	if err != nil {
		return VolumeReceipt{}, err
	}
	empty, err := directoryEmpty(mount)
	if err != nil {
		return VolumeReceipt{}, err
	}
	if !empty {
		return VolumeReceipt{}, fmt.Errorf("managed target volume is not empty")
	}
	if err := os.MkdirAll(v.transferDir, 0o700); err != nil {
		return VolumeReceipt{}, fmt.Errorf("prepare mobility transfer: %w", err)
	}
	archivePath := filepath.Join(v.transferDir, migrationID+"-"+volume+".tar.gz")
	archive, err := os.OpenFile(archivePath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return VolumeReceipt{}, fmt.Errorf("stage managed volume archive: %w", err)
	}
	defer func() { _ = os.Remove(archivePath) }()
	digest := sha256.New()
	limited := &limitedWriter{limit: v.maxBytes, writer: io.MultiWriter(archive, digest)}
	_, copyErr := io.Copy(limited, &contextReader{ctx: ctx, reader: input})
	if syncErr := archive.Sync(); copyErr == nil {
		copyErr = syncErr
	}
	if closeErr := archive.Close(); copyErr == nil {
		copyErr = closeErr
	}
	if copyErr != nil {
		return VolumeReceipt{}, fmt.Errorf("stage managed volume archive: %w", copyErr)
	}
	parent := filepath.Dir(mount)
	stage := filepath.Join(parent, ".swarmops-migration-"+migrationID)
	if err := os.Mkdir(stage, 0o700); err != nil {
		return VolumeReceipt{}, fmt.Errorf("prepare managed volume restore: %w", err)
	}
	defer func() { _ = os.RemoveAll(stage) }()
	if err := extractArchive(ctx, archivePath, stage, v.maxBytes); err != nil {
		return VolumeReceipt{}, err
	}
	if err := swapVolumeDirectory(mount, stage, migrationID); err != nil {
		return VolumeReceipt{}, err
	}
	return VolumeReceipt{Bytes: limited.written, Digest: hex.EncodeToString(digest.Sum(nil))}, nil
}

// prepareTargetMount creates only the exact reviewed local volume on a target
// that has never hosted the service before. Swarm normally creates a named
// local volume when its first task starts, but the handover must populate it
// before that task is allowed to run. Existing non-empty targets remain a
// hard failure in Restore and are never overwritten.
func (v *systemVolumeTransfer) prepareTargetMount(ctx context.Context, volume string) (string, error) {
	if v == nil || v.docker == nil || !mobility.IsManagedVolume(volume) {
		return "", fmt.Errorf("managed volume transfer is unavailable")
	}
	mount, err := v.mountpoint(ctx, volume)
	if err == nil {
		return mount, nil
	}
	if _, createErr := v.docker.CreateVolume(ctx, volume); createErr != nil {
		return "", fmt.Errorf("create managed target volume: %w", createErr)
	}
	mount, err = v.mountpoint(ctx, volume)
	if err != nil {
		return "", err
	}
	return mount, nil
}

func (v *systemVolumeTransfer) Remove(ctx context.Context, volume string) error {
	if _, err := v.mountpoint(ctx, volume); err != nil {
		return err
	}
	if err := v.docker.RemoveVolume(ctx, volume); err != nil {
		return fmt.Errorf("remove managed volume: %w", err)
	}
	return nil
}

func (v *systemVolumeTransfer) mountpoint(ctx context.Context, volume string) (string, error) {
	if v == nil || v.docker == nil || !mobility.IsManagedVolume(volume) {
		return "", fmt.Errorf("managed volume transfer is unavailable")
	}
	details, err := v.docker.Volume(ctx, volume)
	if err != nil {
		return "", fmt.Errorf("inspect managed volume: %w", err)
	}
	if details.Name != volume || details.Driver != "local" || !filepath.IsAbs(details.Mountpoint) || filepath.Base(details.Mountpoint) != "_data" {
		return "", fmt.Errorf("managed volume is not a local volume")
	}
	info, err := os.Stat(details.Mountpoint)
	if err != nil || !info.IsDir() {
		return "", fmt.Errorf("managed volume mountpoint is unavailable")
	}
	return filepath.Clean(details.Mountpoint), nil
}

type archiveState struct {
	files        int
	uncompressed int64
	maxBytes     int64
}

type limitedWriter struct {
	limit   int64
	written int64
	writer  io.Writer
}

func (w *limitedWriter) Write(value []byte) (int, error) {
	if int64(len(value))+w.written > w.limit {
		remaining := w.limit - w.written
		if remaining > 0 {
			written, _ := w.writer.Write(value[:remaining])
			w.written += int64(written)
		}
		return 0, fmt.Errorf("managed volume archive exceeds transfer limit")
	}
	written, err := w.writer.Write(value)
	w.written += int64(written)
	return written, err
}

type contextReader struct {
	ctx    context.Context
	reader io.Reader
}

func (r *contextReader) Read(value []byte) (int, error) {
	if err := r.ctx.Err(); err != nil {
		return 0, err
	}
	return r.reader.Read(value)
}

func cleanArchivePath(value string) error {
	value = filepath.ToSlash(strings.TrimSpace(value))
	if value == "" || value == "." || strings.HasPrefix(value, "/") || strings.HasPrefix(value, "../") || strings.Contains(value, "/../") || value == ".." {
		return fmt.Errorf("invalid managed volume archive path")
	}
	return nil
}

func applyOwner(header *tar.Header, info os.FileInfo) {
	if stat, ok := info.Sys().(*syscall.Stat_t); ok {
		header.Uid = int(stat.Uid)
		header.Gid = int(stat.Gid)
	}
}

func directoryEmpty(path string) (bool, error) {
	entries, err := os.ReadDir(path)
	if err != nil {
		return false, err
	}
	return len(entries) == 0, nil
}

func extractArchive(ctx context.Context, archivePath, destination string, maxBytes int64) error {
	file, err := os.Open(archivePath)
	if err != nil {
		return fmt.Errorf("open managed volume archive: %w", err)
	}
	defer file.Close()
	gzipReader, err := gzip.NewReader(file)
	if err != nil {
		return fmt.Errorf("read managed volume archive: %w", err)
	}
	defer gzipReader.Close()
	tarReader := tar.NewReader(gzipReader)
	state := archiveState{maxBytes: maxBytes}
	for {
		if err := ctx.Err(); err != nil {
			return err
		}
		header, err := tarReader.Next()
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			return fmt.Errorf("read managed volume archive: %w", err)
		}
		state.files++
		if state.files > maxMobilityFiles || header.Size < 0 || header.Size > maxBytes {
			return fmt.Errorf("managed volume archive exceeds limits")
		}
		name := filepath.Clean(filepath.FromSlash(header.Name))
		if err := cleanArchivePath(name); err != nil {
			return err
		}
		target := filepath.Join(destination, name)
		relative, err := filepath.Rel(destination, target)
		if err != nil || relative == ".." || strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
			return fmt.Errorf("invalid managed volume archive path")
		}
		switch header.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(target, os.FileMode(header.Mode)&0o777); err != nil {
				return fmt.Errorf("restore managed volume directory: %w", err)
			}
			if err := os.Chown(target, header.Uid, header.Gid); err != nil && !errors.Is(err, os.ErrPermission) {
				return fmt.Errorf("restore managed volume ownership: %w", err)
			}
		case tar.TypeReg, tar.TypeRegA:
			state.uncompressed += header.Size
			if state.uncompressed > maxBytes {
				return fmt.Errorf("managed volume archive exceeds limits")
			}
			if err := os.MkdirAll(filepath.Dir(target), 0o700); err != nil {
				return fmt.Errorf("restore managed volume directory: %w", err)
			}
			output, err := os.OpenFile(target, os.O_WRONLY|os.O_CREATE|os.O_EXCL, os.FileMode(header.Mode)&0o777)
			if err != nil {
				return fmt.Errorf("restore managed volume file: %w", err)
			}
			_, copyErr := io.Copy(output, &contextReader{ctx: ctx, reader: tarReader})
			if closeErr := output.Close(); copyErr == nil {
				copyErr = closeErr
			}
			if copyErr != nil {
				return fmt.Errorf("restore managed volume file: %w", copyErr)
			}
			if err := os.Chown(target, header.Uid, header.Gid); err != nil && !errors.Is(err, os.ErrPermission) {
				return fmt.Errorf("restore managed volume ownership: %w", err)
			}
		default:
			return fmt.Errorf("managed volume archive contains an unsupported file type")
		}
	}
}

func swapVolumeDirectory(mount, stage, migrationID string) error {
	parent := filepath.Dir(mount)
	empty := filepath.Join(parent, ".swarmops-empty-"+migrationID)
	if err := os.Rename(mount, empty); err != nil {
		return fmt.Errorf("prepare managed volume handover: %w", err)
	}
	if err := os.Rename(stage, mount); err != nil {
		_ = os.Rename(empty, mount)
		return fmt.Errorf("activate managed volume handover: %w", err)
	}
	if err := os.RemoveAll(empty); err != nil {
		return fmt.Errorf("finalize managed volume handover: %w", err)
	}
	return nil
}

// DecodeVolumeReceipt is shared by the controller's machine-agent adapter.
// Keeping it here makes the accepted response shape a single contract.
func DecodeVolumeReceipt(reader io.Reader) (VolumeReceipt, error) {
	var receipt VolumeReceipt
	decoder := json.NewDecoder(io.LimitReader(reader, 4096))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&receipt); err != nil {
		return VolumeReceipt{}, err
	}
	if receipt.Bytes < 0 || len(receipt.Digest) != 64 {
		return VolumeReceipt{}, fmt.Errorf("invalid managed volume receipt")
	}
	if _, err := hex.DecodeString(receipt.Digest); err != nil {
		return VolumeReceipt{}, fmt.Errorf("invalid managed volume receipt")
	}
	return receipt, nil
}
