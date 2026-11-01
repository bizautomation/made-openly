import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { day, sweepDormant } from "../../src/sighting.js";
import { runNewCheck } from "../../src/verify.js";
import { call, freshIp, mockFetch, postJson } from "./helpers.js";

// SPEC.md 8.6: a badge with no token counts by the site it loads on and its label.
const plain = (referer, query = "?l=mostly-ai&s=light&z=large&v=robot", init = {}) =>
  call(`/badge.svg${query}`, { ...init, headers: { ...(referer ? { Referer: referer } : {}), "CF-Connecting-IP": freshIp() } });
const places = async () => (await env.DB.prepare("SELECT * FROM tokenless_places ORDER BY host, label").all()).results;
const tokenlessDays = async () => (await env.DB.prepare("SELECT COUNT(*) AS n FROM tokenless_daily").first()).n;
const stats = async () => (await call("/stats.json")).json();
const badgeRow = (token) => env.DB.prepare("SELECT * FROM badges WHERE token = ?").bind(token).first();
const tokenDays = async (token) => (await env.DB.prepare("SELECT day FROM daily WHERE token = ? ORDER BY day").bind(token).all()).results.map((r) => r.day);

let n = 0;
async function seedToken({ label = "mostly-ai", host = null, status = "new", declared_url = null } = {}) {
  const token = `tok${String(++n).padStart(13, "0")}none`;
  await env.DB.prepare(
    `INSERT INTO badges (token, label, style, size, variant, created_at, host, bound_at, status, declared_url)
     VALUES (?, ?, 'light', 'large', 'robot', ?, ?, ?, ?, ?)`,
  )
    .bind(token, label, new Date().toISOString(), host, host ? new Date().toISOString() : null, status, declared_url)
    .run();
  return token;
}
// A tokenless place seen on two earlier days, first on 1 Oct.
async function seedTokenless(host, label, status = "active") {
  await env.DB.batch([
    env.DB.prepare("INSERT INTO tokenless_places (host, label, status, first_seen, last_seen) VALUES (?, ?, ?, '2026-10-01T09:00:00.000Z', '2026-10-02')").bind(host, label, status),
    env.DB.prepare("INSERT INTO tokenless_daily (host, label, day) VALUES (?, ?, '2026-10-01'), (?, ?, '2026-10-02')").bind(host, label, host, label),
  ]);
}

beforeEach(async () => {
  await env.DB.batch(["badges", "daily", "tokenless_places", "tokenless_daily"].map((t) => env.DB.prepare(`DELETE FROM ${t}`)));
});
afterEach(() => vi.unstubAllGlobals());

describe("GET /badge.svg from another site", () => {
  it("counts the host and label once a day, with the short cache", async () => {
    const res = await plain("https://www.Example.com/blog/post?utm=x#top");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=300");
    await plain("https://example.com/other");
    expect(await places()).toEqual([{ host: "example.com", label: "mostly-ai", status: "active", first_seen: expect.any(String), last_seen: day(), copied: 0 }]);
    expect(await tokenlessDays()).toBe(1);
    // The host only: no path, query or fragment is stored anywhere.
    const dump = JSON.stringify([await places(), (await env.DB.prepare("SELECT * FROM tokenless_daily").all()).results]);
    expect(dump).not.toMatch(/blog|post|utm|top|other/);
  });

  it("makes two places for two labels on one site", async () => {
    await plain("https://example.com/");
    await plain("https://example.com/", "?l=human-only");
    expect((await places()).map((p) => p.label)).toEqual(["human-only", "mostly-ai"]);
  });

  it.each([
    ["no Referer", null, undefined, {}],
    ["a HEAD request", "https://example.com/", undefined, { method: "HEAD" }],
    ["a download", "https://example.com/", "?l=mostly-ai&download=1", {}],
    ["no label in the address", "https://example.com/", "?s=light", {}],
    ["the picker on madeopenly.com", "https://madeopenly.com/#get", undefined, {}],
    ["localhost", "http://localhost:8787/", undefined, {}],
    ["an IP address", "http://192.0.2.4/page", undefined, {}],
    ["a preview host", "https://my-site.pages.dev/", undefined, {}],
  ])("records nothing for %s, but still draws the badge", async (_, referer, query, init) => {
    const res = await plain(referer, query, init);
    expect(res.status).toBe(200);
    expect(await places()).toEqual([]);
    expect(await tokenlessDays()).toBe(0);
  });

  it("keeps the long cache for the picker on madeopenly.com", async () => {
    const res = await plain("https://madeopenly.com/");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=86400");
  });

  it("goes dormant after 30 days, is kept, and turns active again", async () => {
    await seedTokenless("example.com", "mostly-ai");
    expect(await sweepDormant(env.DB, new Date("2026-11-15T00:00:00Z"))).toBe(1);
    expect((await places())[0].status).toBe("dormant");
    await plain("https://example.com/");
    expect(await places()).toMatchObject([{ status: "active", last_seen: day(), first_seen: "2026-10-01T09:00:00.000Z" }]);
  });

  it("keeps its own record when a token place holds the same site and label", async () => {
    const token = await seedToken({ host: "example.com", status: "active" });
    await plain("https://example.com/");
    expect(await places()).toMatchObject([{ host: "example.com", label: "mostly-ai" }]);
    expect(await tokenDays(token)).toEqual([]);
  });
});

describe("/stats.json", () => {
  it("counts places with no badge ID inside the totals and on their own", async () => {
    await seedTokenless("a.example", "human-ai");
    await seedTokenless("b.example", "human-ai", "dormant");
    await seedToken({ label: "human-only", host: "c.example", status: "active" });
    const s = await stats();
    expect(s.no_badge_id).toEqual({ total: 2, active: 1, dormant: 1, from_copied_snippet: 0, counted_once_with_badge_id: 0, maybe_counted_twice: 0 });
    expect(s.total_verified).toBe(2);
    expect(s.added_total).toBe(3);
    expect(s.dormant_total).toBe(1);
    expect(s.by_label).toEqual({ "mostly-ai": 0, "human-ai": 1, "human-only": 1 });
    expect(s.by_kind.site).toBe(2);
    expect(s.listed).toEqual([]); // never on the named list
  });
});

// SPEC.md 8.6: nothing is ever joined or taken over. Only our own check
// finding a token on the site's page makes the counter count a site once.
describe("a token place on the same site and label", () => {
  const counts = async () => {
    const s = await stats();
    return { ...s.no_badge_id, verified: s.total_verified, added: s.added_total };
  };

  it("never takes the tokenless place on its first load", async () => {
    await seedTokenless("example.com", "mostly-ai");
    const token = await seedToken();
    await call(`/b/${token}.svg`, { headers: { Referer: "https://example.com/", "CF-Connecting-IP": freshIp() } });
    expect(await badgeRow(token)).toMatchObject({ host: "example.com", status: "active", last_seen: day() });
    expect(await tokenDays(token)).toEqual([day()]);
    expect(await places()).toMatchObject([{ host: "example.com", first_seen: "2026-10-01T09:00:00.000Z" }]);
    expect(await tokenlessDays()).toBe(2);
    // Not confirmed by our check: both count, and the possible double count is shown.
    expect(await counts()).toMatchObject({ verified: 2, added: 2, total: 1, maybe_counted_twice: 1, counted_once_with_badge_id: 0 });
  });

  it("never takes it through a page address at Generate", async () => {
    mockFetch();
    await seedTokenless("blog.example.org", "human-ai", "dormant");
    const res = await postJson("/api/generate", {
      label: "human-ai", style: "light", size: "large", variant: "robot", mascot: "robot",
      turnstile_token: "pass-generate", declared_url: "https://www.blog.example.org/p/one",
    });
    const { token } = await res.json();
    expect(await badgeRow(token)).toMatchObject({ status: "declared", first_verified: null, last_seen: null });
    expect(await tokenDays(token)).toEqual([]);
    expect(await places()).toMatchObject([{ host: "blog.example.org", status: "dormant" }]);
    expect(await counts()).toMatchObject({ added: 2, maybe_counted_twice: 1 });
  });

  it("is counted once after our check finds the token on the page, and both records stay", async () => {
    await seedTokenless("example.com", "mostly-ai");
    const token = await seedToken({ host: "example.com" });
    mockFetch((url) => (url === "https://example.com/" ? new Response(`<a href="https://madeopenly.com/?t=${token}">`) : new Response("", { status: 404 })));
    await runNewCheck(env, { sleep: async () => {} });
    expect(await badgeRow(token)).toMatchObject({ status: "active", last_verified: expect.any(String) });
    expect(await places()).toHaveLength(1);
    expect(await counts()).toMatchObject({ verified: 1, added: 1, total: 1, counted_once_with_badge_id: 1, maybe_counted_twice: 0 });
  });

  it("with a different label stays a second place", async () => {
    await seedTokenless("example.com", "human-only");
    const token = await seedToken({ label: "mostly-ai", host: "example.com", status: "active" });
    await env.DB.prepare("UPDATE badges SET last_verified = ?, last_seen = ? WHERE token = ?").bind(new Date().toISOString(), day(), token).run();
    expect(await counts()).toMatchObject({ verified: 2, total: 1, counted_once_with_badge_id: 0, maybe_counted_twice: 0 });
  });
});

describe("a copied token on a second site", () => {
  it("counts for the second site with no badge ID, shown as copied, and never lowers the original", async () => {
    const token = await seedToken({ host: "first.example", status: "active" });
    await env.DB.prepare("UPDATE badges SET last_seen = ? WHERE token = ?").bind(day(), token).run();
    const before = (await stats()).total_verified;
    await call(`/b/${token}.svg`, { headers: { Referer: "https://copycat.example/", "CF-Connecting-IP": freshIp() } });
    await call(`/b/${token}.svg`, { headers: { Referer: "https://copycat.example/x", "CF-Connecting-IP": freshIp() } });
    expect(await badgeRow(token)).toMatchObject({ host: "first.example", status: "active" });
    expect(await places()).toMatchObject([{ host: "copycat.example", label: "mostly-ai", copied: 1 }]);
    expect(await tokenlessDays()).toBe(1);
    const s = await stats();
    expect(s.total_verified).toBe(before + 1);
    expect(s.no_badge_id).toMatchObject({ total: 1, from_copied_snippet: 1 });
  });
});
