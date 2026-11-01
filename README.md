# Made Openly

<a href="https://madeopenly.com/?t=2f368b12a8d442cf8483f1cbee1e1671" title="Made Openly: Mostly AI">
  <img src="https://madeopenly.com/b/2f368b12a8d442cf8483f1cbee1e1671.svg?l=mostly-ai&s=light&z=large&v=robot&m=robot"
       width="176" height="62" alt="Made Openly: Mostly AI">
</a>

A free badge that says, openly, how much AI helped make your work. Put it on a site, a repo, a post or a product. **[madeopenly.com](https://madeopenly.com)**

"Made by humans" badges already exist. This is their mirror: a way to say "AI helped make this", plainly and without apology. The counter shows how many places wear each label. It counts places, never visitors.

## The three labels

| Badge | Label | Meaning |
|---|---|---|
| <img src="https://madeopenly.com/badge.svg?l=human-only&s=light&z=small&v=robot" width="88" height="31" alt="Human only"> | **Human only** | No AI in the making, or only spelling-level help. |
| <img src="https://madeopenly.com/badge.svg?l=human-ai&s=light&z=small&v=robot" width="88" height="31" alt="Human + AI"> | **Human + AI** | A person produced a real share of the final work, and AI helped. |
| <img src="https://madeopenly.com/badge.svg?l=mostly-ai&s=light&z=small&v=robot" width="88" height="31" alt="Mostly AI"> | **Mostly AI** | AI produced most of the final work. A person directed, chose and checked it. |

The question to ask: **who produced most of the final words, code or images?** Torn between two labels? Choose the one with more AI. The badge is the maker's own statement, not a certificate.

## Get a badge

1. Open [madeopenly.com](https://madeopenly.com/#get) and choose a label, size, style and mascot.
2. Optional: paste the page address where the badge will live. Do this for Substack, GitHub, Medium and Notion, because they copy images instead of loading them from us.
3. Press **Generate** and paste the snippet into your page.

For an email signature, LinkedIn or a site builder that won't take SVG, use the PNG version under "More ways to add it". It counts the same way.

No sign-up and no account. You can also save a **badge key**, which you need later to remove your place or change its listing at [madeopenly.com/manage](https://madeopenly.com/manage). For a PDF, video or app store page, download the plain badge: it has no tracking and is never counted.

## How counting works

A place counts while we can see its badge there. Either of two signals is enough:

- **The badge itself:** the image loads from the place's own site, or a reader clicks it there.
- **Our check:** a Worker looks for the badge on the page every week, and every 15 minutes for new badges. GitHub READMEs are read through the GitHub API.

The counter shows every place that was added, including the ones we can't see:

- **Active:** seen in the last 30 days. These are the main count.
- **Not seen lately:** seen before, but not in the last 30 days.
- **Not verified yet:** an address was given, but we haven't seen the badge there yet.

A failed check never deletes anything. Places that ask to be named appear on the public list at [madeopenly.com/places](https://madeopenly.com/places) after the owner approves them. The counts themselves are never moderated.

The numbers are public at [`/stats.json`](https://madeopenly.com/stats.json):

```sh
curl https://madeopenly.com/stats.json
curl "https://madeopenly.com/stats.json?since=2026-11-01"
```

## Privacy

- The badge records the place it appears, the label chosen and the days it was seen. Nothing about the people who visit.
- No cookies, and nothing stored on your device. No IP address, user agent or visitor ID is stored or logged anywhere.
- The site's own pages use Cloudflare Web Analytics, which is cookieless. The badge never runs it.
- A badge key is stored encrypted. If you ask us to email it, we send it once and do not keep your address.

Full details are in the privacy section of [madeopenly.com](https://madeopenly.com/#privacy) and in [SPEC.md](SPEC.md).

## Why the code is open

The code is public so anyone can check what the badge records and how the counting works. It is here for review, not as a kit to run your own copy.

The badge means something because everyone uses the same one, counted in one place. To support the idea, use the badge from [madeopenly.com](https://madeopenly.com). Please don't run a second copy of the badge or counter.

The code is MIT licensed, so you are free to reuse any part of it for other purposes.

## How it is built

One Cloudflare Worker with a D1 database. There is no framework and no build step: the page is a single HTML file, and badges are SVG drawn by code.

| Path | What it is |
|---|---|
| `src/index.js` | Routes, security headers, the scheduled checks |
| `src/badge.js` | Draws every badge as SVG |
| `src/live.js` | `GET /b/:token.svg` and `.png`: serves a badge and records the day |
| `scripts/render-pngs.js`, `public/png/` | The PNG badges, drawn once ahead of time |
| `src/generate.js` | `POST /api/generate`: makes a token, snippet and key |
| `src/verify.js`, `src/sighting.js` | The Worker check, and active/dormant status |
| `src/stats.js`, `src/places.js` | `/stats.json` and the `/places` page |
| `src/key.js`, `src/manage.js` | The badge key and `/manage` |
| `src/share.js`, `scripts/render-og.js` | Link preview tags, `/og.png`, `/sitemap.xml` |
| `src/moderation.js` | The named list, reports and the owner's weekly email |
| `src/page.html` | The page |
| `migrations/` | D1 schema |
| `mascots/` | Mascot SVGs and `registry.json` |
| `reference/badges.html` | The reference the badge SVG must match exactly |
| `SPEC.md` | The full specification: the source of truth |

### Run it locally

To review a change or test a pull request. Needs Node 24 (the version CI uses).

```sh
npm install
npm run db:migrate:local
npm run dev        # http://localhost:8787
npm test           # Workers runtime tests with a local D1
```

Local settings go in `.dev.vars`, which is gitignored. For the forms, use Cloudflare's [Turnstile test keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/) as `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET`, and set `TURNSTILE_HOSTNAMES=localhost`. The tests need none of this: they mock every outside service.

## Contributing

- **Mascots** are welcome by pull request. See [CONTRIBUTING.md](CONTRIBUTING.md) for the rules and the automatic check.
- **Code changes** should follow [SPEC.md](SPEC.md). Open an issue first for anything that changes a design decision.
- Run `npm test` before opening a pull request. CI runs the same tests.

## Licence

Code: [MIT](LICENSE). Badge artwork and mascots: [CC BY 4.0](LICENSE-ART).

Run by Biz-Automation Co., Ltd., Bangkok, Thailand.
