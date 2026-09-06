package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"github.com/nimasrn/SwarmOps/internal/cli"
	"github.com/nimasrn/SwarmOps/internal/domain"
)

// requestTimeout bounds one controller call. Following a queued command uses
// its own, longer budget.
const requestTimeout = 60 * time.Second

// followTimeout bounds how long a command is watched before the CLI stops
// waiting. The command itself keeps running; only the watching stops.
const followTimeout = 30 * time.Minute

// sessionTTL is how long a stored session is assumed good for. The controller
// is the authority — this only decides when to say "run login" before making a
// call that would come back 401 anyway. It is deliberately shorter than the
// controller's default so the guess errs towards prompting.
const sessionTTL = 8 * time.Hour

// options are the flags every controller-facing command accepts.
type options struct {
	json    bool
	profile string
	server  string
}

func (o *options) register(flags *flag.FlagSet) {
	flags.BoolVar(&o.json, "json", false, "print the raw controller document")
	flags.StringVar(&o.profile, "profile", "", "stored profile to use")
	flags.StringVar(&o.server, "server-id", "", "machine to address commands to")
}

// newFlagSet gives every command the same parsing behaviour: errors are
// returned rather than printed, so main renders one usage line.
func newFlagSet(name string, opts *options) *flag.FlagSet {
	flags := flag.NewFlagSet(name, flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	if opts != nil {
		opts.register(flags)
	}
	return flags
}

// connect resolves the profile and returns a client carrying its session. It
// refuses rather than prompting: a command that silently asked for a password
// would break every non-interactive use.
func (o *options) connect() (*cli.Client, error) {
	config, err := cli.LoadConfig()
	if err != nil {
		return nil, err
	}
	name, profile, err := config.Resolve(o.profile)
	if err != nil {
		return nil, err
	}
	if !profile.Session.Valid(time.Now()) {
		return nil, fmt.Errorf("no valid session for profile %q; run `swarmops login`", name)
	}
	client, err := cli.New(profile.URL, profile.CoreFingerprint, requestTimeout)
	if err != nil {
		return nil, err
	}
	client.WithSession(profile.Session)
	server := profile.ServerID
	if o.server != "" {
		server = o.server
	}
	client.WithServer(server)
	return client, nil
}

func timeoutContext(budget time.Duration) (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), budget)
}

func runLogin(arguments []string) error {
	var opts options
	flags := newFlagSet("login", &opts)
	baseURL := flags.String("url", "", "Core URL")
	username := flags.String("username", "", "SwarmOps username")
	fingerprint := flags.String("core-fingerprint", "", "exact SHA256:<64-hex> Core certificate pin")
	passwordStdin := flags.Bool("password-stdin", false, "read the password from standard input")
	if err := flags.Parse(arguments); err != nil {
		return err
	}
	config, err := cli.LoadConfig()
	if err != nil {
		return err
	}
	name := config.ProfileName(opts.profile)
	if name == "" {
		name = "default"
	}
	profile := config.Profiles[name]
	if *baseURL != "" {
		profile.URL = *baseURL
	}
	if *username != "" {
		profile.Username = *username
	}
	if *fingerprint != "" {
		profile.CoreFingerprint = *fingerprint
	}
	if profile.URL == "" || profile.Username == "" {
		return fmt.Errorf("%w: --url and --username are required the first time a profile is used", errUsage)
	}
	password, err := readPassword(*passwordStdin)
	if err != nil {
		return err
	}
	client, err := cli.New(profile.URL, profile.CoreFingerprint, requestTimeout)
	if err != nil {
		return err
	}
	ctx, cancel := timeoutContext(requestTimeout)
	defer cancel()
	if err := client.Login(ctx, profile.Username, password); err != nil {
		return err
	}
	profile.ClusterID = cli.ClusterID
	profile.Session = client.Session(sessionTTL)
	// A profile with exactly one enrolled machine selects it, so the first
	// deploy does not fail on a server the operator has no reason to name.
	if profile.ServerID == "" {
		if servers, listErr := listServers(ctx, client); listErr == nil && len(servers) == 1 {
			profile.ServerID = servers[0].ID
		}
	}
	config.Put(name, profile)
	config.Current = name
	if err := config.Save(); err != nil {
		return err
	}
	fmt.Printf("Signed in to %s as %s (profile %q).\n", profile.URL, profile.Username, name)
	if profile.ServerID == "" {
		fmt.Println("No machine is selected. Run `swarmops server list`, then `swarmops server use <id>`.")
	} else {
		fmt.Printf("Commands run on machine %s.\n", profile.ServerID)
	}
	return nil
}

func runLogout(arguments []string) error {
	var opts options
	flags := newFlagSet("logout", &opts)
	if err := flags.Parse(arguments); err != nil {
		return err
	}
	config, err := cli.LoadConfig()
	if err != nil {
		return err
	}
	name, profile, err := config.Resolve(opts.profile)
	if err != nil {
		return err
	}
	if profile.Session.Valid(time.Now()) {
		client, clientErr := cli.New(profile.URL, profile.CoreFingerprint, requestTimeout)
		if clientErr == nil {
			ctx, cancel := timeoutContext(requestTimeout)
			defer cancel()
			// A controller that cannot be reached does not keep this session
			// alive on the workstation; the local credential is dropped either
			// way and the failure is reported, not swallowed.
			if err := client.WithSession(profile.Session).Post(ctx, "/api/v1/auth/logout", nil, nil); err != nil {
				fmt.Fprintln(os.Stderr, "swarmops: the controller was not told about the logout:", err)
			}
		}
	}
	profile.Session = cli.Session{}
	config.Put(name, profile)
	if err := config.Save(); err != nil {
		return err
	}
	fmt.Printf("Signed out of profile %q.\n", name)
	return nil
}

func runWhoami(arguments []string) error {
	var opts options
	flags := newFlagSet("whoami", &opts)
	if err := flags.Parse(arguments); err != nil {
		return err
	}
	client, err := opts.connect()
	if err != nil {
		return err
	}
	ctx, cancel := timeoutContext(requestTimeout)
	defer cancel()
	var identity struct {
		User struct {
			Username string `json:"username"`
		} `json:"user"`
	}
	if err := client.Get(ctx, "/api/v1/auth/me", &identity); err != nil {
		return err
	}
	if opts.json {
		return cli.WriteJSON(os.Stdout, identity)
	}
	fmt.Printf("%s at %s\n", identity.User.Username, client.BaseURL())
	if client.ServerID() != "" {
		fmt.Printf("machine %s\n", client.ServerID())
	}
	return nil
}

func runProfile(arguments []string) error {
	if len(arguments) == 0 {
		return errUsage
	}
	config, err := cli.LoadConfig()
	if err != nil {
		return err
	}
	switch arguments[0] {
	case "list":
		table := cli.Table{Header: []string{"NAME", "URL", "USER", "MACHINE", "SESSION"}}
		for _, name := range config.Names() {
			profile := config.Profiles[name]
			marker := name
			if name == config.Current {
				marker = "* " + name
			}
			session := "expired"
			if profile.Session.Valid(time.Now()) {
				session = "valid until " + profile.Session.ExpiresAt.Format(time.RFC3339)
			}
			table.Add(marker, profile.URL, cli.Dash(profile.Username), cli.Dash(profile.ServerID), session)
		}
		return table.Write(os.Stdout, "No profile is configured. Run `swarmops login --url <core-url> --username <name>`.")
	case "use":
		if len(arguments) != 2 {
			return errUsage
		}
		if _, found := config.Profiles[arguments[1]]; !found {
			return fmt.Errorf("profile %q is not configured", arguments[1])
		}
		config.Current = arguments[1]
		if err := config.Save(); err != nil {
			return err
		}
		fmt.Printf("Profile %q is now current.\n", arguments[1])
		return nil
	case "remove":
		if len(arguments) != 2 {
			return errUsage
		}
		if _, found := config.Profiles[arguments[1]]; !found {
			return fmt.Errorf("profile %q is not configured", arguments[1])
		}
		delete(config.Profiles, arguments[1])
		if config.Current == arguments[1] {
			config.Current = ""
		}
		if err := config.Save(); err != nil {
			return err
		}
		fmt.Printf("Removed profile %q.\n", arguments[1])
		return nil
	default:
		return errUsage
	}
}

// listServers reads the enrolled machines. It decodes the controller's own
// record type rather than a local copy, so a field this CLI does not print
// cannot silently become the wrong field when the record changes.
func listServers(ctx context.Context, client *cli.Client) ([]domain.Server, error) {
	var servers []domain.Server
	if err := client.Get(ctx, "/api/v1/servers", &servers); err != nil {
		return nil, err
	}
	return servers, nil
}

func runServer(arguments []string) error {
	if len(arguments) == 0 {
		return errUsage
	}
	var opts options
	flags := newFlagSet("server", &opts)
	apiKeyFile := flags.String("api-key-file", "", "file holding the machine API key, for connect")
	rest, err := parseAfterPositionals(flags, arguments[1:])
	if err != nil {
		return err
	}
	switch arguments[0] {
	case "list":
		client, err := opts.connect()
		if err != nil {
			return err
		}
		ctx, cancel := timeoutContext(requestTimeout)
		defer cancel()
		servers, err := listServers(ctx, client)
		if err != nil {
			return err
		}
		if opts.json {
			return cli.WriteJSON(os.Stdout, servers)
		}
		table := cli.Table{Header: []string{"ID", "NAME", "HOST", "LINK", "STATE", "DOCKER"}}
		for _, server := range servers {
			marker := server.ID
			if server.ID == client.ServerID() {
				marker = "* " + server.ID
			}
			docker := server.DockerVersion
			if !server.DockerAvailable {
				docker = "unavailable"
			}
			if server.SwarmState != "" {
				docker = cli.Dash(docker) + " / swarm " + server.SwarmState
			}
			table.Add(marker, cli.Dash(server.Name), cli.Dash(server.Host),
				cli.Dash(server.ConnectionType), cli.Dash(server.ConnectionState), cli.Dash(docker))
		}
		return table.Write(os.Stdout, "No machine is enrolled yet.")
	case "connect", "disconnect":
		if len(rest) != 1 {
			return errUsage
		}
		client, err := opts.connect()
		if err != nil {
			return err
		}
		ctx, cancel := timeoutContext(requestTimeout)
		defer cancel()
		if arguments[0] == "disconnect" {
			var server domain.Server
			if err := client.Post(ctx, "/api/v1/servers/"+rest[0]+"/disconnect", nil, &server); err != nil {
				return err
			}
			fmt.Printf("Disconnected %s.\n", cli.Dash(server.Name))
			return nil
		}
		// The machine credential is read from a file rather than a flag: an
		// API key in argv is visible to every process on the workstation and
		// ends up in shell history.
		body := map[string]string{}
		if *apiKeyFile != "" {
			key, readErr := os.ReadFile(*apiKeyFile)
			if readErr != nil {
				return fmt.Errorf("read %s: %w", *apiKeyFile, readErr)
			}
			body["apiKey"] = strings.TrimSpace(string(key))
		}
		var server domain.Server
		if err := client.Post(ctx, "/api/v1/servers/"+rest[0]+"/connect", body, &server); err != nil {
			return err
		}
		fmt.Printf("Connected %s (%s).\n", cli.Dash(server.Name), server.ID)
		return nil
	case "use":
		if len(rest) != 1 {
			return errUsage
		}
		config, err := cli.LoadConfig()
		if err != nil {
			return err
		}
		name, profile, err := config.Resolve(opts.profile)
		if err != nil {
			return err
		}
		profile.ServerID = rest[0]
		config.Put(name, profile)
		if err := config.Save(); err != nil {
			return err
		}
		fmt.Printf("Commands on profile %q now run on machine %s.\n", name, profile.ServerID)
		return nil
	default:
		return errUsage
	}
}

// requireServer is the check every command that queues work makes before it
// builds a request, so the refusal names the fix rather than surfacing a 409.
func requireServer(client *cli.Client) error {
	if client.ServerID() == "" {
		return errors.New("no machine is selected; run `swarmops server list` then `swarmops server use <id>`")
	}
	return nil
}
