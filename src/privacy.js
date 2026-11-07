// GET /privacy (SPEC.md 11.2): the full privacy note. Every page ends with
// the same one-line footer that links here.
import { PRIVACY, headTags } from "./share.js";

const NOTE = `
    <p>The badge records the place it appears (site, repo or page address), the badge chosen, and the days it was seen. Nothing about the people who visit that place.</p>
    <p>No cookies, and nothing stored on your device. No IP addresses stored by us.</p>
    <p>We count visits to these pages with Cloudflare Web Analytics. It sets no cookies, uses no visitor ID and does not follow you to other sites. The badge itself never runs it.</p>
    <p>The contact form keeps your name, email and message, used only to reply.</p>
    <p>Turnstile, a Cloudflare service, protects the forms.</p>
    <p>A place stops counting when we can no longer see its badge. We keep its small record until you remove it with your badge key, ask us to remove it, or we clear old records.</p>
    <p>If you ask us to email your badge key, we send it once and do not keep your address. Our mail service keeps a short delivery log.</p>
    <p>The <a href="/music">music page</a> loads its video from YouTube (youtube-nocookie.com) only after you press play. Until then nothing loads from YouTube.</p>
    <p>Open source (MIT). <a href="https://github.com/bizautomation/made-openly">Code on GitHub</a>. Questions? <a href="/#contact">Contact us</a>.</p>
    <p>Run by Biz-Automation Co., Ltd., Bangkok, Thailand.</p>`;

const CSS = `
.privacy{padding:40px 0 56px}
.privacy h1{margin:0 0 18px;font-size:32px;line-height:1.2}
`;

// shell: { head, nav, footer } cut from page.html, as for /places.
export function handlePrivacy(shell, csp) {
  const html = `${shell.head.replace(/<title>.*<\/title>/, `<title>${PRIVACY.title}</title>`).replace("__HEAD_TAGS__", headTags(PRIVACY))}${CSS}</style>
</head>
<body>
${shell.nav}
<main id="top">
<section class="privacy">
  <div class="wrap">
    <h1>Privacy</h1>${NOTE}
  </div>
</section>
</main>
${shell.footer}
</body>
</html>
`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Content-Security-Policy": csp,
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
