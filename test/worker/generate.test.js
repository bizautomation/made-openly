import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanDeclaredUrl, handleGenerate, insertBadge, placeKind } from "../../src/generate.js";
import { call, mockFetch, postJson } from "./helpers.js";

const valid = { label: "human-ai", style: "light", size: "large", variant: "robot", mascot: "robot", turnstile_token: "pass" };

beforeEach(() => mockFetch());
afterEach(() => vi.unstubAllGlobals());

describe("POST /api/generate", () => {
  it("creates a token and returns the snippet", async () => {
    const res = await postJson("/api/generate", valid);
    expect(res.status).toBe(201);
    const out = await res.json();
    expect(out.token).toMatch(/^[0-9a-f]{32}$/);
    expect(out.snippet).toBe(
      `<a href="https://madeopenly.com/?t=${out.token}" title="Made Openly: Human + AI">\n` +
        `  <img src="https://madeopenly.com/b/${out.token}.svg?l=human-ai&s=light&z=large&v=robot&m=robot"\n` +
        `       width="176" height="62" alt="Made Openly: Human + AI">\n` +
        `</a>`,
    );
    const row = await env.DB.prepare("SELECT * FROM badges WHERE token = ?").bind(out.token).first();
    expect(row).toMatchObject({ label: "human-ai", status: "new", place_kind: "site", verify_method: null, host: null, listed: "no" });
  });

  it("stores a declared address as Way B", async () => {
    const res = await postJson("/api/generate", { ...valid, size: "small", declared_url: "https://github.com/bizautomation/made-openly#readme" });
    const out = await res.json();
    expect(out.snippet).toContain('width="88" height="31"');
    const row = await env.DB.prepare("SELECT * FROM badges WHERE token = ?").bind(out.token).first();
    expect(row).toMatchObject({ declared_url: "https://github.com/bizautomation/made-openly", place_kind: "repo", verify_method: "address" });
  });

  it.each([
    ["unknown label", { ...valid, label: "all-ai" }],
    ["unknown style", { ...valid, style: "neon" }],
    ["unknown mascot", { ...valid, mascot: "bird" }],
    ["http address", { ...valid, declared_url: "http://example.com/" }],
    ["not an address", { ...valid, declared_url: "javascript:alert(1)" }],
  ])("rejects %s", async (_, body) => {
    expect((await postJson("/api/generate", body)).status).toBe(400);
  });

  it("rejects a body that is not JSON", async () => {
    for (const body of ["not json", '"a string"', "[1]"]) {
      const res = await call("/api/generate", { method: "POST", body });
      expect(res.status).toBe(400);
    }
  });

  it("rejects a failed Turnstile check and creates nothing", async () => {
    const count = async () => (await env.DB.prepare("SELECT COUNT(*) AS n FROM badges").first()).n;
    const before = await count();
    const res = await postJson("/api/generate", { ...valid, turnstile_token: "fail" });
    expect(res.status).toBe(403);
    expect(await count()).toBe(before);
  });

  it("rejects a missing Turnstile token", async () => {
    const { turnstile_token, ...rest } = valid;
    expect((await postJson("/api/generate", rest)).status).toBe(403);
  });

  it("limits one IP to 5 per minute", async () => {
    const statuses = [];
    for (let i = 0; i < 6; i++) statuses.push((await postJson("/api/generate", valid, "198.51.100.7")).status);
    expect(statuses).toEqual([201, 201, 201, 201, 201, 429]);
  });
});

describe("token conflicts", () => {
  const row = { label: "human-ai", style: "light", size: "large", variant: "robot", mascot: "robot", declared_url: null, place_kind: "site", verify_method: null, created_at: "2026-10-28T00:00:00Z" };

  it("retries on a conflict and succeeds with a new token", async () => {
    await insertBadge(env.DB, row, () => "taken0000000000000000000000000000");
    const tokens = ["taken0000000000000000000000000000", "fresh0000000000000000000000000000"];
    const make = vi.fn(() => tokens.shift());
    expect(await insertBadge(env.DB, row, make)).toBe("fresh0000000000000000000000000000");
    expect(make).toHaveBeenCalledTimes(2);
  });

  it("stops after 3 tries and returns an error", async () => {
    await insertBadge(env.DB, row, () => "taken0000000000000000000000000000");
    const make = vi.fn(() => "taken0000000000000000000000000000");
    expect(await insertBadge(env.DB, row, make)).toBeNull();
    expect(make).toHaveBeenCalledTimes(3);

    const req = new Request("https://madeopenly.com/api/generate", {
      method: "POST",
      headers: { "CF-Connecting-IP": "192.0.2.50" },
      body: JSON.stringify({ label: "human-ai", turnstile_token: "pass" }),
    });
    const res = await handleGenerate(req, env, make);
    expect(res.status).toBe(503);
    expect(make).toHaveBeenCalledTimes(6);
  });
});

describe("place kind (SPEC.md 8.4)", () => {
  it.each([
    ["https://github.com/bizautomation/made-openly", false, "repo"],
    ["https://github.com/bizautomation", false, "site"],
    ["https://conversationdaemon.substack.com/p/hello", false, "post"],
    ["https://medium.com/@someone/a-post-123", false, "post"],
    ["https://someone.medium.com/a-post-123", false, "post"],
    ["https://bizat.co/", true, "product"],
    [null, true, "product"],
    ["https://bizat.co/", false, "site"],
    [null, false, "site"],
  ])("%s (product: %s) is %s", (url, isProduct, kind) => {
    expect(placeKind(url, isProduct)).toBe(kind);
  });

  it("only accepts https addresses with a real host", () => {
    expect(cleanDeclaredUrl("https://example.com/a#b")).toBe("https://example.com/a");
    expect(cleanDeclaredUrl("https://localhost/")).toBeNull();
    expect(cleanDeclaredUrl("https://user:pw@example.com/")).toBeNull();
    expect(cleanDeclaredUrl("ftp://example.com/")).toBeNull();
  });
});
