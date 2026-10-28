// Guards the privacy rule (SPEC.md 11): no IP, user agent, cookie or visitor
// identifier is stored or logged. Fails if new code reaches for any of them.
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");
const src = readdirSync(new URL("../../src", import.meta.url)).map((f) => [`src/${f}`, read(`src/${f}`)]);
const hits = (pattern) => src.filter(([, text]) => pattern.test(text)).map(([f]) => f);

describe("privacy", () => {
  it("reads the client IP only in the rate limiter", () => {
    expect(hits(/CF-Connecting-IP/i)).toEqual(["src/generate.js"]);
    expect(read("src/generate.js").match(/CF-Connecting-IP/gi)).toHaveLength(1);
  });

  it("never reads forwarded IPs, the visitor's user agent or request.cf", () => {
    expect(hits(/x-forwarded-for|x-real-ip|true-client-ip|remoteip|request\.cf\b/i)).toEqual([]);
    expect(hits(/headers\.get\(\s*["']user-agent/i)).toEqual([]);
  });

  it("never sets or reads a cookie, or uses browser storage", () => {
    expect(hits(/set-cookie|document\.cookie|localStorage|sessionStorage|indexedDB/i)).toEqual([]);
  });

  it("logs counts and HTTP statuses only", () => {
    const logs = src.flatMap(([f, text]) => [...text.matchAll(/console\.\w+\(([^)]*)\)/g)].map((m) => `${f}: ${m[1]}`));
    expect(logs).toEqual([
      'src/index.js: "weekly check", JSON.stringify(summary',
      'src/mail.js: "mail failed", res.status',
      'src/mail.js: "mail failed", "network"',
    ]);
  });

  it("has no column for a visitor in the schema", () => {
    const sql = read("migrations/0001_init.sql").replace(/--.*$/gm, "");
    expect(sql).not.toMatch(/\b(ip|ip_address|user_agent|ua|cookie|visitor|session|fingerprint|referer|referrer)\b/i);
  });

  it("turns on no request logging", () => {
    expect(read("wrangler.toml")).not.toMatch(/observability|logpush|tail_consumers/i);
  });
});
