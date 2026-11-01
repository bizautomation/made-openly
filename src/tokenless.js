// Badges with no token (SPEC.md 8.6): a load of /badge.svg from another site,
// or a copied token loaded on a second site, counts as a place keyed by that
// site's host and the label shown. The host only; nothing about the visitor.
// A tokenless place is never merged into a token place and never taken over.
import { day } from "./sighting.js";

// The host of a badge's declared address, lowercased and without "www.".
// Declared addresses are normalised https URLs (generate.js), so the host
// runs from character 9 to the next "/".
const DH = "substr(declared_url, 9, instr(substr(declared_url, 9), '/') - 1)";
const DECLARED_HOST = `CASE WHEN ${DH} LIKE 'www.%' THEN substr(${DH}, 5) ELSE ${DH} END`;

// A token place on the same host (bound or declared) with the same label as
// tokenless place `t`. Confirmed means our own check found the token on that
// site's page; a Referer is never proof. A confirmed one makes the counter
// count that site and label once. An unconfirmed one may be the same place,
// counted twice, and /stats.json says how many.
const sameSite = (confirmed) => `EXISTS (
    SELECT 1 FROM badges WHERE label = t.label AND status IN ('active', 'dormant', 'declared')
      AND last_verified IS ${confirmed ? "NOT NULL" : "NULL"}
      AND (host = t.host OR (declared_url IS NOT NULL AND ${DECLARED_HOST} = t.host)))`;
export const CONFIRMED_TOKEN = sameSite(true);
export const UNCONFIRMED_TOKEN = sameSite(false);

// One sighting: once a day per host and label. `copied` marks a load of
// another place's token, so those can be counted openly.
export async function recordTokenless(db, host, label, { copied = false } = {}, now = new Date()) {
  const today = day(now);
  const row = await db.prepare("SELECT last_seen, copied FROM tokenless_places WHERE host = ? AND label = ?").bind(host, label).first();
  if (row?.last_seen === today && (row.copied || !copied)) return; // already seen today: no write
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO tokenless_daily (host, label, day) VALUES (?, ?, ?)").bind(host, label, today),
    db
      .prepare(
        `INSERT INTO tokenless_places (host, label, status, first_seen, last_seen, copied) VALUES (?1, ?2, 'active', ?3, ?4, ?5)
         ON CONFLICT (host, label) DO UPDATE SET status = 'active', last_seen = excluded.last_seen, copied = MAX(copied, excluded.copied)`,
      )
      .bind(host, label, now.toISOString(), today, copied ? 1 : 0),
  ]);
}
