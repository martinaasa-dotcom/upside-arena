<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Upside Arena agent notes

- **No em dashes, and nothing else that reads as generated, in anything a person sees.** Product copy has to sound like a person wrote it, because in Arena every sentence is one: there is no model-written copy in this app at all, so nothing was scrubbing them and nothing was going to. Em and en dashes are the loudest tell, so reader-facing strings take a comma, a colon or a full stop instead. `tests/unit/onboarding-copy.test.ts` fails on an em or en dash in any reader-facing line of the onboarding surfaces; its `SWEPT` list may grow and must never shrink. Code comments are exempt, this file included: the rule is about the product, not the source. Screens outside that list have not been swept yet.
- **The walkthrough's rows are `.glass`, not `CARD`.** `CARD` (`src/lib/page-shell.ts`) is `glass-well`, the quiet nested material keyed to `--muted`, and it is right for a well sitting inside a panel that is already doing the refraction. The walkthrough has no panel around it: its rows sit straight on a dialog over an 80% scrim, where `glass-well` reads as a flat grey box. `ROW_GLASS` in `src/components/WelcomeTour.tsx` uses the top-level material instead (`card-sheen glass`), which is what carries the three specular terms that sell glass on a near-black field. Anything else drawn directly on an overlay wants the same treatment.
- **One walkthrough, versioned, and everybody sees it once.** `WelcomeTour` (`src/components/`) opens over Home with Home already painted behind it. Whether it shows is `profiles.tour_version` against `TOUR_VERSION` (`src/lib/tour.ts`); raising the constant re-shows it to every account exactly once, and that is the whole reset mechanism. `needsTour` returns **false** for `undefined`/`null`, so a deploy that lands before its migration shows nobody a walkthrough rather than showing everybody one on every page load. Escape, the X and "Skip the tour" all write the version down: a walkthrough that returns tomorrow because you dismissed it today is a nag with a progress bar. Nothing in `src/lib/tour-steps.ts` is a figure typed by hand, and `tests/unit/tour.test.ts` holds it to that. Every screen is in `/gallery` so `tests/e2e/clipping.spec.ts` measures it at every width a phone reports.
