import { describe, expect, it } from "vitest";
import { call } from "./helpers.js";

const footerOf = (html) => html.slice(html.indexOf('<footer id="privacy"'), html.indexOf("</footer>") + 9);

describe("privacy (SPEC.md 11.2)", () => {
  it("every page ends with the same one-line footer", async () => {
    const footers = [];
    for (const path of ["/", "/places", "/music", "/music/models", "/manage", "/privacy"]) footers.push(footerOf(await (await call(path)).text()));
    expect(new Set(footers).size).toBe(1);
    expect(footers[0]).toContain("No cookies. We count places, never visitors.");
    expect(footers[0]).toContain('<a href="/privacy">Privacy</a>');
    expect(footers[0].match(/<p>/g)).toHaveLength(1);
    // The site wears its own badge, registered for https://madeopenly.com/ like any other place.
    expect(footers[0]).toMatch(/<a class="own" href="https:\/\/madeopenly\.com\/\?t=([0-9a-f]{32})" title="Made Openly: Mostly AI"><img src="https:\/\/madeopenly\.com\/b\/\1\.svg\?l=mostly-ai&amp;/);
  });

  it("/privacy holds the full note", async () => {
    const res = await call("/privacy");
    expect(res.status).toBe(200);
    expect(res.headers.get("Set-Cookie")).toBeNull();
    const html = await res.text();
    expect(html).toContain("<title>Privacy: Made Openly</title>");
    expect(html).toContain('<link rel="canonical" href="https://madeopenly.com/privacy">');
    for (const t of ["No IP addresses stored by us.", "Cloudflare Web Analytics", "badge key", "youtube-nocookie.com", "Run by Biz-Automation Co., Ltd., Bangkok, Thailand."])
      expect(html).toContain(t);
  });

  it("redirects /privacy/ to /privacy", async () => {
    const res = await call("/privacy/", { redirect: "manual" });
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("https://madeopenly.com/privacy");
  });
});
