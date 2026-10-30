import { badge, labelText, parseSettings } from "./badge.js";
import { handleGenerate } from "./generate.js";
import { TOKEN_PATH, handleLiveBadge } from "./live.js";
import { handleStats } from "./stats.js";
import { runWeeklyCheck } from "./verify.js";
import { handleContact } from "./contact.js";
import { handleList, handleReport, handleReview, sendReviewEmail } from "./moderation.js";
import pageHtml from "./page.html";
import registry from "../mascots/registry.json";
import { BAR_NOTE, EXAMPLES, MEANINGS, TEST, TIE_BREAK } from "./labels.js";

const SVG_TYPE = "image/svg+xml";

export function svgResponse(svg, cacheControl) {
  return new Response(svg, {
    headers: {
      "Content-Type": SVG_TYPE,
      "Cache-Control": cacheControl,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

// Badge settings from query params: l=label, s=style, z=size, v=variant.
export function settingsFromQuery(params) {
  return parseSettings({
    label: params.get("l") ?? undefined,
    style: params.get("s") ?? undefined,
    size: params.get("z") ?? undefined,
    variant: params.get("v") ?? undefined,
  });
}

// GET /badge.svg: preview for the picker and the plain no-tracking download.
// No token, never records anything.
function previewBadge(url) {
  const s = settingsFromQuery(url.searchParams);
  if (!s) return new Response("Unknown badge settings", { status: 400 });
  const res = svgResponse(badge(s.size, s.style, s.label, s.variant), "public, max-age=86400");
  if (url.searchParams.has("download"))
    res.headers.set("Content-Disposition", `attachment; filename="made-openly-${s.label}-${s.style}-${s.size}.svg"`);
  return res;
}

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

// GET /: the single page. No cookies are set. Someone who clicked a badge
// (?t=TOKEN) also sees what that badge's label means; nothing is recorded.
async function page(env, url) {
  const mascots = JSON.stringify(registry.map(({ slug, name, designer }) => ({ slug, name, designer }))).replaceAll("<", "\\u003c");
  let html = pageHtml
    .replace("__TURNSTILE_SITE_KEY__", env.TURNSTILE_SITE_KEY ?? "")
    .replace("__MASCOTS__", mascots)
    .replaceAll("__TEST__", TEST)
    .replaceAll("__BAR_NOTE__", BAR_NOTE)
    .replace("__TIE_BREAK__", TIE_BREAK);
  for (const [slug, meaning] of Object.entries(MEANINGS)) html = html.replaceAll(`__MEANING_${slug}__`, meaning);
  for (const [slug, cases] of Object.entries(EXAMPLES)) html = html.replace(`__EXAMPLES_${slug}__`, cases.map((c) => `<li>${c}</li>`).join(""));
  html = html.replace("__BADGE_NOTE__", await badgeNote(env, url.searchParams.get("t")));
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Content-Security-Policy": CSP,
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function badgeNote(env, token) {
  if (!token || !/^[A-Za-z0-9]{16,64}$/.test(token)) return "";
  const row = await env.DB.prepare("SELECT label FROM badges WHERE token = ?").bind(token).first();
  if (!row || !MEANINGS[row.label]) return "";
  return `<p class="badge-note" id="badge-note"><b>This badge says: ${labelText(row.label)}</b>${MEANINGS[row.label]} ${BAR_NOTE} It is the maker's own statement.</p>\n    `;
}

// Private review mirror for the owner (behind Cloudflare Access). Same Worker,
// but nothing on it may be indexed, followed or used for AI training.
export const REVIEW_HOSTS = ["madeopenly.bizat.co"];
const NO_INDEX = "noindex, nofollow, noarchive, noimageindex, noai, noimageai";

// Every route on every host.
function route(request, env, ctx, url) {
  const { pathname } = url;
  // HEAD is answered like GET; the runtime drops the body.
  const method = request.method === "HEAD" ? "GET" : request.method;

  if (method === "GET" && pathname === "/") return page(env, url);
  if (method === "GET" && pathname === "/badge.svg") return previewBadge(url);
  if (method === "POST" && pathname === "/api/contact") return handleContact(request, env, ctx);
  if (method === "POST" && pathname === "/api/list") return handleList(request, env);
  if (method === "POST" && pathname === "/api/report") return handleReport(request, env, ctx);
  if (method === "GET" && pathname === "/admin/review") return handleReview(env, ctx, url);
  if (method === "POST" && pathname === "/api/generate") return handleGenerate(request, env);
  if (method === "GET" && pathname === "/stats.json") return handleStats(request, env, ctx, url);
  const live = method === "GET" && TOKEN_PATH.exec(pathname);
  if (live) return handleLiveBadge(request, env, live[1], url);

  return new Response("Not found", { status: 404 });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!REVIEW_HOSTS.includes(url.hostname)) return route(request, env, ctx, url);
    if (url.pathname === "/robots.txt")
      return new Response("User-agent: *\nDisallow: /\n", { headers: { "Content-Type": "text/plain", "X-Robots-Tag": NO_INDEX } });
    // Copy so the headers are writable (cached and JSON responses are immutable).
    const original = await route(request, env, ctx, url);
    const res = new Response(original.body, original);
    res.headers.set("X-Robots-Tag", NO_INDEX);
    return res;
  },

  async scheduled(controller, env, ctx) {
    const summary = await runWeeklyCheck(env);
    summary.to_review = await sendReviewEmail(env);
    console.log("weekly check", JSON.stringify(summary)); // counts only
  },
};
