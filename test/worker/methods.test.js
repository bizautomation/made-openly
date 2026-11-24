import { describe, expect, it } from "vitest";
import { call } from "./helpers.js";

describe("GET /music/methods, the second page of the model review", () => {
  it("is a page of its own, under the Model review menu item", async () => {
    const res = await call("/music/methods");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(res.headers.get("Set-Cookie")).toBeNull();
    const html = await res.text();
    expect(html).toContain('<link rel="canonical" href="https://madeopenly.com/music/methods">');
    expect(html.match(/<h1>/g)).toHaveLength(1);
    expect(html).toContain("<h1>Methods that worked</h1>");
    // No new item in the top bar: the menu marks Model review as the current section.
    const header = html.slice(html.indexOf('<header class="site">'), html.indexOf("</header>"));
    expect(header).toContain('<a href="/music/models" aria-current="true">Model review</a>');
    expect(header).not.toContain("/music/methods");
    expect(header.match(/aria-current/g)).toHaveLength(1);
    expect(html).toContain('<nav class="tabs" aria-label="Model review"><a href="/music/models">Models and prices</a><a href="/music/methods" aria-current="page">Methods</a></nav>');
    expect(html).toContain('<a href="/music/models">Model review</a> <span aria-hidden="true">/</span> Methods</p>');
  });

  it("carries the same disclaimer as the first page", async () => {
    const [a, b] = await Promise.all(["/music/models", "/music/methods"].map(async (p) => (await call(p)).text()));
    const cut = (h) => h.slice(h.indexOf('<aside class="disclaimer"'), h.indexOf("</aside>", h.indexOf('<aside class="disclaimer"')));
    expect(cut(b)).toBe(cut(a));
    expect(cut(b)).toContain("They are not benchmarks");
  });

  it("has eight numbered methods, each with a way back to the top", async () => {
    const html = await (await call("/music/methods")).text();
    const titles = [...html.matchAll(/<h2>(\d)\. ([^<]+)<\/h2>/g)].map((m) => `${m[1]} ${m[2]}`);
    expect(titles).toEqual([
      "1 Crop, change, paste back",
      "2 Green paint for a stronger change",
      "3 One run for several faces, mapped from left to right",
      "4 One measure for each question",
      "5 What the likeness score does not see",
      "6 Teeth correction, calibrated for each clip",
      "7 A continuous shot from loose endings",
      "8 Word order is action order",
    ]);
    for (const id of ["crop", "green", "strip", "measure", "score", "teeth", "loose", "wording"]) {
      expect(html).toContain(`<section id="${id}">`);
      expect(html).toContain(`<a href="#${id}">`);
    }
    expect(html.match(/<p class="top"><a href="#top">Back to top<\/a><\/p>/g)).toHaveLength(8);
    expect(html).not.toMatch(/8\.\d /);
  });

  it("has four pictures with alt text and sizes, each opening at full size", async () => {
    const html = await (await call("/music/methods")).text();
    for (const name of ["trick-crop", "trick-paint", "trick-strip", "trick-teeth"])
      expect(html).toContain(`<a href="/art/tricks/${name}-1600.jpg"><img src="/art/tricks/${name}-800.jpg" srcset="/art/tricks/${name}-800.jpg 800w, /art/tricks/${name}-1600.jpg 1600w"`);
    const imgs = html.slice(html.indexOf("<main"), html.indexOf("</main>")).match(/<img [^>]*>/g);
    expect(imgs).toHaveLength(4);
    for (const img of imgs) expect(img).toMatch(/ width="1600" height="\d+" alt="[^"]{40,}" loading="lazy"/);
  });

  it("keeps the words of the run records", async () => {
    const html = await (await call("/music/methods")).text();
    expect(html).toContain("the head must not be bigger than the green area");
    expect(html).toContain("“Four people, left to right. Replace person 1 with reference 1");
    expect(html).toContain("One run was billed at 47 credits and corrected three faces. Three separate runs of the same kind were billed at 126 credits on 22 November.");
  });

  it("redirects a trailing slash to the page", async () => {
    const res = await call("/music/methods/", { redirect: "manual" });
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("https://madeopenly.com/music/methods");
  });
});
