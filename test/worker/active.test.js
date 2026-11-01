import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runNewCheck, runWeeklyCheck, githubRepo } from "../../src/verify.js";
import { buildStats } from "../../src/stats.js";
import { sendReviewEmail } from "../../src/moderation.js";
import { call, mockFetch } from "./helpers.js";

const NOW = new Date("2026-11-02T02:00:00Z");
const DAY = 86_400_000;
const daysAgo = (d) => new Date(NOW.getTime() - d * DAY).toISOString();
const page = (body) => new Response(`<!doctype html><body>${body}</body>`, { headers: { "Content-Type": "text/html" } });
const link = (t) => `<a href="https://madeopenly.com/?t=${t}">badge</a>`;

let n = 0;
async function seed(cols = {}) {
  const token = `act${String(++n).padStart(13, "0")}tok`;
  const row = { label: "human-ai", style: "light", size: "large", variant: "robot", place_kind: "site", status: "new", listed: "no", created_at: daysAgo(2), ...cols };
  const keys = Object.keys(row);
  await env.DB.prepare(`INSERT INTO badges (token, ${keys.join(", ")}) VALUES (?, ${keys.map(() => "?").join(", ")})`)
    .bind(token, ...keys.map((k) => row[k]))
    .run();
  return token;
}
const row = (t) => env.DB.prepare("SELECT * FROM badges WHERE token = ?").bind(t).first();
const load = (t, referer) => call(`/b/${t}.svg`, { headers: { ...(referer ? { Referer: referer } : {}), "CF-Connecting-IP": "203.0.113.20" } });
const click = (t, referer) => call(`/?t=${t}`, { headers: { ...(referer ? { Referer: referer } : {}), "CF-Connecting-IP": "203.0.113.21" } });
const today = () => new Date().toISOString().slice(0, 10);

let pages;
beforeEach(async () => {
  await env.DB.batch(["badges", "daily", "weekly_counts", "key_attempts"].map((t) => env.DB.prepare(`DELETE FROM ${t}`)));
  pages = {};
  mockFetch((url) => (pages[url] ? pages[url]() : new Response("not found", { status: 404 })));
});
afterEach(() => vi.unstubAllGlobals());

describe("signal 1: badge load", () => {
  it("binds, makes the place active and sets last_seen", async () => {
    const t = await seed();
    await load(t, "https://blog.example/post");
    expect(await row(t)).toMatchObject({ host: "blog.example", status: "active", last_seen: today() });
  });

  it("turns a dormant place active again", async () => {
    const t = await seed({ host: "blog.example", status: "dormant", last_seen: "2026-01-01" });
    await load(t, "https://blog.example/");
    expect(await row(t)).toMatchObject({ status: "active", last_seen: today() });
  });

  it("moves 'asked' to 'pending' on the first sighting and leaves 'no' alone", async () => {
    const asked = await seed({ listed: "asked" });
    const no = await seed();
    await load(asked, "https://a.example/");
    await load(no, "https://b.example/");
    expect((await row(asked)).listed).toBe("pending");
    expect((await row(no)).listed).toBe("no");
  });
});

describe("signal 1: badge click", () => {
  it("makes a declared Substack place active when the Referer host matches", async () => {
    const t = await seed({ declared_url: "https://theconversationdaemon.com/about", status: "declared", place_kind: "site" });
    const res = await click(t, "https://theconversationdaemon.com/");
    expect(res.status).toBe(200);
    expect(await row(t)).toMatchObject({ status: "active", last_seen: today(), host: null });
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM daily WHERE token = ?").bind(t).first()).n).toBe(1);
  });

  it("matches the bound host too", async () => {
    const t = await seed({ host: "blog.example", status: "dormant", last_seen: "2026-01-01" });
    await click(t, "https://www.blog.example/");
    expect((await row(t)).status).toBe("active");
  });

  it("changes nothing for another host or no Referer, and never binds", async () => {
    const t = await seed({ declared_url: "https://theconversationdaemon.com/about", status: "declared" });
    await click(t, "https://elsewhere.example/");
    await click(t, null);
    await click(t, "https://substack.com/redirect/abc");
    expect(await row(t)).toMatchObject({ status: "declared", host: null, last_seen: null });
  });
});

describe("signal 2: Worker check", () => {
  it("a find makes the place active", async () => {
    const t = await seed({ declared_url: "https://x.substack.com/p/one", status: "declared", place_kind: "post" });
    pages["https://x.substack.com/p/one"] = () => page(link(t));
    await runNewCheck(env, { now: NOW, sleep: async () => {} });
    expect(await row(t)).toMatchObject({ status: "active", last_seen: "2026-11-02" });
  });

  it.each([
    ["429", () => new Response("slow", { status: 429 })],
    ["404", () => new Response("gone", { status: 404 })],
    ["network error", () => { throw new TypeError("down"); }],
  ])("a %s changes nothing", async (_, reply) => {
    const t = await seed({ declared_url: "https://x.substack.com/about", status: "declared" });
    pages["https://x.substack.com/about"] = reply;
    await runWeeklyCheck(env, { now: NOW, sleep: async () => {} });
    expect(await row(t)).toMatchObject({ status: "declared", last_seen: null });
  });

  it("a declared place never seen stays declared and is never deleted", async () => {
    const t = await seed({ declared_url: "https://x.substack.com/about", status: "declared", created_at: daysAgo(400) });
    await runWeeklyCheck(env, { now: NOW, sleep: async () => {} });
    expect((await row(t)).status).toBe("declared");
  });
});

describe("30 days", () => {
  it("with no sighting turns a place dormant, and a sighting turns it active again", async () => {
    const old = await seed({ host: "old.example", status: "active", last_seen: "2026-10-02" });
    const recent = await seed({ host: "new.example", status: "active", last_seen: "2026-10-03" });
    const summary = await runNewCheck(env, { now: NOW, sleep: async () => {} });
    expect(summary.dormant).toBe(1);
    expect((await row(old)).status).toBe("dormant");
    expect((await row(recent)).status).toBe("active");
    await load(old, "https://old.example/");
    expect((await row(old)).status).toBe("active");
  });

  it("a dormant listed place leaves the list and comes back with its approval", async () => {
    const t = await seed({ host: "q.example", status: "dormant", listed: "yes", last_seen: "2026-01-01", first_verified: "2026-01-01T00:00:00Z" });
    expect((await buildStats(env.DB)).listed).toEqual([]);
    await load(t, "https://q.example/");
    expect((await buildStats(env.DB)).listed.map((p) => p.place)).toEqual(["q.example"]);
  });
});

describe("GitHub README through the API", () => {
  const api = "https://api.github.com/repos/bizautomation/made-openly/readme";
  const repo = { declared_url: "https://github.com/bizautomation/made-openly", place_kind: "repo", status: "declared" };

  it("finds the token in the raw README", async () => {
    const t = await seed(repo);
    let init;
    pages[api] = () => new Response(`# Title\n\n<a href="https://madeopenly.com/?t=${t}"><img src="https://madeopenly.com/b/${t}.svg"></a>`);
    const fetchMock = mockFetch((url, i) => {
      if (url === api) init = i;
      return pages[url] ? pages[url]() : new Response("not found", { status: 404 });
    });
    await runNewCheck(env, { now: NOW, sleep: async () => {} });
    expect((await row(t)).status).toBe("active");
    expect(init.headers.Accept).toBe("application/vnd.github.raw");
    expect(fetchMock.mock.calls.some(([u]) => String(u).startsWith("https://github.com/"))).toBe(false);
  });

  it("token missing and 404 leave it declared", async () => {
    const a = await seed(repo);
    pages[api] = () => new Response("# No badge");
    await runNewCheck(env, { now: NOW, sleep: async () => {} });
    expect((await row(a)).status).toBe("declared");
    delete pages[api];
    await runNewCheck(env, { now: NOW, sleep: async () => {} });
    expect((await row(a)).status).toBe("declared");
  });

  it("reads owner/repo from the address", () => {
    expect(githubRepo("https://github.com/a/b")).toBe("a/b");
    expect(githubRepo("https://github.com/a/b.git")).toBe("a/b");
    expect(githubRepo("https://github.com/a")).toBeNull();
    expect(githubRepo("https://gitlab.com/a/b")).toBeNull();
  });
});

describe("migration 0002", () => {
  it("maps verified to active and declared-but-unverified to declared", async () => {
    const verified = await seed({ host: "v.example", status: "verified", last_verified: "2026-10-31T17:15:00.000Z" });
    const declared = await seed({ declared_url: "https://x.substack.com/about", status: "new" });
    const unplaced = await seed({ status: "new" });
    const bound = await seed({ host: "b.example", status: "bound" });
    await env.DB.prepare("INSERT INTO daily (token, day) VALUES (?, ?)").bind(bound, today()).run();
    const updates = env.TEST_MIGRATIONS.find((m) => m.name.startsWith("0002")).queries.filter((q) => /^\s*(--[^\n]*\n\s*)*UPDATE/i.test(q));
    for (const q of updates) await env.DB.prepare(q).run();
    expect(await row(verified)).toMatchObject({ status: "active", last_seen: "2026-10-31" });
    expect((await row(declared)).status).toBe("declared");
    expect((await row(unplaced)).status).toBe("new");
    expect(await row(bound)).toMatchObject({ status: "active", last_seen: today() });
  });
});

describe("counts and the Monday email", () => {
  it("added = active + dormant + unverified; unplaced tokens are not added", async () => {
    await seed({ host: "a.example", status: "active", last_seen: today(), first_verified: daysAgo(1) });
    await seed({ host: "d.example", status: "dormant", last_seen: "2026-01-01", first_verified: "2026-01-01T00:00:00Z" });
    await seed({ declared_url: "https://x.substack.com/about", status: "declared" });
    await seed({ status: "new" });
    const s = await buildStats(env.DB);
    expect([s.added_total, s.total_verified, s.dormant_total, s.unverified_total]).toEqual([3, 1, 1, 1]);
    expect(s.added_total).toBe(s.total_verified + s.dormant_total + s.unverified_total);
  });

  it("the review email shows places with no sighting for 12+ months", async () => {
    await seed({ host: "d.example", status: "dormant", last_seen: "2025-06-01" });
    await seed({ declared_url: "https://x.substack.com/about", status: "declared", created_at: "2025-06-01T00:00:00Z" });
    await seed({ host: "fresh.example", status: "dormant", last_seen: "2026-09-01" });
    const sent = [];
    mockFetch((url, init) => (sent.push(JSON.parse(init.body)), Response.json({ id: "x" })));
    await sendReviewEmail(env, NOW);
    expect(sent[0].text).toContain("Places with no sighting for 12+ months: 2");
    expect(sent[0].text).not.toMatch(/delete|remove/i);
  });
});
