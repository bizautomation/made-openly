import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { buildStats } from "../../src/stats.js";
import { call } from "./helpers.js";

const NOW = new Date("2026-11-09T03:00:00Z");

beforeAll(async () => {
  const db = env.DB;
  await db.batch(["badges", "daily", "weekly_counts"].map((t) => db.prepare(`DELETE FROM ${t}`)));
  const rows = [
    // token, label, kind, status, listed, host, declared_url, first_verified
    ["t01", "mostly-ai", "site", "active", "yes", "bizat.co", null, "2026-10-26T02:00:00Z"],
    ["t02", "human-ai", "post", "active", "yes", null, "https://daemon.substack.com/p/one", "2026-11-02T02:00:00Z"],
    ["t03", "human-ai", "repo", "active", "pending", null, "https://github.com/bizautomation/made-openly", "2026-11-09T02:00:00Z"],
    ["t04", "human-only", "product", "active", "reported", "tool.example", null, "2026-11-09T02:00:00Z"],
    ["t05", "human-only", "site", "active", "removed", "gone.example", null, "2026-11-09T02:00:00Z"],
    ["t06", "mostly-ai", "site", "new", "no", "notyet.example", null, null],
    ["t07", "human-ai", "site", "flagged", "no", "copy.example", null, null],
    ["t08", "human-ai", "site", "new", "no", null, null, null],
    ["t09", "mostly-ai", "site", "dormant", "yes", "quiet.example", null, "2026-10-01T02:00:00Z"],
    ["t10", "human-ai", "post", "declared", "asked", null, "https://x.substack.com/about", null],
  ];
  await db.batch(
    rows.map((r) =>
      db
        .prepare(
          `INSERT INTO badges (token, label, place_kind, status, listed, host, declared_url, first_verified, style, size, variant, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'light', 'large', 'robot', '2026-10-20T00:00:00Z')`,
        )
        .bind(...r.map((v) => (v === null ? null : v)).map((v, i) => (i === 0 ? `${v}aaaaaaaaaaaaaaaa` : v))),
    ),
  );
  await db.batch(
    [
      ["2026-W44", "mostly-ai", "site", 1],
      ["2026-W45", "mostly-ai", "site", 1],
      ["2026-W45", "human-ai", "post", 1],
      ["2026-W46", "mostly-ai", "site", 1],
      ["2026-W46", "human-ai", "post", 1],
      ["2026-W46", "human-ai", "repo", 1],
      ["2026-W46", "human-only", "product", 1],
      ["2026-W46", "human-only", "site", 1],
    ].map((r) => db.prepare("INSERT INTO weekly_counts (week, label, kind, verified) VALUES (?, ?, ?, ?)").bind(...r)),
  );
});

describe("/stats.json", () => {
  it("matches the SPEC.md section 10 schema against seeded data", async () => {
    expect(await buildStats(env.DB, { now: NOW })).toEqual({
      updated: "2026-11-09T03:00:00Z",
      total_verified: 5,
      by_label: { "mostly-ai": 1, "human-ai": 2, "human-only": 2 },
      by_kind: { site: 2, repo: 1, post: 1, product: 1 },
      by_label_kind: {
        "mostly-ai": { site: 1, repo: 0, post: 0, product: 0 },
        "human-ai": { site: 0, repo: 1, post: 1, product: 0 },
        "human-only": { site: 1, repo: 0, post: 0, product: 1 },
      },
      added_total: 7,
      dormant_total: 1,
      unverified_total: 1,
      by_status_label: {
        active: { "mostly-ai": 1, "human-ai": 2, "human-only": 2 },
        dormant: { "mostly-ai": 1, "human-ai": 0, "human-only": 0 },
        unverified: { "mostly-ai": 0, "human-ai": 1, "human-only": 0 },
      },
      weekly: [
        { week: "2026-W44", verified: 1, added: 0, dormant: 0, unverified: 0 },
        { week: "2026-W45", verified: 2, added: 0, dormant: 0, unverified: 0 },
        { week: "2026-W46", verified: 5, added: 0, dormant: 0, unverified: 0 },
      ],
      new_last_7_days: 3,
      // Only active places with listed = 'yes': pending, asked, reported, removed and dormant ones are hidden.
      listed_total: 2,
      // Newest first.
      listed: [
        { place: "daemon.substack.com/p/one", url: "https://daemon.substack.com/p/one", label: "human-ai", kind: "post", since: "2026-11-02" },
        { place: "bizat.co", url: "https://bizat.co/", label: "mostly-ai", kind: "site", since: "2026-10-26" },
      ],
    });
  });

  it("filters with ?since=", async () => {
    const s = await buildStats(env.DB, { now: NOW, since: "2026-11-02" });
    expect(s.total_verified).toBe(4);
    expect(s.weekly.map((w) => w.week)).toEqual(["2026-W45", "2026-W46"]);
    expect(s.listed.map((l) => l.place)).toEqual(["daemon.substack.com/p/one"]);
  });

  it("is served with an hour of cache and open CORS", async () => {
    const res = await call("/stats.json");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=3600");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect((await res.json()).total_verified).toBe(5);
  });

  it("rejects a bad since date", async () => {
    expect((await call("/stats.json?since=last-week")).status).toBe(400);
  });
});
