# Made Openly

## Muninn

This repo's sessions use the Muninn project `made-openly`.

- **Boot.** Start every session with `muninn_session_boot(query: "<topic from the user's first message>", project: "made-openly")`.
- **Carryover.** If boot returns a carryover, first back it up as a session-history memory tagged `made-openly`. Delete the original only after the backup succeeds.
- **Writes.** Pass `project: "made-openly"` and the tag `made-openly` on every Muninn write.
- **Build log.** Keep appending to the existing build log, `muninn_memory_get("4c6f3366")`.
- **Spec.** `muninn_memory_get("0c88dc26")` mirrors `./SPEC.md`.

## Where work lives

Code, deploys and the repo live here. Growth, marketing, Search Console, community posts and the "why" writing live in the claude.ai Project "Made Openly", which boots into the same Muninn project. A code task from there arrives as a written task.
