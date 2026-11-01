-- Badges loaded with no token (SPEC.md 8.6): one place per site and label.
-- The host only, never the path or query. No IP address, user agent or
-- visitor identifier. Existing token places are not touched.
CREATE TABLE tokenless_places (
  host       TEXT NOT NULL,                -- lowercased, without "www."
  label      TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'active', -- active | dormant
  first_seen TEXT NOT NULL,                -- ISO timestamp of the first load
  last_seen  TEXT NOT NULL,                -- YYYY-MM-DD (UTC)
  copied     INTEGER NOT NULL DEFAULT 0,   -- 1 once a copied token was loaded here
  PRIMARY KEY (host, label)
);

-- One row per place per day it was seen, like `daily` for token places.
CREATE TABLE tokenless_daily (
  host  TEXT NOT NULL,
  label TEXT NOT NULL,
  day   TEXT NOT NULL,
  PRIMARY KEY (host, label, day)
);
