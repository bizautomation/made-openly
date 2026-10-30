import { DIMENSIONS, labelText, parseSettings } from "./badge.js";
import registry from "../mascots/registry.json";

export const ORIGIN = "https://madeopenly.com";
const MAX_TOKEN_TRIES = 3;
const MAX_URL_LENGTH = 2048;

export const newToken = () => crypto.randomUUID().replaceAll("-", "");

// SPEC.md 8.4. A ticked "This is a product" wins over the address.
export function placeKind(declaredUrl, isProduct) {
  if (isProduct) return "product";
  if (!declaredUrl) return "site";
  const u = new URL(declaredUrl);
  const host = u.hostname.toLowerCase();
  const segments = u.pathname.split("/").filter(Boolean);
  if ((host === "github.com" || host === "www.github.com") && segments.length >= 2) return "repo";
  if (host.endsWith(".substack.com") || host === "medium.com" || host.endsWith(".medium.com")) return "post";
  return "site";
}

// Returns a normalised https URL, or null if the address is not acceptable.
export function cleanDeclaredUrl(value) {
  if (typeof value !== "string" || value.length > MAX_URL_LENGTH) return null;
  let u;
  try {
    u = new URL(value.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || !u.hostname.includes(".") || u.username || u.password) return null;
  u.hash = "";
  return u.toString();
}

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const MAX_TURNSTILE_TOKEN = 2048;

// Server-side Turnstile check. Fails closed: the token must verify, come from
// the expected form (action) and from one of our own pages (hostname).
// The visitor's IP is optional for siteverify and is deliberately not sent.
export async function verifyTurnstile(env, token, action) {
  const hostnames = (env.TURNSTILE_HOSTNAMES ?? "").split(",").map((h) => h.trim()).filter(Boolean);
  if (!env.TURNSTILE_SECRET || !hostnames.length) return false;
  if (typeof token !== "string" || !token || token.length > MAX_TURNSTILE_TOKEN) return false;
  const body = new FormData();
  body.append("secret", env.TURNSTILE_SECRET);
  body.append("response", token);
  try {
    const res = await fetch(SITEVERIFY, { method: "POST", body, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return false;
    const data = await res.json();
    return data.success === true && data.action === action && hostnames.includes(data.hostname);
  } catch {
    return false;
  }
}

// The rate-limit key is the client IP, passed to the limiter in memory only.
export async function withinLimit(limiter, request) {
  const key = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const { success } = await limiter.limit({ key });
  return success;
}

export function snippet(token, s) {
  const text = labelText(s.label);
  const [w, h] = DIMENSIONS[s.size];
  const src = `${ORIGIN}/b/${token}.svg?l=${s.label}&s=${s.style}&z=${s.size}&v=${s.variant}&m=${s.mascot}`;
  const html =
    `<a href="${ORIGIN}/?t=${token}" title="Made Openly: ${text}">\n` +
    `  <img src="${src}"\n` +
    `       width="${w}" height="${h}" alt="Made Openly: ${text}">\n` +
    `</a>`;
  return { html, text: `Made Openly: ${text} (${ORIGIN}/?t=${token})`, src };
}

// Insert a badge row, regenerating the token on a primary-key conflict.
// At most MAX_TOKEN_TRIES attempts in total, never an open loop.
export async function insertBadge(db, row, makeToken = newToken) {
  for (let attempt = 1; attempt <= MAX_TOKEN_TRIES; attempt++) {
    const token = makeToken();
    try {
      await db
        .prepare(
          `INSERT INTO badges (token, label, style, size, variant, mascot, declared_url, place_kind, verify_method, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?)`,
        )
        .bind(token, row.label, row.style, row.size, row.variant, row.mascot, row.declared_url, row.place_kind, row.verify_method, row.created_at)
        .run();
      return token;
    } catch (err) {
      if (!String(err?.message).includes("UNIQUE constraint failed")) throw err;
    }
  }
  return null;
}

export async function handleGenerate(request, env, makeToken = newToken) {
  let input;
  try {
    input = await request.json();
  } catch {
    input = null;
  }
  if (!input || typeof input !== "object" || Array.isArray(input))
    return Response.json({ error: "Send the form as JSON." }, { status: 400 });

  if (!(await verifyTurnstile(env, input.turnstile_token, "generate")))
    return Response.json({ error: "The human check failed. Please try again." }, { status: 403 });

  if (!(await withinLimit(env.RL_GENERATE, request)))
    return Response.json({ error: "Too many badges at once. Please wait a minute." }, { status: 429 });

  const s = parseSettings(input);
  const mascot = input.mascot ?? "robot";
  if (!s || !registry.some((m) => m.slug === mascot))
    return Response.json({ error: "Unknown badge settings." }, { status: 400 });

  let declared = null;
  if (input.declared_url != null && input.declared_url !== "") {
    declared = cleanDeclaredUrl(input.declared_url);
    if (!declared) return Response.json({ error: "The page address must start with https://" }, { status: 400 });
  }

  const row = {
    ...s,
    mascot,
    declared_url: declared,
    place_kind: placeKind(declared, input.is_product === true),
    verify_method: declared ? "address" : null,
    created_at: new Date().toISOString(),
  };
  const token = await insertBadge(env.DB, row, makeToken);
  if (!token) return Response.json({ error: "Could not make a badge. Please try again." }, { status: 503 });

  const out = snippet(token, { ...s, mascot });
  return Response.json({ token, snippet: out.html, text: out.text, src: out.src, place_kind: row.place_kind }, { status: 201 });
}
