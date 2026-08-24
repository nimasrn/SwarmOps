// Package securestore provides authenticated encryption for SwarmOps durable
// controller state. It intentionally accepts a caller-supplied key so key
// custody remains outside the data directory and can be managed by the host.
package securestore

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

const (
	formatHeader       = "swarmops-sealed-v1\x00"
	streamFormatHeader = "swarmops-sealed-stream-v1\x00"
	keySize            = 32
	streamChunkSize    = 64 << 10
)

var ErrInvalidCiphertext = errors.New("encrypted state is invalid or the data key does not match")

// Sealer encrypts one independently authenticated state file at a time. The
// caller supplies a distinct purpose for each file so ciphertext cannot be
// swapped between otherwise valid state records.
type Sealer struct {
	aead cipher.AEAD
}

func New(key []byte) (*Sealer, error) {
	if len(key) != keySize {
		return nil, fmt.Errorf("data encryption key must contain exactly %d bytes", keySize)
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("create AES cipher: %w", err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("create AES-GCM cipher: %w", err)
	}
	return &Sealer{aead: aead}, nil
}

func (s *Sealer) Seal(purpose string, plaintext []byte) ([]byte, error) {
	if s == nil || s.aead == nil {
		return nil, errors.New("encrypted state store is not configured")
	}
	if purpose == "" {
		return nil, errors.New("encrypted state purpose is required")
	}
	nonce := make([]byte, s.aead.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, fmt.Errorf("generate encryption nonce: %w", err)
	}
	sealed := s.aead.Seal(nil, nonce, plaintext, []byte(purpose))
	result := make([]byte, 0, len(formatHeader)+len(nonce)+len(sealed))
	result = append(result, formatHeader...)
	result = append(result, nonce...)
	result = append(result, sealed...)
	return result, nil
}

func (s *Sealer) Open(purpose string, ciphertext []byte) ([]byte, error) {
	if s == nil || s.aead == nil {
		return nil, errors.New("encrypted state store is not configured")
	}
	if purpose == "" {
		return nil, errors.New("encrypted state purpose is required")
	}
	headerSize := len(formatHeader)
	nonceSize := s.aead.NonceSize()
	if len(ciphertext) < headerSize+nonceSize+s.aead.Overhead() || string(ciphertext[:headerSize]) != formatHeader {
		return nil, ErrInvalidCiphertext
	}
	plaintext, err := s.aead.Open(nil, ciphertext[headerSize:headerSize+nonceSize], ciphertext[headerSize+nonceSize:], []byte(purpose))
	if err != nil {
		return nil, ErrInvalidCiphertext
	}
	return plaintext, nil
}

// ReadFile opens one sealed state file. A missing file remains distinguishable
// through errors.Is(err, os.ErrNotExist) so a caller can safely initialise
// empty state.
func (s *Sealer) ReadFile(path, purpose string) ([]byte, error) {
	ciphertext, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	plaintext, err := s.Open(purpose, ciphertext)
	if err != nil {
		return nil, fmt.Errorf("open encrypted state: %w", err)
	}
	return plaintext, nil
}

// WriteFile seals data and atomically replaces the target with mode 0600. The
// file and parent directory are synced so a reported mutation is durable
// across a normal process crash.
func (s *Sealer) WriteFile(path, purpose string, plaintext []byte) (err error) {
	if path == "" {
		return errors.New("encrypted state path is required")
	}
	ciphertext, err := s.Seal(purpose, plaintext)
	if err != nil {
		return err
	}
	directory := filepath.Dir(path)
	if err := os.MkdirAll(directory, 0o700); err != nil {
		return fmt.Errorf("create encrypted state directory: %w", err)
	}
	temporary, err := os.CreateTemp(directory, "."+filepath.Base(path)+".tmp-*")
	if err != nil {
		return fmt.Errorf("create encrypted state file: %w", err)
	}
	temporaryPath := temporary.Name()
	defer func() {
		if err != nil {
			_ = temporary.Close()
			_ = os.Remove(temporaryPath)
		}
	}()
	if err = temporary.Chmod(0o600); err != nil {
		return fmt.Errorf("protect encrypted state file: %w", err)
	}
	if _, err = temporary.Write(ciphertext); err != nil {
		return fmt.Errorf("write encrypted state: %w", err)
	}
	if err = temporary.Sync(); err != nil {
		return fmt.Errorf("sync encrypted state: %w", err)
	}
	if err = temporary.Close(); err != nil {
		return fmt.Errorf("close encrypted state: %w", err)
	}
	if err = os.Rename(temporaryPath, path); err != nil {
		return fmt.Errorf("replace encrypted state: %w", err)
	}
	if err = syncDirectory(directory); err != nil {
		return fmt.Errorf("sync encrypted state directory: %w", err)
	}
	return nil
}

// WriteReaderFile seals a bounded stream to an atomically replaced file. It
// uses independently authenticated chunks so large build inputs never need to
// be materialised in controller memory or written to disk in plaintext.
func (s *Sealer) WriteReaderFile(path, purpose string, source io.Reader, maxBytes int64) (written int64, err error) {
	if s == nil || s.aead == nil {
		return 0, errors.New("encrypted state store is not configured")
	}
	if path == "" {
		return 0, errors.New("encrypted state path is required")
	}
	if purpose == "" {
		return 0, errors.New("encrypted state purpose is required")
	}
	if source == nil {
		return 0, errors.New("encrypted state source is required")
	}
	if maxBytes < 0 {
		return 0, errors.New("encrypted state size limit is invalid")
	}
	directory := filepath.Dir(path)
	if err := os.MkdirAll(directory, 0o700); err != nil {
		return 0, fmt.Errorf("create encrypted state directory: %w", err)
	}
	temporary, err := os.CreateTemp(directory, "."+filepath.Base(path)+".tmp-*")
	if err != nil {
		return 0, fmt.Errorf("create encrypted state file: %w", err)
	}
	temporaryPath := temporary.Name()
	defer func() {
		if err != nil {
			_ = temporary.Close()
			_ = os.Remove(temporaryPath)
		}
	}()
	if err = temporary.Chmod(0o600); err != nil {
		return 0, fmt.Errorf("protect encrypted state file: %w", err)
	}
	if _, err = io.WriteString(temporary, streamFormatHeader); err != nil {
		return 0, fmt.Errorf("write encrypted state header: %w", err)
	}

	buffer := make([]byte, streamChunkSize)
	var index uint64
	for {
		count, readErr := source.Read(buffer)
		if count > 0 {
			if written > maxBytes-int64(count) {
				return 0, fmt.Errorf("encrypted state source exceeds the %d byte limit", maxBytes)
			}
			if err = s.writeStreamFrame(temporary, purpose, index, false, buffer[:count]); err != nil {
				return 0, err
			}
			written += int64(count)
			index++
		}
		if errors.Is(readErr, io.EOF) {
			break
		}
		if readErr != nil {
			return 0, fmt.Errorf("read encrypted state source: %w", readErr)
		}
		if count == 0 {
			return 0, errors.New("encrypted state source made no progress")
		}
	}
	if err = s.writeStreamFrame(temporary, purpose, index, true, nil); err != nil {
		return 0, err
	}
	if err = temporary.Sync(); err != nil {
		return 0, fmt.Errorf("sync encrypted state: %w", err)
	}
	if err = temporary.Close(); err != nil {
		return 0, fmt.Errorf("close encrypted state: %w", err)
	}
	if err = os.Rename(temporaryPath, path); err != nil {
		return 0, fmt.Errorf("replace encrypted state: %w", err)
	}
	if err = syncDirectory(directory); err != nil {
		return 0, fmt.Errorf("sync encrypted state directory: %w", err)
	}
	return written, nil
}

// OpenReaderFile returns a streaming plaintext reader for one sealed stream.
// A caller must read to EOF to validate the authenticated terminal frame.
func (s *Sealer) OpenReaderFile(path, purpose string) (io.ReadCloser, error) {
	if s == nil || s.aead == nil {
		return nil, errors.New("encrypted state store is not configured")
	}
	if purpose == "" {
		return nil, errors.New("encrypted state purpose is required")
	}
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	info, err := file.Stat()
	if err != nil {
		_ = file.Close()
		return nil, err
	}
	if !info.Mode().IsRegular() {
		_ = file.Close()
		return nil, ErrInvalidCiphertext
	}
	header := make([]byte, len(streamFormatHeader))
	if _, err := io.ReadFull(file, header); err != nil || string(header) != streamFormatHeader {
		_ = file.Close()
		return nil, ErrInvalidCiphertext
	}
	return &sealedStreamReader{file: file, purpose: purpose, sealer: s}, nil
}

// VerifyReaderFile authenticates an entire sealed stream before a caller uses
// it for a side effect. It intentionally discards plaintext, so verification
// does not require a second plaintext file or a large memory allocation.
func (s *Sealer) VerifyReaderFile(path, purpose string) error {
	reader, err := s.OpenReaderFile(path, purpose)
	if err != nil {
		return err
	}
	_, readErr := io.Copy(io.Discard, reader)
	closeErr := reader.Close()
	if readErr != nil {
		return readErr
	}
	if closeErr != nil {
		return closeErr
	}
	return nil
}

func (s *Sealer) writeStreamFrame(destination io.Writer, purpose string, index uint64, final bool, plaintext []byte) error {
	nonce := make([]byte, s.aead.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return fmt.Errorf("generate encryption nonce: %w", err)
	}
	sealed := s.aead.Seal(nil, nonce, plaintext, streamAssociatedData(purpose, index, final))
	frame := append(nonce, sealed...)
	if uint64(len(frame)) > uint64(^uint32(0)) {
		return errors.New("encrypted state frame is too large")
	}
	var prefix [5]byte
	if final {
		prefix[0] = 1
	}
	binary.BigEndian.PutUint32(prefix[1:], uint32(len(frame)))
	if _, err := destination.Write(prefix[:]); err != nil {
		return fmt.Errorf("write encrypted state frame: %w", err)
	}
	if _, err := destination.Write(frame); err != nil {
		return fmt.Errorf("write encrypted state frame: %w", err)
	}
	return nil
}

func streamAssociatedData(purpose string, index uint64, final bool) []byte {
	data := make([]byte, len(purpose)+10)
	copy(data, purpose)
	data[len(purpose)] = 0
	binary.BigEndian.PutUint64(data[len(purpose)+1:], index)
	if final {
		data[len(data)-1] = 1
	}
	return data
}

type sealedStreamReader struct {
	buffer  []byte
	done    bool
	file    *os.File
	index   uint64
	purpose string
	sealer  *Sealer
}

func (r *sealedStreamReader) Read(destination []byte) (int, error) {
	if len(destination) == 0 {
		return 0, nil
	}
	if r.file == nil {
		return 0, errors.New("encrypted state reader is closed")
	}
	for len(r.buffer) == 0 && !r.done {
		if err := r.readFrame(); err != nil {
			return 0, err
		}
	}
	if len(r.buffer) == 0 {
		return 0, io.EOF
	}
	count := copy(destination, r.buffer)
	zero(r.buffer[:count])
	r.buffer = r.buffer[count:]
	return count, nil
}

func (r *sealedStreamReader) Close() error {
	zero(r.buffer)
	r.buffer = nil
	if r.file == nil {
		return nil
	}
	err := r.file.Close()
	r.file = nil
	return err
}

func (r *sealedStreamReader) readFrame() error {
	var prefix [5]byte
	if _, err := io.ReadFull(r.file, prefix[:]); err != nil {
		if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
			return ErrInvalidCiphertext
		}
		return fmt.Errorf("read encrypted state frame: %w", err)
	}
	final := prefix[0] == 1
	if prefix[0] != 0 && !final {
		return ErrInvalidCiphertext
	}
	frameLength := int(binary.BigEndian.Uint32(prefix[1:]))
	minimumLength := r.sealer.aead.NonceSize() + r.sealer.aead.Overhead()
	maximumLength := minimumLength + streamChunkSize
	if frameLength < minimumLength || frameLength > maximumLength {
		return ErrInvalidCiphertext
	}
	frame := make([]byte, frameLength)
	if _, err := io.ReadFull(r.file, frame); err != nil {
		if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
			return ErrInvalidCiphertext
		}
		return fmt.Errorf("read encrypted state frame: %w", err)
	}
	nonceSize := r.sealer.aead.NonceSize()
	plaintext, err := r.sealer.aead.Open(nil, frame[:nonceSize], frame[nonceSize:], streamAssociatedData(r.purpose, r.index, final))
	if err != nil {
		return ErrInvalidCiphertext
	}
	r.index++
	if final {
		if len(plaintext) != 0 {
			zero(plaintext)
			return ErrInvalidCiphertext
		}
		var trailing [1]byte
		count, err := r.file.Read(trailing[:])
		if count != 0 || !errors.Is(err, io.EOF) {
			return ErrInvalidCiphertext
		}
		r.done = true
		return nil
	}
	if len(plaintext) == 0 {
		return ErrInvalidCiphertext
	}
	r.buffer = plaintext
	return nil
}

func zero(value []byte) {
	for index := range value {
		value[index] = 0
	}
}

// RemoveFile deletes a legacy plaintext state file only after a caller has
// successfully committed its sealed replacement.
func RemoveFile(path string) error {
	if err := os.Remove(path); err != nil {
		return err
	}
	return syncDirectory(filepath.Dir(path))
}

func syncDirectory(path string) error {
	directory, err := os.Open(path)
	if err != nil {
		return err
	}
	defer directory.Close()
	return directory.Sync()
}
