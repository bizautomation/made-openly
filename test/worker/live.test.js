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
  it("draws from stored settings, not query hints, with a 5-minute cache", async () => {
    const token = await seed();
    const res = await load(token, "https://example.com/post", "?l=human-only&s=light&z=large&v=wordmark");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/svg+xml");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=300");
    expect(await res.text()).toBe(badge("small", "dark", "mostly-ai", "robot"));
  });

  it("binds on the first valid referrer and records the day", async () => {
    const token = await seed();
    await load(token, "https://www.Example.com/post");
    expect(await row(token)).toMatchObject({ host: "example.com", status: "bound", verify_method: "live" });
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

  it("still counts the day when the referrer cannot bind", async () => {
    const token = await seed();
    await load(token, null);
    expect(await days(token)).toBe(1);
  });

  it("flags a second host and records nothing for it", async () => {
    const token = await seed();
    await load(token, "https://first.example/");
    await env.DB.prepare("DELETE FROM daily WHERE token = ?").bind(token).run();
    await load(token, "https://copycat.example/");
    expect(await row(token)).toMatchObject({ host: "first.example", status: "flagged" });
    expect(await days(token)).toBe(0);
  });

  it("keeps counting loads from the first host after a flag", async () => {
    const token = await seed({ host: "first.example", status: "flagged", verify_method: "live" });
    await load(token, "https://first.example/about");
    expect(await days(token)).toBe(1);
    expect((await row(token)).host).toBe("first.example");
  });

  it("keeps verify_method 'address' when a declared badge binds", async () => {
    const token = await seed({ declared_url: "https://blog.example/p/1", verify_method: "address" });
    await load(token, "https://blog.example/p/1");
    expect(await row(token)).toMatchObject({ host: "blog.example", verify_method: "address", status: "bound" });
  });

  it("does not demote a verified token when it is loaded again", async () => {
    const token = await seed({ host: "example.com", status: "verified", verify_method: "live" });
    await load(token, "https://example.com/");
    expect((await row(token)).status).toBe("verified");
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
