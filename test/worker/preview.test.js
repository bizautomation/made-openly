import { exports } from "cloudflare:workers";
import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { badge } from "../../src/badge.js";

const get = (path, init) => exports.default.fetch(new Request(`https://madeopenly.com${path}`, init));

describe("GET /badge.svg", () => {
  it("serves the generator output for the given settings", async () => {
    const res = await get("/badge.svg?l=mostly-ai&s=dark&z=small&v=wordmark&m=robot");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/svg+xml");
    expect(await res.text()).toBe(badge("small", "dark", "mostly-ai", "wordmark"));
  });

  it("defaults to large, light, Human + AI, robot", async () => {
    const res = await get("/badge.svg");
    expect(await res.text()).toBe(badge("large", "light", "human-ai", "robot"));
  });

  it("rejects unknown settings", async () => {
    expect((await get("/badge.svg?l=nope")).status).toBe(400);
  });

  it("never records anything", async () => {
    await get("/badge.svg", { headers: { Referer: "https://example.com/" } });
    const { n } = await env.DB.prepare("SELECT (SELECT COUNT(*) FROM badges) + (SELECT COUNT(*) FROM daily) AS n").first();
    expect(n).toBe(0);
  });
});
