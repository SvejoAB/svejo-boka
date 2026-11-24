-- Owner settings per bookable person. Missing row = defaults from src/shared/config.ts.
CREATE TABLE settings (
  person TEXT PRIMARY KEY,
  min_notice_minutes INTEGER NOT NULL,
  -- JSON array of minutes before the meeting, e.g. [1440] for 24 h.
  reminder_minutes TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- One row per reminder sent, so the cron never sends the same one twice.
CREATE TABLE booking_reminders (
  booking_id TEXT NOT NULL,
  offset_minutes INTEGER NOT NULL,
  sent_at INTEGER NOT NULL,
  PRIMARY KEY (booking_id, offset_minutes)
);

-- The booker's cancel token, AES-GCM encrypted, so reminder emails can carry the cancel link.
ALTER TABLE bookings ADD COLUMN token_enc TEXT;
