// Active and dormant places (SPEC.md 8.3). A place counts while either signal
// sees it: its badge loading or being clicked from its own host, or the
// Worker check finding the token on the page. Nothing here ever deletes.

export const DORMANT_DAYS = 30;
const DAY_MS = 86_400_000;

export const day = (now = new Date()) => now.toISOString().slice(0, 10);

// One sighting: the place is active and last seen today. A place that asked
// to be named at Generate now waits for the owner's approval. A flagged place
// (its snippet was seen on another host) stays flagged unless the Worker
// check finds it on its own page.
export async function markSeen(db, token, now = new Date(), { unflag = false } = {}) {
  const iso = now.toISOString();
  await db
    .prepare(
      `UPDATE badges SET status = 'active', last_seen = ?,
         first_verified = COALESCE(first_verified, ?),
         listed = CASE WHEN listed = 'asked' THEN 'pending' ELSE listed END
       WHERE token = ? AND (status <> 'flagged' OR ?)`,
    )
    .bind(day(now), iso, token, unflag ? 1 : 0)
    .run();
}

// A badge load or click from the place's own host: one row per token per
// day, and the first one each day is a sighting. Nothing about the visitor.
export async function recordDay(db, token, now = new Date()) {
  const res = await db.prepare("INSERT OR IGNORE INTO daily (token, day) VALUES (?, ?)").bind(token, day(now)).run();
  if (res.meta.changes) await markSeen(db, token, now);
}

// Active places with no sighting for 30 days become dormant. They keep their
// record and listing approval, and turn active again at the next sighting.
export async function sweepDormant(db, now = new Date()) {
  const cutoff = day(new Date(now.getTime() - DORMANT_DAYS * DAY_MS));
  const res = await db.prepare("UPDATE badges SET status = 'dormant' WHERE status = 'active' AND last_seen < ?").bind(cutoff).run();
  return res.meta.changes;
}
