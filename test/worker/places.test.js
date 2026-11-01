import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { PAGE_SIZE } from "../../src/places.js";
import { call } from "./helpers.js";

async function seed(rows) {
  await env.DB.prepare("DELETE FROM badges").run();
  await env.DB.batch(
    rows.map(([token, label, kind, listed, host, declared_url, first_verified]) =>
      env.DB.prepare(
        `INSERT INTO badges (token, label, place_kind, status, listed, host, declared_url, first_verified, style, size, variant, created_at)
         VALUES (?, ?, ?, 'active', ?, ?, ?, ?, 'light', 'large', 'robot', '2026-10-01T00:00:00Z')`,
      ).bind(`${token}aaaaaaaaaaaaaaaa`, label, kind, listed, host, declared_url, first_verified),
    ),
  );
}

describe("GET /places", () => {
  beforeEach(() =>
    seed([
      ["p01", "mostly-ai", "site", "yes", "bizat.co", null, "2026-10-26T02:00:00Z"],
      ["p02", "human-ai", "post", "yes", null, "https://daemon.substack.com/p/one", "2026-11-02T02:00:00Z"],
      ["p03", "human-only", "repo", "pending", null, "https://github.com/a/b", "2026-11-03T02:00:00Z"],
      ["p04", "mostly-ai", "site", "reported", "bad.example", null, "2026-11-04T02:00:00Z"],
    ]),
  );

  it("lists named places newest first, with ugc nofollow links", async () => {
    const res = await call("/places");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(res.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
    expect(res.headers.get("Set-Cookie")).toBeNull();
    const html = await res.text();
    expect(html).toContain("<title>Places wearing Made Openly</title>");
    expect(html).toContain("2 named");
    expect(html.indexOf("daemon.substack.com/p/one")).toBeLessThan(html.indexOf("bizat.co"));
    expect(html).toContain('href="https://bizat.co/" rel="ugc nofollow noopener" target="_blank"');
    expect(html).toContain('href="https://daemon.substack.com/p/one" rel="ugc nofollow noopener"');
    // Pending and reported places are hidden.
    expect(html).not.toContain("github.com/a/b");
    expect(html).not.toContain("bad.example");
    // Shares the home page's nav and footer, pointing back to it.
    expect(html).toContain('href="/#faq"');
    expect(html).toContain('id="privacy"');
    expect(html).not.toMatch(/__[A-Z][A-Za-z_-]*__/);
  });

  it("filters by label and kind, and ignores unknown values", async () => {
    let html = await (await call("/places?l=human-ai")).text();
    expect(html).toContain("daemon.substack.com/p/one");
    expect(html).not.toContain('href="https://bizat.co/"');
    expect(html).toContain('href="/places?l=human-ai" aria-current="true"');
    html = await (await call("/places?k=site")).text();
    expect(html).toContain('href="https://bizat.co/"');
    expect(html).not.toContain('href="https://daemon.substack.com/p/one"');
    html = await (await call("/places?l=human-only&k=post")).text();
    expect(html).toContain("No named places match yet.");
    html = await (await call("/places?l=%3Cscript%3E&k=x&p=abc")).text();
    expect(html).toContain("2 named");
    expect(html).not.toContain("<script>alert");
  });

  it("escapes place names", async () => {
    await seed([["p09", "mostly-ai", "site", "yes", 'x"><img src=x>.example', null, "2026-10-26T02:00:00Z"]]);
    const html = await (await call("/places")).text();
    expect(html).not.toContain("<img src=x>");
    expect(html).toContain("&lt;img src=x&gt;");
  });

  it("pages 50 at a time with a Show more link", async () => {
    const rows = [];
    for (let i = 0; i < PAGE_SIZE + 3; i++)
      rows.push([`q${String(i).padStart(3, "0")}`, "mostly-ai", "site", "yes", `s${i}.example`, null, new Date(Date.UTC(2026, 9, 1) + i * 3_600_000).toISOString()]);
    await seed(rows);
    const first = await (await call("/places")).text();
    expect(first.match(/rel="ugc nofollow noopener"/g)).toHaveLength(PAGE_SIZE);
    expect(first).toContain('href="/places?p=2"');
    expect(first).toContain(`s${PAGE_SIZE + 2}.example`);
    const second = await (await call("/places?p=2")).text();
    expect(second.match(/rel="ugc nofollow noopener"/g)).toHaveLength(3);
    expect(second).toContain("s0.example");
    expect(second).not.toContain("Show more");
  });
});

describe("home page teaser", () => {
  it("links to /places from the nav and the named list", async () => {
    const html = await (await call("/")).text();
    expect(html).toContain('<a href="/places">Places</a>');
    expect(html).toContain('id="see-all" href="/places"');
    expect(html).toContain('rel="ugc nofollow noopener"');
  });
});
