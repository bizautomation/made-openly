import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { call, mockFetch, postJson } from "./helpers.js";

describe("GET /", () => {
  it("serves the page with all seven sections in order and no cookie", async () => {
    const res = await call("/");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(res.headers.get("Set-Cookie")).toBeNull();
    expect(res.headers.get("Content-Security-Policy")).toContain("frame-src https://challenges.cloudflare.com");
    const html = await res.text();
    const order = ['class="hero"', 'id="why"', 'id="get"', 'id="count"', 'id="faq"', 'id="contact"', 'id="privacy"'].map((m) => html.indexOf(m));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).toContain(`const SITE_KEY = "${env.TURNSTILE_SITE_KEY}"`);
    expect(html).toContain('"slug":"robot"');
    expect(html).not.toContain("__MASCOTS__");
    expect(html).not.toMatch(/fonts\.googleapis|google-analytics|googletagmanager|document\.cookie|localStorage/);
  });
});

describe("plain badge download", () => {
  it("is the preview SVG as an attachment", async () => {
    const res = await call("/badge.svg?l=human-only&s=dark&z=small&v=wordmark&download=1");
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="made-openly-human-only-dark-small.svg"');
  });
});

describe("AI assistant prompt", () => {
  it("is on the page with a Copy button, and keeps the badge loading from madeopenly.com", async () => {
    const html = await (await call("/")).text();
    expect(html).toContain('<pre id="ai-prompt"></pre>');
    expect(html).toContain('data-copy="ai-prompt"');
    expect(html).toContain("Do not download the image");
    expect(html).toMatch(/\$\("ai-block"\)\.hidden = data\.place_kind === "post"/);
  });
});

describe("POST /api/contact", () => {
  let fetchMock;
  beforeEach(() => (fetchMock = mockFetch((url) => (url === "https://api.resend.com/emails" ? Response.json({ id: "m1" }) : new Response("", { status: 404 })))));
  afterEach(() => vi.unstubAllGlobals());
  const msg = { name: "Ann", email: "ann@example.com", body: "Hello", turnstile_token: "pass" };

  it("saves the message", async () => {
    const res = await postJson("/api/contact", msg);
    expect(res.status).toBe(201);
    const row = await env.DB.prepare("SELECT * FROM messages ORDER BY id DESC").first();
    expect(row).toMatchObject({ name: "Ann", email: "ann@example.com", body: "Hello" });
    expect(Object.keys(row).sort()).toEqual(["body", "created_at", "email", "id", "name"]);
  });

  it("forwards the message to the owner, reply-to the sender", async () => {
    await postJson("/api/contact", msg);
    await vi.waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u) === "https://api.resend.com/emails")).toBe(true));
    const [, init] = fetchMock.mock.calls.find(([u]) => String(u) === "https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer test-resend-key");
    expect(JSON.parse(init.body)).toEqual({
      from: "Made Openly <we@madeopenly.com>",
      to: ["owner@example.com"],
      subject: "Made Openly contact from Ann",
      text: "Ann <ann@example.com>\n\nHello",
      reply_to: "ann@example.com",
    });
  });

  it("rejects a failed Turnstile check", async () => {
    expect((await postJson("/api/contact", { ...msg, turnstile_token: "fail" })).status).toBe(403);
  });

  it.each([
    ["no email", { ...msg, email: "" }],
    ["a bad email", { ...msg, email: "ann" }],
    ["no message", { ...msg, body: "  " }],
    ["a huge message", { ...msg, body: "x".repeat(5001) }],
  ])("rejects %s", async (_, body) => {
    expect((await postJson("/api/contact", body)).status).toBe(400);
  });

  it("limits one IP to 1 per minute", async () => {
    expect((await postJson("/api/contact", msg, "198.51.100.99")).status).toBe(201);
    expect((await postJson("/api/contact", msg, "198.51.100.99")).status).toBe(429);
  });
});
