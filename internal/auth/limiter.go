package auth

import (
	"strings"
	"sync"
	"time"
)

// LoginLimiter makes online password guessing expensive even when an edge
// middleware is unavailable. It is deliberately in-process: operators still
// configure a Traefik rate limit for a multi-replica or hostile-edge setup.
type LoginLimiter struct {
	entries    map[string]loginAttempts
	maxEntries int
	maxTries   int
	mu         sync.Mutex
	now        func() time.Time
	window     time.Duration
}

type loginAttempts struct {
	blockedUntil time.Time
	first        time.Time
	tries        int
}

func NewLoginLimiter(maxTries int, window time.Duration) *LoginLimiter {
	return &LoginLimiter{
		entries:    make(map[string]loginAttempts),
		maxEntries: 2048,
		maxTries:   maxTries,
		now:        time.Now,
		window:     window,
	}
}

func (l *LoginLimiter) Allow(key string) bool {
	key = limiterKey(key)
	if key == "" {
		return false
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	entry, found := l.entries[key]
	if !found {
		return true
	}
	now := l.now()
	if now.After(entry.blockedUntil) && now.Sub(entry.first) > l.window {
		delete(l.entries, key)
		return true
	}
	return !now.Before(entry.blockedUntil)
}

func (l *LoginLimiter) Failure(key string) {
	key = limiterKey(key)
	if key == "" {
		return
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	l.prune(now)
	entry := l.entries[key]
	if entry.first.IsZero() || now.Sub(entry.first) > l.window {
		entry = loginAttempts{first: now}
	}
	entry.tries++
	if entry.tries >= l.maxTries {
		entry.blockedUntil = now.Add(l.window)
	}
	l.entries[key] = entry
}

func (l *LoginLimiter) Success(key string) {
	key = limiterKey(key)
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.entries, key)
}

func (l *LoginLimiter) prune(now time.Time) {
	if len(l.entries) < l.maxEntries {
		return
	}
	for key, entry := range l.entries {
		if now.Sub(entry.first) > l.window && !now.Before(entry.blockedUntil) {
			delete(l.entries, key)
		}
	}
	// Do not retain attacker-controlled keys indefinitely if every existing
	// entry is still fresh. A new key can be dropped without affecting known
	// credentials or allocating an unbounded map.
	if len(l.entries) >= l.maxEntries {
		for key := range l.entries {
			delete(l.entries, key)
			break
		}
	}
}

func limiterKey(value string) string {
	value = strings.TrimSpace(value)
	if len(value) == 0 || len(value) > 256 {
		return ""
	}
	return value
}
