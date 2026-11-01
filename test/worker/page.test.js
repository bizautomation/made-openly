import { env } from "cloudflare:test";
import { exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { call, mockFetch, postJson } from "./helpers.js";
import { BAR_NOTE, EXAMPLES, MEANINGS, TEST, TIE_BREAK } from "../../src/labels.js";

describe("GET /", () => {
  it("serves the page with all seven sections in order and no cookie", async () => {
    const res = await call("/");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(res.headers.get("Set-Cookie")).toBeNull();
    expect(res.headers.get("Content-Security-Policy")).toContain("frame-src https://challenges.cloudflare.com");
    // Scripts from elsewhere: only Turnstile and the cookieless Cloudflare Web Analytics beacon.
    const csp = res.headers.get("Content-Security-Policy");
    expect(csp).toContain("script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com;");
    expect(csp).toContain("connect-src 'self' https://cloudflareinsights.com;");
    expect(csp).not.toMatch(/google|gtm|doubleclick|facebook/i);
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

describe("FAQ", () => {
  it("explains counting, hosting and the link, after the counter entry", async () => {
    const html = await (await call("/")).text();
    const faq = html.slice(html.indexOf('id="faq"'), html.indexOf('id="contact"'));
    const order = ["Can I trust the counter?", "When does my place start counting?",
      "Why does the badge image load from madeopenly.com? Can I host it myself?",
      "Why does the badge link back to madeopenly.com?",
    ].map((q) => faq.indexOf(`${q}</summary>`));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(faq).toContain('<details id="when-counting">');
    expect(faq).toContain('<details id="why-link">');
    expect(faq).toContain('<details id="host-it">');
    // The same words as the counter.
    for (const word of ['"added"', '"not verified yet"', '"not seen lately"']) expect(faq).toContain(word);
    expect(html).toContain('<a href="#faq">FAQ</a>');
  });
});

describe("plain badge download", () => {
  it("is the preview SVG as an attachment", async () => {
    const res = await call("/badge.svg?l=human-only&s=dark&z=small&v=wordmark&download=1");
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="made-openly-human-only-dark-small.svg"');
  });
});

describe("label meanings", () => {
  it("fills every placeholder and shows each meaning, the test and the bar note", async () => {
    const html = await (await call("/")).text();
    expect(html).not.toMatch(/__[A-Z][A-Za-z_-]*__/);
    for (const m of Object.values(MEANINGS)) expect(html.split(m).length - 1).toBe(3); // labels section, picker and FAQ
    expect(html).toContain(TEST);
    expect(html).toContain(BAR_NOTE);
    expect(html).not.toContain('id="badge-note"');
  });

  it("shows two examples per label and the tie-break, in order from human to AI", async () => {
    const html = await (await call("/")).text();
    for (const cases of Object.values(EXAMPLES)) for (const c of cases) expect(html).toContain(`<li>${c}</li>`);
    expect(html).toContain(TIE_BREAK);
    const at = (slug) => html.indexOf(`class="card ${slug}"`);
    expect(at("human-only")).toBeGreaterThan(0);
    expect(at("human-only")).toBeLessThan(at("human-ai"));
    expect(at("human-ai")).toBeLessThan(at("mostly-ai"));
  });

  it("tells someone who clicked a badge what its label means", async () => {
    const token = "notetoken0000000001";
    await env.DB.prepare(
      "INSERT OR REPLACE INTO badges (token, label, style, size, variant, created_at) VALUES (?, 'mostly-ai', 'light', 'large', 'robot', '2026-10-30T00:00:00Z')",
    ).bind(token).run();
    const html = await (await call(`/?t=${token}`)).text();
    expect(html).toContain('<p class="badge-note" id="badge-note"><b>This badge says: Mostly AI</b>');
    expect(html).toContain(`${MEANINGS["mostly-ai"]} ${BAR_NOTE}`);
  });

  it("shows no note for an unknown or malformed token, and records nothing", async () => {
    const before = await env.DB.prepare("SELECT COUNT(*) AS n FROM daily").first();
    for (const t of ["unknowntoken00000000", "<script>", ""]) {
      const html = await (await call(`/?t=${encodeURIComponent(t)}`)).text();
      expect(html).not.toContain('id="badge-note"');
    }
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM daily").first()).toEqual(before);
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

describe("review host madeopenly.bizat.co", () => {
  const onReview = (path) => exports.default.fetch(new Request(`https://madeopenly.bizat.co${path}`));

  it("marks every response noindex and noai", async () => {
    for (const path of ["/", "/stats.json", "/badge.svg", "/nope"]) {
      const res = await onReview(path);
      expect(res.headers.get("X-Robots-Tag")).toBe("noindex, nofollow, noarchive, noimageindex, noai, noimageai");
    }
    expect((await onReview("/")).status).toBe(200);
  });

  it("blocks every crawler in robots.txt", async () => {
    expect(await (await onReview("/robots.txt")).text()).toBe("User-agent: *\nDisallow: /\n");
  });

  it("leaves madeopenly.com indexable", async () => {
    expect((await call("/")).headers.get("X-Robots-Tag")).toBeNull();
  });
});

describe("POST /api/contact", () => {
  let fetchMock;
  beforeEach(() => (fetchMock = mockFetch((url) => (url === "https://api.resend.com/emails" ? Response.json({ id: "m1" }) : new Response("", { status: 404 })))));
  afterEach(() => vi.unstubAllGlobals());
  const msg = { name: "Ann", email: "ann@example.com", body: "Hello", turnstile_token: "pass-contact" };

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
