// The badge key in use (SPEC.md 8.5): GET /manage and its API. The key, or a
// 6-digit code from it, proves ownership of one badge. With it the owner can
// take the place off Made Openly completely, or turn its listing on or off.
import { cleanDeclaredUrl, ORIGIN, withinLimit } from "./generate.js";
import { isCode, isKey, keyLookup, normalizeKey, recordFail, secretMatches, tooManyFails } from "./key.js";
import { sendMail } from "./mail.js";
import { askToList, purgeStats } from "./moderation.js";
import { placeName } from "./stats.js";
import { labelText } from "./badge.js";

const TOKEN = /^[A-Za-z0-9]{16,64}$/;
const MAX_CANDIDATES = 5;
const ROW = "SELECT token, label, host, declared_url, status, listed, key_enc, key_sent FROM badges";

async function readJson(request) {
  try {
    const input = await request.json();
    return input && typeof input === "object" && !Array.isArray(input) ? input : null;
  } catch {
    return null;
  }
}

const fail = (error, status) => Response.json({ error }, { status });
const WRONG = "That key or code doesn't match this badge.";
const LOCKED = "Too many tries for this badge. Please wait an hour.";

// The token in a pasted snippet, link or bare token, else null.
export function tokenIn(text) {
  const m = String(text).match(/[?&]t=([A-Za-z0-9]{16,64})|\/b\/([A-Za-z0-9]{16,64})\.svg|^\s*([A-Za-z0-9]{16,64})\s*$/);
  return m ? m[1] || m[2] || m[3] : null;
}

// Badges a "badge or page address" may mean: one token, or the places at an address.
async function candidates(db, place) {
  if (typeof place !== "string" || !place.trim() || place.length > 4096) return [];
  const token = tokenIn(place);
  if (token) {
    const row = await db.prepare(`${ROW} WHERE token = ?`).bind(token).first();
    return row ? [row] : [];
  }
  const raw = place.trim();
  const url = cleanDeclaredUrl(/^https?:\/\//i.test(raw) ? raw.replace(/^http:/i, "https:") : `https://${raw}`);
  if (!url) return [];
  const u = new URL(url);
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const { results } = await db
    .prepare(`${ROW} WHERE key_enc IS NOT NULL AND (declared_url IN (?, ?) OR (host = ? AND declared_url IS NULL)) LIMIT ?`)
    .bind(url, url.replace(/\/$/, ""), host, MAX_CANDIDATES)
    .all();
  return results;
}

// The badge this request proves it owns, or an error response.
async function authorize(env, input, now = new Date()) {
  const secret = typeof input.secret === "string" ? input.secret.trim() : "";
  if (!isKey(secret) && !isCode(secret)) return { error: fail("Enter your badge key or the 6-digit code.", 400) };
  if (!env.KEY_SECRET) return { error: fail("Badge keys are not available right now.", 503) };

  let rows;
  if (typeof input.token === "string" && TOKEN.test(input.token)) {
    const row = await env.DB.prepare(`${ROW} WHERE token = ?`).bind(input.token).first();
    rows = row ? [row] : [];
  } else if (input.place) {
    rows = await candidates(env.DB, input.place);
  } else if (isKey(secret)) {
    // A key alone finds its badge (the link in the key's QR and email).
    const row = await env.DB.prepare(`${ROW} WHERE key_lookup = ?`).bind(await keyLookup(env.KEY_SECRET, secret)).first();
    if (row) return { row };
    return { error: fail("That key doesn't match a badge.", 404) };
  } else return { error: fail("Enter the badge or page address too.", 400) };

  if (!rows.length) return { error: fail("We couldn't find that badge.", 404) };
  if (rows.every((r) => !r.key_enc))
    return { error: fail("This badge was made before keys existed. Write to us through the contact form and we'll help.", 409) };
  let tried = false;
  for (const row of rows) {
    if (await tooManyFails(env.DB, row.token, now)) continue;
    tried = true;
    if (await secretMatches(env.KEY_SECRET, row, secret, now)) return { row };
    if (row.key_enc) await recordFail(env.DB, row.token, now);
  }
  return { error: tried ? fail(WRONG, 403) : fail(LOCKED, 429) };
}

const view = (row) => ({
  token: row.token,
  place: placeName(row) ?? "Not placed yet",
  label: labelText(row.label),
  status: row.status,
  listed: row.listed,
});

// POST /api/manage {secret, token | place}: what the owner sees.
export async function handleManage(request, env) {
  const input = await readJson(request);
  if (!input) return fail("Send the form as JSON.", 400);
  if (!(await withinLimit(env.RL_KEY, request))) return fail("Please wait a minute and try again.", 429);
  const { row, error } = await authorize(env, input);
  return error ?? Response.json(view(row));
}

// POST /api/manage/remove {secret, token}: delete the place completely.
export async function handleRemove(request, env, ctx) {
  const input = await readJson(request);
  if (!input) return fail("Send the form as JSON.", 400);
  if (!(await withinLimit(env.RL_KEY, request))) return fail("Please wait a minute and try again.", 429);
  const { row, error } = await authorize(env, input);
  if (error) return error;
  await env.DB.batch([
    env.DB.prepare("DELETE FROM daily WHERE token = ?").bind(row.token),
    env.DB.prepare("DELETE FROM key_attempts WHERE token = ?").bind(row.token),
    env.DB.prepare("DELETE FROM badges WHERE token = ?").bind(row.token),
  ]);
  const purge = purgeStats(env);
  if (purge) ctx.waitUntil(purge);
  return Response.json({ ok: true });
}

// POST /api/manage/list {secret, token, on}: ask to be named, or come off the list.
export async function handleManageList(request, env, ctx) {
  const input = await readJson(request);
  if (!input) return fail("Send the form as JSON.", 400);
  if (!(await withinLimit(env.RL_KEY, request))) return fail("Please wait a minute and try again.", 429);
  const { row, error } = await authorize(env, input);
  if (error) return error;
  if (row.listed === "removed") return fail("This place can't be named on the list.", 409);
  if (input.on === true) await askToList(env.DB, row.token);
  else await env.DB.prepare("UPDATE badges SET listed = 'no' WHERE token = ? AND listed <> 'removed'").bind(row.token).run();
  const purge = purgeStats(env);
  if (purge) ctx.waitUntil(purge);
  return Response.json(view(await env.DB.prepare(`${ROW} WHERE token = ?`).bind(row.token).first()));
}

const EMAIL = /^[^\s@<>]{1,64}@[^\s@<>]{1,190}\.[^\s@<>]{2,}$/;

// POST /api/send-key {token, key, email}: email the key once. The address is
// used for this one send and never stored or logged.
export async function handleSendKey(request, env) {
  const input = await readJson(request);
  if (!input) return fail("Send the form as JSON.", 400);
  if (!(await withinLimit(env.RL_SENDKEY, request))) return fail("Please wait a while and try again.", 429);
  if (typeof input.email !== "string" || input.email.length > 254 || !EMAIL.test(input.email.trim()))
    return fail("Please enter an email address.", 400);
  if (!isKey(input.key) || typeof input.token !== "string" || !TOKEN.test(input.token)) return fail(WRONG, 403);
  const { row, error } = await authorize(env, { token: input.token, secret: input.key });
  if (error) return error;
  if (row.key_sent) return fail("We already emailed this key once.", 409);

  const key = normalizeKey(input.key);
  const claim = await env.DB.prepare("UPDATE badges SET key_sent = 1 WHERE token = ? AND key_sent = 0").bind(row.token).run();
  if (!claim.meta.changes) return fail("We already emailed this key once.", 409);
  const sent = await sendMail(env, {
    to: input.email.trim(),
    subject: "Your Made Openly badge key",
    text: [
      "Here is the key for your Made Openly badge.",
      "",
      `Open it: ${ORIGIN}/manage#k=${key}`,
      `Key: ${key}`,
      "",
      "With it you can take your place off Made Openly, or change it later. Keep it private. We don't keep your email address.",
    ].join("\n"),
  });
  if (!sent) {
    await env.DB.prepare("UPDATE badges SET key_sent = 0 WHERE token = ?").bind(row.token).run();
    return fail("That didn't send. Please try again.", 502);
  }
  return Response.json({ ok: true });
}

const MANAGE_CSS = `
.manage{padding:40px 0 56px}
.manage h1{margin:0 0 6px;font-size:32px;line-height:1.2}
.manage label{display:block;font-weight:600;margin:16px 0 6px}
.panel{background:#fff;border:1px solid var(--line);border-radius:10px;padding:16px 18px;margin:20px 0 0}
.panel dl{display:grid;grid-template-columns:max-content 1fr;gap:6px 16px;margin:0 0 16px}
.panel dt{color:var(--ink-soft)}
.panel dd{margin:0;font-weight:600;overflow-wrap:anywhere}
.actions{display:flex;flex-wrap:wrap;gap:10px}
.btn.danger{background:#fff;color:var(--alert);border:1px solid var(--line);padding:8px 14px;font-size:15px}
.btn.danger:hover{border-color:var(--alert)}
`;

export function managePage(shell, csp) {
  const html = `${shell.head.replace(/<title>.*<\/title>/, "<title>Manage your badge</title>").replace("__HEAD_TAGS__", "")}${MANAGE_CSS}</style>
<meta name="robots" content="noindex">
</head>
<body>
${shell.nav}
<main id="top">
<section class="manage">
  <div class="wrap">
    <h1>Manage your badge</h1>
    <p class="soft">Use the key you kept when you made the badge.</p>
    <form id="find" novalidate>
      <label for="place">Badge or page address</label>
      <input type="text" id="place" autocomplete="off" placeholder="Snippet, token or https://…">
      <label for="secret">Key or 6-digit code</label>
      <input type="text" id="secret" autocomplete="off" autocapitalize="characters" spellcheck="false">
      <p style="margin-top:14px"><button class="btn" type="submit">Open</button></p>
      <p class="error" id="find-msg" role="status"></p>
    </form>
    <div class="panel" id="panel" hidden>
      <dl>
        <dt>Place</dt><dd id="v-place"></dd>
        <dt>Badge</dt><dd id="v-label"></dd>
        <dt>Counting</dt><dd id="v-status"></dd>
        <dt>Public list</dt><dd id="v-listed"></dd>
      </dl>
      <div class="actions">
        <button class="btn quiet" type="button" id="list-toggle"></button>
        <button class="btn danger" type="button" id="remove">Remove from Made Openly</button>
      </div>
      <p class="error" id="panel-msg" role="status"></p>
    </div>
    <p class="ok" id="done" role="status" hidden>Done. Your place is off Made Openly: no count, no listing, no data. The badge on your page now shows a plain Made Openly mark. Take it off your page whenever you like.</p>
  </div>
</section>
</main>
${shell.footer}
<script>
const $ = (id) => document.getElementById(id);
const STATUS = { active: "Yes, we can see the badge there now", dormant: "Not seen lately", declared: "Not verified yet", new: "Not placed yet", flagged: "On hold" };
const LISTED = { no: "Not named", asked: "Asked: waits until we see the badge", pending: "Waiting for approval", yes: "Named on the list", reported: "Hidden while we review a report", removed: "Kept off the list" };
let auth = null;
async function post(path, body) {
  try {
    const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: res.ok, data: await res.json() };
  } catch { return { ok: false, data: {} }; }
}
function show(v) {
  $("find").hidden = true;
  $("panel").hidden = false;
  $("v-place").textContent = v.place;
  $("v-label").textContent = v.label;
  $("v-status").textContent = STATUS[v.status] || v.status;
  $("v-listed").textContent = LISTED[v.listed] || v.listed;
  const on = ["asked", "pending", "yes", "reported"].includes(v.listed);
  $("list-toggle").textContent = on ? "Take it off the list" : "Name it on the list";
  $("list-toggle").dataset.on = on ? "1" : "";
  $("list-toggle").hidden = v.listed === "removed";
  auth = { token: v.token, secret: auth.secret };
}
async function open(body) {
  auth = { secret: body.secret };
  const { ok, data } = await post("/api/manage", body);
  if (ok) return show(data);
  $("find").hidden = false;
  $("find-msg").textContent = data.error || "That didn't work. Please try again.";
}
const k = new URLSearchParams(location.hash.slice(1)).get("k");
if (k) {
  history.replaceState(null, "", location.pathname);
  $("secret").value = k;
  open({ secret: k });
}
$("find").addEventListener("submit", (e) => {
  e.preventDefault();
  $("find-msg").textContent = "";
  open({ place: $("place").value, secret: $("secret").value });
});
$("list-toggle").addEventListener("click", async () => {
  const { ok, data } = await post("/api/manage/list", { ...auth, on: !$("list-toggle").dataset.on });
  if (ok) show(data);
  else $("panel-msg").textContent = data.error || "That didn't work. Please try again.";
});
$("remove").addEventListener("click", async (e) => {
  const b = e.currentTarget;
  if (!b.dataset.sure) {
    b.dataset.sure = "1";
    b.textContent = "Yes, remove it completely";
    $("panel-msg").textContent = "This deletes the place, its count and its listing. It can't be undone.";
    return;
  }
  const { ok, data } = await post("/api/manage/remove", auth);
  if (!ok) { $("panel-msg").textContent = data.error || "That didn't work. Please try again."; return; }
  $("panel").hidden = true;
  $("done").hidden = false;
});
</script>
</body>
</html>
`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": csp,
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
