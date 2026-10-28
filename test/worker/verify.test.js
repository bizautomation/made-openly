import { createScheduledController, createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import worker from "../../src/index.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { USER_AGENT, decodeCamoUrls, isoWeek, pageHasToken, runWeeklyCheck } from "../../src/verify.js";
import { mockFetch } from "./helpers.js";

const NOW = new Date("2026-11-02T02:00:00Z");
const daysAgo = (d) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
const hex = (s) => [...s].map((c) => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");
const page = (body) => new Response(`<!doctype html><html><body>${body}</body></html>`, { headers: { "Content-Type": "text/html" } });

async function seed(token, cols) {
  const row = { label: "human-ai", style: "light", size: "large", variant: "robot", place_kind: "site", status: "bound", created_at: daysAgo(60), ...cols };
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
    expect(await row(T.link)).toMatchObject({ status: "verified", first_verified: NOW.toISOString(), last_verified: NOW.toISOString() });
  });

  it("in an img src", async () => {
    await seed(T.img, { host: "blog.example", bound_at: daysAgo(3) });
    pages["https://blog.example/"] = () => page(`<img src="https://madeopenly.com/b/${T.img}.svg?l=human-ai&amp;s=light" width="176" height="62">`);
    await run();
    expect((await row(T.img)).status).toBe("verified");
  });

  it("in a real-shaped GitHub camo URL on a declared repo", async () => {
    const original = `https://madeopenly.com/b/${T.camo}.svg?l=mostly-ai&s=light&z=large&v=robot&m=robot`;
    const camo = `https://camo.githubusercontent.com/9f2e1c3b8a7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f/${hex(original)}`;
    expect(decodeCamoUrls(`<img src="${camo}">`)).toEqual([original]);
    await seed(T.camo, { declared_url: "https://github.com/bizautomation/made-openly", verify_method: "address", place_kind: "repo", status: "new" });
    // The README link is unwrapped, but test the image alone: the camo src is the only trace.
    pages["https://github.com/bizautomation/made-openly"] = () =>
      page(`<article class="markdown-body"><p><a target="_blank" rel="noopener noreferrer nofollow" href="https://github.com/bizautomation/made-openly"><img src="${camo}" alt="Made Openly: Mostly AI" data-canonical-src="" style="max-width: 100%;"></a></p></article>`);
    await run();
    expect((await row(T.camo)).status).toBe("verified");
  });

  it("in a percent-encoded image proxy URL (Substack-style)", async () => {
    await seed(T.proxy, { declared_url: "https://someone.substack.com/p/hello", verify_method: "address", place_kind: "post", status: "new" });
    const src = `https://substackcdn.com/image/fetch/w_176,c_limit/${encodeURIComponent(`https://madeopenly.com/b/${T.proxy}.svg?l=human-ai`)}`;
    pages["https://someone.substack.com/p/hello"] = () => page(`<img src="${src}">`);
    await run();
    expect((await row(T.proxy)).status).toBe("verified");
  });

  it("does not match a longer token that starts with this one", () => {
    expect(pageHasToken(`<a href="https://madeopenly.com/?t=${T.link}9">`, T.link)).toBe(false);
    expect(pageHasToken(`<a href="https://madeopenly.com/?t=${T.link}&x=1">`, T.link)).toBe(true);
  });

  it("clears a flag when the badge is found at its first host", async () => {
    await seed(T.link, { host: "example.com", status: "flagged", bound_at: daysAgo(3) });
    pages["https://example.com/"] = () => page(`<a href="https://madeopenly.com/?t=${T.link}">x</a>`);
    await run();
    expect((await row(T.link)).status).toBe("verified");
  });

  it("sends the polite User-Agent", async () => {
    await seed(T.link, { host: "example.com", bound_at: daysAgo(3) });
    await run();
    const [, init] = fetchMock.mock.calls.find(([u]) => String(u) === "https://example.com/");
    expect(init.headers["User-Agent"]).toBe(USER_AGENT);
  });
});

describe("removal, release and cleanup", () => {
  it("deletes a verified place whose badge was removed, with its daily rows", async () => {
    await seed(T.link, { host: "example.com", status: "verified", first_verified: daysAgo(14), bound_at: daysAgo(20) });
    pages["https://example.com/"] = () => page("<p>No badge here any more.</p>");
    await run();
    expect(await row(T.link)).toBeNull();
    expect(await days(T.link)).toBe(0);
  });

  it("deletes a verified place whose page is gone (404)", async () => {
    await seed(T.link, { declared_url: "https://example.com/gone", status: "verified", first_verified: daysAgo(14) });
    await run();
    expect(await row(T.link)).toBeNull();
  });

  it("keeps a verified place when the fetch fails or the server errors", async () => {
    await seed(T.link, { host: "down.example", status: "verified", first_verified: daysAgo(14), bound_at: daysAgo(20) });
    await seed(T.img, { host: "broken.example", status: "verified", first_verified: daysAgo(14), bound_at: daysAgo(20) });
    pages["https://down.example/"] = () => {
      throw new TypeError("network down");
    };
    pages["https://broken.example/"] = () => new Response("oops", { status: 503 });
    const summary = await run();
    expect((await row(T.link)).status).toBe("verified");
    expect((await row(T.img)).status).toBe("verified");
    expect(summary.unknown).toBe(2);
  });

  it("releases a token never found and bound over 30 days ago", async () => {
    await seed(T.link, { host: "example.com", verify_method: "live", bound_at: daysAgo(31) });
    pages["https://example.com/"] = () => page("<p>nothing</p>");
    await run();
    expect(await row(T.link)).toMatchObject({ host: null, bound_at: null, status: "new", verify_method: null });
  });

  it("keeps a never-found token bound under 30 days ago", async () => {
    await seed(T.link, { host: "example.com", bound_at: daysAgo(10) });
    pages["https://example.com/"] = () => page("<p>nothing</p>");
    await run();
    expect(await row(T.link)).toMatchObject({ host: "example.com", status: "bound" });
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
      { week: "2026-W45", label: "human-ai", kind: "site", verified: 1 },
      { week: "2026-W45", label: "mostly-ai", kind: "site", verified: 1 },
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
