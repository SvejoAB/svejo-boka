-- Google connection per bookable person. The refresh token is AES-GCM encrypted.
CREATE TABLE accounts (
  person TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  person TEXT NOT NULL,
  start_at INTEGER NOT NULL,
  end_at INTEGER NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  lang TEXT NOT NULL DEFAULT 'sv',
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  event_id TEXT,
  meet_url TEXT,
  -- SHA-256 of the booker's cancel link token; the token itself is never stored.
  token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  cancelled_at INTEGER,
  cancelled_by TEXT
);
CREATE INDEX bookings_person_start ON bookings (person, start_at);
CREATE INDEX bookings_email ON bookings (person, email);

-- One row per claimed half-hour. The primary key is what stops two
-- overlapping bookings: both inserts race for the same cell and one fails.
CREATE TABLE booking_cells (
  person TEXT NOT NULL,
  cell_start INTEGER NOT NULL,
  booking_id TEXT NOT NULL,
  PRIMARY KEY (person, cell_start)
);
CREATE INDEX booking_cells_booking ON booking_cells (booking_id);

-- Manual open/close per half-hour, set from the owner calendar.
CREATE TABLE overrides (
  person TEXT NOT NULL,
  cell_start INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('open', 'close')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (person, cell_start)
);
