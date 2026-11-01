import { badge, labelText, parseSettings } from "./badge.js";
import { handleGenerate, withinLimit } from "./generate.js";
import { TOKEN_PATH, bindableHost, handleLiveBadge } from "./live.js";
import { handleManage, handleManageList, handleRemove, handleSendKey, managePage } from "./manage.js";
import { day, recordDay } from "./sighting.js";
import { handleStats } from "./stats.js";
import { handlePlaces } from "./places.js";
import { HOME, headTags, robots, shareImage, sitemap } from "./share.js";
import { runNewCheck, runWeeklyCheck } from "./verify.js";
import { handleContact } from "./contact.js";
import { handleList, handleReport, handleReview, purgeStats, sendReviewEmail } from "./moderation.js";
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
  // Cloudflare Web Analytics (cookieless) is the only script from elsewhere besides Turnstile.
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com",
  "frame-src https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' https://cloudflareinsights.com",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

// GET /: the single page. No cookies are set. Someone who clicked a badge
// (?t=TOKEN) also sees what that badge's label means; nothing is recorded.
async function page(request, env, ctx, url) {
  const mascots = JSON.stringify(registry.map(({ slug, name, designer }) => ({ slug, name, designer }))).replaceAll("<", "\\u003c");
  let html = pageHtml
    .replace("__HEAD_TAGS__", headTags(HOME))
    .replace("__TURNSTILE_SITE_KEY__", env.TURNSTILE_SITE_KEY ?? "")
    .replace("__MASCOTS__", mascots)
    .replaceAll("__TEST__", TEST)
    .replaceAll("__BAR_NOTE__", BAR_NOTE)
    .replace("__TIE_BREAK__", TIE_BREAK);
  for (const [slug, meaning] of Object.entries(MEANINGS)) html = html.replaceAll(`__MEANING_${slug}__`, meaning);
  for (const [slug, cases] of Object.entries(EXAMPLES)) html = html.replace(`__EXAMPLES_${slug}__`, cases.map((c) => `<li>${c}</li>`).join(""));
  const token = url.searchParams.get("t");
  const row = token && /^[A-Za-z0-9]{16,64}$/.test(token)
    ? await env.DB.prepare("SELECT label, host, declared_url, last_seen FROM badges WHERE token = ?").bind(token).first()
    : null;
  html = html.replace("__BADGE_NOTE__", badgeNote(row));
  if (row && request.method === "GET") await badgeClick(request, env, token, row);
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

// /places and /manage share the home page's styles, nav and footer, cut from
// page.html. Each page fills __HEAD_TAGS__ and its own title.
const between = (start, end) => pageHtml.slice(pageHtml.indexOf(start), pageHtml.indexOf(end) + end.length);
const SHELL = {
  head: pageHtml.slice(0, pageHtml.indexOf("</style>")),
  nav: between("<nav", "</nav>").replaceAll('href="#', 'href="/#'),
  footer: between('<footer id="privacy">', "</footer>"),
};

// A reader clicked the badge (SPEC.md 8.3). When the Referer's host is the
// place's bound host or the host of its declared address, that is a sighting.
// Most sites send only the origin, so the host is all that is compared. A
// click never binds a token and records nothing about the reader.
async function badgeClick(request, env, token, row) {
  const from = bindableHost(request.headers.get("Referer"));
  if (!from) return;
  let declaredHost = null;
  try {
    declaredHost = row.declared_url ? new URL(row.declared_url).hostname.toLowerCase().replace(/^www\./, "") : null;
  } catch {}
  if (from !== row.host && from !== declaredHost) return;
  if (row.last_seen === day()) return; // already seen today: no write
  if (!(await withinLimit(env.RL_BADGE, request))) return;
  await recordDay(env.DB, token);
}

function badgeNote(row) {
  if (!row || !MEANINGS[row.label]) return "";
  return `<p class="badge-note" id="badge-note"><b>This badge says: ${labelText(row.label)}</b>${MEANINGS[row.label]} ${BAR_NOTE} It is the maker's own statement.</p>\n    `;
}

// Private review mirror for the owner (behind Cloudflare Access). Same Worker,
// but nothing on it may be indexed, followed or used for AI training.
const REVIEW_HOSTS = ["madeopenly.bizat.co"];
const NO_INDEX = "noindex, nofollow, noarchive, noimageindex, noai, noimageai";

// HTTPS only, and one host: plain http and www.madeopenly.com go to
// https://madeopenly.com in a single hop (308 keeps the method and body of a
// POST). Browsers are told to use https from then on.
const HSTS = "max-age=31536000; includeSubDomains";
const CANONICAL_HOST = { "www.madeopenly.com": "madeopenly.com" };
function canonical(url, method) {
  url.protocol = "https:";
  url.hostname = CANONICAL_HOST[url.hostname] ?? url.hostname;
  return new Response(null, { status: method === "GET" || method === "HEAD" ? 301 : 308, headers: { Location: url.toString() } });
}

// Every route on every host.
function route(request, env, ctx, url) {
  const { pathname } = url;
  // HEAD is answered like GET; the runtime drops the body.
  const method = request.method === "HEAD" ? "GET" : request.method;

  if (method === "GET" && pathname === "/") return page(request, env, ctx, url);
  if (method === "GET" && pathname === "/manage") return managePage(SHELL, CSP);
  if (method === "POST" && pathname === "/api/manage") return handleManage(request, env);
  if (method === "POST" && pathname === "/api/manage/remove") return handleRemove(request, env, ctx);
  if (method === "POST" && pathname === "/api/manage/list") return handleManageList(request, env, ctx);
  if (method === "POST" && pathname === "/api/send-key") return handleSendKey(request, env);
  if (method === "GET" && pathname === "/places") return handlePlaces(env, url, SHELL, CSP);
  if (method === "GET" && pathname === "/badge.svg") return previewBadge(url);
  if (method === "GET" && pathname === "/og.png") return shareImage(env);
  if (method === "GET" && pathname === "/sitemap.xml") return sitemap();
  if (method === "GET" && pathname === "/robots.txt") return robots();
  if (method === "POST" && pathname === "/api/contact") return handleContact(request, env, ctx);
  if (method === "POST" && pathname === "/api/list") return handleList(request, env);
  if (method === "POST" && pathname === "/api/report") return handleReport(request, env, ctx);
  if (method === "GET" && pathname === "/admin/review") return handleReview(env, ctx, url);
  if (method === "POST" && pathname === "/api/generate") return handleGenerate(request, env);
  if (method === "GET" && pathname === "/stats.json") return handleStats(request, env, ctx, url);
  const live = method === "GET" && TOKEN_PATH.exec(pathname);
  if (live) return handleLiveBadge(request, env, live[1], url, live[2]);

  return new Response("Not found", { status: 404 });
}

const NEW_CHECK_CRON = "*/15 * * * *"; // must match wrangler.toml

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if ((url.protocol === "http:" && url.hostname !== "localhost") || url.hostname in CANONICAL_HOST) return canonical(url, request.method);
    const review = REVIEW_HOSTS.includes(url.hostname);
    if (review && url.pathname === "/robots.txt")
      return new Response("User-agent: *\nDisallow: /\n", { headers: { "Content-Type": "text/plain", "X-Robots-Tag": NO_INDEX, "Strict-Transport-Security": HSTS } });
    // Copy so the headers are writable (cached and JSON responses are immutable).
    const original = await route(request, env, ctx, url);
    const res = new Response(original.body, original);
    res.headers.set("Strict-Transport-Security", HSTS);
    if (review) res.headers.set("X-Robots-Tag", NO_INDEX);
    return res;
  },

  async scheduled(controller, env, ctx) {
    if (controller.cron === NEW_CHECK_CRON) {
      const summary = await runNewCheck(env);
      // A newly active or dormant place should show on the counter now, not in an hour.
      if (summary.verified || summary.dormant) await purgeStats(env);
      if (summary.checked) console.log("new check", JSON.stringify(summary)); // counts only
      return;
    }
    const summary = await runWeeklyCheck(env);
    summary.to_review = await sendReviewEmail(env);
    console.log("weekly check", JSON.stringify(summary)); // counts only
  },
};
