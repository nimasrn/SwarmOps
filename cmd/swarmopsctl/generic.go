package main

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/nimasrn/SwarmOps/internal/cli"
)

// The controller returns many documents this CLI has no reason to model: raw
// Docker records, Traefik state, insight rollups. Rather than mirroring each
// shape — and going stale the moment one grows a field — those commands read
// the document generically, print the few fields an operator scans, and hand
// over the whole thing under --json.

// stringField reads the first key that is present, so a command can accept
// both the Docker capitalisation and the controller's own.
func stringField(document map[string]any, keys ...string) string {
	for _, key := range keys {
		if value, found := document[key]; found {
			if text := fmt.Sprint(value); text != "" && text != "<nil>" {
				return text
			}
		}
	}
	return "—"
}

// listDocuments prints a one-column list of named documents.
func listDocuments(path string, arguments []string, nameKeys []string, empty string) error {
	var opts options
	flags := newFlagSet("list", &opts)
	if err := flags.Parse(arguments); err != nil {
		return err
	}
	client, err := opts.connect()
	if err != nil {
		return err
	}
	ctx, cancel := timeoutContext(requestTimeout)
	defer cancel()
	var documents []map[string]any
	if err := client.Get(ctx, path, &documents); err != nil {
		return err
	}
	if opts.json {
		return cli.WriteJSON(os.Stdout, documents)
	}
	table := cli.Table{Header: []string{"NAME"}}
	for _, document := range documents {
		table.Add(stringField(document, nameKeys...))
	}
	return table.Write(os.Stdout, empty)
}

// column names one printed column and the keys it may be found under.
type column struct {
	Header string
	Keys   []string
}

// listTable prints a table of documents from a list endpoint.
func listTable(path string, arguments []string, columns []column, empty string) error {
	var opts options
	flags := newFlagSet("list", &opts)
	if err := flags.Parse(arguments); err != nil {
		return err
	}
	client, err := opts.connect()
	if err != nil {
		return err
	}
	ctx, cancel := timeoutContext(requestTimeout)
	defer cancel()
	var documents []map[string]any
	if err := client.Get(ctx, path, &documents); err != nil {
		return err
	}
	if opts.json {
		return cli.WriteJSON(os.Stdout, documents)
	}
	headers := make([]string, 0, len(columns))
	for _, current := range columns {
		headers = append(headers, current.Header)
	}
	table := cli.Table{Header: headers}
	for _, document := range documents {
		row := make([]string, 0, len(columns))
		for _, current := range columns {
			row = append(row, stringField(document, current.Keys...))
		}
		table.Add(row...)
	}
	return table.Write(os.Stdout, empty)
}

// showDocument prints one document from a read endpoint.
func showDocument(path string, arguments []string) error {
	var opts options
	flags := newFlagSet("show", &opts)
	if err := flags.Parse(arguments); err != nil {
		return err
	}
	client, err := opts.connect()
	if err != nil {
		return err
	}
	ctx, cancel := timeoutContext(requestTimeout)
	defer cancel()
	var document any
	if err := client.Get(ctx, path, &document); err != nil {
		return err
	}
	return cli.WriteJSON(os.Stdout, document)
}

// listStateSection prints one array out of the routing state document.
//
// Domains, DNS records and stored credentials have no list endpoint of their
// own: they are fields of GET /api/v1/traefik/state, which is the one read
// that returns the routing store as a consistent snapshot. Asking for
// /api/v1/traefik/domains returns the console's HTML, not a 404, so a CLI that
// guessed the URL failed with a JSON parse error instead of a useful one.
func listStateSection(section string, arguments []string, columns []column, empty string) error {
	var opts options
	flags := newFlagSet("list", &opts)
	if err := flags.Parse(arguments); err != nil {
		return err
	}
	client, err := opts.connect()
	if err != nil {
		return err
	}
	ctx, cancel := timeoutContext(requestTimeout)
	defer cancel()
	var state map[string]json.RawMessage
	if err := client.Get(ctx, "/api/v1/traefik/state", &state); err != nil {
		return err
	}
	raw, found := state[section]
	if !found {
		return fmt.Errorf("the routing state has no %s", section)
	}
	var documents []map[string]any
	if err := json.Unmarshal(raw, &documents); err != nil {
		return fmt.Errorf("decode %s from the routing state: %w", section, err)
	}
	if opts.json {
		return cli.WriteJSON(os.Stdout, documents)
	}
	headers := make([]string, 0, len(columns))
	for _, current := range columns {
		headers = append(headers, current.Header)
	}
	table := cli.Table{Header: headers}
	for _, document := range documents {
		row := make([]string, 0, len(columns))
		for _, current := range columns {
			row = append(row, stringField(document, current.Keys...))
		}
		table.Add(row...)
	}
	return table.Write(os.Stdout, empty)
}
