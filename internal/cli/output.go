package cli

import (
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"text/tabwriter"
	"time"
)

// Table is the shape every read command prints: a header and rows of already
// formatted cells. Keeping it this dumb means each command decides what a
// column means, and no command has to build its own alignment.
type Table struct {
	Header []string
	Rows   [][]string
}

// Add appends one row.
func (t *Table) Add(cells ...string) { t.Rows = append(t.Rows, cells) }

// Write renders the table, or a single line when there is nothing to show. An
// empty result is a real answer and should not print a bare header.
func (t Table) Write(writer io.Writer, empty string) error {
	if len(t.Rows) == 0 {
		_, err := fmt.Fprintln(writer, empty)
		return err
	}
	tabbed := tabwriter.NewWriter(writer, 0, 4, 2, ' ', 0)
	if len(t.Header) > 0 {
		if _, err := fmt.Fprintln(tabbed, strings.Join(t.Header, "\t")); err != nil {
			return err
		}
	}
	for _, row := range t.Rows {
		if _, err := fmt.Fprintln(tabbed, strings.Join(row, "\t")); err != nil {
			return err
		}
	}
	return tabbed.Flush()
}

// WriteJSON prints a document for a caller that asked for --json. Every read
// command offers it, so the CLI composes with jq rather than being scraped.
func WriteJSON(writer io.Writer, value any) error {
	encoder := json.NewEncoder(writer)
	encoder.SetIndent("", "  ")
	return encoder.Encode(value)
}

// Dash renders an empty cell so a column never collapses.
func Dash(value string) string {
	if strings.TrimSpace(value) == "" {
		return "—"
	}
	return value
}

// Age renders a timestamp as an approximate distance from now, which is what
// an operator scanning a list actually reads.
func Age(at time.Time) string {
	if at.IsZero() {
		return "—"
	}
	elapsed := time.Since(at)
	switch {
	case elapsed < time.Minute:
		return fmt.Sprintf("%ds", int(elapsed.Seconds()))
	case elapsed < time.Hour:
		return fmt.Sprintf("%dm", int(elapsed.Minutes()))
	case elapsed < 24*time.Hour:
		return fmt.Sprintf("%dh", int(elapsed.Hours()))
	default:
		return fmt.Sprintf("%dd", int(elapsed.Hours()/24))
	}
}
