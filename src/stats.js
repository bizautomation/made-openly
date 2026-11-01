// GET /stats.json (SPEC.md 10). Public, counts places only, cached about an hour.
// The original keys (total_verified, by_label, ...) count active places.
import { LABEL_SLUGS } from "./badge.js";
import { isoWeek } from "./verify.js";

export const KINDS = ["site", "repo", "post", "product"];
const CACHE_SECONDS = 3600;
const DAY_MS = 86_400_000;
const LISTED_CAP = 200; // newest first; the /places page has the rest

const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
const zeroKinds = () => Object.fromEntries(KINDS.map((k) => [k, 0]));

// The public name of a place: its declared address without the scheme, or its host.
// Where it lives. Declared addresses are https-only (generate.js).
export const placeUrl = (r) => r.declared_url ?? `https://${r.host}/`;

export const placeName = (r) => (r.declared_url ? r.declared_url.replace(/^https:\/\//, "").replace(/\/$/, "") : r.host);

export async function buildStats(db, { now = new Date(), since = null } = {}) {
  const sinceIso = since ? `${since}T00:00:00.000Z` : "";
  // Active places count. Added = active + dormant + declared ("not verified yet").
  const { results: counts } = await db
    .prepare(
      `SELECT label, place_kind AS kind, status, COUNT(*) AS n FROM badges
       WHERE status IN ('active', 'dormant', 'declared') AND COALESCE(first_verified, created_at) >= ?
       GROUP BY label, place_kind, status`,
    )
    .bind(sinceIso)
    .all();

  const byLabel = Object.fromEntries(LABEL_SLUGS.map((l) => [l, 0]));
  const byKind = zeroKinds();
  const byLabelKind = Object.fromEntries(LABEL_SLUGS.map((l) => [l, zeroKinds()]));
  const zeroLabels = () => Object.fromEntries(LABEL_SLUGS.map((l) => [l, 0]));
  const byStatusLabel = { active: zeroLabels(), dormant: zeroLabels(), unverified: zeroLabels() };
  let total = 0;
  for (const { label, kind, status, n } of counts) {
    if (!(label in byLabel) || !(kind in byKind)) continue;
    byStatusLabel[status === "declared" ? "unverified" : status][label] += n;
    if (status !== "active") continue;
    byLabel[label] += n;
    byKind[kind] += n;
    byLabelKind[label][kind] += n;
    total += n;
  }

  const { results: weekly } = await db
    .prepare(
      `SELECT week, SUM(verified) AS verified, SUM(added) AS added, SUM(dormant) AS dormant, SUM(unverified) AS unverified
       FROM weekly_counts WHERE week >= ? GROUP BY week ORDER BY week`,
    )
    .bind(since ? isoWeek(new Date(sinceIso)) : "")
    .all();

  const weekAgo = new Date(now.getTime() - 7 * DAY_MS).toISOString();
  const { n: newLast7 } = await db
    .prepare("SELECT COUNT(*) AS n FROM badges WHERE status = 'active' AND first_verified >= ?")
    .bind(sinceIso > weekAgo ? sinceIso : weekAgo)
    .first();

  const { results: listedRows } = await db
    .prepare(
      `SELECT host, declared_url, label, place_kind, first_verified FROM badges
       WHERE status = 'active' AND listed = 'yes' AND first_verified >= ?
       ORDER BY first_verified DESC, token LIMIT ?`,
    )
    .bind(sinceIso, LISTED_CAP)
    .all();
  const { n: listedTotal } = await db
    .prepare("SELECT COUNT(*) AS n FROM badges WHERE status = 'active' AND listed = 'yes' AND first_verified >= ?")
    .bind(sinceIso)
    .first();

  return {
    updated: now.toISOString().replace(/\.\d{3}Z$/, "Z"),
    total_verified: total,
    by_label: byLabel,
    by_kind: byKind,
    by_label_kind: byLabelKind,
    added_total: sum(byStatusLabel.active) + sum(byStatusLabel.dormant) + sum(byStatusLabel.unverified),
    dormant_total: sum(byStatusLabel.dormant),
    unverified_total: sum(byStatusLabel.unverified),
    by_status_label: byStatusLabel,
    weekly: weekly.map((w) => ({ week: w.week, verified: w.verified, added: w.added, dormant: w.dormant, unverified: w.unverified })),
    new_last_7_days: newLast7,
    listed_total: listedTotal,
    listed: listedRows.map((r) => ({ place: placeName(r), url: placeUrl(r), label: r.label, kind: r.place_kind, since: r.first_verified.slice(0, 10) })),
  };
}

export async function handleStats(request, env, ctx, url) {
  const since = url.searchParams.get("since");
  if (since !== null && !/^\d{4}-\d{2}-\d{2}$/.test(since))
    return Response.json({ error: "since must be YYYY-MM-DD" }, { status: 400 });

  const useCache = env.STATS_CACHE !== "off";
  const cacheKey = new Request(url.toString(), { method: "GET" });
  if (useCache) {
    const hit = await caches.default.match(cacheKey);
    if (hit) return hit;
  }

  const body = await buildStats(env.DB, { since });
  const res = Response.json(body, {
    headers: { "Cache-Control": `public, max-age=${CACHE_SECONDS}`, "Access-Control-Allow-Origin": "*" },
  });
  if (useCache) ctx.waitUntil(caches.default.put(cacheKey, res.clone()));
  return res;
}
