# Made Openly: Build Specification

This document is the single source of truth for building madeopenly.com. It is written so that a developer or an AI coding agent can build the whole project from it without other context. Where a decision has a reason, the reason is given in one line so it is not undone by accident.

Status: all design decisions closed, 28 Oct 2026. Owner: Biz-Automation Co., Ltd. (GitHub: `bizautomation`).

---

## 1. What this is

Made Openly is a free badge that a person puts on their work to say, openly, how much AI was involved in making it. It is the mirror image of "Not By AI" style badges: those certify that no machine was involved; this one lets makers say a machine was involved and that they are not hiding it.

The site does three things:

1. **Gives out badges.** Anyone picks a badge, copies a snippet, pastes it into their site, repo or post. No sign-up.
2. **Counts places wearing them.** A place counts once it has been verified (the badge was found there). It counts places, never visitors.
3. **Shows the count publicly.** A live counter, split by badge label and place type, is the experiment's result. The project is framed as a year-long experiment: who chooses to wear which badge.

The badge is a **self-declaration, not a certificate.** It vouches for honesty about how something was made, not for quality.

### The idea, for the "Why" section of the page

The question moves from purity (did a machine touch this?) to character (is the maker honest about how it was made?). The virtue is not avoiding the tool, it is not hiding it. Wearing the badge means saying: this was my hand, and the machine carried it.

---

## 2. Non-goals (do not build these at launch)

- Accounts, logins, sign-up, email capture.
- Cookies, analytics scripts, tracking pixels, fingerprinting.
- Storing IP addresses (rate limiting may read them in memory only).
- A JavaScript badge tier. Image badge only.
- User uploads of mascots or images.
- Thai or any language other than English.
- Certification, auditing or any claim that a badge is "true".

---

## 3. Stack and hosting

- **Cloudflare Worker** serves the site, the badges and the API.
- **Cloudflare D1** stores badges, daily counts and contact messages.
- **Cloudflare Turnstile** protects Generate and the contact form.
- **Cloudflare Cron Trigger** runs the weekly verification check.
- **Cloudflare rate limiting** guards the endpoints (section 9).
- Account: the existing Biz-Automation Cloudflare account on the Workers Paid plan, shared with bizat.co and Muninn. Keep Made Openly **isolated**: its own Worker, its own D1 database, its own scoped API token. Never share a database with another project.
- Domain: `madeopenly.com` (registered on Cloudflare Registrar).
- Repo: `github.com/bizautomation/made-openly`, public. Secrets live in Cloudflare environment settings, never in the repo.

---

## 4. Badges

### 4.1 Labels (three degrees)

| Slug | Label on badge | AI share on the bar | Meaning (for the FAQ) |
|---|---|---|---|
| `mostly-ai` | Mostly AI | 85% | AI did most of the making; a human directed, chose and checked. |
| `human-ai` | Human + AI | 50% | A human and AI worked on it together, back and forth. |
| `human-only` | Human only | 0% | No AI in the making, or only spelling-level help. |

Labels avoid prepositions ("by", "with") on purpose: non-native English readers mix them up, and "Made by human" does not fit the small badge.

### 4.2 Sizes

| Size | Pixels | Icon size | Notes |
|---|---|---|---|
| `small` | 88 × 31 | 22 px | Classic web button. Fits footers. |
| `large` | 176 × 62 | 48 px | **Default in the picker.** Shows "MADE OPENLY" readably. |

### 4.3 Styles

| Style | Background | Border | Text |
|---|---|---|---|
| `light` | white `#FFFFFF` | Ink at 25% | Ink |
| `dark` | Ink `#1F2937` | white at 12% | light `#F3F4F6` |
| `clear-light` | none (transparent) | Ink at 30% | Ink |
| `clear-dark` | none (transparent) | white at 30% | light `#F3F4F6` |

Optional later: `auto`, one SVG with an internal `prefers-color-scheme` media query. It follows the visitor's OS setting, not a site's own theme toggle.

### 4.4 Variants

- `robot` (default): mascot icon on the left, "MADE OPENLY" and label on the right.
- `wordmark`: no icon. "MADE OPENLY" above the label, centred. For formal sites.

### 4.5 The bar

A thin bar under the label shows the split. The track is **clay** (human); the fill from the left is **teal** (machine), at the AI share from 4.1. "Human only" shows an all-clay bar. The bar carries the meaning without reading English.

### 4.6 Exact layout

Use the reference generator in `reference/badges.html` (section 15). Its functions `robot(onDark)` and `badge(size, style, label, variant)` are the canonical implementation. Port them to the Worker unchanged in output. Key numbers, for checking:

- Small, robot: icon at x=2, y=4.5, 22×22. Label at x=25, y=17, 10 px, weight 600. Bar at x=25, y=22, width 57, height 3.
- Small, wordmark: "MADE OPENLY" centred at y=11.5, 6.8 px, weight 700, letter-spacing 0.6. Label centred at y=22, 9.5 px. Bar x=8, y=25.5, width 72, height 2.5.
- Large, robot: icon at x=6, y=7, 48×48. "MADE OPENLY" at x=58, y=20, 9 px, weight 700, letter-spacing 0.8. Label at x=58, y=38, 16 px. Bar x=58, y=45, width 110, height 3.
- Large, wordmark: "MADE OPENLY" centred at y=21, 11 px, letter-spacing 1.4. Label centred at y=40, 16 px. Bar x=16, y=48, width 144.
- Corner radius 5 (small), 8 (large). Border drawn as a 1 px stroke inset 0.5 px.
- Font stack: `Inter, Helvetica, Arial, sans-serif`. "MADE OPENLY" uses teal `#0F766E` on light, `#5EC4B6` on dark.
- Every SVG carries `role="img"`, `aria-label` and `<title>` set to `Made Openly: <Label>`.

### 4.7 The mascot (open-hatch robot)

A small robot whose chest hatch has swung open, with a heart inside. Meaning: nothing hidden, and what is inside is human. The swung-open door is the distinctive part; keep it prominent.

Geometry on a 100×100 canvas (the generator draws it; these numbers are for review):

- Antenna: line (50,6)→(50,16), stroke 4, round cap; ball r=4 teal at (50,6).
- Head: rect x=24 y=16 w=52 h=34 rx=12, Ink. Eyes: white circles r=5 at (40,33) and (60,33).
- Body: rect x=22 y=54 w=56 h=40 rx=10, Ink.
- Hatch hole: rect x=35 y=60 w=30 h=28 rx=4.5, white. Heart: clay, centred at (50,74.5), scale 1.15.
- Door: modelled in 3D, the same size and corner radius as the hole, hinged on the hole's right edge (x=65), swung 125° toward the viewer, perspective camera distance 220, centre (50,55), thickness 2.4. Front face teal `#0F766E`, back and edge `#0A4F4A`, white knob r=1.4 near the free edge. The door pokes slightly past the body edge; this is correct, not a bug.
- **On dark backgrounds the robot is never recoloured.** It keeps its Ink body and gains a light outline: stroke `#E5E7EB`, width 3, on head and body; the antenna stroke turns light too.

### 4.8 Mascot picker

Users can choose the icon on their badge. Launch set:

| Slug | Name | Status |
|---|---|---|
| `robot` | Open-hatch robot | Final. Default. |
| `bird` | Half-bot bird | Sketch only. Landing-page mascot. Ship when final art exists. |
| `pen-bot` | Pen bot | Sketch only. |
| `split-nib` | Split nib | Sketch only. |
| `open-ring` | Open ring | Sketch only. |

Only mascots with final art go in the registry. Sketches stay out until finished.

The picker reads the mascot registry (section 13.1). Each choice shows its designer's name. A "Design one" link goes to `CONTRIBUTING.md`. The chosen slug travels in the badge URL (`&m=robot`) and is stored with the token.

---

## 5. Colour palette

One palette. Colours carry meaning: **teal = machine, clay = human, ink = structure.**

| Token | Hex | Use |
|---|---|---|
| Paper | `#FAF8F5` | page background |
| Ink | `#1F2937` | text, robot body, dark badge |
| Ink soft | `#6B7280` | secondary text |
| Line | `#E5E7EB` | borders, robot outline on dark |
| Machine | `#0F766E` | AI share, buttons, links, door |
| Machine on dark | `#5EC4B6` | teal text on dark backgrounds |
| Machine deep | `#0A4F4A` | door back and edge |
| Machine tint | `#CCE7E4` | teal backgrounds |
| Human | `#E39565` | human share, heart. Fills only, never text (2.4:1 on white). |
| Human deep | `#B45309` | human-coloured text on light |
| Alert | `#B91C1C` | form errors only |
| Dark text | `#F3F4F6` | text on dark badges |

Contrast checked: Ink on Paper 13.8:1, Machine on white 5.5:1, Human deep on white 5.0:1.

---

## 6. The snippet

### Live badge (Way A)

```html
<a href="https://madeopenly.com/?t=TOKEN" title="Made Openly: Human + AI">
  <img src="https://madeopenly.com/b/TOKEN.svg?l=human-ai&s=light&z=large&v=robot&m=robot"
       width="176" height="62" alt="Made Openly: Human + AI">
</a>
```

- `width` and `height` are always set, so a failed load never shifts the page layout.
- `alt` keeps the meaning if the image is blocked.
- An image tag never blocks the host page: if the Worker is down, the page loads normally and the badge shows its alt text.

### Theme swap (document on the site)

For sites with their own light/dark toggle, offer a copy-ready snippet that swaps `s=light` and `s=dark` when the page theme changes (a `MutationObserver` on the page's theme attribute). Tested on bizat.co: the swap is instant.

### Plain badge (no tracking)

A downloadable SVG/PNG with no token, for PDFs, ebooks, videos and app store pages. It is never counted.

---

## 7. Data model (D1)

```sql
CREATE TABLE badges (
  token          TEXT PRIMARY KEY,          -- random, >= 16 chars, from crypto.randomUUID()
  label          TEXT NOT NULL,             -- mostly-ai | human-ai | human-only
  style          TEXT NOT NULL,             -- light | dark | clear-light | clear-dark
  size           TEXT NOT NULL,             -- small | large
  variant        TEXT NOT NULL,             -- robot | wordmark
  mascot         TEXT NOT NULL DEFAULT 'robot',
  host           TEXT,                      -- bound host (Way A), e.g. blog.example.com
  declared_url   TEXT,                      -- optional page URL given at Generate (Way B)
  place_kind     TEXT NOT NULL DEFAULT 'site', -- site | repo | post | product
  verify_method  TEXT,                      -- live | address
  status         TEXT NOT NULL DEFAULT 'new', -- new | bound | verified | flagged
  listed         TEXT NOT NULL DEFAULT 'no',  -- no | pending | yes | reported | removed
  created_at     TEXT NOT NULL,
  bound_at       TEXT,
  first_verified TEXT,
  last_verified  TEXT
);
CREATE INDEX badges_host ON badges(host);
CREATE INDEX badges_status ON badges(status);

CREATE TABLE daily (
  token TEXT NOT NULL,
  day   TEXT NOT NULL,                      -- YYYY-MM-DD (UTC)
  PRIMARY KEY (token, day)
);

CREATE TABLE messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT,
  email      TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE weekly_counts (               -- anonymous snapshot, written by the weekly check
  week     TEXT NOT NULL,                  -- ISO week, e.g. 2026-W45
  label    TEXT NOT NULL,
  kind     TEXT NOT NULL,
  verified INTEGER NOT NULL,               -- verified places with this label and kind that week
  PRIMARY KEY (week, label, kind)
);
```

`weekly_counts` holds counts only, never a token or host, so removing a badge still deletes all of its data while past weeks of the growth line stay correct.

No IP address, user agent or visitor identifier is stored anywhere.

---

## 8. Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | The single page (section 11). |
| POST | `/api/generate` | Create a token, return the snippet. |
| GET | `/b/:token.svg` | Serve a badge and record the day. |
| GET | `/badge.svg` | Preview only (picker). Same params, no token, never records. |
| GET | `/stats.json` | Public counter data (section 10). |
| POST | `/api/list` | Ask for a verified place to be named on the public list. |
| POST | `/api/report` | Report a listed place. |
| POST | `/api/contact` | Contact form. |
| GET | `/admin/review?k=...` | One-click approve/reject links from the weekly email (signed). |

### 8.1 `POST /api/generate`

Input: `label, style, size, variant, mascot, declared_url (optional), is_product (optional), turnstile_token`.

1. Verify Turnstile server-side. Reject on failure.
2. Check rate limits (section 9).
3. Make a token: `crypto.randomUUID()` with dashes removed, or any random string of at least 16 characters.
4. `INSERT` into `badges` with `status='new'`. The token is the primary key. If the insert fails on a conflict, generate a new token and retry, **at most 3 times**, then return an error. Never loop.
5. If `declared_url` is given: validate it is `https://`, set `verify_method='address'` and set `place_kind` (section 8.4).
6. Return the ready snippet (section 6) and the plain-text version.

### 8.2 `GET /b/:token.svg` (the hot path)

1. Look up the token. Unknown token: return a neutral "Made Openly" badge, record nothing.
2. Draw the SVG. The label always comes from storage, since it is what the counter counts. The look comes from the query string: `s` style, `z` size, `v` variant, so a site can swap themes without a new token. A missing or invalid value falls back to the stored setting. (Decided by the owner, 29 Oct 2026.)
3. Read the `Referer` header. Take its host. Ignore and do not bind if it is missing, `localhost`, an IP address, or a known preview host (`*.pages.dev`, `*.vercel.app`, `*.netlify.app` previews, `127.0.0.1`, etc.).
4. If the token has no host yet and the referrer host is valid: bind it (`host`, `bound_at`, `status='bound'`, `verify_method='live'`).
5. If the token is bound to host A and the referrer is host B: record nothing, and set `status='flagged'` (someone copied another site's snippet).
6. `INSERT OR IGNORE INTO daily (token, day)` for today. One row per token per day, however many loads.
7. Respond with `Content-Type: image/svg+xml`, `Cache-Control: public, max-age=300` (short, so loads keep reaching the Worker).

### 8.3 Weekly verification (Cron, Mondays 02:00 UTC)

For every token with a `host` or a `declared_url`:

1. Fetch the page: `declared_url` if set, otherwise `https://<host>/`.
2. Look for the token in the HTML, in any of: the badge link href (`madeopenly.com/?t=TOKEN`), the image src (`/b/TOKEN.svg`), or a GitHub camo URL (`camo.githubusercontent.com/...`, hex-decode the original URL and search it).
3. **Found:** `status='verified'`, update `last_verified`, set `first_verified` if empty.
4. **Not found on a previously verified place:** the badge was removed, which is the opt-out. Delete the token's `badges` row and all its `daily` rows.
5. **Never found, bound more than 30 days ago:** clear `host` and set `status='new'` so the token can bind again.
6. **Created more than 30 days ago and never bound or declared:** delete it (cleans up bot-generated tokens).

Run in batches with a short delay between fetches. Use a polite `User-Agent` such as `MadeOpenlyVerifier/1.0 (+https://madeopenly.com/#faq)`.

### 8.4 Place types

Detected from the address, with one checkbox:

| Address | `place_kind` |
|---|---|
| `github.com/<owner>/<repo>` | `repo` |
| `*.substack.com`, `medium.com`, `*.medium.com`, Substack custom domains if detectable | `post` |
| User ticked "This is a product" | `product` |
| Anything else | `site` |

Many tokens may share one host (medium.com, github.com, substack.com). A token is one place.

---

## 9. Rate limits and abuse

Limits are keyed by IP using Cloudflare's rate limiting. The IP is held in memory by the limiter only and **never written to D1 or logs**. There are no sessions, because there are no cookies.

| Endpoint | Guard | Limit |
|---|---|---|
| `/api/generate` | Turnstile + per-IP | 10 per 10 minutes, 50 per day |
| `/b/:token.svg` | No per-IP limit (cache and once-a-day rows absorb load) | Flood rule only: block an IP above ~300 requests per minute |
| `/api/contact` | Turnstile + per-IP | 3 per hour |
| `/api/list`, `/api/report` | per-IP | 10 per hour |

The Workers rate-limit binding only counts over 10 or 60 seconds, so the Worker enforces per-minute limits (Generate 5, contact 1, list/report 3 per minute per IP, badge 300) and the longer windows above are zone WAF rate-limiting rules. Decided by the owner, 28 Oct 2026.

Cleanup: tokens never bound or declared within 30 days are deleted by the weekly job.

---

## 10. Counter and `/stats.json`

### What counts

A **verified place**: one token, found at its place by the weekly check. Each place counts once a day at most (`daily` table). Visits are never counted or shown.

### `/stats.json` (public, no auth, cached ~1 hour)

```json
{
  "updated": "2026-11-02T02:30:00Z",
  "total_verified": 0,
  "by_label": { "mostly-ai": 0, "human-ai": 0, "human-only": 0 },
  "by_kind":  { "site": 0, "repo": 0, "post": 0, "product": 0 },
  "by_label_kind": { "mostly-ai": { "site": 0, "repo": 0, "post": 0, "product": 0 } },
  "weekly": [ { "week": "2026-W45", "verified": 0 } ],
  "new_last_7_days": 0,
  "listed": [ { "place": "example.com", "label": "human-ai", "kind": "site", "since": "2026-11-02" } ]
}
```

`weekly` comes from `weekly_counts` (one snapshot per weekly run), not from the current `badges` rows.

Optional: `/stats.json?since=YYYY-MM-DD` returns only places first verified since that date. This endpoint is how a scheduled assistant reads the numbers for the weekly marketing report, and it powers the on-page counter.

### On the page

- Verified places per badge label, as bars in the label colours (Mostly AI teal, Human + AI mid-teal `#5FA8A0`, Human only clay).
- Total, with a weekly growth line.
- The opt-in named list.
- One plain line under the counter: **"This counts places wearing the badge, not visitors. Each place counts once a day, and only if we can find the badge there."**

---

## 11. The page

One page, mobile-first, one column on phones. A small jump menu at the top. Sections in order:

1. **Hero.** One line saying what this is: a badge for things made with AI, worn openly. The half-bot bird mascot can appear here when its art is final.
2. **Why.** Three or four lines from section 1 ("The idea").
3. **Badge picker.** Choose label, size (large default), style, robot or wordmark, mascot. Live preview from `/badge.svg`. Optional field: "Where will this badge live? (paste the page address)" plus a "This is a product" checkbox. Turnstile. A **Generate** button returns the snippet with a **Copy** button and the theme-swap snippet. A link to download the plain no-tracking badge.
4. **Counter.** Section 10.
5. **FAQ.** Section 11.1.
6. **Contact.** Name, email, message, Turnstile. Stored in `messages` and forwarded to the owner's inbox.
7. **Privacy** (small footer, about 14 px, not tiny). Section 11.2.

### Style

Clean, formal, standard; not techy. Font: Inter. Lots of white space. Paper background, Ink text, Machine teal for buttons and links. No dark mode for the page at launch, no glow effects.

### 11.1 FAQ (seed questions; write plain, short answers)

- What does each badge mean, and who decides which one fits? (You decide. Section 4.1 meanings.)
- Is this tracking my visitors? (No. It counts places, not people, and stores no IP addresses.)
- What exactly do you record? (The place, the badge chosen, and the days it was seen. Nothing about visitors.)
- How do I remove my badge or my data? (Take the badge off. The next weekly check deletes its data.)
- Why is there no sign-up?
- Can I trust the counter? (Once-a-day rule, weekly check, only verified places.)
- Does it work on Substack, GitHub, Medium or Notion? (Yes: paste the page address when you generate the badge.)
- What about apps, PDFs or videos? (Use the plain badge. It is not counted.)
- Is it free? Where is the code? (Free. Link to the GitHub repo.)
- Can I design a mascot? (Yes. Link to CONTRIBUTING.md.)
- Why build this? (Two lines: the mirror of "made by humans" badges.)
- "We may remove any place from the public list without notice. It still counts."

### 11.2 Privacy note (a few short paragraphs)

- The badge records the place it appears (site, repo or page address), the badge chosen, and the days it was seen. Nothing about the people who visit that place.
- No cookies, no tracking scripts, no IP addresses stored.
- The contact form keeps your name, email and message, used only to reply.
- Turnstile, a Cloudflare service, protects the forms.
- To delete a badge's data, remove the badge; it is deleted at the next weekly check. For anything else, use the contact form.
- Run by Biz-Automation Co., Ltd., Bangkok, Thailand.

No cookie banner is needed: nothing is stored on the visitor's device. A short legal review before launch is recommended.

---

## 12. Public list and moderation

Only the public **named list** is moderated. The **counts are never moderated**: every verified place counts, whatever it is.

1. Listing is opt-in and off by default (`listed='no'`).
2. Only places with `status='verified'` can ask to be listed (`POST /api/list`) → `listed='pending'`.
3. Once a week the owner receives one email listing pending places, each with signed one-click **Approve** and **Reject** links (`/admin/review`). Approve → `yes`. Reject → `no`.
4. Every listed place shows a small **Report** link → `listed='reported'`, hidden until the owner reviews it. The weekly email also lists reported places: **Keep listed** → `yes`, **Remove** → `removed`.
5. A removed place keeps counting; it is only hidden from the list.
6. Review links are signed (HMAC-SHA256 with the `ADMIN_SIGNING_KEY` secret) and expire after 14 days. A link only acts while the place is still in the state it was sent for. Mail goes through Resend from `we@madeopenly.com` to the owner only (`ADMIN_EMAIL` secret). Decided by the owner, 29 Oct 2026.

---

## 13. Repository layout

```
/
├─ SPEC.md                 this file
├─ README.md               what it is, how to add a badge, link to the site
├─ CONTRIBUTING.md         how to propose a mascot (section 13.1)
├─ LICENSE                 MIT, for the code
├─ LICENSE-ART             CC BY 4.0, for badge art and mascots
├─ reference/badges.html   reference generator and gallery of every badge
├─ mascots/
│  ├─ registry.json        [{ slug, name, designer, designer_url, licence }]
│  └─ robot.svg            viewBox 0 0 100 100
├─ src/
│  ├─ index.js             Worker entry and routing
│  ├─ badge.js             port of reference/badges.html (robot, badge)
│  ├─ verify.js            weekly check
│  ├─ stats.js             /stats.json
│  └─ page.html            the single page
├─ migrations/0001_init.sql
├─ wrangler.toml           D1 binding, cron, routes (no secrets)
└─ .github/workflows/mascot-check.yml
```

### 13.1 Community mascots (CONTRIBUTING.md content)

Mascots live in the repo as SVG files. Anyone can propose one by pull request; the owner reviews and merges, and merging is the moderation. Merged mascots appear in the picker on the next deploy, with the designer credited.

Rules, checked by `mascot-check.yml` where possible:

- Original work only. No existing characters, mascots, logos or brands.
- `viewBox="0 0 100 100"`. Readable at 20 × 20 inside the small badge.
- No `<script>`, no event attributes, no external references (`href` to other files or URLs), no embedded raster images. Maximum 10 KB.
- Use the palette in section 5 where possible.
- Add an entry to `mascots/registry.json` with your name and link.
- By contributing, the designer agrees to license the art under CC BY 4.0 (LICENSE-ART).

---

## 14. Build order and acceptance checks

1. **Badge rendering.** Port the generator. `/badge.svg` renders all 48 combinations (2 sizes × 4 styles × 3 labels × 2 variants) identically to `reference/badges.html`.
2. **Generate + D1.** Tokens are unique, retries capped at 3, Turnstile enforced, rate limits enforced.
3. **Live badge.** First valid referrer binds; localhost and previews ignored; second host flags; one `daily` row per token per day; nothing about the visitor stored.
4. **Weekly check.** Finds tokens in link href, img src and GitHub camo URLs; deletes removed badges; releases never-found tokens after 30 days; deletes never-used tokens after 30 days.
5. **Stats.** `/stats.json` matches the schema in section 10 and is cached about an hour.
6. **Page.** All seven sections, mobile-first, readable at 360 px wide, no horizontal scroll.
7. **Moderation.** Pending list email with signed links; Report hides immediately.
8. **Privacy check.** Grep the code and D1: no IP, no user agent, no cookie set anywhere.
9. **Dogfood.** Put the badge on bizat.co (clear style, theme swap), the Conversation Daemon (Way B, declared address) and the repo README (Way B). All three verify on the first weekly run.

---

## 15. Reference

`reference/badges.html` contains the generator that defines every badge and both mascot versions, and draws them all in a gallery. Open it in a browser to see the agreed set. If the Worker's output differs from `reference/badges.html`, the reference file is right.
