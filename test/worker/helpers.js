import { exports } from "cloudflare:workers";
import { vi } from "vitest";

export const call = (path, init) => exports.default.fetch(new Request(`https://madeopenly.com${path}`, init));

let ipCounter = 0;
// A fresh client IP per call keeps tests from tripping each other's rate limits.
export const freshIp = () => `203.0.113.${++ipCounter % 250}`;

export function postJson(path, body, ip = freshIp()) {
  return call(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": ip },
    body: JSON.stringify(body),
  });
}

// Stub Turnstile siteverify: the response token "pass" succeeds, anything else fails.
// Other URLs go to `other` (default: 404).
export function mockFetch(other = () => new Response("not found", { status: 404 })) {
  const fn = vi.fn(async (input, init) => {
    const url = String(input?.url ?? input);
    if (url.startsWith("https://challenges.cloudflare.com/turnstile/")) {
      const token = init.body.get("response");
      return Response.json({ success: token === "pass" });
    }
    return other(url, init);
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}
