import { createExecutionContext, createScheduledController, env, waitOnExecutionContext } from "cloudflare:test";
import worker from "../../src/index.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendReviewEmail, signReview, verifyReview } from "../../src/moderation.js";
import { buildStats } from "../../src/stats.js";
import { call, mockFetch, postJson } from "./helpers.js";

const KEY = "test-signing-key";
let n = 0;
async function seed(cols = {}) {
  const token = `mod${String(++n).padStart(13, "0")}tok`;
  const row = {
    label: "human-ai", style: "light", size: "large", variant: "robot", place_kind: "site",
    status: "verified", listed: "no", host: `place${n}.example`, created_at: "2026-10-01T00:00:00Z",
    first_verified: "2026-10-05T02:00:00Z", ...cols,
  };
  const keys = Object.keys(row);
  await env.DB.prepare(`INSERT INTO badges (token, ${keys.join(", ")}) VALUES (?, ${keys.map(() => "?").join(", ")})`)
    .bind(token, ...keys.map((k) => row[k]))
    .run();
  return token;
}
const listed = async (token) => (await env.DB.prepare("SELECT listed FROM badges WHERE token = ?").bind(token).first()).listed;
const review = (k) => call(`/admin/review?k=${encodeURIComponent(k)}`);

let sent;
beforeEach(async () => {
  await env.DB.prepare("DELETE FROM badges").run();
  sent = [];
  mockFetch((url, init) => {
    if (url === "https://api.resend.com/emails") {
      sent.push(JSON.parse(init.body));
      return Response.json({ id: "m1" });
    }
    return new Response("not found", { status: 404 });
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("POST /api/list", () => {
  it("moves a verified place to pending", async () => {
    const token = await seed();
    const res = await postJson("/api/list", { token });
    expect(res.status).toBe(200);
    expect(await listed(token)).toBe("pending");
  });

  it("refuses a place that is not verified yet", async () => {
    const token = await seed({ status: "bound", first_verified: null });
    expect((await postJson("/api/list", { token })).status).toBe(409);
    expect(await listed(token)).toBe("no");
  });

  it("never re-opens a removed place, and leaves a listed one alone", async () => {
    const removed = await seed({ listed: "removed" });
    const yes = await seed({ listed: "yes" });
    expect((await postJson("/api/list", { token: removed })).status).toBe(409);
    expect((await postJson("/api/list", { token: yes })).status).toBe(200);
    expect(await listed(removed)).toBe("removed");
    expect(await listed(yes)).toBe("yes");
  });

  it("rejects bad input and unknown tokens", async () => {
    expect((await postJson("/api/list", { token: "x" })).status).toBe(400);
    expect((await postJson("/api/list", { token: "unknowntoken00000000" })).status).toBe(404);
    const res = await call("/api/list", { method: "POST", headers: { "CF-Connecting-IP": "198.51.100.40" }, body: "nope" });
    expect(res.status).toBe(400);
  });

  it("limits one IP to 3 per minute", async () => {
    const token = await seed();
    for (let i = 0; i < 3; i++) expect((await postJson("/api/list", { token }, "198.51.100.41")).status).toBe(200);
    expect((await postJson("/api/list", { token }, "198.51.100.41")).status).toBe(429);
  });
});

describe("POST /api/report", () => {
  it("hides a listed place immediately, and it still counts", async () => {
    const token = await seed({ listed: "yes", host: "bad.example" });
    const before = await buildStats(env.DB);
    expect(before.listed.map((p) => p.place)).toContain("bad.example");

    expect((await postJson("/api/report", { place: "bad.example" })).status).toBe(200);
    expect(await listed(token)).toBe("reported");
    const after = await buildStats(env.DB);
    expect(after.listed.map((p) => p.place)).not.toContain("bad.example");
    expect(after.total_verified).toBe(before.total_verified);
    const stats = await (await call("/stats.json")).json();
    expect(stats.listed.map((p) => p.place)).not.toContain("bad.example");
  });

  it("matches a declared address by its public name", async () => {
    const token = await seed({ listed: "yes", host: null, declared_url: "https://github.com/bizautomation/made-openly/" });
    expect((await postJson("/api/report", { place: "github.com/bizautomation/made-openly" })).status).toBe(200);
    expect(await listed(token)).toBe("reported");
  });

  it("only reports places on the list", async () => {
    const token = await seed({ listed: "pending", host: "quiet.example" });
    expect((await postJson("/api/report", { place: "quiet.example" })).status).toBe(404);
    expect((await postJson("/api/report", { place: "" })).status).toBe(400);
    expect(await listed(token)).toBe("pending");
  });
});

describe("signed review links", () => {
  it("round-trips, and fails with the wrong key or a changed payload", async () => {
    const k = await signReview(KEY, "abcdefghijklmnop", "list-approve");
    expect(await verifyReview(KEY, k)).toMatchObject({ t: "abcdefghijklmnop", a: "list-approve" });
    expect(await verifyReview("other-key", k)).toBeNull();
    const [body, sig] = k.split(".");
    const forged = btoa(JSON.stringify({ t: "abcdefghijklmnop", a: "report-remove", exp: Date.now() + 1e9 })).replace(/=+$/, "");
    expect(await verifyReview(KEY, `${forged}.${sig}`)).toBeNull();
    expect(await verifyReview(KEY, `${body}.${sig}x`)).toBeNull();
    expect(await verifyReview(KEY, body)).toBeNull();
    expect(await verifyReview(KEY, "")).toBeNull();
  });

  it("approves a pending place from a valid link", async () => {
    const token = await seed({ listed: "pending" });
    const res = await review(await signReview(KEY, token, "list-approve"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(await listed(token)).toBe("yes");
  });

  it("rejects a pending place back to no", async () => {
    const token = await seed({ listed: "pending" });
    expect((await review(await signReview(KEY, token, "list-reject"))).status).toBe(200);
    expect(await listed(token)).toBe("no");
  });

  it("removes a reported place, and it still counts", async () => {
    const token = await seed({ listed: "reported" });
    const before = (await buildStats(env.DB)).total_verified;
    expect((await review(await signReview(KEY, token, "report-remove"))).status).toBe(200);
    expect(await listed(token)).toBe("removed");
    expect((await buildStats(env.DB)).total_verified).toBe(before);
  });

  it("refuses an expired link and changes nothing", async () => {
    const token = await seed({ listed: "pending" });
    const k = await signReview(KEY, token, "list-approve", new Date(Date.now() - 15 * 86_400_000));
    expect((await review(k)).status).toBe(403);
    expect(await listed(token)).toBe("pending");
  });

  it("refuses a bad signature and changes nothing", async () => {
    const token = await seed({ listed: "pending" });
    const k = await signReview("wrong-key", token, "list-approve");
    expect((await review(k)).status).toBe(403);
    expect((await call("/admin/review")).status).toBe(403);
    expect(await listed(token)).toBe("pending");
  });

  it("does nothing when the place was already reviewed", async () => {
    const token = await seed({ listed: "pending" });
    const reject = await signReview(KEY, token, "list-reject");
    expect((await review(await signReview(KEY, token, "list-approve"))).status).toBe(200);
    expect((await review(reject)).status).toBe(409);
    expect(await listed(token)).toBe("yes");
  });
});

describe("weekly review email", () => {
  it("sends nothing when there is nothing to review", async () => {
    await seed({ listed: "yes" });
    expect(await sendReviewEmail(env)).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it("lists pending and reported places with working signed links", async () => {
    const pending = await seed({ listed: "pending", host: "ask.example" });
    const reported = await seed({ listed: "reported", host: "flagme.example" });
    expect(await sendReviewEmail(env)).toBe(2);
    expect(sent).toHaveLength(1);
    const mail = sent[0];
    expect(mail).toMatchObject({ from: "Made Openly <we@madeopenly.com>", to: ["owner@example.com"], subject: "Made Openly: 2 to review" });
    expect(mail.text).toContain("ask.example (human-ai, site)");
    expect(mail.text).toContain("flagme.example (human-ai, site)");

    const links = [...mail.text.matchAll(/https:\/\/madeopenly\.com(\/admin\/review\?k=\S+)/g)].map((m) => m[1]);
    expect(links).toHaveLength(4);
    expect((await call(links[0])).status).toBe(200); // Approve the pending place
    expect((await call(links[3])).status).toBe(200); // Remove the reported place
    expect(await listed(pending)).toBe("yes");
    expect(await listed(reported)).toBe("removed");
  });

  it("runs from the Monday cron", async () => {
    // Not a place yet, so the weekly check leaves it alone and fetches nothing.
    await seed({ listed: "pending", host: null, declared_url: null, created_at: new Date().toISOString() });
    const ctx = createExecutionContext();
    await worker.scheduled(createScheduledController({ cron: "0 2 * * 1" }), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(sent.some((m) => m.subject === "Made Openly: 1 to review")).toBe(true);
  });
});
