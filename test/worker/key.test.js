import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { neutralBadge } from "../../src/badge.js";
import { base32, decryptKey, secretMatches, totp, unbase32 } from "../../src/key.js";
import { call, mockFetch, postJson } from "./helpers.js";

const valid = { label: "human-ai", style: "light", size: "large", variant: "robot", mascot: "robot", turnstile_token: "pass-generate" };
let mails;
beforeEach(async () => {
  await env.DB.batch(["badges", "daily", "key_attempts"].map((t) => env.DB.prepare(`DELETE FROM ${t}`)));
  mails = [];
  mockFetch((url, init) => {
    if (url === "https://api.resend.com/emails") {
      mails.push(JSON.parse(init.body));
      return Response.json({ id: "m1" });
    }
    return new Response("not found", { status: 404 });
  });
});
afterEach(() => vi.unstubAllGlobals());

const make = async (extra = {}) => (await postJson("/api/generate", { ...valid, ...extra })).json();
const row = (t) => env.DB.prepare("SELECT * FROM badges WHERE token = ?").bind(t).first();
const seen = (t) => env.DB.prepare("UPDATE badges SET status = 'active', host = 'mine.example', last_seen = '2026-11-01', first_verified = '2026-11-01T00:00:00Z' WHERE token = ?").bind(t).run();
const step = () => Math.floor(Date.now() / 30_000);

describe("listing at Generate", () => {
  it("list true stores 'asked', false or missing stores 'no'", async () => {
    const a = await make({ list: true });
    const b = await make({ list: false });
    const c = await make();
    expect(a.listed).toBe("asked");
    expect((await row(a.token)).listed).toBe("asked");
    expect((await row(b.token)).listed).toBe("no");
    expect((await row(c.token)).listed).toBe("no");
  });

  it("a declared address starts as 'declared'", async () => {
    const a = await make({ declared_url: "https://x.substack.com/about" });
    expect((await row(a.token)).status).toBe("declared");
  });
});

describe("the badge key", () => {
  it("is 32 base32 characters, encrypted at rest, and never logged", async () => {
    const log = vi.spyOn(console, "log");
    const out = await make();
    expect(out.key).toMatch(/^[A-Z2-7]{32}$/);
    const r = await row(out.token);
    expect(JSON.stringify(r)).not.toContain(out.key);
    expect(await decryptKey(env.KEY_SECRET, r.key_enc)).toBe(out.key);
    expect(JSON.stringify(log.mock.calls)).not.toContain(out.key);
    log.mockRestore();
  });

  it("round-trips base32", () => {
    const bytes = crypto.getRandomValues(new Uint8Array(20));
    expect(unbase32(base32(bytes))).toEqual(bytes);
  });

  it("opens the badge with the key alone (the #k= link)", async () => {
    const out = await make({ declared_url: "https://x.substack.com/about" });
    const res = await postJson("/api/manage", { secret: out.key.toLowerCase() });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ token: out.token, place: "x.substack.com/about", status: "declared", listed: "no" });
  });

  it("opens the badge by address and 6-digit code", async () => {
    const out = await make({ declared_url: "https://x.substack.com/about" });
    const code = await totp(out.key, step());
    const res = await postJson("/api/manage", { place: "x.substack.com/about", secret: code });
    expect(res.status).toBe(200);
  });

  it("accepts the code at -1, 0 and +1 step, and not beyond", async () => {
    const out = await make();
    const r = await row(out.token);
    const now = new Date("2026-11-01T12:00:10Z");
    const s = Math.floor(now.getTime() / 30_000);
    for (const d of [-1, 0, 1]) expect(await secretMatches(env.KEY_SECRET, r, await totp(out.key, s + d), now)).toBe(true);
    for (const d of [-3, -2, 2, 3]) expect(await secretMatches(env.KEY_SECRET, r, await totp(out.key, s + d), now)).toBe(false);
  });

  it("refuses the 6th attempt in an hour, even with the right key", async () => {
    const out = await make();
    const wrong = [];
    for (let i = 0; i < 5; i++) wrong.push((await postJson("/api/manage", { token: out.token, secret: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" })).status);
    expect(wrong).toEqual([403, 403, 403, 403, 403]);
    expect((await postJson("/api/manage", { token: out.token, secret: out.key })).status).toBe(429);
    const attempts = await env.DB.prepare("SELECT * FROM key_attempts").all();
    expect(Object.keys(attempts.results[0]).sort()).toEqual(["count", "hour", "token"]);
  });

  it("turns the public listing on and off", async () => {
    const out = await make();
    await seen(out.token);
    let res = await postJson("/api/manage/list", { token: out.token, secret: out.key, on: true });
    expect((await res.json()).listed).toBe("pending");
    res = await postJson("/api/manage/list", { token: out.token, secret: out.key, on: false });
    expect((await res.json()).listed).toBe("no");
  });

  it("removes the place completely; the badge then draws neutral and records nothing", async () => {
    const out = await make({ size: "small" });
    await call(`/b/${out.token}.svg`, { headers: { Referer: "https://mine.example/" } });
    expect((await postJson("/api/manage/remove", { token: out.token, secret: "000000" })).status).toBe(403);
    const res = await postJson("/api/manage/remove", { token: out.token, secret: out.key });
    expect(res.status).toBe(200);
    expect(await row(out.token)).toBeNull();
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM daily WHERE token = ?").bind(out.token).first()).n).toBe(0);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM key_attempts WHERE token = ?").bind(out.token).first()).n).toBe(0);
    const svg = await (await call(`/b/${out.token}.svg?z=small&s=light`, { headers: { Referer: "https://mine.example/" } })).text();
    expect(svg).toBe(neutralBadge("small", "light"));
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM daily").first()).n).toBe(0);
  });

  it("says when a badge has no key", async () => {
    await env.DB.prepare("INSERT INTO badges (token, label, style, size, variant, status, created_at) VALUES ('oldbadge000000000000', 'human-ai', 'light', 'large', 'robot', 'active', '2026-10-01')").run();
    const res = await postJson("/api/manage", { token: "oldbadge000000000000", secret: "123456" });
    expect(res.status).toBe(409);
  });
});

describe("POST /api/send-key", () => {
  it("rejects a wrong key, sends once, and stores no email", async () => {
    const out = await make();
    const email = "maker@example.com";
    expect((await postJson("/api/send-key", { token: out.token, key: "A".repeat(32), email })).status).toBe(403);
    expect(mails).toHaveLength(0);
    expect((await postJson("/api/send-key", { token: out.token, key: out.key, email })).status).toBe(200);
    expect(mails).toHaveLength(1);
    expect(mails[0].to).toEqual([email]);
    expect(mails[0].text).toContain(`https://madeopenly.com/manage#k=${out.key}`);
    expect((await postJson("/api/send-key", { token: out.token, key: out.key, email })).status).toBe(409);
    expect(mails).toHaveLength(1);
    const dump = JSON.stringify((await env.DB.prepare("SELECT * FROM badges").all()).results);
    expect(dump).not.toContain("maker@");
    const messages = (await env.DB.prepare("SELECT COUNT(*) AS n FROM messages").first()).n;
    expect(messages).toBe(0);
  });
});

describe("pages", () => {
  it("the picker has the list checkbox, unticked, and the key box with four buttons", async () => {
    const html = await (await call("/")).text();
    expect(html).toMatch(/<input type="checkbox" name="list" id="list-me">\s*Name this place on the public list/);
    expect(html).toContain("Your place appears on the list after the badge is found there and we approve it.");
    const box = html.slice(html.indexOf('id="keybox"'), html.indexOf("</div>\n      <div class=\"block\">", html.indexOf('id="keybox"')));
    expect(box.match(/data-key="/g)).toHaveLength(4);
    for (const w of ["Copy link", "Save picture", "Add to authenticator", "Email it to me"]) expect(box).toContain(w);
    expect(box).toContain("Keep a key to manage it later?");
    expect(box).toContain("We can't show it again.");
    // Words never shown on the page (scripts may use otpauth:// and location.hash).
    const visible = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ");
    expect(visible).not.toMatch(/TOTP|2FA|hash|encrypt/i);
  });

  it("the counter shows four numbers and the toggle", async () => {
    const html = await (await call("/")).text();
    for (const id of ["n-added", "n-active", "n-dormant", "n-unverified", "show-added"]) expect(html).toContain(`id="${id}"`);
    expect(html).toContain("not seen lately");
    expect(html).toContain("not verified yet");
  });

  it("serves /manage without the key reaching the server", async () => {
    const res = await call("/manage");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const html = await res.text();
    expect(html).toContain("Key or 6-digit code");
    expect(html).toContain('location.hash');
  });
});
