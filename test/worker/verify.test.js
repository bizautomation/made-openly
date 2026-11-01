import { createScheduledController, createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import worker from "../../src/index.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { USER_AGENT, decodeCamoUrls, isoWeek, pageHasToken, runNewCheck, runWeeklyCheck } from "../../src/verify.js";
import { mockFetch } from "./helpers.js";

const NOW = new Date("2026-11-02T02:00:00Z");
const daysAgo = (d) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
const hex = (s) => [...s].map((c) => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");
const page = (body) => new Response(`<!doctype html><html><body>${body}</body></html>`, { headers: { "Content-Type": "text/html" } });

async function seed(token, cols) {
  const row = { label: "human-ai", style: "light", size: "large", variant: "robot", place_kind: "site", status: "active", last_seen: daysAgo(3).slice(0, 10), created_at: daysAgo(60), ...cols };
  const keys = Object.keys(row);
  await env.DB.prepare(`INSERT INTO badges (token, ${keys.join(", ")}) VALUES (?, ${keys.map(() => "?").join(", ")})`)
    .bind(token, ...keys.map((k) => row[k]))
    .run();
  await env.DB.prepare("INSERT INTO daily (token, day) VALUES (?, '2026-10-30')").bind(token).run();
}
const row = (token) => env.DB.prepare("SELECT * FROM badges WHERE token = ?").bind(token).first();
const days = async (token) => (await env.DB.prepare("SELECT COUNT(*) AS n FROM daily WHERE token = ?").bind(token).first()).n;
const run = () => runWeeklyCheck(env, { now: NOW, sleep: async () => {} });

let pages;
let fetchMock;
beforeEach(async () => {
  await env.DB.batch(["badges", "daily", "weekly_counts"].map((t) => env.DB.prepare(`DELETE FROM ${t}`)));
  pages = {};
  fetchMock = mockFetch((url) => (pages[url] ? pages[url]() : new Response("not found", { status: 404 })));
});
afterEach(() => vi.unstubAllGlobals());

const T = {
  link: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa01",
  img: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa02",
  camo: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa03",
  proxy: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa04",
};

describe("finding the token", () => {
  it("in a badge link href, for a live badge", async () => {
    await seed(T.link, { host: "example.com", verify_method: "live", bound_at: daysAgo(3) });
    pages["https://example.com/"] = () => page(`<footer><a href="https://madeopenly.com/?t=${T.link}" title="Made Openly: Human + AI">badge</a></footer>`);
    await run();
    expect(await row(T.link)).toMatchObject({ status: "active", first_verified: NOW.toISOString(), last_verified: NOW.toISOString() });
  });

  it("in an img src", async () => {
    await seed(T.img, { host: "blog.example", bound_at: daysAgo(3) });
    pages["https://blog.example/"] = () => page(`<img src="https://madeopenly.com/b/${T.img}.svg?l=human-ai&amp;s=light" width="176" height="62">`);
    await run();
    expect((await row(T.img)).status).toBe("active");
  });

  it("decodes a real-shaped GitHub camo URL", () => {
    const original = `https://madeopenly.com/b/${T.camo}.svg?l=mostly-ai&s=light&z=large&v=robot&m=robot`;
    const camo = `https://camo.githubusercontent.com/9f2e1c3b8a7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f/${hex(original)}`;
    expect(decodeCamoUrls(`<img src="${camo}">`)).toEqual([original]);
    expect(pageHasToken(`<img src="${camo}">`, T.camo)).toBe(true);
  });

  it("in a percent-encoded image proxy URL (Substack-style)", async () => {
    await seed(T.proxy, { declared_url: "https://someone.substack.com/p/hello", verify_method: "address", place_kind: "post", status: "new" });
    const src = `https://substackcdn.com/image/fetch/w_176,c_limit/${encodeURIComponent(`https://madeopenly.com/b/${T.proxy}.svg?l=human-ai`)}`;
    pages["https://someone.substack.com/p/hello"] = () => page(`<img src="${src}">`);
    await run();
    expect((await row(T.proxy)).status).toBe("active");
  });

  it("does not match a longer token that starts with this one", () => {
    expect(pageHasToken(`<a href="https://madeopenly.com/?t=${T.link}9">`, T.link)).toBe(false);
    // The PNG badge, for email signatures and site builders, counts the same way.
    expect(pageHasToken(`<img src="https://madeopenly.com/b/${T.img}.png?l=human-ai">`, T.img)).toBe(true);
    expect(pageHasToken(`<img src="https://madeopenly.com/b/${T.img}.gif">`, T.img)).toBe(false);
    expect(pageHasToken(`<a href="https://madeopenly.com/?t=${T.link}&x=1">`, T.link)).toBe(true);
  });

  it("clears a flag when the badge is found at its first host", async () => {
    await seed(T.link, { host: "example.com", status: "flagged", bound_at: daysAgo(3) });
    pages["https://example.com/"] = () => page(`<a href="https://madeopenly.com/?t=${T.link}">x</a>`);
    await run();
    expect((await row(T.link)).status).toBe("active");
  });

  it("sends the polite User-Agent", async () => {
    await seed(T.link, { host: "example.com", bound_at: daysAgo(3) });
    await run();
    const [, init] = fetchMock.mock.calls.find(([u]) => String(u) === "https://example.com/");
    expect(init.headers["User-Agent"]).toBe(USER_AGENT);
  });
});

describe("removal, release and cleanup", () => {
  it("never deletes a place whose badge is gone or whose page is 404", async () => {
    await seed(T.link, { host: "example.com", status: "active", first_verified: daysAgo(14), bound_at: daysAgo(20) });
    await seed(T.img, { declared_url: "https://example.com/gone", status: "active", first_verified: daysAgo(14) });
    pages["https://example.com/"] = () => page("<p>No badge here any more.</p>");
    const summary = await run();
    expect(await row(T.link)).toMatchObject({ status: "active", host: "example.com" });
    expect(await row(T.img)).toMatchObject({ status: "active" });
    expect(await days(T.link)).toBe(1);
    expect(summary.missing).toBe(2);
  });

  it("keeps a verified place when the fetch fails or the server errors", async () => {
    await seed(T.link, { host: "down.example", status: "active", first_verified: daysAgo(14), bound_at: daysAgo(20) });
    await seed(T.img, { host: "broken.example", status: "active", first_verified: daysAgo(14), bound_at: daysAgo(20) });
    pages["https://down.example/"] = () => {
      throw new TypeError("network down");
    };
    pages["https://broken.example/"] = () => new Response("oops", { status: 503 });
    const summary = await run();
    expect((await row(T.link)).status).toBe("active");
    expect((await row(T.img)).status).toBe("active");
    expect(summary.unknown).toBe(2);
  });

  it("never releases a bound host, even when not found for over 30 days", async () => {
    await seed(T.link, { host: "example.com", verify_method: "live", bound_at: daysAgo(31), last_seen: daysAgo(31).slice(0, 10) });
    pages["https://example.com/"] = () => page("<p>nothing</p>");
    await run();
    expect(await row(T.link)).toMatchObject({ host: "example.com", verify_method: "live", status: "dormant" });
  });

  it("keeps a never-found token bound under 30 days ago", async () => {
    await seed(T.link, { host: "example.com", bound_at: daysAgo(10) });
    pages["https://example.com/"] = () => page("<p>nothing</p>");
    await run();
    expect(await row(T.link)).toMatchObject({ host: "example.com", status: "active" });
  });

  it("deletes a token never bound or declared after 30 days, keeps a newer one", async () => {
    await seed(T.link, { status: "new", created_at: daysAgo(31) });
    await seed(T.img, { status: "new", created_at: daysAgo(5) });
    await run();
    expect(await row(T.link)).toBeNull();
    expect(await days(T.link)).toBe(0);
    expect(await row(T.img)).not.toBeNull();
  });
});

describe("batches and snapshot", () => {
  it("fetches in batches with a delay between them", async () => {
    for (let i = 0; i < 13; i++) await seed(`bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb${String(i).padStart(2, "0")}`, { host: `s${i}.example`, bound_at: daysAgo(3) });
    const sleep = vi.fn(async () => {});
    const summary = await runWeeklyCheck(env, { now: NOW, sleep });
    expect(summary.checked).toBe(13);
    expect(sleep).toHaveBeenCalledTimes(2); // batches of 6: 6 + 6 + 1
  });

  it("writes an anonymous weekly_counts snapshot", async () => {
    await seed(T.link, { host: "example.com", bound_at: daysAgo(3) });
    await seed(T.img, { host: "repo.example", label: "mostly-ai", bound_at: daysAgo(3) });
    pages["https://example.com/"] = () => page(`<a href="https://madeopenly.com/?t=${T.link}">x</a>`);
    pages["https://repo.example/"] = () => page(`<a href="https://madeopenly.com/?t=${T.img}">x</a>`);
    await run();
    const { results } = await env.DB.prepare("SELECT * FROM weekly_counts ORDER BY label").all();
    expect(results).toEqual([
      { week: "2026-W45", label: "human-ai", kind: "site", verified: 1, added: 1, dormant: 0, unverified: 0 },
      { week: "2026-W45", label: "mostly-ai", kind: "site", verified: 1, added: 1, dormant: 0, unverified: 0 },
    ]);
  });

  it("computes ISO weeks across a year boundary", () => {
    expect(isoWeek(new Date("2026-11-02T00:00:00Z"))).toBe("2026-W45");
    expect(isoWeek(new Date("2027-01-01T00:00:00Z"))).toBe("2026-W53");
    expect(isoWeek(new Date("2025-12-29T00:00:00Z"))).toBe("2026-W01");
  });

  it("is wired to the scheduled handler", async () => {
    await seed(T.link, { status: "new", created_at: "2020-01-01T00:00:00Z" });
    const ctx = createExecutionContext();
    await worker.scheduled(createScheduledController({ cron: "0 2 * * 1" }), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(await row(T.link)).toBeNull();
  });
});

describe("15-minute check of new places", () => {
  const runNew = () => runNewCheck(env, { now: NOW, sleep: async () => {} });
  const link = (t) => `<a href="https://madeopenly.com/?t=${t}">badge</a>`;

  it("verifies a new place found within 7 days", async () => {
    await seed(T.link, { declared_url: "https://example.com/about", status: "new", created_at: daysAgo(1) });
    pages["https://example.com/about"] = () => page(link(T.link));
    expect(await runNew()).toEqual({ checked: 1, verified: 1, missing: 0, unknown: 0, statuses: { 200: 1 }, dormant: 0 });
    expect(await row(T.link)).toMatchObject({ status: "active", first_verified: NOW.toISOString(), last_verified: NOW.toISOString() });
  });

  it("never deletes or releases, even when the badge is missing", async () => {
    await seed(T.link, { declared_url: "https://example.com/about", status: "declared", last_seen: null, created_at: daysAgo(2) });
    expect(await runNew()).toEqual({ checked: 1, verified: 0, missing: 1, unknown: 0, statuses: { 404: 1 }, dormant: 0 });
    expect(await row(T.link)).toMatchObject({ declared_url: "https://example.com/about", status: "declared" });
    expect(await days(T.link)).toBe(1);
  });

  it("skips verified places, places older than 7 days and unplaced tokens", async () => {
    await seed(T.link, { host: "a.example", status: "active", first_verified: daysAgo(1), bound_at: daysAgo(1) });
    await seed(T.img, { host: "b.example", status: "active", bound_at: daysAgo(8) });
    await seed(T.camo, { status: "new", created_at: daysAgo(1) });
    expect(await runNew()).toEqual({ checked: 0, verified: 0, missing: 0, unknown: 0, statuses: {}, dormant: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks once more after a 429, waiting what Retry-After says (capped)", async () => {
    await seed(T.link, { declared_url: "https://example.com/about", status: "new", created_at: daysAgo(1) });
    const replies = [new Response("slow down", { status: 429, headers: { "Retry-After": "60" } }), page(link(T.link))];
    pages["https://example.com/about"] = () => replies.shift();
    const waits = [];
    const summary = await runNewCheck(env, { now: NOW, sleep: async (ms) => waits.push(ms) });
    expect(summary).toEqual({ checked: 1, verified: 1, missing: 0, unknown: 0, statuses: { "429-first": 1, 200: 1 }, dormant: 0 });
    expect(waits).toEqual([5000]);
  });

  it("stays unknown when the retry is refused too", async () => {
    await seed(T.link, { declared_url: "https://example.com/about", status: "new", created_at: daysAgo(1) });
    pages["https://example.com/about"] = () => new Response("slow down", { status: 429 });
    const waits = [];
    const summary = await runNewCheck(env, { now: NOW, sleep: async (ms) => waits.push(ms) });
    expect(summary).toEqual({ checked: 1, verified: 0, missing: 0, unknown: 1, statuses: { "429-first": 1, 429: 1 }, dormant: 0 });
    expect(waits).toEqual([2000]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not write the weekly snapshot", async () => {
    await seed(T.link, { declared_url: "https://example.com/", status: "new", created_at: daysAgo(1) });
    pages["https://example.com/"] = () => page(link(T.link));
    await runNew();
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM weekly_counts").first()).n).toBe(0);
  });

  it("is wired to the 15-minute cron, separate from the weekly one", async () => {
    await seed(T.link, { declared_url: "https://example.com/", status: "new", created_at: daysAgo(1) });
    await seed(T.img, { status: "new", created_at: "2020-01-01T00:00:00Z" });
    pages["https://example.com/"] = () => page(link(T.link));
    const ctx = createExecutionContext();
    await worker.scheduled(createScheduledController({ cron: "*/15 * * * *" }), env, ctx);
    await waitOnExecutionContext(ctx);
    expect((await row(T.link)).status).toBe("active");
    expect(await row(T.img)).not.toBeNull(); // weekly cleanup did not run
  });
});
