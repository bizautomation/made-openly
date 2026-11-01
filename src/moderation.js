// The public named list (SPEC.md 12). Only the list is moderated; counts never are.
import { ORIGIN, withinLimit } from "./generate.js";
import { sendMail } from "./mail.js";
import { placeName } from "./stats.js";

const LINK_DAYS = 14; // a link outlives one weekly email, not two
const DAY_MS = 86_400_000;
const TOKEN = /^[A-Za-z0-9]{16,64}$/;

// Each review action moves one state to another. A link only works while
// the place is still in the state it was sent for, so an old link cannot
// undo a later decision.
export const ACTIONS = {
  "list-approve": { from: "pending", to: "yes" },
  "list-reject": { from: "pending", to: "no" },
  "report-keep": { from: "reported", to: "yes" },
  "report-remove": { from: "reported", to: "removed" },
};

const enc = new TextEncoder();
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
const unb64url = (s) => Uint8Array.from(atob(s.replaceAll("-", "+").replaceAll("_", "/")), (c) => c.charCodeAt(0));

const hmacKey = (secret) => crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);

// k = base64url(JSON {t, a, exp}) "." base64url(HMAC-SHA256 of the first part)
export async function signReview(secret, token, action, now = new Date()) {
  const body = b64url(enc.encode(JSON.stringify({ t: token, a: action, exp: now.getTime() + LINK_DAYS * DAY_MS })));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(body)));
  return `${body}.${b64url(sig)}`;
}

// The payload if the signature is good and the link has not expired, else null.
export async function verifyReview(secret, k, now = new Date()) {
  if (!secret || typeof k !== "string") return null;
  const [body, sig, extra] = k.split(".");
  if (!body || !sig || extra !== undefined) return null;
  let payload;
  try {
    // crypto.subtle.verify compares in constant time.
    if (!(await crypto.subtle.verify("HMAC", await hmacKey(secret), unb64url(sig), enc.encode(body)))) return null;
    payload = JSON.parse(new TextDecoder().decode(unb64url(body)));
  } catch {
    return null;
  }
  if (!payload || !TOKEN.test(payload.t) || !ACTIONS[payload.a] || !(payload.exp > now.getTime())) return null;
  return payload;
}

async function readJson(request) {
  try {
    const input = await request.json();
    return input && typeof input === "object" && !Array.isArray(input) ? input : null;
  } catch {
    return null;
  }
}

// The cached /stats.json would show a reported place for up to an hour; drop it.
export const purgeStats = (env) => (env.STATS_CACHE === "off" ? null : caches.default.delete(new Request(`${ORIGIN}/stats.json`)));

// POST /api/list {token}: a place asks to be named. A place that has been
// seen waits for the owner's approval; one not seen yet waits for its first
// sighting first, like a place that asked at Generate.
export async function handleList(request, env) {
  const input = await readJson(request);
  if (!input) return Response.json({ error: "Send the form as JSON." }, { status: 400 });
  if (!(await withinLimit(env.RL_LIST, request)))
    return Response.json({ error: "Please wait a minute and try again." }, { status: 429 });
  if (typeof input.token !== "string" || !TOKEN.test(input.token))
    return Response.json({ error: "That doesn't look like a badge snippet or token." }, { status: 400 });

  const row = await env.DB.prepare("SELECT status, listed FROM badges WHERE token = ?").bind(input.token).first();
  if (!row) return Response.json({ error: "We couldn't find that badge." }, { status: 404 });
  if (row.listed === "removed") return Response.json({ error: "This place can't be named on the list." }, { status: 409 });
  const listed = await askToList(env.DB, input.token);
  return Response.json({ ok: true, listed });
}

// 'no' or 'asked' becomes 'pending' if the place was seen, else 'asked'.
// Any other listing state is left alone. Returns the state now.
export async function askToList(db, token) {
  await db
    .prepare(
      `UPDATE badges SET listed = CASE WHEN status IN ('active', 'dormant') THEN 'pending' ELSE 'asked' END
       WHERE token = ? AND listed IN ('no', 'asked')`,
    )
    .bind(token)
    .run();
  return (await db.prepare("SELECT listed FROM badges WHERE token = ?").bind(token).first())?.listed;
}

// POST /api/report {place}: hides a listed place at once, until the owner reviews it.
export async function handleReport(request, env, ctx) {
  const input = await readJson(request);
  if (!input) return Response.json({ error: "Send the form as JSON." }, { status: 400 });
  if (!(await withinLimit(env.RL_LIST, request)))
    return Response.json({ error: "Please wait a minute and try again." }, { status: 429 });
  if (typeof input.place !== "string" || !input.place || input.place.length > 2048)
    return Response.json({ error: "Which place?" }, { status: 400 });

  const { results } = await env.DB.prepare("SELECT token, host, declared_url FROM badges WHERE listed = 'yes'").all();
  const tokens = results.filter((r) => placeName(r) === input.place).map((r) => r.token);
  if (!tokens.length) return Response.json({ error: "That place isn't on the list." }, { status: 404 });

  await env.DB.batch(tokens.map((t) => env.DB.prepare("UPDATE badges SET listed = 'reported' WHERE token = ? AND listed = 'yes'").bind(t)));
  const purge = purgeStats(env);
  if (purge) ctx.waitUntil(purge);
  return Response.json({ ok: true });
}

const reviewPage = (status, message) =>
  new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Made Openly review</title><p style="font:16px/1.5 system-ui,sans-serif;margin:2rem">${message}</p>`, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });

// GET /admin/review?k=...: one-click Approve or Reject from the weekly email.
export async function handleReview(env, ctx, url, now = new Date()) {
  const payload = await verifyReview(env.ADMIN_SIGNING_KEY, url.searchParams.get("k"), now);
  if (!payload) return reviewPage(403, "This link is not valid or has expired. The next weekly email has fresh links.");

  const { from, to } = ACTIONS[payload.a];
  const res = await env.DB.prepare("UPDATE badges SET listed = ? WHERE token = ? AND listed = ?").bind(to, payload.t, from).run();
  if (res.meta.changes === 0) return reviewPage(409, "Nothing to do: this place was already reviewed.");
  const purge = purgeStats(env);
  if (purge) ctx.waitUntil(purge);
  const done = { yes: "It is now on the public list.", no: "It stays off the list.", removed: "It is removed from the list. It still counts." }[to];
  return reviewPage(200, `Done. ${done}`);
}

// Monday email: every pending and reported place, with signed links. Nothing is sent if there are none.
export async function sendReviewEmail(env, now = new Date()) {
  const { results } = await env.DB.prepare(
    "SELECT token, host, declared_url, label, place_kind, listed FROM badges WHERE listed IN ('pending', 'reported') ORDER BY listed, first_verified",
  ).all();
  // Not seen for a year: the owner decides whether to clear them. No button.
  const yearAgo = new Date(now.getTime() - 365 * DAY_MS).toISOString();
  const { n: stale } = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM badges
     WHERE (status = 'dormant' AND last_seen < ?) OR (status = 'declared' AND created_at < ?)`,
  )
    .bind(yearAgo.slice(0, 10), yearAgo)
    .first();
  if (!results.length && !stale) return 0;

  const link = async (token, action) => `${ORIGIN}/admin/review?k=${await signReview(env.ADMIN_SIGNING_KEY, token, action, now)}`;
  const lines = [];
  for (const kind of ["pending", "reported"]) {
    const rows = results.filter((r) => r.listed === kind);
    if (!rows.length) continue;
    lines.push(kind === "pending" ? "Asking to be named:" : "Reported (hidden until you decide):", "");
    for (const r of rows) {
      const [yes, no] = kind === "pending" ? ["list-approve", "list-reject"] : ["report-keep", "report-remove"];
      lines.push(
        `${placeName(r)} (${r.label}, ${r.place_kind})`,
        `  ${kind === "pending" ? "Approve" : "Keep listed"}: ${await link(r.token, yes)}`,
        `  ${kind === "pending" ? "Reject" : "Remove"}: ${await link(r.token, no)}`,
        "",
      );
    }
  }
  if (results.length) lines.push(`Links expire in ${LINK_DAYS} days.`, "");
  lines.push(`Places with no sighting for 12+ months: ${stale}`);
  await sendMail(env, { subject: `Made Openly: ${results.length} to review`, text: lines.join("\n") });
  return results.length;
}
