// The Worker check (SPEC.md 8.3), one of the two signals that see a place.
// The Monday cron looks at every place; a 15-minute cron looks at new ones.
import { markSeen, sweepDormant } from "./sighting.js";
import { placesCte } from "./stats.js";
import { CONFIRMED_TOKEN } from "./tokenless.js";

export const USER_AGENT = "MadeOpenlyVerifier/1.0 (+https://madeopenly.com/#faq)";
const DAY_MS = 86_400_000;
const BATCH_SIZE = 6;
const BATCH_DELAY_MS = 500;
const MAX_PLACES_PER_RUN = 900; // stays under the per-invocation subrequest limit
const MAX_HTML_BYTES = 2_000_000;
const FETCH_TIMEOUT_MS = 10_000;
const RETRY_WAIT_S = 2;
const MAX_RETRY_WAIT_S = 5;

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

// True if the page carries this token in the badge link, the image src (SVG or PNG),
// a GitHub camo URL, or an image proxy that percent-encodes the original.
export function pageHasToken(html, token) {
  const link = new RegExp(`madeopenly\\.com/\\?t=${token}(?![A-Za-z0-9])`);
  const img = new RegExp(`madeopenly\\.com/b/${token}\\.(svg|png)`);
  const haystacks = [html, percentDecode(html), ...decodeCamoUrls(html)];
  return haystacks.some((h) => link.test(h) || img.test(h));
}

// "found" | "missing" | "unknown". Unknown (network error, timeout, 5xx, 429)
// never deletes anything; the place is checked again later. When given,
// `statuses` tallies HTTP status codes (0 for no response), for count-only logs.
// GitHub README through the official API (SPEC.md 8.3): the raw markdown,
// searched with the same matcher. GITHUB_TOKEN is optional.
export function githubRepo(declaredUrl) {
  if (!declaredUrl) return null;
  try {
    const u = new URL(declaredUrl);
    if (u.hostname !== "github.com" && u.hostname !== "www.github.com") return null;
    const [owner, repo] = u.pathname.split("/").filter(Boolean);
    return owner && repo ? `${owner}/${repo.replace(/\.git$/, "")}` : null;
  } catch {
    return null;
  }
}

// Where to look for a place, and how.
export function placeTarget(p, env = {}) {
  const repo = p.place_kind === "repo" ? githubRepo(p.declared_url) : null;
  if (repo) {
    const headers = { Accept: "application/vnd.github.raw" };
    if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
    return { url: `https://api.github.com/repos/${repo}/readme`, headers };
  }
  return { url: p.declared_url ?? `https://${p.host}/`, headers: {} };
}

async function checkPlace({ url, headers = {} }, token, statuses, sleep = sleepMs) {
  const tally = (code) => statuses && (statuses[code] = (statuses[code] ?? 0) + 1);
  const get = () =>
    fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,*/*;q=0.8", ...headers },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  let res;
  try {
    res = await get();
    // Some hosts (Substack) answer 429 to a first visit. Ask once more,
    // after the wait they name (capped), or after 2 seconds.
    if (res.status === 429) {
      tally("429-first");
      const wait = Math.min(Number(res.headers.get("Retry-After")) || RETRY_WAIT_S, MAX_RETRY_WAIT_S);
      await sleep(wait * 1000);
      res = await get();
    }
  } catch {
    tally(0);
    return "unknown";
  }
  tally(res.status);
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

// Look for each place and mark the ones found as seen. A failed check (404,
// 429, 5xx, network) only means "not seen this time": it never deletes and
// never changes a status.
async function checkPlaces(env, places, summary, { now, sleep, statuses = null }) {
  for (let i = 0; i < places.length; i += BATCH_SIZE) {
    if (i > 0) await sleep(BATCH_DELAY_MS);
    const batch = places.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map((p) => checkPlace(placeTarget(p, env), p.token, statuses, sleep)));
    for (let j = 0; j < batch.length; j++) {
      summary.checked++;
      if (results[j] === "found") {
        // Found on its own page: also clears a flag.
        await markSeen(env.DB, batch[j].token, now, { unflag: true });
        await env.DB.prepare("UPDATE badges SET last_verified = ? WHERE token = ?").bind(now.toISOString(), batch[j].token).run();
        summary.verified++;
      } else summary[results[j]]++;
    }
  }
}

// Every 15 minutes: look for places not active yet, bound or declared in the
// last 7 days, so a new badge counts within minutes. Then turn places with no
// sighting for 30 days dormant. Never deletes or snapshots.
export async function runNewCheck(env, { now = new Date(), sleep = sleepMs } = {}) {
  const since = new Date(now.getTime() - NEW_WINDOW_DAYS * DAY_MS).toISOString();
  const summary = { checked: 0, verified: 0, missing: 0, unknown: 0, statuses: {} };
  const { results: places } = await env.DB
    .prepare(
      `SELECT token, host, declared_url, place_kind FROM badges
       WHERE status <> 'active' AND (host IS NOT NULL OR declared_url IS NOT NULL)
         AND COALESCE(bound_at, created_at) >= ?
       ORDER BY COALESCE(bound_at, created_at) DESC LIMIT ?`,
    )
    .bind(since, MAX_NEW_PER_RUN)
    .all();
  await checkPlaces(env, places, summary, { now, sleep, statuses: summary.statuses });
  summary.dormant = await sweepDormant(env.DB, now);
  return summary;
}

// Mondays: look for every place, delete tokens never placed within 30 days
// (bot cleanup), and write the weekly snapshot. Places that were ever bound
// or declared are never deleted automatically (SPEC.md 8.3).
export async function runWeeklyCheck(env, { now = new Date(), sleep = sleepMs } = {}) {
  const db = env.DB;
  const cutoff = new Date(now.getTime() - 30 * DAY_MS).toISOString();
  const summary = { checked: 0, verified: 0, missing: 0, unknown: 0, cleaned: 0 };

  const stale = await db
    .prepare("SELECT token FROM badges WHERE host IS NULL AND declared_url IS NULL AND created_at < ?")
    .bind(cutoff)
    .all();
  for (const { token } of stale.results) await deleteToken(db, token);
  summary.cleaned = stale.results.length;
  await db.prepare("DELETE FROM key_attempts WHERE hour < ?").bind(new Date(now.getTime() - DAY_MS).toISOString().slice(0, 13)).run();

  const { results: places } = await db
    .prepare(
      `SELECT token, host, declared_url, place_kind FROM badges
       WHERE host IS NOT NULL OR declared_url IS NOT NULL
       ORDER BY COALESCE(last_verified, '') ASC LIMIT ?`,
    )
    .bind(MAX_PLACES_PER_RUN)
    .all();
  await checkPlaces(env, places, summary, { now, sleep });
  summary.dormant = await sweepDormant(db, now);

  await writeWeeklySnapshot(db, isoWeek(now));
  return summary;
}

// Anonymous snapshot for the growth line: counts only, no token or host.
// `verified` is the active count; added = active + dormant + unverified.
export async function writeWeeklySnapshot(db, week) {
  const { results } = await db
    .prepare(
      `${placesCte("status IN ('active', 'dormant', 'declared')")}
       SELECT label, place_kind AS kind,
         SUM(status = 'active') AS active, SUM(status = 'dormant') AS dormant, SUM(status = 'declared') AS unverified
       FROM places GROUP BY label, place_kind`,
    )
    .all();
  // Places with no badge ID are sites, added to the same rows, except those
  // a confirmed token place already counts (SPEC.md 8.6).
  const { results: tokenless } = await db
    .prepare(
      `SELECT label, SUM(status = 'active') AS active, SUM(status = 'dormant') AS dormant
       FROM tokenless_places t WHERE NOT ${CONFIRMED_TOKEN} GROUP BY label`,
    )
    .all();
  for (const t of tokenless) {
    const row = results.find((r) => r.label === t.label && r.kind === "site");
    if (row) (row.active += t.active), (row.dormant += t.dormant);
    else results.push({ label: t.label, kind: "site", active: t.active, dormant: t.dormant, unverified: 0 });
  }
  const stmts = [db.prepare("DELETE FROM weekly_counts WHERE week = ?").bind(week)];
  for (const r of results)
    stmts.push(
      db
        .prepare("INSERT INTO weekly_counts (week, label, kind, verified, added, dormant, unverified) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(week, r.label, r.kind, r.active, r.active + r.dormant + r.unverified, r.dormant, r.unverified),
    );
  await db.batch(stmts);
}
