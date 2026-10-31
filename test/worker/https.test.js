import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { call } from "./helpers.js";

const fetchUrl = (url, init) => exports.default.fetch(new Request(url, init));

describe("HTTPS only", () => {
  it.each(["madeopenly.com", "madeopenly.bizat.co"])("redirects http://%s to https, keeping path and query", async (host) => {
    const res = await fetchUrl(`http://${host}/b/abc.svg?l=human-ai&s=dark`, { redirect: "manual" });
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe(`https://${host}/b/abc.svg?l=human-ai&s=dark`);
  });

  it.each(["http", "https"])("sends %s://www.madeopenly.com to https://madeopenly.com in one hop", async (scheme) => {
    const res = await fetchUrl(`${scheme}://www.madeopenly.com/b/abc.svg?l=human-ai&s=dark`, { redirect: "manual" });
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("https://madeopenly.com/b/abc.svg?l=human-ai&s=dark");
  });

  it("uses 308 for a POST to www", async () => {
    const res = await fetchUrl("https://www.madeopenly.com/api/generate", { method: "POST", body: "{}", redirect: "manual" });
    expect(res.status).toBe(308);
    expect(res.headers.get("Location")).toBe("https://madeopenly.com/api/generate");
  });

  it("uses 308 for a POST so the browser resends the body", async () => {
    const res = await fetchUrl("http://madeopenly.com/api/generate", { method: "POST", body: "{}", redirect: "manual" });
    expect(res.status).toBe(308);
    expect(res.headers.get("Location")).toBe("https://madeopenly.com/api/generate");
  });

  it("leaves local development on http alone", async () => {
    expect((await fetchUrl("http://localhost/")).status).toBe(200);
  });

  it("sends HSTS on https responses", async () => {
    for (const path of ["/", "/badge.svg", "/stats.json", "/nope"])
      expect((await call(path)).headers.get("Strict-Transport-Security")).toBe("max-age=31536000; includeSubDomains");
  });
});
