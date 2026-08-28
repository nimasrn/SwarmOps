package main

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/nimasrn/SwarmOps/internal/agentcontrol"
	"github.com/nimasrn/SwarmOps/internal/logstore"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	store, err := logstore.New(env("SWARMOPS_LOG_ROOT", "/var/lib/swarmops-logs"), 7*24*time.Hour, envInt64("SWARMOPS_LOG_CAPACITY_BYTES", logstore.DefaultCapacity))
	if err != nil {
		logger.Error("open log store", "error", err)
		os.Exit(1)
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go func() {
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for {
			select {
			case now := <-ticker.C:
				if err := store.Cleanup(now); err != nil {
					logger.Error("clean log store", "error", err)
				}
			case <-ctx.Done():
				return
			}
		}
	}()
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) { writeJSON(w, http.StatusOK, map[string]bool{"ok": true}) })
	mux.HandleFunc("GET /v1/status", func(w http.ResponseWriter, _ *http.Request) { writeJSON(w, http.StatusOK, store.Status()) })
	mux.HandleFunc("POST /v1/query", func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, 16*1024)
		var q agentcontrol.LogQuery
		if json.NewDecoder(r.Body).Decode(&q) != nil {
			writeJSON(w, 400, map[string]string{"error": "invalid log query"})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 4*time.Second)
		defer cancel()
		page, err := store.Query(ctx, q)
		if err != nil {
			status := 400
			if errors.Is(err, context.DeadlineExceeded) {
				status = 504
			}
			writeJSON(w, status, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, 200, page)
	})
	server := &http.Server{Addr: ":8085", Handler: mux, ReadHeaderTimeout: 3 * time.Second, ReadTimeout: 5 * time.Second, WriteTimeout: 6 * time.Second, IdleTimeout: 20 * time.Second}
	go func() {
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("serve log query", "error", err)
			stop()
		}
	}()
	<-ctx.Done()
	shutdown, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = server.Shutdown(shutdown)
}
func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
func env(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}
func envInt64(k string, d int64) int64 {
	v, e := strconv.ParseInt(os.Getenv(k), 10, 64)
	if e == nil && v > 0 {
		return v
	}
	return d
}
