import { badge, parseSettings } from "./badge.js";
import { handleGenerate } from "./generate.js";

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

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
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
    const method = request.method;

    if (method === "GET" && pathname === "/badge.svg") return previewBadge(url);
    if (method === "POST" && pathname === "/api/generate") return handleGenerate(request, env);

    return new Response("Not found", { status: 404 });
  },
};
