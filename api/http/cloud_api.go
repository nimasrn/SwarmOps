package apihttp

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/nimasrn/SwarmOps/internal/auth"
	"github.com/nimasrn/SwarmOps/internal/cloud"
	"github.com/nimasrn/SwarmOps/internal/domain"
	"github.com/nimasrn/SwarmOps/internal/ops"
	"github.com/nimasrn/SwarmOps/internal/queue"
)

// storeSessionCookie is the customer storefront's session cookie. It is a
// different cookie from the operator console's, so a customer session can
// never authenticate an operator route and the reverse.
const storeSessionCookie = "swarmops_store_session"

// SetCloudService enables SwarmOps Cloud: the customer storefront API and the
// commerce screens of the operator console.
func (s *Server) SetCloudService(service *cloud.Service) { s.cloud = service }

// CloudProvisioner stops and restarts a customer's application by queueing
// the controller's existing service scale command. Suspension scales the
// service to zero; nothing is removed, so resuming loses no data.
func (s *Server) CloudProvisioner() cloud.Provisioner { return cloudProvisioner{server: s} }

type cloudProvisioner struct{ server *Server }

func (p cloudProvisioner) Suspend(_ context.Context, project cloud.Project) error {
	return p.scale(project, 0)
}

func (p cloudProvisioner) Resume(_ context.Context, project cloud.Project) error {
	return p.scale(project, 1)
}

func (p cloudProvisioner) scale(project cloud.Project, replicas uint64) error {
	if p.server.commands == nil {
		return fmt.Errorf("command storage is unavailable")
	}
	service := ops.ApplicationSpec{Name: project.AppName}.ServiceDNSName(ops.ApplicationNamespace)
	payload, err := json.Marshal(serviceActionCommand{Action: "scale", Replicas: &replicas, ServiceID: service})
	if err != nil {
		return err
	}
	_, err = p.server.commands.SubmitWithResult(queue.SubmitInput{
		Action:         commandServiceScale,
		Actor:          "swarmops-cloud-billing",
		AuthorityEpoch: p.server.core.AuthorityEpoch(),
		AutoRetry:      true,
		ClusterID:      "default",
		IdempotencyKey: fmt.Sprintf("cloud-scale-%d-%d-%d", project.ID, replicas, time.Now().UnixNano()),
		MaxAttempts:    maxAutomaticAttempts,
		Payload:        payload,
		ServerID:       project.ServerID,
		Target:         "service/" + service,
	})
	return err
}

func (s *Server) registerCloudRoutes(mux *http.ServeMux) {
	// Customer storefront.
	mux.HandleFunc("GET /api/store/v1/plans", s.requireCloud(s.storePlans))
	mux.HandleFunc("POST /api/store/v1/auth/register", s.requireCloud(s.storeRegister))
	mux.HandleFunc("POST /api/store/v1/auth/login", s.requireCloud(s.storeLogin))
	mux.HandleFunc("POST /api/store/v1/auth/logout", s.withCustomer(true, s.storeLogout))
	mux.HandleFunc("GET /api/store/v1/auth/me", s.withCustomer(false, s.storeMe))
	mux.HandleFunc("GET /api/store/v1/wallet", s.withCustomer(false, s.storeWallet))
	mux.HandleFunc("POST /api/store/v1/wallet/topups", s.withCustomer(true, s.storeTopUp))
	mux.HandleFunc("GET /api/store/v1/orders", s.withCustomer(false, s.storeOrders))
	mux.HandleFunc("POST /api/store/v1/orders", s.withCustomer(true, s.storePlaceOrder))
	mux.HandleFunc("GET /api/store/v1/orders/{id}", s.withCustomer(false, s.storeOrder))
	mux.HandleFunc("POST /api/store/v1/orders/{id}/cancel", s.withCustomer(true, s.storeCancelOrder))
	mux.HandleFunc("GET /api/store/v1/projects", s.withCustomer(false, s.storeProjects))
	mux.HandleFunc("GET /api/store/v1/invoices", s.withCustomer(false, s.storeInvoices))
	mux.HandleFunc("GET /api/store/v1/invoices/{id}", s.withCustomer(false, s.storeInvoice))
	mux.HandleFunc("GET /api/store/v1/tickets", s.withCustomer(false, s.storeTickets))
	mux.HandleFunc("POST /api/store/v1/tickets", s.withCustomer(true, s.storeOpenTicket))
	mux.HandleFunc("GET /api/store/v1/tickets/{id}", s.withCustomer(false, s.storeTicket))
	mux.HandleFunc("POST /api/store/v1/tickets/{id}/replies", s.withCustomer(true, s.storeReplyTicket))
	mux.HandleFunc("POST /api/store/v1/tickets/{id}/close", s.withCustomer(true, s.storeCloseTicket))

	// Operator console: the commerce administration surface.
	mux.HandleFunc("GET /api/v1/commerce/overview", s.withAuth(false, s.adminCloud(s.commerceOverview)))
	mux.HandleFunc("GET /api/v1/commerce/customers", s.withAuth(false, s.adminCloud(s.commerceCustomers)))
	mux.HandleFunc("GET /api/v1/commerce/customers/{id}/wallet", s.withAuth(false, s.adminCloud(s.commerceCustomerWallet)))
	mux.HandleFunc("POST /api/v1/commerce/customers/{id}/status", s.withActiveAuth(s.adminCloud(s.commerceCustomerStatus)))
	mux.HandleFunc("POST /api/v1/commerce/customers/{id}/adjustments", s.withActiveAuth(s.adminCloud(s.commerceAdjust)))
	mux.HandleFunc("GET /api/v1/commerce/plans", s.withAuth(false, s.adminCloud(s.commercePlans)))
	mux.HandleFunc("PUT /api/v1/commerce/plans/{code}", s.withActiveAuth(s.adminCloud(s.commerceSavePlan)))
	mux.HandleFunc("GET /api/v1/commerce/orders", s.withAuth(false, s.adminCloud(s.commerceOrders)))
	mux.HandleFunc("POST /api/v1/commerce/orders/{id}/confirm", s.withActiveAuth(s.adminCloud(s.commerceConfirmOrder)))
	mux.HandleFunc("POST /api/v1/commerce/orders/{id}/reject", s.withActiveAuth(s.adminCloud(s.commerceRejectOrder)))
	mux.HandleFunc("GET /api/v1/commerce/projects", s.withAuth(false, s.adminCloud(s.commerceProjects)))
	mux.HandleFunc("GET /api/v1/commerce/invoices", s.withAuth(false, s.adminCloud(s.commerceInvoices)))
	mux.HandleFunc("GET /api/v1/commerce/invoices/{id}", s.withAuth(false, s.adminCloud(s.commerceInvoice)))
	mux.HandleFunc("POST /api/v1/commerce/invoices/issue", s.withActiveAuth(s.adminCloud(s.commerceIssueInvoices)))
	mux.HandleFunc("POST /api/v1/commerce/billing/run", s.withActiveAuth(s.adminCloud(s.commerceRunBilling)))
	mux.HandleFunc("GET /api/v1/commerce/revenue", s.withAuth(false, s.adminCloud(s.commerceRevenue)))
	mux.HandleFunc("GET /api/v1/commerce/tickets", s.withAuth(false, s.adminCloud(s.commerceTickets)))
	mux.HandleFunc("GET /api/v1/commerce/tickets/{id}", s.withAuth(false, s.adminCloud(s.commerceTicket)))
	mux.HandleFunc("POST /api/v1/commerce/tickets/{id}/replies", s.withActiveAuth(s.adminCloud(s.commerceReplyTicket)))
	mux.HandleFunc("POST /api/v1/commerce/tickets/{id}/close", s.withActiveAuth(s.adminCloud(s.commerceCloseTicket)))
}

func (s *Server) requireCloud(handler http.HandlerFunc) http.HandlerFunc {
	return func(response http.ResponseWriter, request *http.Request) {
		if s.cloud == nil {
			writeError(response, http.StatusServiceUnavailable, "SwarmOps Cloud is not enabled on this controller")
			return
		}
		handler(response, request)
	}
}

func (s *Server) adminCloud(handler protectedHandler) protectedHandler {
	return func(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
		if s.cloud == nil {
			writeError(response, http.StatusServiceUnavailable, "SwarmOps Cloud is not enabled on this controller")
			return
		}
		handler(response, request, claims)
	}
}

type customerHandler func(http.ResponseWriter, *http.Request, cloud.Session)

// withCustomer authenticates a storefront request by its customer session
// cookie and, for a change, its CSRF header.
func (s *Server) withCustomer(csrf bool, handler customerHandler) http.HandlerFunc {
	return s.requireCloud(func(response http.ResponseWriter, request *http.Request) {
		cookie, err := request.Cookie(storeSessionCookie)
		if err != nil {
			writeError(response, http.StatusUnauthorized, "Sign in to continue")
			return
		}
		session, err := s.cloud.Authenticate(request.Context(), cookie.Value)
		if err != nil {
			s.cloudError(response, request, err)
			return
		}
		if csrf && !cloud.VerifyCSRF(session, request.Header.Get("X-CSRF-Token")) {
			writeError(response, http.StatusForbidden, "Invalid request token")
			return
		}
		handler(response, request, session)
	})
}

// cloudError maps a commerce error to its status. Every message it sends was
// written for the person using the page; an unexpected error is logged and
// answered generically.
func (s *Server) cloudError(response http.ResponseWriter, request *http.Request, err error) {
	var validation *cloud.ValidationError
	var funds *cloud.FundsError
	var conflictErr *cloud.ConflictError
	switch {
	case errors.As(err, &validation):
		writeJSON(response, http.StatusUnprocessableEntity, map[string]string{"error": validation.Message, "field": validation.Field})
	case errors.As(err, &funds):
		writeJSON(response, http.StatusConflict, map[string]any{"error": "The customer's wallet does not hold the required reserve", "balanceRial": funds.Balance, "requiredRial": funds.Required})
	case errors.Is(err, cloud.ErrInsufficientFunds):
		writeError(response, http.StatusConflict, "The wallet balance is not enough")
	case errors.As(err, &conflictErr):
		writeError(response, http.StatusConflict, conflictErr.Message)
	case errors.Is(err, cloud.ErrNotFound):
		writeError(response, http.StatusNotFound, "Not found")
	case errors.Is(err, cloud.ErrInvalidCredentials):
		writeError(response, http.StatusUnauthorized, "Invalid email or password")
	case errors.Is(err, cloud.ErrSessionExpired):
		writeError(response, http.StatusUnauthorized, "Your session has expired")
	case errors.Is(err, cloud.ErrForbidden):
		writeError(response, http.StatusForbidden, "This account cannot do that")
	default:
		s.logger.Error("SwarmOps Cloud request failed", "request_id", requestID(request), "path", request.URL.Path, "error", err)
		writeErrorDetail(response, http.StatusInternalServerError, "The request could not be completed", "", requestID(request))
	}
}

func pathID(response http.ResponseWriter, request *http.Request) (uint64, bool) {
	id, err := strconv.ParseUint(request.PathValue("id"), 10, 64)
	if err != nil || id == 0 {
		writeError(response, http.StatusNotFound, "Not found")
		return 0, false
	}
	return id, true
}

func queryLimit(request *http.Request) int {
	limit, _ := strconv.Atoi(request.URL.Query().Get("limit"))
	return limit
}

func (s *Server) storePlans(response http.ResponseWriter, request *http.Request) {
	plans, err := s.cloud.Plans(request.Context(), false)
	if err != nil {
		s.cloudError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, plans)
}

func (s *Server) storeRegister(response http.ResponseWriter, request *http.Request) {
	var input struct {
		Email    string `json:"email"`
		FullName string `json:"fullName"`
		Password string `json:"password"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	key := "store-register:" + loginAttemptKey(request, "", s.config.TrustedProxyCIDRs)
	if !s.loginLimiter.Allow(key) {
		writeError(response, http.StatusTooManyRequests, "Too many attempts; wait a few minutes")
		return
	}
	user, err := s.cloud.Register(request.Context(), input.Email, input.FullName, input.Password)
	if err != nil {
		s.loginLimiter.Failure(key)
		s.cloudError(response, request, err)
		return
	}
	s.record(user.Email, requestID(request), "cloud.customer.registered", fmt.Sprintf("customer/%d", user.ID), nil, nil)
	writeJSON(response, http.StatusCreated, user)
}

func (s *Server) storeLogin(response http.ResponseWriter, request *http.Request) {
	var input struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	key := "store-login:" + loginAttemptKey(request, input.Email, s.config.TrustedProxyCIDRs)
	if !s.loginLimiter.Allow(key) {
		writeError(response, http.StatusTooManyRequests, "Too many sign-in attempts; wait a few minutes")
		return
	}
	session, err := s.cloud.Login(request.Context(), input.Email, input.Password)
	if err != nil {
		s.loginLimiter.Failure(key)
		s.cloudError(response, request, err)
		return
	}
	s.loginLimiter.Success(key)
	http.SetCookie(response, &http.Cookie{Name: storeSessionCookie, Value: session.Token, Path: "/", Expires: session.ExpiresAt, HttpOnly: true,
		SameSite: http.SameSiteStrictMode, Secure: s.config.SecureCookies && !isPlaintextHTTPRequest(request)})
	writeJSON(response, http.StatusOK, session)
}

func (s *Server) storeLogout(response http.ResponseWriter, request *http.Request, session cloud.Session) {
	if err := s.cloud.Logout(request.Context(), session.Token); err != nil {
		s.cloudError(response, request, err)
		return
	}
	http.SetCookie(response, &http.Cookie{Name: storeSessionCookie, Value: "", Path: "/", MaxAge: -1, HttpOnly: true, SameSite: http.SameSiteStrictMode,
		Secure: s.config.SecureCookies && !isPlaintextHTTPRequest(request)})
	response.WriteHeader(http.StatusNoContent)
}

func (s *Server) storeMe(response http.ResponseWriter, _ *http.Request, session cloud.Session) {
	writeJSON(response, http.StatusOK, session)
}

func (s *Server) storeWallet(response http.ResponseWriter, request *http.Request, session cloud.Session) {
	wallet, err := s.cloud.Wallet(request.Context(), session.User.ID)
	if err != nil {
		s.cloudError(response, request, err)
		return
	}
	transactions, err := s.cloud.Transactions(request.Context(), session.User.ID, queryLimit(request))
	if err != nil {
		s.cloudError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, map[string]any{"transactions": transactions, "wallet": wallet})
}

// storeTopUp stands in for a payment gateway's confirmation. The Idempotency-Key
// plays the part of the gateway's payment reference: a retried callback with
// the same key credits nothing twice.
func (s *Server) storeTopUp(response http.ResponseWriter, request *http.Request, session cloud.Session) {
	var input struct {
		AmountRial int64 `json:"amountRial"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	transaction, err := s.cloud.TopUp(request.Context(), session.User.ID, input.AmountRial, request.Header.Get("Idempotency-Key"))
	if err != nil {
		s.cloudError(response, request, err)
		return
	}
	s.record(session.User.Email, requestID(request), "cloud.wallet.topup", fmt.Sprintf("customer/%d", session.User.ID), nil,
		map[string]string{"amount_rial": strconv.FormatInt(input.AmountRial, 10), "transaction_id": strconv.FormatUint(transaction.ID, 10)})
	writeJSON(response, http.StatusOK, transaction)
}

func (s *Server) storeOrders(response http.ResponseWriter, request *http.Request, session cloud.Session) {
	orders, err := s.cloud.Orders(request.Context(), session.User.ID, queryLimit(request))
	if err != nil {
		s.cloudError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, orders)
}

func (s *Server) storePlaceOrder(response http.ResponseWriter, request *http.Request, session cloud.Session) {
	var input cloud.OrderInput
	if !decodeJSON(response, request, &input) {
		return
	}
	order, err := s.cloud.PlaceOrder(request.Context(), session.User.ID, input)
	if err != nil {
		s.cloudError(response, request, err)
		return
	}
	s.record(session.User.Email, requestID(request), "cloud.order.placed", fmt.Sprintf("order/%d", order.ID), nil,
		map[string]string{"application": input.AppName, "plan": input.PlanCode})
	writeJSON(response, http.StatusCreated, order)
}

func (s *Server) storeOrder(response http.ResponseWriter, request *http.Request, session cloud.Session) {
	id, ok := pathID(response, request)
	if !ok {
		return
	}
	order, err := s.cloud.CustomerOrder(request.Context(), session.User.ID, id)
	if err != nil {
		s.cloudError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, order)
}

func (s *Server) storeCancelOrder(response http.ResponseWriter, request *http.Request, session cloud.Session) {
	id, ok := pathID(response, request)
	if !ok {
		return
	}
	order, err := s.cloud.CancelOrder(request.Context(), session.User.ID, id)
	if err != nil {
		s.cloudError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, order)
}

func (s *Server) storeProjects(response http.ResponseWriter, request *http.Request, session cloud.Session) {
	projects, err := s.cloud.Projects(request.Context(), session.User.ID)
	if err != nil {
		s.cloudError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, projects)
}

func (s *Server) storeInvoices(response http.ResponseWriter, request *http.Request, session cloud.Session) {
	invoices, err := s.cloud.Invoices(request.Context(), session.User.ID, queryLimit(request))
	if err != nil {
		s.cloudError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, invoices)
}

func (s *Server) storeInvoice(response http.ResponseWriter, request *http.Request, session cloud.Session) {
	id, ok := pathID(response, request)
	if !ok {
		return
	}
	invoice, err := s.cloud.Invoice(request.Context(), session.User.ID, id)
	if err != nil {
		s.cloudError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, invoice)
}

func (s *Server) storeTickets(response http.ResponseWriter, request *http.Request, session cloud.Session) {
	tickets, err := s.cloud.Tickets(request.Context(), session.User, request.URL.Query().Get("status"), queryLimit(request))
	if err != nil {
		s.cloudError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, tickets)
}

func (s *Server) storeOpenTicket(response http.ResponseWriter, request *http.Request, session cloud.Session) {
	var input struct {
		Body      string `json:"body"`
		Priority  string `json:"priority"`
		ProjectID uint64 `json:"projectId"`
		Subject   string `json:"subject"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	ticket, err := s.cloud.OpenTicket(request.Context(), session.User, input.Subject, input.Body, input.Priority, input.ProjectID)
	if err != nil {
		s.cloudError(response, request, err)
		return
	}
	writeJSON(response, http.StatusCreated, ticket)
}

func (s *Server) storeTicket(response http.ResponseWriter, request *http.Request, session cloud.Session) {
	id, ok := pathID(response, request)
	if !ok {
		return
	}
	ticket, err := s.cloud.Ticket(request.Context(), session.User, id)
	if err != nil {
		s.cloudError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, ticket)
}

func (s *Server) storeReplyTicket(response http.ResponseWriter, request *http.Request, session cloud.Session) {
	id, ok := pathID(response, request)
	if !ok {
		return
	}
	var input struct {
		Body string `json:"body"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	ticket, err := s.cloud.ReplyTicket(request.Context(), session.User, id, input.Body)
	if err != nil {
		s.cloudError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, ticket)
}

func (s *Server) storeCloseTicket(response http.ResponseWriter, request *http.Request, session cloud.Session) {
	id, ok := pathID(response, request)
	if !ok {
		return
	}
	ticket, err := s.cloud.CloseTicket(request.Context(), session.User, id)
	if err != nil {
		s.cloudError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, ticket)
}

// operator resolves the console operator behind an admin request to the
// commerce admin row that reviews and replies carry.
func (s *Server) operator(response http.ResponseWriter, request *http.Request, claims auth.Claims) (cloud.User, bool) {
	user, err := s.cloud.EnsureOperator(request.Context(), claims.Username)
	if err != nil {
		s.cloudError(response, request, err)
		return cloud.User{}, false
	}
	return user, true
}

func (s *Server) commerceOverview(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	overview, err := s.cloud.AdminOverview(request.Context())
	if err != nil {
		s.cloudError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, overview)
}

func (s *Server) commerceCustomers(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	customers, err := s.cloud.Customers(request.Context(), queryLimit(request))
	if err != nil {
		s.cloudError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, customers)
}

func (s *Server) commerceCustomerWallet(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	id, ok := pathID(response, request)
	if !ok {
		return
	}
	wallet, err := s.cloud.Wallet(request.Context(), id)
	if err != nil {
		s.cloudError(response, request, err)
		return
	}
	transactions, err := s.cloud.Transactions(request.Context(), id, queryLimit(request))
	if err != nil {
		s.cloudError(response, request, err)
		return
	}
	consistent, err := s.cloud.LedgerConsistent(request.Context(), id)
	if err != nil {
		s.cloudError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, map[string]any{"ledgerConsistent": consistent, "transactions": transactions, "wallet": wallet})
}

func (s *Server) commerceCustomerStatus(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	id, ok := pathID(response, request)
	if !ok {
		return
	}
	var input struct {
		Status string `json:"status"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	err := s.cloud.SetCustomerStatus(request.Context(), id, input.Status)
	s.record(claims.Username, requestID(request), "commerce.customer.status", fmt.Sprintf("customer/%d", id), err, map[string]string{"status": input.Status})
	if err != nil {
		s.cloudError(response, request, err)
		return
	}
	response.WriteHeader(http.StatusNoContent)
}

func (s *Server) commerceAdjust(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	id, ok := pathID(response, request)
	if !ok {
		return
	}
	var input struct {
		AmountRial int64  `json:"amountRial"`
		Reason     string `json:"reason"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	admin, ok := s.operator(response, request, claims)
	if !ok {
		return
	}
	transaction, err := s.cloud.Adjust(request.Context(), admin, id, input.AmountRial, input.Reason, request.Header.Get("Idempotency-Key"))
	s.record(claims.Username, requestID(request), "commerce.wallet.adjusted", fmt.Sprintf("customer/%d", id), err,
		map[string]string{"amount_rial": strconv.FormatInt(input.AmountRial, 10)})
	if err != nil {
		s.cloudError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, transaction)
}

func (s *Server) commercePlans(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	plans, err := s.cloud.Plans(request.Context(), true)
	if err != nil {
		s.cloudError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, plans)
}

func (s *Server) commerceSavePlan(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input cloud.PlanInput
	if !decodeJSON(response, request, &input) {
		return
	}
	input.Code = request.PathValue("code")
	plan, err := s.cloud.SavePlan(request.Context(), input)
	s.record(claims.Username, requestID(request), "commerce.plan.saved", "plan/"+input.Code, err,
		map[string]string{"hourly_price_rial": strconv.FormatInt(input.HourlyPriceRial, 10), "active": strconv.FormatBool(input.Active)})
	if err != nil {
		s.cloudError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, plan)
}

func (s *Server) commerceOrders(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	orders, err := s.cloud.AllOrders(request.Context(), request.URL.Query().Get("status"), queryLimit(request))
	if err != nil {
		s.cloudError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, orders)
}

// commerceConfirmOrder accepts an order. It runs every admission check a
// console deployment would, and the controller's own deployment planning,
// before the commerce transaction charges the wallet and queues the deploy.
func (s *Server) commerceConfirmOrder(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	id, ok := pathID(response, request)
	if !ok {
		return
	}
	var input struct {
		ServerID string `json:"serverId"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	if !s.remoteMutationsEnabled(response) {
		return
	}
	if s.commands == nil || s.commands.Writable() != nil {
		writeError(response, http.StatusServiceUnavailable, "SwarmOps command storage is unavailable")
		return
	}
	if err := s.audit.Writable(); err != nil {
		writeError(response, http.StatusServiceUnavailable, "The audit ledger is unavailable; the order was not confirmed")
		return
	}
	serverID := strings.TrimSpace(input.ServerID)
	known := false
	for _, server := range s.servers.List() {
		if server.ID == serverID {
			known = true
			break
		}
	}
	if !known {
		writeJSON(response, http.StatusUnprocessableEntity, map[string]string{"error": "Choose a saved server to deploy on", "field": "serverId"})
		return
	}
	target, err := s.targets.Resolve(serverID)
	if err != nil || target.Control == nil {
		writeError(response, http.StatusConflict, "The selected server is not connected to a Swarm manager")
		return
	}
	order, err := s.cloud.Order(request.Context(), id)
	if err != nil {
		s.cloudError(response, request, err)
		return
	}
	if len(order.Items) == 0 {
		writeError(response, http.StatusConflict, "This order has nothing to provision")
		return
	}
	item := order.Items[0]
	plan, err := s.cloud.PlanByCode(request.Context(), item.PlanCode)
	if err != nil {
		s.cloudError(response, request, err)
		return
	}
	spec, err := cloud.ApplicationSpec(plan, item.AppName, item.Image, item.Port)
	if err != nil {
		s.cloudError(response, request, err)
		return
	}
	if _, err := target.Control.PlanApplication(request.Context(), spec); err != nil {
		writeError(response, http.StatusUnprocessableEntity, err.Error())
		return
	}
	reviewer, ok := s.operator(response, request, claims)
	if !ok {
		return
	}
	confirmed, project, command, err := s.cloud.ConfirmOrder(request.Context(), reviewer, id, cloud.ProvisionTarget{
		AuthorityEpoch: s.core.AuthorityEpoch(), RequestID: requestID(request), ServerID: serverID,
	})
	s.record(claims.Username, requestID(request), "commerce.order.confirmed", fmt.Sprintf("order/%d", id), err,
		map[string]string{"application": item.AppName, "command_id": command.ID, "server_id": serverID})
	if err != nil {
		s.cloudError(response, request, err)
		return
	}
	s.record(claims.Username, requestID(request), "command.queued", "command/"+command.ID, nil, commandAuditDetail(command))
	writeJSON(response, http.StatusOK, map[string]any{"command": command, "order": confirmed, "project": project})
}

func (s *Server) commerceRejectOrder(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	id, ok := pathID(response, request)
	if !ok {
		return
	}
	var input struct {
		Reason string `json:"reason"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	reviewer, ok := s.operator(response, request, claims)
	if !ok {
		return
	}
	order, err := s.cloud.RejectOrder(request.Context(), reviewer, id, input.Reason)
	s.record(claims.Username, requestID(request), "commerce.order.rejected", fmt.Sprintf("order/%d", id), err, nil)
	if err != nil {
		s.cloudError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, order)
}

func (s *Server) commerceProjects(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	projects, err := s.cloud.AllProjects(request.Context(), request.URL.Query().Get("status"), queryLimit(request))
	if err != nil {
		s.cloudError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, projects)
}

func (s *Server) commerceInvoices(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	invoices, err := s.cloud.Invoices(request.Context(), 0, queryLimit(request))
	if err != nil {
		s.cloudError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, invoices)
}

func (s *Server) commerceInvoice(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	id, ok := pathID(response, request)
	if !ok {
		return
	}
	invoice, err := s.cloud.Invoice(request.Context(), 0, id)
	if err != nil {
		s.cloudError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, invoice)
}

func (s *Server) commerceIssueInvoices(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	var input struct {
		Month string `json:"month"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	month, err := time.Parse("2006-01", strings.TrimSpace(input.Month))
	if err != nil {
		writeJSON(response, http.StatusUnprocessableEntity, map[string]string{"error": "Give the month as YYYY-MM", "field": "month"})
		return
	}
	issued, err := s.cloud.IssueInvoices(request.Context(), month)
	s.record(claims.Username, requestID(request), "commerce.invoices.issued", "invoices/"+input.Month, err, map[string]string{"issued": strconv.Itoa(issued)})
	if err != nil {
		s.cloudError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, map[string]int{"issued": issued})
}

func (s *Server) commerceRunBilling(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	result, err := s.cloud.RunBilling(request.Context())
	s.record(claims.Username, requestID(request), "commerce.billing.run", "billing", err, map[string]string{
		"charged_hours": strconv.FormatInt(result.ChargedHours, 10), "suspended": strconv.FormatInt(result.Suspended, 10)})
	if err != nil {
		s.cloudError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, result)
}

func (s *Server) commerceRevenue(response http.ResponseWriter, request *http.Request, _ auth.Claims) {
	months, _ := strconv.Atoi(request.URL.Query().Get("months"))
	revenue, err := s.cloud.Revenue(request.Context(), months)
	if err != nil {
		s.cloudError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, revenue)
}

func (s *Server) commerceTickets(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	admin, ok := s.operator(response, request, claims)
	if !ok {
		return
	}
	tickets, err := s.cloud.Tickets(request.Context(), admin, request.URL.Query().Get("status"), queryLimit(request))
	if err != nil {
		s.cloudError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, tickets)
}

func (s *Server) commerceTicket(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	id, ok := pathID(response, request)
	if !ok {
		return
	}
	admin, ok := s.operator(response, request, claims)
	if !ok {
		return
	}
	ticket, err := s.cloud.Ticket(request.Context(), admin, id)
	if err != nil {
		s.cloudError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, ticket)
}

func (s *Server) commerceReplyTicket(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	id, ok := pathID(response, request)
	if !ok {
		return
	}
	var input struct {
		Body string `json:"body"`
	}
	if !decodeJSON(response, request, &input) {
		return
	}
	admin, ok := s.operator(response, request, claims)
	if !ok {
		return
	}
	ticket, err := s.cloud.ReplyTicket(request.Context(), admin, id, input.Body)
	if err != nil {
		s.cloudError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, ticket)
}

func (s *Server) commerceCloseTicket(response http.ResponseWriter, request *http.Request, claims auth.Claims) {
	id, ok := pathID(response, request)
	if !ok {
		return
	}
	admin, ok := s.operator(response, request, claims)
	if !ok {
		return
	}
	ticket, err := s.cloud.CloseTicket(request.Context(), admin, id)
	if err != nil {
		s.cloudError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, ticket)
}

// notifyCloud moves a customer's project forward when the deployment command
// that provisions it reaches an outcome.
func (s *Server) notifyCloud(command domain.Command) {
	if s.cloud == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := s.cloud.OnCommandTransition(ctx, command); err != nil {
		s.logger.Error("SwarmOps Cloud could not record a deployment outcome", "command_id", command.ID, "state", command.State, "error", err)
	}
}
