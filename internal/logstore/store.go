package logstore

import (
	"bufio"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/nimasrn/SwarmOps/internal/agentcontrol"
)

const (
	DefaultRetention = 7 * 24 * time.Hour
	DefaultCapacity  = int64(20 * 1024 * 1024 * 1024)
	MaxResponseBytes = 2 * 1024 * 1024
	maxLineBytes     = 64 * 1024
)

type Store struct {
	root      string
	retention time.Duration
	capacity  int64
	mu        sync.RWMutex
	status    agentcontrol.LogStatus
	malformed atomic.Uint64
}

func New(root string, retention time.Duration, capacity int64) (*Store, error) {
	root = filepath.Clean(root)
	if !filepath.IsAbs(root) {
		return nil, fmt.Errorf("log root must be absolute")
	}
	if retention <= 0 {
		retention = DefaultRetention
	}
	if capacity <= 0 {
		capacity = DefaultCapacity
	}
	if err := os.MkdirAll(filepath.Join(root, "records"), 0750); err != nil {
		return nil, err
	}
	return &Store{root: root, retention: retention, capacity: capacity, status: agentcontrol.LogStatus{Healthy: true, RetentionSeconds: int64(retention.Seconds()), CapacityBytes: capacity}}, nil
}

type cursor struct {
	Timestamp time.Time `json:"t"`
	ID        string    `json:"i"`
}

func (s *Store) Query(ctx context.Context, query agentcontrol.LogQuery) (agentcontrol.LogPage, error) {
	if err := query.Normalize(time.Now()); err != nil {
		return agentcontrol.LogPage{}, err
	}
	cur, err := decodeCursor(query.Cursor)
	if err != nil {
		return agentcontrol.LogPage{}, err
	}
	files, err := s.recordFiles()
	if err != nil {
		return agentcontrol.LogPage{}, err
	}
	page := agentcontrol.LogPage{Records: make([]agentcontrol.LogRecord, 0, query.Limit+1)}
	facets := newFacets()
	seen := map[string]struct{}{}
	for _, path := range files {
		if err := ctx.Err(); err != nil {
			return agentcontrol.LogPage{}, err
		}
		if err := s.scanFile(ctx, path, true, func(record agentcontrol.LogRecord) {
			if _, ok := seen[record.ID]; ok {
				return
			}
			seen[record.ID] = struct{}{}
			if !matches(record, query, cur) {
				return
			}
			facets.add(record)
			page.Records = append(page.Records, record)
		}); err != nil && !errors.Is(err, os.ErrNotExist) {
			return agentcontrol.LogPage{}, err
		}
	}
	sort.Slice(page.Records, func(i, j int) bool {
		if page.Records[i].Timestamp.Equal(page.Records[j].Timestamp) {
			return page.Records[i].ID > page.Records[j].ID
		}
		return page.Records[i].Timestamp.After(page.Records[j].Timestamp)
	})
	if len(page.Records) > query.Limit {
		page.Truncated = true
		page.Records = page.Records[:query.Limit]
	}
	page.Records = boundResponse(page.Records, &page.Truncated)
	if page.Truncated && len(page.Records) > 0 {
		last := page.Records[len(page.Records)-1]
		page.NextCursor = encodeCursor(cursor{Timestamp: last.Timestamp, ID: last.ID})
	}
	page.Facets = facets.result()
	return page, nil
}

func (s *Store) scanFile(ctx context.Context, path string, countMalformed bool, fn func(agentcontrol.LogRecord)) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()
	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 4096), maxLineBytes)
	for scanner.Scan() {
		if err := ctx.Err(); err != nil {
			return err
		}
		var record agentcontrol.LogRecord
		if err := json.Unmarshal(scanner.Bytes(), &record); err != nil || record.ID == "" || record.Timestamp.IsZero() || len(record.Message) > 32*1024 {
			if countMalformed {
				s.malformed.Add(1)
			}
			continue
		}
		fn(record)
	}
	if err := scanner.Err(); err != nil && !errors.Is(err, bufio.ErrTooLong) {
		return err
	}
	return nil
}

func (s *Store) recordFiles() ([]string, error) {
	paths, err := filepath.Glob(filepath.Join(s.root, "records", "log.*.jsonl"))
	if err != nil {
		return nil, err
	}
	live := filepath.Join(s.root, "records", "current.jsonl")
	if _, err := os.Stat(live); err == nil {
		paths = append(paths, live)
	}
	return paths, nil
}

func (s *Store) Cleanup(now time.Time) error {
	paths, err := filepath.Glob(filepath.Join(s.root, "records", "log.*.jsonl"))
	if err != nil {
		return err
	}
	type fileInfo struct {
		path string
		info os.FileInfo
	}
	files := make([]fileInfo, 0, len(paths))
	var total int64
	var evicted uint64
	cutoff := now.Add(-s.retention)
	for _, path := range paths {
		info, err := os.Stat(path)
		if err != nil {
			continue
		}
		if info.ModTime().Before(cutoff) {
			if os.Remove(path) == nil {
				continue
			}
		}
		files = append(files, fileInfo{path, info})
		total += info.Size()
	}
	sort.Slice(files, func(i, j int) bool { return files[i].info.ModTime().Before(files[j].info.ModTime()) })
	for _, file := range files {
		if total <= s.capacity {
			break
		}
		if os.Remove(file.path) == nil {
			total -= file.info.Size()
			evicted++
		}
	}
	s.mu.Lock()
	s.status.LastCleanupAt = now.UTC()
	s.status.CapacityEvictions += evicted
	s.mu.Unlock()
	return s.refreshStatus()
}

func (s *Store) Status() agentcontrol.LogStatus {
	_ = s.refreshStatus()
	s.mu.RLock()
	defer s.mu.RUnlock()
	status := s.status
	status.MalformedRecords = s.malformed.Load()
	status.Warnings = append([]string(nil), status.Warnings...)
	return status
}

func (s *Store) refreshStatus() error {
	paths, err := s.recordFiles()
	if err != nil {
		return err
	}
	var retained, buffers int64
	var oldest, newest time.Time
	recentNodes := map[string]struct{}{}
	recentCutoff := time.Now().Add(-2 * time.Minute)
	for _, path := range paths {
		info, err := os.Stat(path)
		if err != nil {
			continue
		}
		retained += info.Size()
		_ = s.scanFile(context.Background(), path, false, func(r agentcontrol.LogRecord) {
			if oldest.IsZero() || r.Timestamp.Before(oldest) {
				oldest = r.Timestamp
			}
			if newest.IsZero() || r.Timestamp.After(newest) {
				newest = r.Timestamp
			}
			if r.Node != "" && r.Timestamp.After(recentCutoff) {
				recentNodes[r.Node] = struct{}{}
			}
		})
	}
	_ = filepath.WalkDir(filepath.Join(s.root, "buffer"), func(path string, d os.DirEntry, err error) error {
		if err == nil && !d.IsDir() {
			if i, e := d.Info(); e == nil {
				buffers += i.Size()
			}
		}
		return nil
	})
	s.mu.Lock()
	defer s.mu.Unlock()
	s.status.RetainedBytes = retained
	s.status.BufferBytes = buffers
	s.status.Oldest = oldest
	s.status.Newest = newest
	s.status.Forwarders = len(recentNodes)
	s.status.Warnings = nil
	if s.status.CapacityEvictions > 0 {
		s.status.Warnings = append(s.status.Warnings, "Retention was shortened by the 20 GiB capacity limit.")
	}
	if buffers > 400*1024*1024 {
		s.status.Warnings = append(s.status.Warnings, "Fluentd disk buffers are nearing capacity.")
	}
	return nil
}

func matches(r agentcontrol.LogRecord, q agentcontrol.LogQuery, cur cursor) bool {
	if r.Timestamp.Before(q.From) || r.Timestamp.After(q.To) {
		return false
	}
	if !cur.Timestamp.IsZero() && (r.Timestamp.After(cur.Timestamp) || (r.Timestamp.Equal(cur.Timestamp) && r.ID >= cur.ID)) {
		return false
	}
	if q.Level != "" && r.Level != q.Level || q.SourceKind != "" && r.SourceKind != q.SourceKind || q.Node != "" && r.Node != q.Node || q.Stack != "" && r.Stack != q.Stack || q.Service != "" && r.Service != q.Service || q.Container != "" && r.ContainerID != q.Container || q.Unit != "" && r.Unit != q.Unit {
		return false
	}
	return q.Search == "" || strings.Contains(strings.ToLower(r.Message), strings.ToLower(q.Search))
}

func encodeCursor(c cursor) string {
	b, _ := json.Marshal(c)
	return base64.RawURLEncoding.EncodeToString(b)
}
func decodeCursor(raw string) (cursor, error) {
	if raw == "" {
		return cursor{}, nil
	}
	b, e := base64.RawURLEncoding.DecodeString(raw)
	if e != nil {
		return cursor{}, fmt.Errorf("cursor is invalid")
	}
	var c cursor
	if json.Unmarshal(b, &c) != nil || c.Timestamp.IsZero() || c.ID == "" {
		return cursor{}, fmt.Errorf("cursor is invalid")
	}
	return c, nil
}
func boundResponse(in []agentcontrol.LogRecord, truncated *bool) []agentcontrol.LogRecord {
	size := 0
	for i, r := range in {
		b, _ := json.Marshal(r)
		if size+len(b) > MaxResponseBytes {
			*truncated = true
			return in[:i]
		}
		size += len(b)
	}
	return in
}

type facetSets struct{ levels, kinds, nodes, stacks, services, units map[string]struct{} }

func newFacets() *facetSets {
	return &facetSets{map[string]struct{}{}, map[string]struct{}{}, map[string]struct{}{}, map[string]struct{}{}, map[string]struct{}{}, map[string]struct{}{}}
}
func (f *facetSets) add(r agentcontrol.LogRecord) {
	add := func(m map[string]struct{}, v string) {
		if v != "" && len(m) < 100 {
			m[v] = struct{}{}
		}
	}
	add(f.levels, r.Level)
	add(f.kinds, r.SourceKind)
	add(f.nodes, r.Node)
	add(f.stacks, r.Stack)
	add(f.services, r.Service)
	add(f.units, r.Unit)
}
func sorted(m map[string]struct{}) []string {
	r := make([]string, 0, len(m))
	for v := range m {
		r = append(r, v)
	}
	sort.Strings(r)
	return r
}
func (f *facetSets) result() agentcontrol.LogFacets {
	return agentcontrol.LogFacets{Levels: sorted(f.levels), SourceKinds: sorted(f.kinds), Nodes: sorted(f.nodes), Stacks: sorted(f.stacks), Services: sorted(f.services), Units: sorted(f.units)}
}
