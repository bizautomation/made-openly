# Contributing a mascot

Mascots live in this repo as SVG files in `mascots/`. Anyone can propose one by pull request. The owner reviews and merges, and merging is the moderation. Merged mascots appear in the badge picker on the next deploy, with the designer credited.

## Rules

These are checked automatically by `.github/workflows/mascot-check.yml` where possible. You can run the same check yourself with `node scripts/check-mascots.js`.

- **Original work only.** No existing characters, mascots, logos or brands.
- **`viewBox="0 0 100 100"`.** It must stay readable at 20 × 20 inside the small badge.
- **Nothing active or external.** No `<script>`, no event attributes (`onclick=` and the like), no external references (`href` to other files or URLs), no embedded raster images.
- **Maximum 10 KB.**
- **Use the palette** in [SPEC.md section 5](SPEC.md#5-colour-palette) where possible: teal is machine, clay is human, ink is structure.
- **Add an entry to `mascots/registry.json`** with your name and link:

  ```json
  { "slug": "your-mascot", "name": "Your mascot", "designer": "Your name", "designer_url": "https://your.site", "licence": "CC-BY-4.0" }
  ```

  The file must be named `mascots/<slug>.svg`.

## Licence

By contributing, you agree to license the art under CC BY 4.0 (see [LICENSE-ART](LICENSE-ART)). Code in this repo is MIT (see [LICENSE](LICENSE)).
