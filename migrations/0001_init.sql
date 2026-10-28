-- Made Openly schema (SPEC.md section 7).
-- No IP address, user agent or visitor identifier is stored anywhere.

CREATE TABLE badges (
  token          TEXT PRIMARY KEY,
  label          TEXT NOT NULL,
  style          TEXT NOT NULL,
  size           TEXT NOT NULL,
  variant        TEXT NOT NULL,
  mascot         TEXT NOT NULL DEFAULT 'robot',
  host           TEXT,
  declared_url   TEXT,
  place_kind     TEXT NOT NULL DEFAULT 'site',
  verify_method  TEXT,
  status         TEXT NOT NULL DEFAULT 'new',
  listed         TEXT NOT NULL DEFAULT 'no',
  created_at     TEXT NOT NULL,
  bound_at       TEXT,
  first_verified TEXT,
  last_verified  TEXT
);
CREATE INDEX badges_host ON badges(host);
CREATE INDEX badges_status ON badges(status);

CREATE TABLE daily (
  token TEXT NOT NULL,
  day   TEXT NOT NULL,
  PRIMARY KEY (token, day)
);

CREATE TABLE messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT,
  email      TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Anonymous weekly snapshot written by the Monday check: counts only,
-- no token or host, so removing a badge still deletes all of its data.
CREATE TABLE weekly_counts (
  week     TEXT NOT NULL,
  label    TEXT NOT NULL,
  kind     TEXT NOT NULL,
  verified INTEGER NOT NULL,
  PRIMARY KEY (week, label, kind)
);
