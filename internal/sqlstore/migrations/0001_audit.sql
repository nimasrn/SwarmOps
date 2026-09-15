-- Audit ledger. Logically append-only: the application inserts events and
-- trims only the oldest beyond the configured retention bound.

CREATE TABLE audit_events (
  seq BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id CHAR(32) NOT NULL,
  occurred_at DATETIME(6) NOT NULL,
  actor VARCHAR(190) NOT NULL,
  action VARCHAR(190) NOT NULL,
  target VARCHAR(512) NOT NULL,
  outcome VARCHAR(64) NOT NULL,
  request_id VARCHAR(128) NULL,
  PRIMARY KEY (seq),
  UNIQUE KEY uq_audit_events_id (id),
  KEY ix_audit_events_occurred_at (occurred_at),
  KEY ix_audit_events_actor (actor, occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row per detail key keeps the event table in first normal form instead
-- of storing a serialised map in a column.
CREATE TABLE audit_event_details (
  event_seq BIGINT UNSIGNED NOT NULL,
  detail_key VARCHAR(190) NOT NULL,
  detail_value TEXT NOT NULL,
  PRIMARY KEY (event_seq, detail_key),
  CONSTRAINT fk_audit_event_details_event FOREIGN KEY (event_seq)
    REFERENCES audit_events (seq) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
