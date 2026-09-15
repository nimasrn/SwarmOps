package cloud

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"unicode/utf8"
)

const (
	TicketOpen     = "open"
	TicketAnswered = "answered"
	TicketClosed   = "closed"
)

// OpenTicket starts a support conversation, optionally about one of the
// customer's own projects.
func (s *Service) OpenTicket(ctx context.Context, customer User, subject, body, priority string, projectID uint64) (Ticket, error) {
	subject, body = strings.TrimSpace(subject), strings.TrimSpace(body)
	if utf8.RuneCountInString(subject) < 3 || utf8.RuneCountInString(subject) > 160 {
		return Ticket{}, invalid("subject", "give the ticket a short subject")
	}
	if utf8.RuneCountInString(body) < 1 || utf8.RuneCountInString(body) > 5000 {
		return Ticket{}, invalid("body", "describe the problem in under 5000 characters")
	}
	if priority == "" {
		priority = "normal"
	}
	if priority != "low" && priority != "normal" && priority != "high" {
		return Ticket{}, invalid("priority", "priority must be low, normal or high")
	}
	ctx, cancel := s.context(ctx)
	defer cancel()
	var ticketID int64
	err := s.db.WithTx(ctx, func(tx *sql.Tx) error {
		if projectID != 0 {
			var owner uint64
			if err := tx.QueryRowContext(ctx, "SELECT user_id FROM projects WHERE id = ?", projectID).Scan(&owner); err != nil || owner != customer.ID {
				return invalid("projectId", "choose one of your own projects")
			}
		}
		now := s.now()
		result, err := tx.ExecContext(ctx, "INSERT INTO support_tickets (user_id, project_id, subject, status, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
			customer.ID, sql.NullInt64{Int64: int64(projectID), Valid: projectID != 0}, subject, TicketOpen, priority, now, now)
		if err != nil {
			return err
		}
		if ticketID, err = result.LastInsertId(); err != nil {
			return err
		}
		_, err = tx.ExecContext(ctx, "INSERT INTO ticket_messages (ticket_id, author_id, body, created_at) VALUES (?, ?, ?, ?)", ticketID, customer.ID, body, now)
		return err
	})
	if err != nil {
		return Ticket{}, err
	}
	return s.Ticket(ctx, customer, uint64(ticketID))
}

// ReplyTicket adds a message. An administrator's reply marks the ticket
// answered; the customer's marks it open again.
func (s *Service) ReplyTicket(ctx context.Context, author User, ticketID uint64, body string) (Ticket, error) {
	body = strings.TrimSpace(body)
	if utf8.RuneCountInString(body) < 1 || utf8.RuneCountInString(body) > 5000 {
		return Ticket{}, invalid("body", "write a reply in under 5000 characters")
	}
	ctx, cancel := s.context(ctx)
	defer cancel()
	err := s.db.WithTx(ctx, func(tx *sql.Tx) error {
		status, err := lockTicket(ctx, tx, author, ticketID)
		if err != nil {
			return err
		}
		if status == TicketClosed {
			return conflict("this ticket is closed; open a new one")
		}
		next := TicketOpen
		if author.Role == RoleAdmin {
			next = TicketAnswered
		}
		now := s.now()
		if _, err := tx.ExecContext(ctx, "INSERT INTO ticket_messages (ticket_id, author_id, body, created_at) VALUES (?, ?, ?, ?)", ticketID, author.ID, body, now); err != nil {
			return err
		}
		_, err = tx.ExecContext(ctx, "UPDATE support_tickets SET status = ?, updated_at = ? WHERE id = ?", next, now, ticketID)
		return err
	})
	if err != nil {
		return Ticket{}, err
	}
	return s.Ticket(ctx, author, ticketID)
}

func (s *Service) CloseTicket(ctx context.Context, user User, ticketID uint64) (Ticket, error) {
	ctx, cancel := s.context(ctx)
	defer cancel()
	err := s.db.WithTx(ctx, func(tx *sql.Tx) error {
		if _, err := lockTicket(ctx, tx, user, ticketID); err != nil {
			return err
		}
		_, err := tx.ExecContext(ctx, "UPDATE support_tickets SET status = ?, updated_at = ? WHERE id = ?", TicketClosed, s.now(), ticketID)
		return err
	})
	if err != nil {
		return Ticket{}, err
	}
	return s.Ticket(ctx, user, ticketID)
}

// lockTicket locks a ticket the user may act on: their own, or any ticket for
// an administrator. Anyone else's ticket is reported as not found.
func lockTicket(ctx context.Context, tx *sql.Tx, user User, ticketID uint64) (string, error) {
	var owner uint64
	var status string
	err := tx.QueryRowContext(ctx, "SELECT user_id, status FROM support_tickets WHERE id = ? FOR UPDATE", ticketID).Scan(&owner, &status)
	if errors.Is(err, sql.ErrNoRows) || (err == nil && user.Role != RoleAdmin && owner != user.ID) {
		return "", ErrNotFound
	}
	return status, err
}

const ticketColumns = `SELECT t.id, t.user_id, u.email, t.project_id, t.subject, t.status, t.priority, t.created_at, t.updated_at
	FROM support_tickets t JOIN users u ON u.id = t.user_id`

// Tickets lists a customer's tickets, or every ticket for an administrator,
// optionally in one status, most recently active first.
func (s *Service) Tickets(ctx context.Context, user User, status string, limit int) ([]Ticket, error) {
	ctx, cancel := s.context(ctx)
	defer cancel()
	where, args := []string{}, []any{}
	if user.Role != RoleAdmin {
		where, args = append(where, "t.user_id = ?"), append(args, user.ID)
	}
	if status != "" {
		where, args = append(where, "t.status = ?"), append(args, status)
	}
	query := ticketColumns
	if len(where) > 0 {
		query += " WHERE " + strings.Join(where, " AND ")
	}
	rows, err := s.db.Pool().QueryContext(ctx, query+" ORDER BY t.updated_at DESC, t.id DESC LIMIT ?", append(args, boundedLimit(limit))...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	tickets := []Ticket{}
	for rows.Next() {
		ticket, err := scanTicket(rows)
		if err != nil {
			return nil, err
		}
		tickets = append(tickets, ticket)
	}
	return tickets, rows.Err()
}

func scanTicket(row scanner) (Ticket, error) {
	var ticket Ticket
	var projectID sql.NullInt64
	if err := row.Scan(&ticket.ID, &ticket.UserID, &ticket.CustomerEmail, &projectID, &ticket.Subject, &ticket.Status, &ticket.Priority,
		&ticket.CreatedAt, &ticket.UpdatedAt); err != nil {
		return Ticket{}, err
	}
	ticket.ProjectID = uint64(projectID.Int64)
	return ticket, nil
}

// Ticket returns one ticket and its conversation to its customer or an
// administrator.
func (s *Service) Ticket(ctx context.Context, user User, ticketID uint64) (Ticket, error) {
	ctx, cancel := s.context(ctx)
	defer cancel()
	ticket, err := scanTicket(s.db.Pool().QueryRowContext(ctx, ticketColumns+" WHERE t.id = ?", ticketID))
	if errors.Is(err, sql.ErrNoRows) || (err == nil && user.Role != RoleAdmin && ticket.UserID != user.ID) {
		return Ticket{}, ErrNotFound
	}
	if err != nil {
		return Ticket{}, err
	}
	rows, err := s.db.Pool().QueryContext(ctx, `SELECT m.id, u.full_name, u.role, m.body, m.created_at FROM ticket_messages m JOIN users u ON u.id = m.author_id
		WHERE m.ticket_id = ? ORDER BY m.created_at, m.id`, ticketID)
	if err != nil {
		return Ticket{}, err
	}
	defer rows.Close()
	ticket.Messages = []TicketMessage{}
	for rows.Next() {
		var message TicketMessage
		if err := rows.Scan(&message.ID, &message.AuthorName, &message.AuthorRole, &message.Body, &message.CreatedAt); err != nil {
			return Ticket{}, err
		}
		ticket.Messages = append(ticket.Messages, message)
	}
	return ticket, rows.Err()
}
