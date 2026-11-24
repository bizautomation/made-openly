import { describe, expect, it } from "vitest";
import { call } from "./helpers.js";

describe("GET /music/models, the model fit review", () => {
  it("is a page of its own, with the site's menu and a canonical address", async () => {
    const res = await call("/music/models");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(res.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
    expect(res.headers.get("Set-Cookie")).toBeNull();
    const html = await res.text();
    expect(html).toContain('<link rel="canonical" href="https://madeopenly.com/music/models">');
    expect(html.match(/<h1>/g)).toHaveLength(1);
    const nav = html.slice(html.indexOf("<nav"), html.indexOf("</nav>"));
    expect(nav).toContain('<a href="/music">Music</a>');
    expect(nav).toContain('<a href="/music/models" aria-current="page">Model review</a>');
    expect(html).toContain('<p class="crumb"><a href="/music">Music</a>');
  });

  it("says near the top that these are one project's findings, not benchmarks", async () => {
    const html = await (await call("/music/models")).text();
    const disclaimer = html.indexOf('<aside class="disclaimer"');
    expect(disclaimer).toBeGreaterThan(0);
    expect(disclaimer).toBeLessThan(html.indexOf('<section id="quick">'));
    const text = html.slice(disclaimer, html.indexOf("</aside>", disclaimer));
    expect(text).toContain("one person's experience on one music-video project");
    expect(text).toContain("between 7 and 24 November 2026");
    expect(text).toContain("They are not benchmarks");
    expect(text).toContain("check the current price with the provider before running anything");
  });

  it("uses plain words for each assessment, never the old shorthand", async () => {
    const html = await (await call("/music/models")).text();
    const body = html.slice(html.indexOf("<main"), html.indexOf("</main>")).replace(/<[^>]+>/g, " ");
    for (const word of ["Recommended", "Mixed results", "Not recommended"]) expect(body).toContain(word);
    expect(body).not.toMatch(/\b(USE|TEST|NO)\b/);
    expect(body).not.toMatch(/\bcr\b/); // credits, written out
  });

  it("keeps the prices and measurements of the source notes", async () => {
    const html = await (await call("/music/models")).text();
    for (const fact of ["163 findings", "2816 × 1584", "$0.0675 per image", "0.665 to 0.704", "about 3.1 times the list price", "227 of 646 frames", "$0.0072 per second", "12 + 60 = 72 credits", "276 against 250", "0.15–0.34 s"])
      expect(html).toContain(fact);
    for (const id of ["quick", "stills", "warm-face", "video", "upscalers", "local", "prompts", "billing", "open"]) {
      expect(html).toContain(`<section id="${id}">`);
      expect(html).toContain(`href="#${id}"`);
    }
  });

  it("has a section on working methods, with four pictures that carry alt text and sizes", async () => {
    const html = await (await call("/music/models")).text();
    const start = html.indexOf('<section id="methods">');
    expect(start).toBeGreaterThan(html.indexOf('<section id="prompts">'));
    const text = html.slice(start, html.indexOf('<section id="billing">'));
    expect(html).toContain('<li><a href="#methods">Methods that worked</a></li>');
    for (const name of ["trick-crop", "trick-green", "trick-strip", "trick-teeth"])
      expect(text).toContain(`src="/art/tricks/${name}-800.jpg" srcset="/art/tricks/${name}-800.jpg 800w, /art/tricks/${name}-1600.jpg 1600w"`);
    const imgs = text.match(/<img [^>]*>/g);
    expect(imgs).toHaveLength(4);
    for (const img of imgs) {
      expect(img).toMatch(/ width="1600" height="\d+" alt="[^"]{40,}" loading="lazy"/);
    }
    expect(text).toContain("“Four people, left to right. Replace person 1 with reference 1");
    expect(text).toContain("it was not tested side by side");
  });

  it("redirects a trailing slash to the page", async () => {
    const res = await call("/music/models/", { redirect: "manual" });
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("https://madeopenly.com/music/models");
  });
});
