package apihttp

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/nimasrn/SwarmOps/internal/audit"
	"github.com/nimasrn/SwarmOps/internal/cloud"
	"github.com/nimasrn/SwarmOps/internal/config"
	"github.com/nimasrn/SwarmOps/internal/domain"
	"github.com/nimasrn/SwarmOps/internal/ops"
	"github.com/nimasrn/SwarmOps/internal/remote"
	"github.com/nimasrn/SwarmOps/internal/sqlstore/sqltest"
	"golang.org/x/crypto/bcrypt"
)

type cloudTestServer struct {
	handler http.Handler
	server  *Server
	t       *testing.T
}

func newCloudTestServer(t *testing.T) cloudTestServer {
	t.Helper()
	db := sqltest.Shared(t)
	hash, err := bcrypt.GenerateFromPassword([]byte("test-password"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	key := sqltest.Key()
	dataDir := t.TempDir()
	if err := writeLegacyServersFile(dataDir, "manager-1"); err != nil {
		t.Fatal(err)
	}
	if _, _, err := remote.ImportServerFiles(context.Background(), db, dataDir, key); err != nil {
		t.Fatal(err)
	}
	auditStore, err := audit.Open(db, 1000)
	if err != nil {
		t.Fatal(err)
	}
	servers, err := remote.NewManager(db)
	if err != nil {
		t.Fatal(err)
	}
	applications, err := ops.NewApplicationStore(db)
	if err != nil {
		t.Fatal(err)
	}
	credentials, err := ops.NewCredentialStore(db)
	if err != nil {
		t.Fatal(err)
	}
	control := ops.NewControlPlane(nil, ops.DockerCLI{}, auditStore, ops.ControlPlaneOptions{Apps: applications, Credentials: credentials, DataDir: dataDir, Mutations: true})
	server, err := New(config.Config{
		AdminPasswordHash: hash,
		AdminUsername:     "operator",
		DataDir:           dataDir,
		DataEncryptionKey: key,
		MutationEnabled:   true,
		SessionKey:        []byte("01234567890123456789012345678901"),
		SessionTTL:        time.Hour,
	}, TargetResolverFunc(func(id string) (Target, error) { return Target{Control: control}, nil }), servers, auditStore, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}
	service, err := cloud.New(db, server.CommandStore(), server.CloudProvisioner(), cloud.Options{BcryptCost: bcrypt.MinCost})
	if err != nil {
		t.Fatal(err)
	}
	server.SetCloudService(service)
	return cloudTestServer{handler: server.Handler(), server: server, t: t}
}

type clientSession struct {
	cookie *http.Cookie
	csrf   string
}

func (c cloudTestServer) do(method, path string, body any, session clientSession, headers map[string]string) *httptest.ResponseRecorder {
	c.t.Helper()
	var reader io.Reader
	if body != nil {
		encoded, err := json.Marshal(body)
		if err != nil {
			c.t.Fatal(err)
		}
		reader = bytes.NewReader(encoded)
	}
	request := httptest.NewRequest(method, path, reader)
	request.Header.Set("Content-Type", "application/json")
	if session.cookie != nil {
		request.AddCookie(session.cookie)
	}
	if session.csrf != "" {
		request.Header.Set("X-CSRF-Token", session.csrf)
	}
	for name, value := range headers {
		request.Header.Set(name, value)
	}
	response := httptest.NewRecorder()
	c.handler.ServeHTTP(response, request)
	return response
}

func (c cloudTestServer) customer(email string) clientSession {
	c.t.Helper()
	registered := c.do(http.MethodPost, "/api/store/v1/auth/register", map[string]string{"email": email, "fullName": "Customer", "password": "correct-horse-battery"}, clientSession{}, nil)
	if registered.Code != http.StatusCreated {
		c.t.Fatalf("register = %d %s", registered.Code, registered.Body.String())
	}
	login := c.do(http.MethodPost, "/api/store/v1/auth/login", map[string]string{"email": email, "password": "correct-horse-battery"}, clientSession{}, nil)
	if login.Code != http.StatusOK {
		c.t.Fatalf("login = %d %s", login.Code, login.Body.String())
	}
	var payload struct {
		CSRFToken string `json:"csrfToken"`
	}
	if err := json.NewDecoder(login.Body).Decode(&payload); err != nil {
		c.t.Fatal(err)
	}
	for _, cookie := range login.Result().Cookies() {
		if cookie.Name == storeSessionCookie {
			if !cookie.HttpOnly || cookie.SameSite != http.SameSiteStrictMode {
				c.t.Fatalf("store session cookie is not HttpOnly and SameSite=Strict: %#v", cookie)
			}
			return clientSession{cookie: cookie, csrf: payload.CSRFToken}
		}
	}
	c.t.Fatal("login set no store session cookie")
	return clientSession{}
}

func (c cloudTestServer) operator() clientSession {
	c.t.Helper()
	login := c.do(http.MethodPost, "/api/v1/auth/login", map[string]string{"username": "operator", "password": "test-password"}, clientSession{}, nil)
	if login.Code != http.StatusOK {
		c.t.Fatalf("operator login = %d %s", login.Code, login.Body.String())
	}
	var payload struct {
		CSRFToken string `json:"csrfToken"`
	}
	if err := json.NewDecoder(login.Body).Decode(&payload); err != nil {
		c.t.Fatal(err)
	}
	return clientSession{cookie: login.Result().Cookies()[0], csrf: payload.CSRFToken}
}

// The whole storefront path through HTTP: a customer buys, an operator
// confirms, the controller's command ledger receives the deployment, and its
// outcome reaches the customer's project.
func TestTheStorefrontSellsAndTheConsoleProvisions(t *testing.T) {
	c := newCloudTestServer(t)
	if plans := c.do(http.MethodGet, "/api/store/v1/plans", nil, clientSession{}, nil); plans.Code != http.StatusOK || !strings.Contains(plans.Body.String(), `"code":"starter"`) {
		t.Fatalf("public catalogue = %d %s", plans.Code, plans.Body.String())
	}
	alice := c.customer("alice@example.com")
	forged := clientSession{cookie: alice.cookie}
	if response := c.do(http.MethodPost, "/api/store/v1/wallet/topups", map[string]int64{"amountRial": 500_000}, forged, map[string]string{"Idempotency-Key": "pay-1"}); response.Code != http.StatusForbidden {
		t.Fatalf("top-up without CSRF = %d", response.Code)
	}
	if response := c.do(http.MethodPost, "/api/store/v1/wallet/topups", map[string]int64{"amountRial": 500_000}, alice, map[string]string{"Idempotency-Key": "pay-1"}); response.Code != http.StatusOK {
		t.Fatalf("top-up = %d %s", response.Code, response.Body.String())
	}
	placed := c.do(http.MethodPost, "/api/store/v1/orders", cloud.OrderInput{AppName: "alice-shop", Image: "ghcr.io/alice/shop:1.0.0", PlanCode: "starter", Port: 8080}, alice, nil)
	if placed.Code != http.StatusCreated {
		t.Fatalf("place order = %d %s", placed.Code, placed.Body.String())
	}
	var order cloud.Order
	if err := json.NewDecoder(placed.Body).Decode(&order); err != nil {
		t.Fatal(err)
	}
	orderPath := "/api/store/v1/orders/" + itoa(order.ID)

	bob := c.customer("bob@example.com")
	if response := c.do(http.MethodGet, orderPath, nil, bob, nil); response.Code != http.StatusNotFound {
		t.Fatalf("another customer's order = %d", response.Code)
	}
	if response := c.do(http.MethodGet, "/api/v1/commerce/orders", nil, alice, nil); response.Code != http.StatusUnauthorized {
		t.Fatalf("a customer session on an operator route = %d", response.Code)
	}
	if response := c.do(http.MethodGet, "/api/store/v1/wallet", nil, clientSession{}, nil); response.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous wallet = %d", response.Code)
	}

	operator := c.operator()
	queue := c.do(http.MethodGet, "/api/v1/commerce/orders?status=pending", nil, operator, nil)
	if queue.Code != http.StatusOK || !strings.Contains(queue.Body.String(), "alice-shop") {
		t.Fatalf("pending queue = %d %s", queue.Code, queue.Body.String())
	}
	confirm := c.do(http.MethodPost, "/api/v1/commerce/orders/"+itoa(order.ID)+"/confirm", map[string]string{"serverId": "manager-1"}, operator, nil)
	if confirm.Code != http.StatusOK {
		t.Fatalf("confirm = %d %s", confirm.Code, confirm.Body.String())
	}
	var confirmed struct {
		Command domain.Command `json:"command"`
		Project cloud.Project  `json:"project"`
	}
	if err := json.NewDecoder(confirm.Body).Decode(&confirmed); err != nil {
		t.Fatal(err)
	}
	if confirmed.Command.Action != cloud.DeployAction || confirmed.Command.Target != "application/alice-shop" || confirmed.Project.Status != cloud.ProjectProvisioning {
		t.Fatalf("confirmation = %#v", confirmed)
	}
	if runs := c.do(http.MethodGet, "/api/v1/commands", nil, operator, nil); !strings.Contains(runs.Body.String(), confirmed.Command.ID) {
		t.Fatalf("the deployment is not in the console's run list: %s", runs.Body.String())
	}

	confirmed.Command.State = domain.CommandSucceeded
	c.server.RecordCommandTransition(confirmed.Command, "succeeded")
	projects := c.do(http.MethodGet, "/api/store/v1/projects", nil, alice, nil)
	if projects.Code != http.StatusOK || !strings.Contains(projects.Body.String(), `"status":"active"`) {
		t.Fatalf("customer projects after deployment = %d %s", projects.Code, projects.Body.String())
	}
	wallet := c.do(http.MethodGet, "/api/store/v1/wallet", nil, alice, nil)
	if !strings.Contains(wallet.Body.String(), `"balanceRial":496000`) {
		t.Fatalf("wallet after the first hour = %s", wallet.Body.String())
	}
	audit := c.do(http.MethodGet, "/api/v1/audit-events", nil, operator, nil)
	if !strings.Contains(audit.Body.String(), "commerce.order.confirmed") {
		t.Fatalf("the confirmation was not audited: %s", audit.Body.String())
	}
}

func TestConfirmationRefusesAnUnknownServer(t *testing.T) {
	c := newCloudTestServer(t)
	alice := c.customer("carol@example.com")
	c.do(http.MethodPost, "/api/store/v1/wallet/topups", map[string]int64{"amountRial": 500_000}, alice, map[string]string{"Idempotency-Key": "pay"})
	placed := c.do(http.MethodPost, "/api/store/v1/orders", cloud.OrderInput{AppName: "carol-api", Image: "ghcr.io/carol/api:2.0.0", PlanCode: "basic", Port: 8080}, alice, nil)
	var order cloud.Order
	if err := json.NewDecoder(placed.Body).Decode(&order); err != nil {
		t.Fatal(err)
	}
	response := c.do(http.MethodPost, "/api/v1/commerce/orders/"+itoa(order.ID)+"/confirm", map[string]string{"serverId": "nowhere"}, c.operator(), nil)
	if response.Code != http.StatusUnprocessableEntity {
		t.Fatalf("confirm on an unknown server = %d %s", response.Code, response.Body.String())
	}
}

func itoa(value uint64) string { return strconv.FormatUint(value, 10) }
