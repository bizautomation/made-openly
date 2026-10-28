import { badge, parseSettings } from "./badge.js";
import { handleGenerate } from "./generate.js";
import { TOKEN_PATH, handleLiveBadge } from "./live.js";
import { handleStats } from "./stats.js";
import { runWeeklyCheck } from "./verify.js";

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
  return svgResponse(badge(s.size, s.style, s.label, s.variant), "public, max-age=86400");
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;
    // HEAD is answered like GET; the runtime drops the body.
    const method = request.method === "HEAD" ? "GET" : request.method;

    if (method === "GET" && pathname === "/badge.svg") return previewBadge(url);
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
