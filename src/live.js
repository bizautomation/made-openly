import { badge, neutralBadge, parseSettings } from "./badge.js";
import { withinLimit } from "./generate.js";
import { day, recordDay } from "./sighting.js";

export const TOKEN_PATH = /^\/b\/([A-Za-z0-9]{16,64})\.(svg|png)$/;
const LIVE_CACHE = "public, max-age=300";

// Hosts that never bind a token: previews, image proxies and this site itself.
const NO_BIND_SUFFIXES = [
  ".pages.dev",
  ".vercel.app",
  ".netlify.app",
  ".workers.dev",
  ".githubusercontent.com",
  ".ngrok.io",
  ".ngrok-free.app",
  ".trycloudflare.com",
  ".localhost",
];
const NO_BIND_HOSTS = ["localhost", "madeopenly.com", "madeopenly.bizat.co"];

// The host to bind from a Referer header, or null if it must not bind.
// "www." is dropped so www.example.com and example.com are one place.
export function bindableHost(referer) {
  if (!referer) return null;
  let host;
  try {
    const u = new URL(referer);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    host = u.hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return null;
  }
  if (host.startsWith("[") || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return null; // IP address
  if (!host.includes(".")) return null;
  if (host.startsWith("www.")) host = host.slice(4);
  if (NO_BIND_HOSTS.includes(host)) return null;
  if (NO_BIND_SUFFIXES.some((s) => host.endsWith(s))) return null;
  return host;
}

// The PNG twin of a badge: drawn ahead of time by scripts/render-pngs.js and
// served from public/png/, so no image is converted per request.
function png(env, name) {
  return env.ASSETS.fetch(new Request(`https://madeopenly.com/png/${name}.png`)).then((res) =>
    res.ok
      ? new Response(res.body, { headers: { "Content-Type": "image/png", "Cache-Control": LIVE_CACHE, "X-Content-Type-Options": "nosniff" } })
      : new Response("Not found", { status: 404 }),
  );
}

// GET /b/:token.svg or .png (SPEC.md 8.2). Records the place and the day, never the visitor.
export async function handleLiveBadge(request, env, token, url, format = "svg") {
  // Over the per-IP limit (often a shared proxy such as GitHub camo or Gmail):
  // still draw the badge, so the host page never shows a broken image, but
  // bind and record nothing. Floods are stopped earlier by the zone WAF rule.
  const limited = !(await withinLimit(env.RL_BADGE, request));

  const db = env.DB;
  const row = await db.prepare("SELECT label, style, size, variant, host, last_seen FROM badges WHERE token = ?").bind(token).first();
  if (!row) {
    const hint = parseSettings({ size: url.searchParams.get("z") ?? undefined, style: url.searchParams.get("s") ?? undefined }) ?? {};
    const size = hint.size ?? "large", style = hint.style ?? "light";
    return format === "png" ? png(env, `neutral-${style}-${size}`) : svg(neutralBadge(size, style));
  }

  const look = lookFromQuery(row, url.searchParams);
  const body = () =>
    format === "png" ? png(env, `${row.label}-${look.style}-${look.size}-${look.variant}`) : svg(badge(look.size, look.style, row.label, look.variant));

  // A HEAD request (link checkers) gets the badge but never binds or records.
  if (request.method === "HEAD" || limited) return body();

  const host = bindableHost(request.headers.get("Referer"));
  // Without a usable Referer the load cannot say where it is: draw, record nothing.
  let record = host !== null;
  if (host && !row.host) {
    // Bind only if still unbound, so two first loads cannot both bind.
    const now = new Date().toISOString();
    const res = await db
      .prepare(
        `UPDATE badges SET host = ?, bound_at = ?, verify_method = COALESCE(verify_method, 'live')
         WHERE token = ? AND host IS NULL`,
      )
      .bind(host, now, token)
      .run();
    if (res.meta.changes === 0) {
      const now = await db.prepare("SELECT host FROM badges WHERE token = ?").bind(token).first();
      record = now?.host === host;
      if (!record) await flag(db, token);
    }
  } else if (host && row.host !== host) {
    // Someone copied another place's snippet.
    record = false;
    await flag(db, token);
  }

  // A load from the place's own host is a sighting (SPEC.md 8.3). Once the
  // place is marked seen today, later loads skip the write: one read, no write.
  if (record && row.last_seen !== day()) await recordDay(db, token);

  return body();
}

// The label is the claim and always comes from storage. The look (s=style,
// z=size, v=variant) comes from the URL, so a site can swap themes; each
// missing or invalid value falls back to what was stored at Generate.
export function lookFromQuery(row, params) {
  const look = { style: row.style, size: row.size, variant: row.variant };
  for (const [key, param] of [["style", "s"], ["size", "z"], ["variant", "v"]]) {
    const value = params.get(param);
    if (value !== null && parseSettings({ ...look, label: row.label, [key]: value })) look[key] = value;
  }
  return look;
}

const flag = (db, token) => db.prepare("UPDATE badges SET status = 'flagged' WHERE token = ?").bind(token).run();

const svg = (body) =>
  new Response(body, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": LIVE_CACHE, "X-Content-Type-Options": "nosniff" },
  });
