package apihttp

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/nimasrn/SwarmOps/internal/agentcontrol"
	"github.com/nimasrn/SwarmOps/internal/auth"
)

func (s *Server) logs(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	query, err := parseLogQuery(request)
	if err != nil {
		writeError(response, http.StatusUnprocessableEntity, err.Error())
		return
	}
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	ctx, cancel := context.WithTimeout(request.Context(), 5*time.Second)
	defer cancel()
	page, err := target.Control.Logs(ctx, query)
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, page)
}

func (s *Server) logsStatus(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	target, ok := s.targetFor(response, request)
	if !ok {
		return
	}
	ctx, cancel := context.WithTimeout(request.Context(), 5*time.Second)
	defer cancel()
	status, err := target.Control.LogsStatus(ctx)
	if err != nil {
		s.operationError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, status)
}

func parseLogQuery(request *http.Request) (agentcontrol.LogQuery, error) {
	values := request.URL.Query()
	query := agentcontrol.LogQuery{Level: strings.ToLower(strings.TrimSpace(values.Get("level"))), SourceKind: strings.ToLower(strings.TrimSpace(values.Get("sourceKind"))), Node: strings.TrimSpace(values.Get("node")), Stack: strings.TrimSpace(values.Get("stack")), Service: strings.TrimSpace(values.Get("service")), Container: strings.TrimSpace(values.Get("container")), Unit: strings.TrimSpace(values.Get("unit")), Search: strings.TrimSpace(values.Get("search")), Cursor: strings.TrimSpace(values.Get("cursor"))}
	var err error
	if raw := values.Get("from"); raw != "" {
		query.From, err = time.Parse(time.RFC3339Nano, raw)
		if err != nil {
			return query, err
		}
	}
	if raw := values.Get("to"); raw != "" {
		query.To, err = time.Parse(time.RFC3339Nano, raw)
		if err != nil {
			return query, err
		}
	}
	if raw := values.Get("limit"); raw != "" {
		query.Limit, err = strconv.Atoi(raw)
		if err != nil {
			return query, err
		}
	}
	err = query.Normalize(time.Now().UTC())
	return query, err
}
