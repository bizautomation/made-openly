import { badge, neutralBadge, parseSettings } from "./badge.js";
import { withinLimit } from "./generate.js";
import { recordDay } from "./sighting.js";

export const TOKEN_PATH = /^\/b\/([A-Za-z0-9]{16,64})\.svg$/;
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

// GET /b/:token.svg (SPEC.md 8.2). Records the place and the day, never the visitor.
export async function handleLiveBadge(request, env, token, url) {
  if (!(await withinLimit(env.RL_BADGE, request))) return new Response("Too many requests", { status: 429 });

  const db = env.DB;
  const row = await db.prepare("SELECT label, style, size, variant, host FROM badges WHERE token = ?").bind(token).first();
  if (!row) {
    const hint = parseSettings({ size: url.searchParams.get("z") ?? undefined, style: url.searchParams.get("s") ?? undefined });
    return svg(neutralBadge(hint?.size, hint?.style));
  }

  const look = lookFromQuery(row, url.searchParams);
  const body = () => badge(look.size, look.style, row.label, look.variant);

  // A HEAD request (link checkers) gets the badge but never binds or records.
  if (request.method === "HEAD") return svg(body());

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

  // A load from the place's own host is a sighting (SPEC.md 8.3).
  if (record) await recordDay(db, token);

  return svg(body());
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
