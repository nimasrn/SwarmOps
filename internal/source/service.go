package source

import (
	"context"
	"fmt"
	"io"
	"os"
	"strings"
)

// Service is the only source boundary used by the API. It owns both the
// sealed connection store and the provider network policy.
type Service struct {
	options Options
	store   *Store
}

func NewService(store *Store, options Options) (*Service, error) {
	if store == nil {
		return nil, fmt.Errorf("source connection store is required")
	}
	options = options.withDefaults()
	return &Service{options: options, store: store}, nil
}

func (s *Service) Connections() []Connection {
	if s == nil {
		return nil
	}
	return s.store.List()
}

func (s *Service) CreateConnection(ctx context.Context, input ConnectionInput) (Connection, error) {
	if s == nil {
		return Connection{}, fmt.Errorf("source service is unavailable")
	}
	normalized, err := normalizeConnectionInput(input, s.options)
	if err != nil {
		return Connection{}, err
	}
	adapter, err := newProvider(storedConnection{Connection: Connection{BaseURL: normalized.BaseURL, Kind: normalized.Kind}, Token: normalized.Token}, s.options)
	if err != nil {
		return Connection{}, err
	}
	account, err := adapter.Identity(ctx)
	if err != nil {
		return Connection{}, fmt.Errorf("verify provider credential: %w", err)
	}
	return s.store.Create(normalized, account)
}

func (s *Service) UpdateConnection(ctx context.Context, id string, input ConnectionInput) (Connection, error) {
	if s == nil {
		return Connection{}, fmt.Errorf("source service is unavailable")
	}
	normalized, err := normalizeConnectionInput(input, s.options)
	if err != nil {
		return Connection{}, err
	}
	adapter, err := newProvider(storedConnection{Connection: Connection{BaseURL: normalized.BaseURL, Kind: normalized.Kind}, Token: normalized.Token}, s.options)
	if err != nil {
		return Connection{}, err
	}
	account, err := adapter.Identity(ctx)
	if err != nil {
		return Connection{}, fmt.Errorf("verify provider credential: %w", err)
	}
	return s.store.Update(id, normalized, account)
}

func (s *Service) RemoveConnection(id string) error {
	if s == nil {
		return fmt.Errorf("source service is unavailable")
	}
	return s.store.Remove(id)
}

func (s *Service) Repositories(ctx context.Context, connectionID string) ([]Repository, error) {
	provider, err := s.provider(connectionID)
	if err != nil {
		return nil, err
	}
	return provider.ListRepositories(ctx)
}

func (s *Service) Discover(ctx context.Context, request DiscoverRequest) (Plan, error) {
	provider, err := s.provider(request.ConnectionID)
	if err != nil {
		return Plan{}, err
	}
	repository, err := provider.Repository(ctx, strings.TrimSpace(request.RepositoryID))
	if err != nil {
		return Plan{}, err
	}
	ref := strings.TrimSpace(request.Ref)
	if ref == "" {
		ref = repository.DefaultBranch
	}
	revision, err := provider.ResolveRevision(ctx, repository.ID, ref)
	if err != nil {
		return Plan{}, err
	}
	return scanRepository(ctx, provider, repository, revision, s.options)
}

// BuildContext re-discovers at the immutable revision and streams a sanitized
// regular-file-only tar for exactly one reviewed build context.
func (s *Service) VerifySelection(ctx context.Context, selection Selection) (Plan, ServicePlan, error) {
	selection.Revision = strings.TrimSpace(selection.Revision)
	if !validSHA(selection.Revision) {
		return Plan{}, ServicePlan{}, fmt.Errorf("source deployment requires an immutable commit identifier")
	}
	plan, err := s.Discover(ctx, DiscoverRequest{ConnectionID: selection.ConnectionID, Ref: selection.Revision, RepositoryID: selection.RepositoryID})
	if err != nil {
		return Plan{}, ServicePlan{}, err
	}
	if plan.ID != strings.TrimSpace(selection.PlanID) {
		return Plan{}, ServicePlan{}, fmt.Errorf("source plan changed; discover the repository again")
	}
	candidate, found := plan.Service(selection.ComposePath, selection.Service)
	if !found || candidate.Classification != ClassificationApplication {
		return Plan{}, ServicePlan{}, fmt.Errorf("selected source service is not a deployable application")
	}
	if hasBlocker(candidate.Findings) {
		return Plan{}, ServicePlan{}, fmt.Errorf("selected source service still has blocking findings")
	}
	return plan, candidate, nil
}

func (s *Service) BuildContext(ctx context.Context, selection Selection) (io.ReadCloser, ServicePlan, error) {
	_, candidate, contextReader, err := s.PrepareDeployment(ctx, selection)
	if err != nil {
		return nil, ServicePlan{}, err
	}
	if contextReader == nil {
		return nil, ServicePlan{}, fmt.Errorf("selected source service has no approved build plan")
	}
	return contextReader, candidate, nil
}

// PrepareDeployment verifies the plan at its immutable commit and, when a
// build is required, returns a sanitized streaming tar. Image-only services
// return a nil reader.
func (s *Service) PrepareDeployment(ctx context.Context, selection Selection) (Plan, ServicePlan, io.ReadCloser, error) {
	plan, candidate, err := s.VerifySelection(ctx, selection)
	if err != nil {
		return Plan{}, ServicePlan{}, nil, err
	}
	if candidate.Build == nil || !candidate.Build.Required {
		return plan, candidate, nil, nil
	}
	if !validSHA(selection.Revision) {
		return Plan{}, ServicePlan{}, nil, fmt.Errorf("source build requires an immutable commit identifier")
	}
	provider, err := s.provider(selection.ConnectionID)
	if err != nil {
		return Plan{}, ServicePlan{}, nil, err
	}
	archive, err := provider.OpenArchive(ctx, selection.RepositoryID, plan.Revision)
	if err != nil {
		return Plan{}, ServicePlan{}, nil, err
	}
	contextReader, err := normalizeBuildArchive(archive, candidate.Build.ContextPath, s.options.MaxArchiveBytes)
	if err != nil {
		_ = archive.Close()
		return Plan{}, ServicePlan{}, nil, err
	}
	return plan, candidate, contextReader, nil
}

func (s *Service) provider(connectionID string) (provider, error) {
	if s == nil || s.store == nil {
		return nil, fmt.Errorf("source service is unavailable")
	}
	record, found := s.store.get(connectionID)
	if !found {
		return nil, os.ErrNotExist
	}
	return newProvider(record, s.options)
}
