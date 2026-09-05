package securestore

import (
	"bytes"
	"errors"
	"io"
	"os"
	"path/filepath"
	"testing"
)

func TestSealerRoundTripBindsCiphertextToPurpose(t *testing.T) {
	t.Parallel()
	key := bytes.Repeat([]byte{7}, keySize)
	sealer, err := New(key)
	if err != nil {
		t.Fatal(err)
	}
	ciphertext, err := sealer.Seal("server-profiles", []byte("operator target metadata"))
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(ciphertext, []byte("operator target metadata")) {
		t.Fatal("ciphertext contains plaintext")
	}
	plaintext, err := sealer.Open("server-profiles", ciphertext)
	if err != nil {
		t.Fatal(err)
	}
	if got, want := string(plaintext), "operator target metadata"; got != want {
		t.Fatalf("plaintext = %q, want %q", got, want)
	}
	if _, err := sealer.Open("audit-events", ciphertext); !errors.Is(err, ErrInvalidCiphertext) {
		t.Fatalf("wrong purpose error = %v, want ErrInvalidCiphertext", err)
	}
	ciphertext[len(ciphertext)-1] ^= 1
	if _, err := sealer.Open("server-profiles", ciphertext); !errors.Is(err, ErrInvalidCiphertext) {
		t.Fatalf("tampered ciphertext error = %v, want ErrInvalidCiphertext", err)
	}
}

func TestSealerWriteFileEncryptsAtomically(t *testing.T) {
	t.Parallel()
	sealer, err := New(bytes.Repeat([]byte{9}, keySize))
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(t.TempDir(), "nested", "state.sealed")
	if err := sealer.WriteFile(path, "audit-events", []byte("private audit event")); err != nil {
		t.Fatal(err)
	}
	ciphertext, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(ciphertext, []byte("private audit event")) {
		t.Fatal("saved state contains plaintext")
	}
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if got, want := info.Mode().Perm(), os.FileMode(0o600); got != want {
		t.Fatalf("file mode = %o, want %o", got, want)
	}
	plaintext, err := sealer.ReadFile(path, "audit-events")
	if err != nil {
		t.Fatal(err)
	}
	if got, want := string(plaintext), "private audit event"; got != want {
		t.Fatalf("state = %q, want %q", got, want)
	}
}

func TestSealerWriteReaderFileStreamsEncryptedContent(t *testing.T) {
	t.Parallel()
	sealer, err := New(bytes.Repeat([]byte{3}, keySize))
	if err != nil {
		t.Fatal(err)
	}
	payload := bytes.Repeat([]byte("private build context\n"), 8<<10)
	path := filepath.Join(t.TempDir(), "build.input.sealed")
	written, err := sealer.WriteReaderFile(path, "command-input:cmd-1", bytes.NewReader(payload), int64(len(payload)))
	if err != nil {
		t.Fatal(err)
	}
	if written != int64(len(payload)) {
		t.Fatalf("written = %d, want %d", written, len(payload))
	}
	ciphertext, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(ciphertext, []byte("private build context")) {
		t.Fatal("stream ciphertext contains plaintext")
	}
	reader, err := sealer.OpenReaderFile(path, "command-input:cmd-1")
	if err != nil {
		t.Fatal(err)
	}
	plaintext, err := io.ReadAll(reader)
	closeErr := reader.Close()
	if err != nil || closeErr != nil {
		t.Fatalf("read stream err=%v close=%v", err, closeErr)
	}
	if !bytes.Equal(plaintext, payload) {
		t.Fatal("stream plaintext did not round trip")
	}
	wrongPurpose, err := sealer.OpenReaderFile(path, "command-input:cmd-2")
	if err != nil {
		t.Fatal(err)
	}
	_, err = io.ReadAll(wrongPurpose)
	_ = wrongPurpose.Close()
	if !errors.Is(err, ErrInvalidCiphertext) {
		t.Fatalf("wrong stream purpose error = %v, want ErrInvalidCiphertext", err)
	}
	tamperedPath := filepath.Join(t.TempDir(), "tampered.input.sealed")
	tampered := append([]byte(nil), ciphertext...)
	tampered[len(tampered)-1] ^= 1
	if err := os.WriteFile(tamperedPath, tampered, 0o600); err != nil {
		t.Fatal(err)
	}
	tamperedReader, err := sealer.OpenReaderFile(tamperedPath, "command-input:cmd-1")
	if err != nil {
		t.Fatal(err)
	}
	_, err = io.ReadAll(tamperedReader)
	_ = tamperedReader.Close()
	if !errors.Is(err, ErrInvalidCiphertext) {
		t.Fatalf("tampered stream error = %v, want ErrInvalidCiphertext", err)
	}
}

// io.Reader may legally return (0, nil); callers must read again. Treating the
// first such read as a stalled source rejected valid input, which is what made
// every source deployment fail before its archive had been stored.
func TestSealStreamToleratesZeroByteReads(t *testing.T) {
	t.Parallel()
	sealer, err := New(bytes.Repeat([]byte{5}, keySize))
	if err != nil {
		t.Fatal(err)
	}
	payload := bytes.Repeat([]byte("swarmops"), 4096)
	source := &stutteringReader{data: payload}
	path := filepath.Join(t.TempDir(), "sealed")
	written, err := sealer.WriteReaderFile(path, "test", source, int64(len(payload))+1)
	if err != nil {
		t.Fatalf("seal stream with idle reads: %v", err)
	}
	if written != int64(len(payload)) {
		t.Fatalf("written = %d, want %d", written, len(payload))
	}
}

// stutteringReader returns (0, nil) before every real read.
type stutteringReader struct {
	data   []byte
	offset int
	stall  bool
}

func (r *stutteringReader) Read(p []byte) (int, error) {
	if r.offset >= len(r.data) {
		return 0, io.EOF
	}
	r.stall = !r.stall
	if r.stall {
		return 0, nil
	}
	count := copy(p, r.data[r.offset:])
	r.offset += count
	return count, nil
}
