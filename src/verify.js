// Verification (SPEC.md 8.3). The Monday cron runs the full weekly check;
// a 15-minute cron verifies new places quickly, and only ever verifies.

export const USER_AGENT = "MadeOpenlyVerifier/1.0 (+https://madeopenly.com/#faq)";
const DAY_MS = 86_400_000;
const BATCH_SIZE = 6;
const BATCH_DELAY_MS = 500;
const MAX_PLACES_PER_RUN = 900; // stays under the per-invocation subrequest limit
const MAX_HTML_BYTES = 2_000_000;
const FETCH_TIMEOUT_MS = 10_000;

const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

// ISO 8601 week, e.g. "2026-W44".
export function isoWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d - Date.UTC(year, 0, 1)) / DAY_MS + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

// GitHub camo URLs carry the original image URL hex-encoded in the last path segment:
// https://camo.githubusercontent.com/<digest>/<hex of original URL>
export function decodeCamoUrls(html) {
  const out = [];
  for (const m of html.matchAll(/camo\.githubusercontent\.com\/[0-9a-f]+\/([0-9a-f]+)/gi)) {
    const hex = m[1];
    if (hex.length % 2) continue;
    let s = "";
    for (let i = 0; i < hex.length; i += 2) s += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
    out.push(s);
  }
  return out;
}

function percentDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s.replace(/%2F/gi, "/").replace(/%3A/gi, ":").replace(/%3F/gi, "?").replace(/%3D/gi, "=");
  }
}

// True if the page carries this token in the badge link, the image src,
// a GitHub camo URL, or an image proxy that percent-encodes the original.
export function pageHasToken(html, token) {
  const link = new RegExp(`madeopenly\\.com/\\?t=${token}(?![A-Za-z0-9])`);
  const img = new RegExp(`madeopenly\\.com/b/${token}\\.svg`);
  const haystacks = [html, percentDecode(html), ...decodeCamoUrls(html)];
  return haystacks.some((h) => link.test(h) || img.test(h));
}

// "found" | "missing" | "unknown". Unknown (network error, timeout, 5xx, 429)
// never deletes anything; the place is checked again next week.
async function checkPlace(url, token) {
  let res;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*;q=0.5" },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    return "unknown";
  }
  if (res.status === 404 || res.status === 410) return "missing";
  if (!res.ok) return "unknown";
  let html;
  try {
    html = await readCapped(res);
  } catch {
    return "unknown";
  }
  return pageHasToken(html, token) ? "found" : "missing";
}

async function readCapped(res) {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let html = "";
  let bytes = 0;
  while (bytes < MAX_HTML_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    html += decoder.decode(value, { stream: true });
  }
  reader.cancel().catch(() => {});
  return html;
}

async function deleteToken(db, token) {
  await db.batch([
    db.prepare("DELETE FROM daily WHERE token = ?").bind(token),
    db.prepare("DELETE FROM badges WHERE token = ?").bind(token),
  ]);
}

const NEW_WINDOW_DAYS = 7;
const MAX_NEW_PER_RUN = 50;

async function markVerified(db, token, nowIso) {
  await db
    .prepare("UPDATE badges SET status = 'verified', last_verified = ?, first_verified = COALESCE(first_verified, ?) WHERE token = ?")
    .bind(nowIso, nowIso, token)
    .run();
}

// Every 15 minutes: look for places not yet verified, bound or declared in the
// last 7 days, so a new badge counts within minutes instead of by next Monday.
// It never deletes, releases or snapshots; that stays with the weekly check.
export async function runNewCheck(env, { now = new Date(), sleep = sleepMs } = {}) {
  const db = env.DB;
  const nowIso = now.toISOString();
  const since = new Date(now.getTime() - NEW_WINDOW_DAYS * DAY_MS).toISOString();
  const summary = { checked: 0, verified: 0 };
  const { results: places } = await db
    .prepare(
      `SELECT token, host, declared_url FROM badges
       WHERE status <> 'verified' AND (host IS NOT NULL OR declared_url IS NOT NULL)
         AND COALESCE(bound_at, created_at) >= ?
       ORDER BY COALESCE(bound_at, created_at) DESC LIMIT ?`,
    )
    .bind(since, MAX_NEW_PER_RUN)
    .all();

  for (let i = 0; i < places.length; i += BATCH_SIZE) {
    if (i > 0) await sleep(BATCH_DELAY_MS);
    const batch = places.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map((p) => checkPlace(p.declared_url ?? `https://${p.host}/`, p.token)));
    for (let j = 0; j < batch.length; j++) {
      summary.checked++;
      if (results[j] === "found") {
        await markVerified(db, batch[j].token, nowIso);
        summary.verified++;
      }
    }
  }
  return summary;
}

export async function runWeeklyCheck(env, { now = new Date(), sleep = sleepMs } = {}) {
  const db = env.DB;
  const nowIso = now.toISOString();
  const cutoff = new Date(now.getTime() - 30 * DAY_MS).toISOString();
  const summary = { checked: 0, verified: 0, removed: 0, released: 0, unknown: 0, cleaned: 0 };

  // 6. Never bound or declared after 30 days: delete.
  const stale = await db
    .prepare("SELECT token FROM badges WHERE host IS NULL AND declared_url IS NULL AND created_at < ?")
    .bind(cutoff)
    .all();
  for (const { token } of stale.results) await deleteToken(db, token);
  summary.cleaned = stale.results.length;

  const { results: places } = await db
    .prepare(
      `SELECT token, host, declared_url, first_verified, bound_at FROM badges
       WHERE host IS NOT NULL OR declared_url IS NOT NULL
       ORDER BY COALESCE(last_verified, '') ASC LIMIT ?`,
    )
    .bind(MAX_PLACES_PER_RUN)
    .all();

  for (let i = 0; i < places.length; i += BATCH_SIZE) {
    if (i > 0) await sleep(BATCH_DELAY_MS);
    const batch = places.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map((p) => checkPlace(p.declared_url ?? `https://${p.host}/`, p.token)));

    for (let j = 0; j < batch.length; j++) {
      const p = batch[j];
      const result = results[j];
      summary.checked++;
      if (result === "found") {
        // 3. Found: verified (this also clears a flag).
        await markVerified(db, p.token, nowIso);
        summary.verified++;
      } else if (result === "missing" && p.first_verified) {
        // 4. Removed from a verified place: that is the opt-out.
        await deleteToken(db, p.token);
        summary.removed++;
      } else if (result === "missing" && p.host && p.bound_at && p.bound_at < cutoff) {
        // 5. Never found, bound over 30 days ago: release so it can bind again.
        await db
          .prepare(
            `UPDATE badges SET host = NULL, bound_at = NULL, status = 'new',
               verify_method = CASE WHEN declared_url IS NULL THEN NULL ELSE verify_method END
             WHERE token = ?`,
          )
          .bind(p.token)
          .run();
        summary.released++;
      } else if (result === "unknown") {
        summary.unknown++;
      }
    }
  }

  await writeWeeklySnapshot(db, isoWeek(now));
  return summary;
}

// Anonymous snapshot for the growth line: counts only, no token or host.
export async function writeWeeklySnapshot(db, week) {
  const { results } = await db
    .prepare("SELECT label, place_kind AS kind, COUNT(*) AS n FROM badges WHERE status = 'verified' GROUP BY label, place_kind")
    .all();
  const stmts = [db.prepare("DELETE FROM weekly_counts WHERE week = ?").bind(week)];
  for (const r of results)
    stmts.push(db.prepare("INSERT INTO weekly_counts (week, label, kind, verified) VALUES (?, ?, ?, ?)").bind(week, r.label, r.kind, r.n));
  await db.batch(stmts);
}
