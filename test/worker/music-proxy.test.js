import { describe, expect, it } from "vitest";
import { call } from "./helpers.js";

// /music lives in the private madeopenly-music Worker; vitest.config.js stands
// in a stub for it. These checks cover only the public side of the hand-off.
describe("/music through the MUSIC service binding", () => {
  it("asks the music Worker for the page and hands it the site's nav, footer and CSP", async () => {
    const res = await call("/music");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Security-Policy")).toContain("frame-src");
    const html = await res.text();
    expect(html).toContain("<h1>stub music</h1>");
    expect(html).toContain('<a class="brand" href="/#top">MADE OPENLY</a>');
    expect(html).toContain('<a href="/privacy">Privacy</a>');
  });

  it("passes /art/ pictures to the music Worker", async () => {
    const res = await call("/art/singer-mila-600.jpg");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("stub art /art/singer-mila-600.jpg");
  });

  it("redirects /music/ to /music", async () => {
    const res = await call("/music/", { redirect: "manual" });
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("https://madeopenly.com/music");
  });

  it("is in the menu", async () => {
    const html = await (await call("/")).text();
    expect(html.slice(html.indexOf("<nav"), html.indexOf("</nav>"))).toContain('<a href="/music">Music</a>');
  });

  it("keeps the other pages' frame policy free of YouTube", async () => {
    expect((await call("/")).headers.get("Content-Security-Policy")).not.toContain("youtube");
  });
});
