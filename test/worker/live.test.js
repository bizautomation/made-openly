import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { badge, neutralBadge } from "../../src/badge.js";
import { bindableHost } from "../../src/live.js";
import { call } from "./helpers.js";

let n = 0;
async function seed(extra = {}) {
  const token = `tok${String(++n).padStart(13, "0")}live`;
  await env.DB.prepare(
    `INSERT INTO badges (token, label, style, size, variant, created_at, host, status, declared_url, verify_method)
     VALUES (?, 'mostly-ai', 'dark', 'small', 'robot', '2026-10-28T00:00:00Z', ?, ?, ?, ?)`,
  )
    .bind(token, extra.host ?? null, extra.status ?? "new", extra.declared_url ?? null, extra.verify_method ?? null)
    .run();
  return token;
}
const load = (token, referer, query = "") =>
  call(`/b/${token}.svg${query}`, { headers: { ...(referer ? { Referer: referer } : {}), "CF-Connecting-IP": "203.0.113.9" } });
const row = (token) => env.DB.prepare("SELECT * FROM badges WHERE token = ?").bind(token).first();
const days = async (token) => (await env.DB.prepare("SELECT COUNT(*) AS n FROM daily WHERE token = ?").bind(token).first()).n;

describe("GET /b/:token.svg", () => {
  it("draws from stored settings when the URL has none, with a 5-minute cache", async () => {
    const token = await seed();
    const res = await load(token, "https://example.com/post");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/svg+xml");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=300");
    expect(await res.text()).toBe(badge("small", "dark", "mostly-ai", "robot"));
  });

  it("takes the look from the URL but never the label", async () => {
    const token = await seed();
    const res = await load(token, "https://example.com/post", "?l=human-only&s=light&z=large&v=wordmark");
    expect(await res.text()).toBe(badge("large", "light", "mostly-ai", "wordmark"));
  });

  it("swaps only the style when only s= changes", async () => {
    const token = await seed();
    const res = await load(token, "https://example.com/post", "?s=clear-light");
    expect(await res.text()).toBe(badge("small", "clear-light", "mostly-ai", "robot"));
  });

  it("falls back per value when the URL has an invalid one", async () => {
    const token = await seed();
    const res = await load(token, "https://example.com/post", "?s=neon&z=large");
    expect(await res.text()).toBe(badge("large", "dark", "mostly-ai", "robot"));
  });

  it("binds on the first valid referrer and records the day", async () => {
    const token = await seed();
    await load(token, "https://www.Example.com/post");
    expect(await row(token)).toMatchObject({ host: "example.com", status: "active", verify_method: "live" });
    expect((await row(token)).bound_at).toBeTruthy();
    expect(await days(token)).toBe(1);
  });

  it.each([
    ["no referrer", null],
    ["localhost", "http://localhost:8787/"],
    ["127.0.0.1", "http://127.0.0.1:3000/page"],
    ["an IPv4 address", "https://192.0.2.10/"],
    ["an IPv6 address", "http://[::1]:8080/"],
    ["a Pages preview", "https://abc123.myblog.pages.dev/"],
    ["a Vercel preview", "https://myblog-git-main-me.vercel.app/"],
    ["a Netlify preview", "https://deploy-preview-4--myblog.netlify.app/"],
    ["this site", "https://madeopenly.com/?t=x"],
    ["a bare host", "http://intranet/"],
    ["garbage", "not a url"],
  ])("does not bind on %s", async (_, referer) => {
    const token = await seed();
    await load(token, referer);
    expect(await row(token)).toMatchObject({ host: null, status: "new", verify_method: null });
  });

  it("draws the badge but records nothing without a usable Referer", async () => {
    const token = await seed({ host: "example.com", status: "dormant" });
    await load(token, null);
    await load(token, "http://localhost:3000/");
    expect(await days(token)).toBe(0);
    expect((await row(token)).status).toBe("dormant");
  });

  it("counts a second host as its own place with no badge ID and leaves the first place alone", async () => {
    const token = await seed();
    await load(token, "https://first.example/");
    await load(token, "https://copycat.example/");
    expect(await row(token)).toMatchObject({ host: "first.example", status: "active" });
    expect(await days(token)).toBe(1);
    const copy = await env.DB.prepare("SELECT host, label, copied FROM tokenless_places").all();
    expect(copy.results).toEqual([{ host: "copycat.example", label: "mostly-ai", copied: 1 }]);
  });

  it("never binds a token with a page address to another site", async () => {
    const token = await seed({ declared_url: "https://www.blog.example/p/one", status: "declared", verify_method: "address" });
    await load(token, "https://faker.example/");
    expect(await row(token)).toMatchObject({ host: null, status: "declared" });
    expect(await days(token)).toBe(0);
    const copy = await env.DB.prepare("SELECT host, copied FROM tokenless_places WHERE host = 'faker.example'").all();
    expect(copy.results).toEqual([{ host: "faker.example", copied: 1 }]);
    await load(token, "https://blog.example/p/one");
    expect(await row(token)).toMatchObject({ host: "blog.example", status: "active" });
    expect(await days(token)).toBe(1);
  });

  it("keeps counting loads from the first host of a place flagged before (old rule)", async () => {
    const token = await seed({ host: "first.example", status: "flagged", verify_method: "live" });
    await load(token, "https://first.example/about");
    expect(await days(token)).toBe(1);
    expect((await row(token)).host).toBe("first.example");
  });

  it("keeps verify_method 'address' when a declared badge binds", async () => {
    const token = await seed({ declared_url: "https://blog.example/p/1", verify_method: "address" });
    await load(token, "https://blog.example/p/1");
    expect(await row(token)).toMatchObject({ host: "blog.example", verify_method: "address", status: "active" });
  });

  it("does not demote a verified token when it is loaded again", async () => {
    const token = await seed({ host: "example.com", status: "active", verify_method: "live" });
    await load(token, "https://example.com/");
    expect((await row(token)).status).toBe("active");
  });

  it("answers HEAD without binding or recording", async () => {
    const token = await seed();
    const res = await call(`/b/${token}.svg`, { method: "HEAD", headers: { Referer: "https://example.com/" } });
    expect(res.status).toBe(200);
    expect(await row(token)).toMatchObject({ host: null, status: "new" });
    expect(await days(token)).toBe(0);
  });

  it("leaves one daily row after 100 loads on one day", async () => {
    const token = await seed();
    for (let i = 0; i < 100; i++) await load(token, "https://example.com/post");
    expect(await days(token)).toBe(1);
  });

  it("returns a neutral badge for an unknown token and records nothing", async () => {
    const before = (await env.DB.prepare("SELECT COUNT(*) AS n FROM daily").first()).n;
    const res = await load("unknowntoken0000000000", "https://example.com/", "?z=small&s=dark");
    expect(await res.text()).toBe(neutralBadge("small", "dark"));
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM daily").first()).n).toBe(before);
  });

  it("stores nothing about the visitor", async () => {
    const cols = (await env.DB.prepare("SELECT name FROM pragma_table_info('daily') UNION ALL SELECT name FROM pragma_table_info('badges')").all()).results.map((r) => r.name);
    expect(cols.filter((c) => /ip|agent|cookie|visitor|referer/i.test(c))).toEqual([]);
  });
});

describe("bindableHost", () => {
  it("normalises case, trailing dot and www", () => {
    expect(bindableHost("https://WWW.Example.COM./x")).toBe("example.com");
    expect(bindableHost("https://blog.example.com/")).toBe("blog.example.com");
  });
});

describe("PNG badge and load costs", () => {
  it("serves the pre-drawn PNG and records like the SVG", async () => {
    const token = await seed();
    const res = await call(`/b/${token}.png?s=dark&z=small&v=wordmark`, { headers: { Referer: "https://png.example/", "CF-Connecting-IP": "203.0.113.31" } });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=300");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(String.fromCharCode(...bytes.slice(1, 4))).toBe("PNG");
    expect(await row(token)).toMatchObject({ host: "png.example", status: "active" });
    expect(await days(token)).toBe(1);
  });

  it("draws a neutral PNG for an unknown token", async () => {
    const res = await call("/b/unknowntoken0000000000.png?z=small");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
  });

  it("skips the write once the place was seen today", async () => {
    const token = await seed({ host: "seen.example", status: "active" });
    await load(token, "https://seen.example/");
    expect(await days(token)).toBe(1);
    await env.DB.prepare("DELETE FROM daily WHERE token = ?").bind(token).run();
    await load(token, "https://seen.example/");
    expect(await days(token)).toBe(0);
  });

  it("still draws the badge over the rate limit, and records nothing", async () => {
    const token = await seed();
    const hit = (ref) => call(`/b/${token}.svg`, { headers: { Referer: ref, "CF-Connecting-IP": "198.51.100.77" } });
    for (let i = 0; i < 300; i++) await hit("https://noise.example/");
    await env.DB.prepare("UPDATE badges SET host = NULL, status = 'new', last_seen = NULL WHERE token = ?").bind(token).run();
    await env.DB.prepare("DELETE FROM daily WHERE token = ?").bind(token).run();
    const res = await hit("https://late.example/");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/svg+xml");
    expect(await row(token)).toMatchObject({ host: null, status: "new" });
    expect(await days(token)).toBe(0);
  });
});
