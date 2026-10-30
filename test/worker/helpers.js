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

// Stub Turnstile siteverify. A token "pass-<action>" verifies for that action
// on madeopenly.com, "pass-<action>@<host>" on another host; anything else fails.
// Other URLs go to `other` (default: 404).
export function mockFetch(other = () => new Response("not found", { status: 404 })) {
  const fn = vi.fn(async (input, init) => {
    const url = String(input?.url ?? input);
    if (url.startsWith("https://challenges.cloudflare.com/turnstile/")) {
      const m = /^pass-([a-z]+)(?:@(.+))?$/.exec(init.body.get("response"));
      return Response.json(m ? { success: true, action: m[1], hostname: m[2] ?? "madeopenly.com" } : { success: false });
    }
    return other(url, init);
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}
