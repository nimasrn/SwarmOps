package nativectl

import (
	"bytes"
	"context"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"
	"io/fs"
	"net"
	"net/netip"
	"os"
	"path/filepath"
	"strings"
	"syscall"
)

// CoreAccessHooks keeps the service boundary explicit and makes the protected
// configuration transaction deterministic in tests.
type CoreAccessHooks struct {
	Restart func(context.Context) error
	Ready   func(context.Context, string) error
}

// SetCoreAllowedCIDRs replaces the operator-facing Core access policy while
// preserving the controller certificate IP and loopback access. The previous
// file is restored and Core is restarted again if restart or readiness fails.
func SetCoreAllowedCIDRs(ctx context.Context, environmentFile string, requested []string, hooks CoreAccessHooks) ([]string, error) {
	if hooks.Restart == nil || hooks.Ready == nil {
		return nil, errors.New("Core restart and readiness hooks are required")
	}
	operatorCIDRs, err := normalizeOperatorCIDRs(requested)
	if err != nil {
		return nil, err
	}
	previous, info, err := readRegularConfiguration(environmentFile)
	if err != nil {
		return nil, err
	}
	configuration, err := parseCoreEnvironment(previous)
	if err != nil {
		return nil, err
	}
	policy := ""
	if len(operatorCIDRs) > 0 {
		localCIDRs, err := certificateLocalCIDRs(configuration.certificateFile)
		if err != nil {
			return nil, err
		}
		policy = strings.Join(appendUnique(append([]string{}, operatorCIDRs...), localCIDRs...), ",")
	}
	updated := replaceEnvironmentValue(previous, "SWARMOPS_ALLOWED_CLIENT_CIDRS", policy)
	healthURL, err := localCoreReadyURL(configuration.listenAddress)
	if err != nil {
		return nil, err
	}
	if bytes.Equal(previous, updated) {
		if err := hooks.Ready(ctx, healthURL); err != nil {
			return nil, fmt.Errorf("verify Core readiness with the unchanged access policy: %w", err)
		}
		return operatorCIDRs, nil
	}
	if err := writeConfigurationAtomically(environmentFile, updated, info); err != nil {
		return nil, fmt.Errorf("update Core access policy: %w", err)
	}
	rollback := func(cause error) error {
		if restoreErr := writeConfigurationAtomically(environmentFile, previous, info); restoreErr != nil {
			return fmt.Errorf("%w; restore previous Core access policy: %v", cause, restoreErr)
		}
		if restartErr := hooks.Restart(ctx); restartErr != nil {
			return fmt.Errorf("%w; previous Core access policy was restored but Core did not restart: %v", cause, restartErr)
		}
		return fmt.Errorf("%w; restored previous Core access policy", cause)
	}
	if err := hooks.Restart(ctx); err != nil {
		return nil, rollback(fmt.Errorf("restart Core after updating access policy: %w", err))
	}
	if err := hooks.Ready(ctx, healthURL); err != nil {
		return nil, rollback(fmt.Errorf("verify Core readiness after updating access policy: %w", err))
	}
	return operatorCIDRs, nil
}

type coreEnvironment struct {
	listenAddress   string
	certificateFile string
}

func parseCoreEnvironment(data []byte) (coreEnvironment, error) {
	values := map[string]string{}
	counts := map[string]int{}
	for _, line := range strings.Split(string(data), "\n") {
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		switch key {
		case "SWARMOPS_ALLOWED_CLIENT_CIDRS", "SWARMOPS_LISTEN_ADDR", "SWARMOPS_TLS_CERT_FILE":
			counts[key]++
			values[key] = value
		}
	}
	if counts["SWARMOPS_ALLOWED_CLIENT_CIDRS"] != 1 {
		return coreEnvironment{}, errors.New("Core environment must contain exactly one SWARMOPS_ALLOWED_CLIENT_CIDRS entry")
	}
	for _, key := range []string{"SWARMOPS_LISTEN_ADDR", "SWARMOPS_TLS_CERT_FILE"} {
		if counts[key] != 1 || strings.TrimSpace(values[key]) == "" {
			return coreEnvironment{}, fmt.Errorf("Core environment must contain exactly one non-empty %s entry", key)
		}
	}
	certificateFile := filepath.Clean(values["SWARMOPS_TLS_CERT_FILE"])
	if !filepath.IsAbs(certificateFile) || certificateFile == string(filepath.Separator) {
		return coreEnvironment{}, errors.New("SWARMOPS_TLS_CERT_FILE must be an absolute, non-root path")
	}
	return coreEnvironment{
		listenAddress:   values["SWARMOPS_LISTEN_ADDR"],
		certificateFile: certificateFile,
	}, nil
}

// normalizeOperatorCIDRs returns an empty list when no CIDR is requested,
// which disables the operator allowlist and lets Core accept every client
// network. Operators without a static address rely on that default.
func normalizeOperatorCIDRs(requested []string) ([]string, error) {
	normalized := make([]string, 0, len(requested))
	for _, value := range requested {
		prefix, err := netip.ParsePrefix(strings.TrimSpace(value))
		if err != nil {
			return nil, fmt.Errorf("invalid operator CIDR %q: %w", value, err)
		}
		prefix = prefix.Masked()
		if prefix.Bits() == 0 {
			return nil, errors.New("operator CIDRs must not permit every address; list a specific trusted network, or run \"swarmops-core access disable\" to allow every client network")
		}
		if prefix.Addr().IsUnspecified() && prefix.Bits() != 0 {
			if prefix.Addr().Is4() {
				return nil, errors.New("0.0.0.0/32 permits only the unspecified address; use a specific trusted IPv4 network")
			}
			return nil, errors.New("::/128 permits only the unspecified address; use a specific trusted IPv6 network")
		}
		normalized = appendUnique(normalized, prefix.String())
	}
	return normalized, nil
}

func certificateLocalCIDRs(name string) ([]string, error) {
	data, _, err := readRegularConfiguration(name)
	if err != nil {
		return nil, fmt.Errorf("read Core TLS certificate: %w", err)
	}
	block, _ := pem.Decode(data)
	if block == nil || block.Type != "CERTIFICATE" {
		return nil, errors.New("Core TLS certificate does not contain a PEM certificate")
	}
	certificate, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("parse Core TLS certificate: %w", err)
	}
	if len(certificate.IPAddresses) == 0 {
		return nil, errors.New("Core TLS certificate has no IP identity")
	}
	var local []string
	for _, rawAddress := range certificate.IPAddresses {
		address, ok := netip.AddrFromSlice(rawAddress)
		if !ok {
			return nil, errors.New("Core TLS certificate contains an invalid IP identity")
		}
		address = address.Unmap()
		local = appendUnique(local, netip.PrefixFrom(address, address.BitLen()).String())
		if address.Is4() {
			local = appendUnique(local, "127.0.0.1/32")
		} else {
			local = appendUnique(local, "::1/128")
		}
	}
	return local, nil
}

func localCoreReadyURL(listenAddress string) (string, error) {
	host, port, err := net.SplitHostPort(listenAddress)
	if err != nil || port == "" {
		return "", errors.New("SWARMOPS_LISTEN_ADDR must contain a valid host and port")
	}
	if strings.Contains(host, ":") {
		return "https://[::1]:" + port + "/readyz", nil
	}
	return "https://127.0.0.1:" + port + "/readyz", nil
}

func readRegularConfiguration(name string) ([]byte, fs.FileInfo, error) {
	path := filepath.Clean(name)
	if !filepath.IsAbs(path) || path == string(filepath.Separator) {
		return nil, nil, errors.New("configuration path must be absolute and non-root")
	}
	info, err := os.Lstat(path)
	if err != nil {
		return nil, nil, fmt.Errorf("inspect configuration: %w", err)
	}
	if info.Mode()&os.ModeSymlink != 0 || !info.Mode().IsRegular() {
		return nil, nil, errors.New("configuration must be a regular file, not a symlink")
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, nil, fmt.Errorf("read configuration: %w", err)
	}
	return data, info, nil
}

func replaceEnvironmentValue(data []byte, key, value string) []byte {
	lines := strings.Split(string(data), "\n")
	for index, line := range lines {
		if strings.HasPrefix(line, key+"=") {
			lines[index] = key + "=" + value
		}
	}
	return []byte(strings.Join(lines, "\n"))
}

func writeConfigurationAtomically(name string, data []byte, info fs.FileInfo) error {
	directory := filepath.Dir(name)
	temporary, err := os.CreateTemp(directory, ".core-access-*.tmp")
	if err != nil {
		return err
	}
	temporaryName := temporary.Name()
	defer os.Remove(temporaryName)
	if err := temporary.Chmod(info.Mode().Perm()); err != nil {
		_ = temporary.Close()
		return err
	}
	if stat, ok := info.Sys().(*syscall.Stat_t); ok {
		if err := temporary.Chown(int(stat.Uid), int(stat.Gid)); err != nil {
			_ = temporary.Close()
			return err
		}
	}
	if _, err := temporary.Write(data); err != nil {
		_ = temporary.Close()
		return err
	}
	if err := temporary.Sync(); err != nil {
		_ = temporary.Close()
		return err
	}
	if err := temporary.Close(); err != nil {
		return err
	}
	if err := os.Rename(temporaryName, name); err != nil {
		return err
	}
	directoryHandle, err := os.Open(directory)
	if err != nil {
		return err
	}
	defer directoryHandle.Close()
	return directoryHandle.Sync()
}

func appendUnique(values []string, additions ...string) []string {
	for _, addition := range additions {
		found := false
		for _, existing := range values {
			if existing == addition {
				found = true
				break
			}
		}
		if !found {
			values = append(values, addition)
		}
	}
	return values
}
