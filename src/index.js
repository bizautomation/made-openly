import { badge, parseSettings } from "./badge.js";
import { handleGenerate } from "./generate.js";
import { TOKEN_PATH, handleLiveBadge } from "./live.js";
import { handleStats } from "./stats.js";
import { runWeeklyCheck } from "./verify.js";
import { handleContact } from "./contact.js";
import pageHtml from "./page.html";
import registry from "../mascots/registry.json";

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

// GET /: the single page. No cookies are set.
function page(env) {
  const mascots = JSON.stringify(registry.map(({ slug, name, designer }) => ({ slug, name, designer }))).replaceAll("<", "\\u003c");
  const html = pageHtml.replace("__TURNSTILE_SITE_KEY__", env.TURNSTILE_SITE_KEY ?? "").replace("__MASCOTS__", mascots);
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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;
    // HEAD is answered like GET; the runtime drops the body.
    const method = request.method === "HEAD" ? "GET" : request.method;

    if (method === "GET" && pathname === "/") return page(env);
    if (method === "GET" && pathname === "/badge.svg") return previewBadge(url);
    if (method === "POST" && pathname === "/api/contact") return handleContact(request, env);
    if (method === "POST" && pathname === "/api/generate") return handleGenerate(request, env);
    if (method === "GET" && pathname === "/stats.json") return handleStats(request, env, ctx, url);
    const live = method === "GET" && TOKEN_PATH.exec(pathname);
    if (live) return handleLiveBadge(request, env, live[1], url);

    return new Response("Not found", { status: 404 });
  },

  async scheduled(controller, env, ctx) {
    const summary = await runWeeklyCheck(env);
    console.log("weekly check", JSON.stringify(summary)); // counts only
  },
};
