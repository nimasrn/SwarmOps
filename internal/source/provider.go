package source

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"sort"
	"strconv"
	"strings"
	"time"
)

const (
	defaultMaxArchiveBytes   = int64(1 << 30)
	defaultMaxFileBytes      = int64(2 << 20)
	defaultMaxResponseBytes  = int64(16 << 20)
	defaultMaxDiscoveryBytes = int64(32 << 20)
	defaultMaxPages          = 20
	defaultMaxDiscoveryFiles = 200
	defaultMaxRepositories   = 2000
	defaultMaxTreeEntries    = 20000
	defaultRequestTimeout    = 20 * time.Second
)

type Options struct {
	AllowedHosts      []string
	HTTPClient        *http.Client
	ImagePrefix       string
	MaxArchiveBytes   int64
	MaxDiscoveryBytes int64
	MaxDiscoveryFiles int
	MaxFileBytes      int64
	MaxResponseBytes  int64
	MaxPages          int
	MaxRepositories   int
	MaxTreeEntries    int
	RequestTimeout    time.Duration
	// AllowHTTP exists for isolated tests only. Production configuration never
	// sets it; provider credentials otherwise travel exclusively over HTTPS.
	AllowHTTP bool
}

func (o Options) withDefaults() Options {
	if o.HTTPClient == nil {
		o.HTTPClient = &http.Client{}
	}
	if o.MaxArchiveBytes <= 0 {
		o.MaxArchiveBytes = defaultMaxArchiveBytes
	}
	if o.MaxDiscoveryBytes <= 0 {
		o.MaxDiscoveryBytes = defaultMaxDiscoveryBytes
	}
	if o.MaxDiscoveryFiles <= 0 {
		o.MaxDiscoveryFiles = defaultMaxDiscoveryFiles
	}
	if o.MaxFileBytes <= 0 {
		o.MaxFileBytes = defaultMaxFileBytes
	}
	if o.MaxResponseBytes <= 0 {
		o.MaxResponseBytes = defaultMaxResponseBytes
	}
	if o.MaxPages <= 0 {
		o.MaxPages = defaultMaxPages
	}
	if o.MaxRepositories <= 0 {
		o.MaxRepositories = defaultMaxRepositories
	}
	if o.MaxTreeEntries <= 0 {
		o.MaxTreeEntries = defaultMaxTreeEntries
	}
	if o.RequestTimeout <= 0 {
		o.RequestTimeout = defaultRequestTimeout
	}
	o.ImagePrefix = strings.Trim(strings.TrimSpace(o.ImagePrefix), "/")
	return o
}

type provider interface {
	Identity(context.Context) (string, error)
	ListRepositories(context.Context) ([]Repository, error)
	Repository(context.Context, string) (Repository, error)
	ResolveRevision(context.Context, string, string) (Revision, error)
	ListTree(context.Context, string, Revision) ([]TreeEntry, error)
	ReadFile(context.Context, string, Revision, string) ([]byte, error)
	OpenArchive(context.Context, string, Revision) (io.ReadCloser, error)
}

func (p *providerClient) Identity(ctx context.Context) (string, error) {
	var response struct {
		Login    string `json:"login"`
		Username string `json:"username"`
	}
	if err := p.getJSON(ctx, "/user", nil, &response); err != nil {
		return "", err
	}
	account := strings.TrimSpace(response.Login)
	if p.kind == ProviderGitLab {
		account = strings.TrimSpace(response.Username)
	}
	if account == "" || len(account) > 256 || strings.ContainsAny(account, "\r\n\x00") {
		return "", fmt.Errorf("provider returned an invalid account identity")
	}
	return account, nil
}

func (p *providerClient) Repository(ctx context.Context, repositoryID string) (Repository, error) {
	if err := validateRepositoryID(repositoryID, p.kind); err != nil {
		return Repository{}, err
	}
	switch p.kind {
	case ProviderGitHub, ProviderGitea:
		var response struct {
			DefaultBranch string `json:"default_branch"`
			FullName      string `json:"full_name"`
			HTMLURL       string `json:"html_url"`
			Name          string `json:"name"`
			Private       bool   `json:"private"`
		}
		if err := p.getJSON(ctx, "/repos/"+escapedRepositoryPath(repositoryID), nil, &response); err != nil {
			return Repository{}, err
		}
		if validateRepositoryPath(response.FullName) != nil || !strings.EqualFold(response.FullName, repositoryID) {
			return Repository{}, fmt.Errorf("provider returned an invalid repository record")
		}
		return Repository{DefaultBranch: response.DefaultBranch, ID: response.FullName, Name: response.Name, Path: response.FullName, Private: response.Private, WebURL: response.HTMLURL}, nil
	case ProviderGitLab:
		var response struct {
			DefaultBranch     string `json:"default_branch"`
			ID                int64  `json:"id"`
			Name              string `json:"name"`
			PathWithNamespace string `json:"path_with_namespace"`
			Visibility        string `json:"visibility"`
			WebURL            string `json:"web_url"`
		}
		if err := p.getJSON(ctx, "/projects/"+url.PathEscape(repositoryID), nil, &response); err != nil {
			return Repository{}, err
		}
		if strconv.FormatInt(response.ID, 10) != repositoryID || validateRepositoryPath(response.PathWithNamespace) != nil {
			return Repository{}, fmt.Errorf("provider returned an invalid repository record")
		}
		return Repository{DefaultBranch: response.DefaultBranch, ID: repositoryID, Name: response.Name, Path: response.PathWithNamespace, Private: response.Visibility != "public", WebURL: response.WebURL}, nil
	default:
		return Repository{}, fmt.Errorf("unsupported source provider")
	}
}

type providerClient struct {
	base   *url.URL
	http   *http.Client
	kind   ProviderKind
	limits Options
	token  string
}

func newProvider(record storedConnection, options Options) (provider, error) {
	options = options.withDefaults()
	base, err := validateBaseURL(record.Kind, record.BaseURL, options)
	if err != nil {
		return nil, err
	}
	client := *options.HTTPClient
	if client.Timeout == 0 || client.Timeout > options.RequestTimeout {
		client.Timeout = options.RequestTimeout
	}
	previousRedirect := client.CheckRedirect
	baseHost := strings.ToLower(base.Host)
	client.CheckRedirect = func(request *http.Request, via []*http.Request) error {
		if len(via) >= 5 {
			return errors.New("provider redirect limit exceeded")
		}
		targetHost := strings.ToLower(request.URL.Host)
		allowed := targetHost == baseHost
		if record.Kind == ProviderGitHub && baseHost == "api.github.com" && targetHost == "codeload.github.com" {
			allowed = true
		}
		if !allowed {
			return fmt.Errorf("provider redirected to an unapproved host")
		}
		if targetHost != baseHost {
			request.Header.Del("Authorization")
			request.Header.Del("Private-Token")
		}
		if previousRedirect != nil {
			return previousRedirect(request, via)
		}
		return nil
	}
	return &providerClient{base: base, http: &client, kind: record.Kind, limits: options, token: record.Token}, nil
}

func validateBaseURL(kind ProviderKind, raw string, options Options) (*url.URL, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		switch kind {
		case ProviderGitHub:
			raw = "https://api.github.com"
		case ProviderGitLab:
			raw = "https://gitlab.com/api/v4"
		case ProviderGitea:
			raw = "https://gitea.com/api/v1"
		default:
			return nil, fmt.Errorf("unsupported source provider")
		}
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Host == "" {
		return nil, fmt.Errorf("provider base URL must be an absolute HTTPS URL")
	}
	if parsed.Scheme != "https" && !(options.AllowHTTP && parsed.Scheme == "http") {
		return nil, fmt.Errorf("provider base URL must use HTTPS")
	}
	if parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" || parsed.RawPath != "" {
		return nil, fmt.Errorf("provider base URL must not contain credentials, query, fragment, or escaped path data")
	}
	parsed.Path = strings.TrimSuffix(path.Clean("/"+strings.TrimPrefix(parsed.Path, "/")), "/")
	if parsed.Path == "." {
		parsed.Path = ""
	}
	host := strings.ToLower(parsed.Host)
	public := (kind == ProviderGitHub && host == "api.github.com") ||
		(kind == ProviderGitLab && host == "gitlab.com") ||
		(kind == ProviderGitea && host == "gitea.com")
	if !public && !containsFold(options.AllowedHosts, host) {
		return nil, fmt.Errorf("provider host is not in SWARMOPS_SOURCE_ALLOWED_HOSTS")
	}
	return parsed, nil
}

func normalizeConnectionInput(input ConnectionInput, options Options) (ConnectionInput, error) {
	input.Name = strings.TrimSpace(input.Name)
	input.Token = strings.TrimSpace(input.Token)
	if input.Name == "" || len(input.Name) > 96 || strings.ContainsAny(input.Name, "\r\n\x00") {
		return ConnectionInput{}, fmt.Errorf("connection name must be between 1 and 96 single-line characters")
	}
	switch input.Kind {
	case ProviderGitHub, ProviderGitLab, ProviderGitea:
	default:
		return ConnectionInput{}, fmt.Errorf("unsupported source provider")
	}
	if len(input.Token) < 8 || len(input.Token) > 4096 || strings.ContainsAny(input.Token, " \t\r\n\x00") {
		return ConnectionInput{}, fmt.Errorf("provider token must contain between 8 and 4096 non-whitespace characters")
	}
	parsed, err := validateBaseURL(input.Kind, input.BaseURL, options.withDefaults())
	if err != nil {
		return ConnectionInput{}, err
	}
	input.BaseURL = strings.TrimSuffix(parsed.String(), "/")
	return input, nil
}

func (p *providerClient) ListRepositories(ctx context.Context) ([]Repository, error) {
	switch p.kind {
	case ProviderGitHub:
		return p.listGitHubRepositories(ctx)
	case ProviderGitLab:
		return p.listGitLabRepositories(ctx)
	case ProviderGitea:
		return p.listGiteaRepositories(ctx)
	default:
		return nil, fmt.Errorf("unsupported source provider")
	}
}

func (p *providerClient) ResolveRevision(ctx context.Context, repositoryID, ref string) (Revision, error) {
	if err := validateRepositoryID(repositoryID, p.kind); err != nil {
		return Revision{}, err
	}
	if err := validateRef(ref); err != nil {
		return Revision{}, err
	}
	switch p.kind {
	case ProviderGitHub, ProviderGitea:
		var response struct {
			SHA    string `json:"sha"`
			Commit struct {
				Tree struct {
					SHA string `json:"sha"`
				} `json:"tree"`
			} `json:"commit"`
		}
		endpoint := "/repos/" + escapedRepositoryPath(repositoryID) + "/commits/" + url.PathEscape(ref)
		if err := p.getJSON(ctx, endpoint, nil, &response); err != nil {
			return Revision{}, err
		}
		if !validSHA(response.SHA) {
			return Revision{}, fmt.Errorf("provider returned an invalid commit identifier")
		}
		if response.Commit.Tree.SHA != "" && !validSHA(response.Commit.Tree.SHA) {
			return Revision{}, fmt.Errorf("provider returned an invalid tree identifier")
		}
		return Revision{SHA: strings.ToLower(response.SHA), TreeSHA: strings.ToLower(response.Commit.Tree.SHA)}, nil
	case ProviderGitLab:
		var response struct {
			ID string `json:"id"`
		}
		endpoint := "/projects/" + url.PathEscape(repositoryID) + "/repository/commits/" + url.PathEscape(ref)
		if err := p.getJSON(ctx, endpoint, nil, &response); err != nil {
			return Revision{}, err
		}
		if !validSHA(response.ID) {
			return Revision{}, fmt.Errorf("provider returned an invalid commit identifier")
		}
		return Revision{SHA: strings.ToLower(response.ID)}, nil
	default:
		return Revision{}, fmt.Errorf("unsupported source provider")
	}
}

func (p *providerClient) ListTree(ctx context.Context, repositoryID string, revision Revision) ([]TreeEntry, error) {
	if err := validateRepositoryID(repositoryID, p.kind); err != nil {
		return nil, err
	}
	if !validSHA(revision.SHA) {
		return nil, fmt.Errorf("invalid immutable revision")
	}
	switch p.kind {
	case ProviderGitHub:
		treeSHA := revision.TreeSHA
		if treeSHA == "" {
			treeSHA = revision.SHA
		}
		var response struct {
			Tree      []TreeEntry `json:"tree"`
			Truncated bool        `json:"truncated"`
		}
		endpoint := "/repos/" + escapedRepositoryPath(repositoryID) + "/git/trees/" + url.PathEscape(treeSHA)
		if err := p.getJSON(ctx, endpoint, url.Values{"recursive": {"1"}}, &response); err != nil {
			return nil, err
		}
		if response.Truncated {
			return nil, fmt.Errorf("repository tree exceeds the provider recursive-tree limit")
		}
		return p.validateTree(response.Tree)
	case ProviderGitLab:
		return p.listGitLabTree(ctx, repositoryID, revision)
	case ProviderGitea:
		var response struct {
			Tree      []TreeEntry `json:"tree"`
			Truncated bool        `json:"truncated"`
		}
		endpoint := "/repos/" + escapedRepositoryPath(repositoryID) + "/git/trees/" + url.PathEscape(revision.SHA)
		if err := p.getJSON(ctx, endpoint, url.Values{"recursive": {"true"}}, &response); err != nil {
			return nil, err
		}
		if response.Truncated {
			return nil, fmt.Errorf("repository tree exceeds the provider recursive-tree limit")
		}
		return p.validateTree(response.Tree)
	default:
		return nil, fmt.Errorf("unsupported source provider")
	}
}

func (p *providerClient) ReadFile(ctx context.Context, repositoryID string, revision Revision, filename string) ([]byte, error) {
	if err := validateRepositoryID(repositoryID, p.kind); err != nil {
		return nil, err
	}
	if !validSHA(revision.SHA) {
		return nil, fmt.Errorf("invalid immutable revision")
	}
	filename, err := cleanRepositoryPath(filename)
	if err != nil {
		return nil, err
	}
	switch p.kind {
	case ProviderGitHub, ProviderGitea:
		var response struct {
			Content  string `json:"content"`
			Encoding string `json:"encoding"`
			Size     int64  `json:"size"`
			Type     string `json:"type"`
		}
		endpoint := "/repos/" + escapedRepositoryPath(repositoryID) + "/contents/" + escapePath(filename)
		if err := p.getJSON(ctx, endpoint, url.Values{"ref": {revision.SHA}}, &response); err != nil {
			return nil, err
		}
		if response.Type != "file" || response.Encoding != "base64" || response.Size > p.limits.MaxFileBytes {
			return nil, fmt.Errorf("provider file is not a bounded regular file")
		}
		decoded, err := base64.StdEncoding.DecodeString(strings.ReplaceAll(response.Content, "\n", ""))
		if err != nil || int64(len(decoded)) > p.limits.MaxFileBytes {
			return nil, fmt.Errorf("provider returned invalid file content")
		}
		return decoded, nil
	case ProviderGitLab:
		endpoint := "/projects/" + url.PathEscape(repositoryID) + "/repository/files/" + url.PathEscape(filename) + "/raw"
		return p.getBytes(ctx, endpoint, url.Values{"ref": {revision.SHA}}, p.limits.MaxFileBytes)
	default:
		return nil, fmt.Errorf("unsupported source provider")
	}
}

func (p *providerClient) OpenArchive(ctx context.Context, repositoryID string, revision Revision) (io.ReadCloser, error) {
	if err := validateRepositoryID(repositoryID, p.kind); err != nil {
		return nil, err
	}
	if !validSHA(revision.SHA) {
		return nil, fmt.Errorf("invalid immutable revision")
	}
	var endpoint string
	var query url.Values
	switch p.kind {
	case ProviderGitHub:
		endpoint = "/repos/" + escapedRepositoryPath(repositoryID) + "/tarball/" + url.PathEscape(revision.SHA)
	case ProviderGitLab:
		endpoint = "/projects/" + url.PathEscape(repositoryID) + "/repository/archive.tar.gz"
		query = url.Values{"sha": {revision.SHA}}
	case ProviderGitea:
		endpoint = "/repos/" + escapedRepositoryPath(repositoryID) + "/archive/" + url.PathEscape(revision.SHA) + ".tar.gz"
	default:
		return nil, fmt.Errorf("unsupported source provider")
	}
	archiveClient := *p.http
	archiveClient.Timeout = 10 * time.Minute
	response, err := p.doWithClient(ctx, &archiveClient, endpoint, query)
	if err != nil {
		return nil, err
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		_ = response.Body.Close()
		return nil, fmt.Errorf("provider archive request failed with status %d", response.StatusCode)
	}
	if response.ContentLength > p.limits.MaxArchiveBytes {
		_ = response.Body.Close()
		return nil, fmt.Errorf("provider archive exceeds the configured size limit")
	}
	return &boundedReadCloser{reader: io.LimitReader(response.Body, p.limits.MaxArchiveBytes+1), source: response.Body, remaining: p.limits.MaxArchiveBytes}, nil
}

func (p *providerClient) listGitHubRepositories(ctx context.Context) ([]Repository, error) {
	type githubRepository struct {
		DefaultBranch string `json:"default_branch"`
		FullName      string `json:"full_name"`
		HTMLURL       string `json:"html_url"`
		Name          string `json:"name"`
		Private       bool   `json:"private"`
	}
	var result []Repository
	for pageNumber := 1; pageNumber <= p.limits.MaxPages; pageNumber++ {
		var pageItems []githubRepository
		query := url.Values{
			"affiliation": {"owner,collaborator,organization_member"},
			"page":        {strconv.Itoa(pageNumber)},
			"per_page":    {"100"},
			"sort":        {"full_name"},
			"visibility":  {"all"},
		}
		if err := p.getJSON(ctx, "/user/repos", query, &pageItems); err != nil {
			return nil, err
		}
		for _, item := range pageItems {
			if err := validateRepositoryPath(item.FullName); err != nil {
				return nil, fmt.Errorf("provider returned an invalid repository path")
			}
			result = append(result, Repository{DefaultBranch: item.DefaultBranch, ID: item.FullName, Name: item.Name, Path: item.FullName, Private: item.Private, WebURL: item.HTMLURL})
			if len(result) > p.limits.MaxRepositories {
				return nil, fmt.Errorf("provider returned more than %d repositories", p.limits.MaxRepositories)
			}
		}
		if len(pageItems) < 100 {
			break
		}
		if pageNumber == p.limits.MaxPages {
			return nil, fmt.Errorf("provider repository list exceeds the configured page limit")
		}
	}
	sortRepositories(result)
	return result, nil
}

func (p *providerClient) listGitLabRepositories(ctx context.Context) ([]Repository, error) {
	type gitlabRepository struct {
		DefaultBranch     string `json:"default_branch"`
		ID                int64  `json:"id"`
		Name              string `json:"name"`
		PathWithNamespace string `json:"path_with_namespace"`
		Visibility        string `json:"visibility"`
		WebURL            string `json:"web_url"`
	}
	var result []Repository
	for pageNumber := 1; pageNumber <= p.limits.MaxPages; pageNumber++ {
		var pageItems []gitlabRepository
		query := url.Values{"membership": {"true"}, "order_by": {"path"}, "page": {strconv.Itoa(pageNumber)}, "per_page": {"100"}, "simple": {"true"}, "sort": {"asc"}}
		if err := p.getJSON(ctx, "/projects", query, &pageItems); err != nil {
			return nil, err
		}
		for _, item := range pageItems {
			if item.ID <= 0 || validateRepositoryPath(item.PathWithNamespace) != nil {
				return nil, fmt.Errorf("provider returned an invalid repository record")
			}
			result = append(result, Repository{DefaultBranch: item.DefaultBranch, ID: strconv.FormatInt(item.ID, 10), Name: item.Name, Path: item.PathWithNamespace, Private: item.Visibility != "public", WebURL: item.WebURL})
			if len(result) > p.limits.MaxRepositories {
				return nil, fmt.Errorf("provider returned more than %d repositories", p.limits.MaxRepositories)
			}
		}
		if len(pageItems) < 100 {
			break
		}
		if pageNumber == p.limits.MaxPages {
			return nil, fmt.Errorf("provider repository list exceeds the configured page limit")
		}
	}
	sortRepositories(result)
	return result, nil
}

func (p *providerClient) listGiteaRepositories(ctx context.Context) ([]Repository, error) {
	type giteaRepository struct {
		DefaultBranch string `json:"default_branch"`
		FullName      string `json:"full_name"`
		HTMLURL       string `json:"html_url"`
		Name          string `json:"name"`
		Private       bool   `json:"private"`
	}
	var result []Repository
	for pageNumber := 1; pageNumber <= p.limits.MaxPages; pageNumber++ {
		var pageItems []giteaRepository
		query := url.Values{"limit": {"50"}, "page": {strconv.Itoa(pageNumber)}}
		if err := p.getJSON(ctx, "/user/repos", query, &pageItems); err != nil {
			return nil, err
		}
		for _, item := range pageItems {
			if validateRepositoryPath(item.FullName) != nil {
				return nil, fmt.Errorf("provider returned an invalid repository path")
			}
			result = append(result, Repository{DefaultBranch: item.DefaultBranch, ID: item.FullName, Name: item.Name, Path: item.FullName, Private: item.Private, WebURL: item.HTMLURL})
			if len(result) > p.limits.MaxRepositories {
				return nil, fmt.Errorf("provider returned more than %d repositories", p.limits.MaxRepositories)
			}
		}
		if len(pageItems) < 50 {
			break
		}
		if pageNumber == p.limits.MaxPages {
			return nil, fmt.Errorf("provider repository list exceeds the configured page limit")
		}
	}
	sortRepositories(result)
	return result, nil
}

func (p *providerClient) listGitLabTree(ctx context.Context, repositoryID string, revision Revision) ([]TreeEntry, error) {
	var result []TreeEntry
	for pageNumber := 1; pageNumber <= p.limits.MaxPages; pageNumber++ {
		var items []TreeEntry
		query := url.Values{"page": {strconv.Itoa(pageNumber)}, "per_page": {"100"}, "recursive": {"true"}, "ref": {revision.SHA}}
		endpoint := "/projects/" + url.PathEscape(repositoryID) + "/repository/tree"
		if err := p.getJSON(ctx, endpoint, query, &items); err != nil {
			return nil, err
		}
		result = append(result, items...)
		if len(result) > p.limits.MaxTreeEntries {
			return nil, fmt.Errorf("repository tree exceeds the %d entry limit", p.limits.MaxTreeEntries)
		}
		if len(items) < 100 {
			break
		}
		if pageNumber == p.limits.MaxPages {
			return nil, fmt.Errorf("repository tree exceeds the configured page limit")
		}
	}
	return p.validateTree(result)
}

func (p *providerClient) validateTree(entries []TreeEntry) ([]TreeEntry, error) {
	if len(entries) > p.limits.MaxTreeEntries {
		return nil, fmt.Errorf("repository tree exceeds the %d entry limit", p.limits.MaxTreeEntries)
	}
	for index := range entries {
		clean, err := cleanRepositoryPath(entries[index].Path)
		if err != nil {
			return nil, fmt.Errorf("provider returned an invalid repository path")
		}
		entries[index].Path = clean
		if entries[index].Size < 0 {
			return nil, fmt.Errorf("provider returned an invalid repository entry")
		}
	}
	sort.Slice(entries, func(left, right int) bool { return entries[left].Path < entries[right].Path })
	return entries, nil
}

func (p *providerClient) getJSON(ctx context.Context, endpoint string, query url.Values, target any) error {
	response, err := p.do(ctx, endpoint, query)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return fmt.Errorf("provider request failed with status %d", response.StatusCode)
	}
	decoder := json.NewDecoder(io.LimitReader(response.Body, p.limits.MaxResponseBytes+1))
	if err := decoder.Decode(target); err != nil {
		return fmt.Errorf("decode provider response: %w", err)
	}
	var extra json.RawMessage
	if err := decoder.Decode(&extra); !errors.Is(err, io.EOF) {
		return fmt.Errorf("provider returned trailing response data")
	}
	return nil
}

func (p *providerClient) getBytes(ctx context.Context, endpoint string, query url.Values, limit int64) ([]byte, error) {
	response, err := p.do(ctx, endpoint, query)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, fmt.Errorf("provider request failed with status %d", response.StatusCode)
	}
	if response.ContentLength > limit {
		return nil, fmt.Errorf("provider file exceeds the configured size limit")
	}
	data, err := io.ReadAll(io.LimitReader(response.Body, limit+1))
	if err != nil {
		return nil, fmt.Errorf("read provider response: %w", err)
	}
	if int64(len(data)) > limit {
		return nil, fmt.Errorf("provider file exceeds the configured size limit")
	}
	return data, nil
}

func (p *providerClient) do(ctx context.Context, endpoint string, query url.Values) (*http.Response, error) {
	return p.doWithClient(ctx, p.http, endpoint, query)
}

func (p *providerClient) doWithClient(ctx context.Context, client *http.Client, endpoint string, query url.Values) (*http.Response, error) {
	target, err := url.Parse(strings.TrimSuffix(p.base.String(), "/") + endpoint)
	if err != nil {
		return nil, fmt.Errorf("create provider URL: %w", err)
	}
	target.RawQuery = query.Encode()
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, target.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("create provider request: %w", err)
	}
	request.Header.Set("Accept", "application/json")
	switch p.kind {
	case ProviderGitHub:
		request.Header.Set("Authorization", "Bearer "+p.token)
		request.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	case ProviderGitLab:
		request.Header.Set("Private-Token", p.token)
	case ProviderGitea:
		request.Header.Set("Authorization", "token "+p.token)
	}
	response, err := client.Do(request)
	if err != nil {
		return nil, fmt.Errorf("provider request failed: %w", err)
	}
	return response, nil
}

type boundedReadCloser struct {
	reader    io.Reader
	remaining int64
	source    io.ReadCloser
}

func (r *boundedReadCloser) Read(buffer []byte) (int, error) {
	count, err := r.reader.Read(buffer)
	if int64(count) > r.remaining {
		r.remaining = 0
		return 0, fmt.Errorf("provider archive exceeds the configured size limit")
	}
	r.remaining -= int64(count)
	return count, err
}

func (r *boundedReadCloser) Close() error { return r.source.Close() }

func validateRepositoryID(value string, kind ProviderKind) error {
	value = strings.TrimSpace(value)
	if value == "" || len(value) > 512 || strings.ContainsAny(value, "\r\n\x00") {
		return fmt.Errorf("invalid repository identifier")
	}
	if kind == ProviderGitLab {
		parsed, err := strconv.ParseInt(value, 10, 64)
		if err != nil || parsed <= 0 {
			return fmt.Errorf("invalid repository identifier")
		}
		return nil
	}
	return validateRepositoryPath(value)
}

func validateRepositoryPath(value string) error {
	parts := strings.Split(strings.TrimSpace(value), "/")
	if len(parts) != 2 {
		return fmt.Errorf("repository path must contain owner and name")
	}
	for _, part := range parts {
		if part == "" || part == "." || part == ".." || len(part) > 200 || strings.ContainsAny(part, "\\?#\r\n\x00") {
			return fmt.Errorf("invalid repository path")
		}
	}
	return nil
}

func cleanRepositoryPath(value string) (string, error) {
	value = strings.TrimSpace(strings.TrimPrefix(value, "./"))
	if value == "" || strings.HasPrefix(value, "/") || strings.ContainsAny(value, "\\\r\n\x00") {
		return "", fmt.Errorf("invalid repository path")
	}
	clean := path.Clean(value)
	if clean == "." || clean == ".." || strings.HasPrefix(clean, "../") || clean != value {
		return "", fmt.Errorf("invalid repository path")
	}
	return clean, nil
}

func validateRef(value string) error {
	value = strings.TrimSpace(value)
	if value == "" || len(value) > 256 || strings.HasPrefix(value, "-") || strings.Contains(value, "..") || strings.ContainsAny(value, " ~^:?*[\\\r\n\x00") {
		return fmt.Errorf("invalid repository ref")
	}
	return nil
}

func validSHA(value string) bool {
	if len(value) < 40 || len(value) > 64 {
		return false
	}
	_, err := hexDecode(value)
	return err == nil
}

func hexDecode(value string) ([]byte, error) {
	if len(value)%2 != 0 {
		return nil, fmt.Errorf("odd hex length")
	}
	result := make([]byte, len(value)/2)
	for index := 0; index < len(result); index++ {
		high, ok := hexNibble(value[index*2])
		if !ok {
			return nil, fmt.Errorf("invalid hex")
		}
		low, ok := hexNibble(value[index*2+1])
		if !ok {
			return nil, fmt.Errorf("invalid hex")
		}
		result[index] = high<<4 | low
	}
	return result, nil
}

func hexNibble(value byte) (byte, bool) {
	switch {
	case value >= '0' && value <= '9':
		return value - '0', true
	case value >= 'a' && value <= 'f':
		return value - 'a' + 10, true
	case value >= 'A' && value <= 'F':
		return value - 'A' + 10, true
	default:
		return 0, false
	}
}

func escapedRepositoryPath(value string) string {
	parts := strings.Split(value, "/")
	for index := range parts {
		parts[index] = url.PathEscape(parts[index])
	}
	return strings.Join(parts, "/")
}

func escapePath(value string) string {
	parts := strings.Split(value, "/")
	for index := range parts {
		parts[index] = url.PathEscape(parts[index])
	}
	return strings.Join(parts, "/")
}

func containsFold(values []string, wanted string) bool {
	for _, value := range values {
		if strings.EqualFold(strings.TrimSpace(value), wanted) {
			return true
		}
	}
	return false
}

func sortRepositories(repositories []Repository) {
	sort.Slice(repositories, func(left, right int) bool {
		if repositories[left].Path != repositories[right].Path {
			return repositories[left].Path < repositories[right].Path
		}
		return repositories[left].ID < repositories[right].ID
	})
}
