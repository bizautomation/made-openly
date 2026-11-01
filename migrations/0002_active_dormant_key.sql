-- Active and dormant places, listing at Generate, and the badge key (SPEC.md 7).
-- No IP address, user agent, email address or visitor identifier is stored.

-- The latest day (YYYY-MM-DD, UTC) any signal saw the place.
ALTER TABLE badges ADD COLUMN last_seen TEXT;
-- The badge key, AES-GCM encrypted under the KEY_SECRET Worker secret
-- (base64 of iv || ciphertext), and an HMAC of it to find the badge by key.
ALTER TABLE badges ADD COLUMN key_enc TEXT;
ALTER TABLE badges ADD COLUMN key_lookup TEXT;
-- 1 once the key was emailed (one send per badge). The address is never kept.
ALTER TABLE badges ADD COLUMN key_sent INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX badges_key_lookup ON badges(key_lookup);

-- Key or code attempts per badge per hour (guessing limit). No IP.
CREATE TABLE key_attempts (
  token TEXT NOT NULL,
  hour  TEXT NOT NULL,                     -- YYYY-MM-DDTHH (UTC)
  count INTEGER NOT NULL,
  PRIMARY KEY (token, hour)
);

-- The weekly snapshot gains every added place, not only the counted ones.
ALTER TABLE weekly_counts ADD COLUMN added INTEGER NOT NULL DEFAULT 0;
ALTER TABLE weekly_counts ADD COLUMN dormant INTEGER NOT NULL DEFAULT 0;
ALTER TABLE weekly_counts ADD COLUMN unverified INTEGER NOT NULL DEFAULT 0;

-- Statuses become new | active | dormant | declared | flagged.
-- Verified places are active, last seen when last verified.
UPDATE badges SET status = 'active', last_seen = substr(last_verified, 1, 10) WHERE status = 'verified';
-- Bound places were seen by their badge loading: active while that was
-- within 30 days, otherwise dormant.
UPDATE badges SET last_seen = (SELECT MAX(day) FROM daily WHERE daily.token = badges.token) WHERE status = 'bound';
UPDATE badges SET status = CASE
    WHEN last_seen >= strftime('%Y-%m-%d', 'now', '-30 days') THEN 'active'
    WHEN last_seen IS NOT NULL THEN 'dormant'
    WHEN declared_url IS NOT NULL THEN 'declared'
    ELSE 'new' END
  WHERE status = 'bound';
UPDATE badges SET first_verified = COALESCE(first_verified, last_seen || 'T00:00:00.000Z') WHERE status IN ('active', 'dormant');
-- Declared but never seen.
UPDATE badges SET status = 'declared' WHERE status = 'new' AND declared_url IS NOT NULL;
