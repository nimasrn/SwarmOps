// Package coreself is what the controller knows about itself.
//
// The console could say a great deal about every machine and almost nothing
// about the process saying it. "Controller & recovery" opened on a ten-row
// handoff timeline whose every row read "Pending" — it never stated the
// version, never offered an update, and gave no sign that the machine it runs
// on exists. The updater that could answer all three shipped, worked, and had
// no route.
//
// Nothing here touches Docker, and nothing here is a cluster read. This is the
// process describing its own host, its own storage and its own releases.
package coreself

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strings"
	"syscall"
	"time"
)

// Release is one version installed on this host. The updater keeps three, so
// a bad release is a roll back rather than a reinstall.
type Release struct {
	InstalledAt time.Time `json:"installedAt"`
	Running     bool      `json:"running"`
	SizeBytes   int64     `json:"sizeBytes"`
	Version     string    `json:"version"`
}

// Update is what the local updater last did. It is read from the file the
// updater writes; the controller never runs the updater itself.
type Update struct {
	Automatic     bool      `json:"automatic"`
	Available     string    `json:"available,omitempty"`
	CheckedAt     time.Time `json:"checkedAt,omitempty"`
	Configured    bool      `json:"configured"`
	LastUpdatedAt time.Time `json:"lastUpdatedAt,omitempty"`
	State         string    `json:"state,omitempty"`
}

// Storage is the controller's own volume. A controller that fills its disk
// stops being able to write the command ledger, which is the one thing it
// cannot do without.
type Storage struct {
	FreeBytes  uint64 `json:"freeBytes"`
	Path       string `json:"path"`
	TotalBytes uint64 `json:"totalBytes"`
	UsedBytes  int64  `json:"usedBytes"`
}

// Status is everything the controller can say about itself without asking
// anything else.
type Status struct {
	Architecture  string    `json:"architecture"`
	Hostname      string    `json:"hostname"`
	InCluster     bool      `json:"inCluster"`
	OS            string    `json:"os"`
	Releases      []Release `json:"releases"`
	StartedAt     time.Time `json:"startedAt"`
	Storage       Storage   `json:"storage"`
	Update        Update    `json:"update"`
	UptimeSeconds int64     `json:"uptimeSeconds"`
	Version       string    `json:"version"`
}

// Config is what the installer told this process about itself. Every path is
// optional: a controller run from a source checkout has no release directory
// and no updater, and says so rather than inventing one.
type Config struct {
	ReleaseDir        string
	StateDir          string
	UpdateRequestFile string
	UpdateStatusFile  string
	Version           string
}

// Describe reads the local facts. It never fails as a whole — an unreadable
// release directory costs the release list, not the version.
func Describe(config Config, startedAt time.Time, now time.Time) Status {
	hostname, _ := os.Hostname()
	status := Status{
		Architecture:  runtime.GOARCH,
		Hostname:      hostname,
		OS:            runtime.GOOS,
		StartedAt:     startedAt.UTC(),
		UptimeSeconds: int64(now.Sub(startedAt).Seconds()),
		Version:       config.Version,
	}
	status.Storage = describeStorage(config.StateDir)
	// An empty list, never null. "No releases on disk" is a real state — a
	// controller run from a source checkout has none — and a caller reading
	// its length should not have to know the difference.
	status.Releases = describeReleases(config.ReleaseDir, config.Version)
	if status.Releases == nil {
		status.Releases = []Release{}
	}
	status.Update = describeUpdate(config)
	return status
}

func describeStorage(path string) Storage {
	path = strings.TrimSpace(path)
	if path == "" {
		return Storage{}
	}
	storage := Storage{Path: path, UsedBytes: directorySize(path)}
	var stat syscall.Statfs_t
	if err := syscall.Statfs(path, &stat); err == nil {
		blockSize := uint64(stat.Bsize)
		storage.TotalBytes = stat.Blocks * blockSize
		storage.FreeBytes = stat.Bavail * blockSize
	}
	return storage
}

// directorySize walks the controller's own state. It is bounded by entry count
// rather than by time: a state directory is thousands of files, not millions,
// and a walk that could run away would block a console read.
func directorySize(path string) int64 {
	const maxEntries = 200_000
	var total int64
	var seen int
	_ = filepath.WalkDir(path, func(_ string, entry os.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		seen++
		if seen > maxEntries {
			return filepath.SkipAll
		}
		if entry.IsDir() {
			return nil
		}
		if info, err := entry.Info(); err == nil {
			total += info.Size()
		}
		return nil
	})
	return total
}

// describeReleases lists what is on disk to roll back TO. A version the
// operator cannot return to is not a rollback plan.
func describeReleases(dir, running string) []Release {
	dir = strings.TrimSpace(dir)
	if dir == "" {
		return nil
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}
	releases := make([]Release, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		version := entry.Name()
		releases = append(releases, Release{
			InstalledAt: info.ModTime().UTC(),
			Running:     sameVersion(version, running),
			SizeBytes:   directorySize(filepath.Join(dir, version)),
			Version:     version,
		})
	}
	sort.Slice(releases, func(left, right int) bool {
		return releases[left].InstalledAt.After(releases[right].InstalledAt)
	})
	return releases
}

// A release directory is named `v0.11.0` or `0.11.0` depending on how the tag
// was cut, and the running version is the constant in the binary. Comparing
// them without the prefix is the difference between "you are running this" and
// a list where nothing is marked.
func sameVersion(left, right string) bool {
	return strings.TrimPrefix(left, "v") == strings.TrimPrefix(right, "v")
}

func describeUpdate(config Config) Update {
	update := Update{Configured: strings.TrimSpace(config.UpdateRequestFile) != ""}
	status := strings.TrimSpace(config.UpdateStatusFile)
	if status == "" {
		return update
	}
	// The updater owns this file; the controller only reads it. A missing or
	// unreadable file means the updater has not run yet, which is not an error.
	data, err := os.ReadFile(status)
	if err != nil {
		return update
	}
	if json.Valid(data) {
		return applyWardenStatus(update, data)
	}
	parsed := parseStatus(string(data))
	update.Automatic = parsed["automatic"] == "true"
	update.Available = parsed["available"]
	update.State = parsed["state"]
	if at, err := time.Parse(time.RFC3339, parsed["checkedAt"]); err == nil {
		update.CheckedAt = at.UTC()
	}
	if at, err := time.Parse(time.RFC3339, parsed["lastUpdatedAt"]); err == nil {
		update.LastUpdatedAt = at.UTC()
	}
	return update
}

// wardenStatus is what the local Warden writes after every run. It is the same
// file the machine agent's updater writes, which is the point: the console
// reads one shape for both, and "Core updates" stops being a different,
// weaker screen than "Agent updates".
type wardenStatus struct {
	Automatic     bool      `json:"automatic"`
	CheckedAt     time.Time `json:"checkedAt"`
	LastUpdatedAt time.Time `json:"lastUpdatedAt"`
	State         string    `json:"state"`
	Version       string    `json:"version"`
}

func applyWardenStatus(update Update, data []byte) Update {
	var status wardenStatus
	if err := json.Unmarshal(data, &status); err != nil {
		return update
	}
	update.Automatic = status.Automatic
	// Warden records the release it converged on. When that is not the version
	// this process is, an update is waiting for a restart or has been staged.
	update.Available = strings.TrimSpace(status.Version)
	update.CheckedAt = status.CheckedAt.UTC()
	update.LastUpdatedAt = status.LastUpdatedAt.UTC()
	update.State = status.State
	return update
}

func parseStatus(text string) map[string]string {
	values := map[string]string{}
	for _, line := range strings.Split(text, "\n") {
		key, value, found := strings.Cut(strings.TrimSpace(line), "=")
		if !found {
			continue
		}
		values[strings.TrimSpace(key)] = strings.Trim(strings.TrimSpace(value), `"`)
	}
	return values
}

// ErrVersion reports a requested release the updater would refuse to look up.
var ErrVersion = errors.New("release version has unsupported characters")

var versionPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]*$`)

// RequestUpdate asks the local updater to check for a release, or to install
// one exact release when version is set — which is how the console rolls the
// controller back to something on disk. It writes a marker and nothing else:
// the controller never downloads, never verifies and never restarts itself,
// because a process cannot supervise its own replacement.
func RequestUpdate(config Config, version string) error {
	path := strings.TrimSpace(config.UpdateRequestFile)
	if path == "" {
		return os.ErrNotExist
	}
	version = strings.TrimSpace(version)
	if version != "" && !versionPattern.MatchString(version) {
		return ErrVersion
	}
	marker := "requestedAt=" + time.Now().UTC().Format(time.RFC3339) + "\n"
	if version != "" {
		marker += "version=" + version + "\n"
	}
	return os.WriteFile(path, []byte(marker), 0o600)
}
