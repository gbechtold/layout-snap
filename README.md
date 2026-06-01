# layout-snap

> Standardized, annotated visual layout audits — one command, every viewport, every page.

`layout-snap` is a Playwright-based CLI (and a Claude Code skill) that captures **annotated screenshots** of any website across multiple viewports and pages, with color-coded outlines, spacing overlays, container-width grid lines, and a centered measurement label. Every run produces a self-contained, timestamped folder with the screenshots, a human-readable measurement table, and a machine-readable JSON for diffing between runs.

## What it is

A single-file Node CLI that drives Playwright (WebKit) to load a list of URLs at a list of viewports, measures the widths of the layout primitives that matter (header, main container, content area, rows, product grid, footer, plus headlines and product cards), draws color-coded outlines + spacing overlays + grid lines + a centered label, and saves everything under `YYMMDD-HHMM-<Project>-<Task>/`. No external Node dependencies beyond Playwright itself.

## Why

Visual layout work usually devolves into:

- **Screenshots without measurements** — you see something looks off, but you can't tell whether the row is 1080 or 1180 wide
- **Excel sheets for width audits** — manually measuring DevTools rulers and pasting numbers into a spreadsheet, one viewport at a time
- **Hand-annotated DevTools screenshots** — boxes drawn in Preview/Skitch, no consistency between runs, no machine-readable record
- **Multi-viewport drift** — no easy way to compare 1920 vs 1440 vs 390 side-by-side after a CSS change

`layout-snap` collapses all of that into one command. Every screenshot is annotated identically. Every measurement lands in `04-EVAL.json` so you can `diff` two runs and see exactly what changed.

## Install

Requires Node ≥ 16 and Playwright.

```bash
# 1. Get Playwright reachable from your shell
npm i playwright   # in any project; layout-snap auto-discovers common locations

# 2. Place the skill folder anywhere; the conventional spot is:
~/.claude/skills/layout-snap/

# 3. (Optional) Symlink the binary onto your PATH:
ln -s ~/.claude/skills/layout-snap/bin/layout-snap.js /usr/local/bin/layout-snap
```

The CLI looks for Playwright in: `/Users/guntrambechtold/node_modules/playwright`, `/private/tmp/node_modules/playwright`, `$HOME/node_modules/playwright`, then global `require('playwright')`.

## Quick start

```bash
node ~/.claude/skills/layout-snap/bin/layout-snap.js \
  --project Acme --task LayoutAudit \
  --base https://acme.example \
  --pages "/, /shop/, /about/" \
  --viewports 1920,1440,390
```

Output lands in `~/Documents/Projects/visual-evals/YYMMDD-HHMM-Acme-LayoutAudit/`.

## Use cases

| Scenario | Example |
|---|---|
| **Design review** — show the team how layout primitives align across viewports | `--pages "/" --viewports 1920,1440,1024,768,390 --style blueprint` |
| **Regression audit** — diff measurements before/after a CSS patch | Run twice, then `diff before/04-EVAL.json after/04-EVAL.json` |
| **Client report** — clean visual proof of layout changes | `--style blueprint --palette distinct --minimal` |
| **Dev/staging/live parity** — confirm staging matches production | Three runs with `--project Site --task ParitatStaging` and varying `--base` |

## Flag reference

| Flag | Default | Purpose |
|---|---|---|
| `--project <name>` | required | Project name (folder + label) |
| `--task <name>` | required | Task slug (folder + label) |
| `--base <url>` | required | Site base URL |
| `--pages "<csv>"` | required | Comma-separated paths |
| `--viewports <csv>` | `1920,1440,390` | Widths; mobile widths use Playwright device emulation, desktop widths render @2x |
| `--profile <name>` | `divi-wc` | `divi-wc`, `bricks`, or `bare-wp` |
| `--config <path>` | – | Custom profile JSON (overrides `--profile`) |
| `--version <str>` | – | Site/plugin version shown in label |
| `--cookie-accept <text>` | `Akzeptieren` | Button text auto-clicked; empty string = skip |
| `--out <dir>` | `~/Documents/Projects/visual-evals` | Base dir for run folders |
| `--style <name>` | `classic` | `classic` (DevTools look) or `blueprint` (print-editorial) |
| `--palette <name>` | `golden` | `distinct`, `golden`, `wheel`, `diverging`, `redblue`, `profile` |
| `--show-spacing` | on | Margin + padding overlays |
| `--show-grid` | on | Container-width lines at 1080 + 1280 |
| `--show-center` | on | Viewport center line |
| `--show-all` | – | Force all 3 layers on |
| `--no-spacing` / `--no-grid` / `--no-center` | – | Disable individual layers |
| `--minimal` | – | Disable all 3 layers (outlines + label only) |
| `--no-annotate` | – | No annotation at all (clean screenshots + measurements) |
| `--fullpage` | – | Capture full scrollable page |
| `--max-height <px>` | `5000` | Cap fullpage capture height |
| `--help`, `-h` | – | Print help |

## Output format

Every run produces a self-contained folder:

```
YYMMDD-HHMM-<Project>-<Task>/
├── 00-INDEX.md         Summary table, click-through to each screen, error roll-up
├── 01-LEGEND.md        Profile reference (codes, colors, semantic names, fallback selectors)
├── 02-CONFIG.json      Full reproducibility: args, profile, generator version, ISO timestamp
├── 03-EVAL.md          Human-readable measurement table (one row per screen × all selectors)
├── 04-EVAL.json        Machine-readable; diff-friendly between runs
└── screens/
    └── NN-<vp>-<slug>.png   One PNG per (viewport × page)
```

## Profiles

A profile is a JSON file mapping short codes to CSS selectors. The first selector that matches wins — fallbacks let one profile cover many sites in the same stack.

| Profile | When to use |
|---|---|
| `divi-wc` (default) | Divi Theme + WooCommerce — most StarsMedia clients (Planet Pure, Schwanen, etc.) |
| `bricks` | Bricks Builder themes (FemaleFuture and similar) |
| `bare-wp` | Default WordPress themes (Twenty-Twenty-Five and similar) |

To build a custom profile, copy `lib/profiles/divi-wc.json` and edit. Two selector tiers:

- `selectors[]` — primary layout containers, get 2px dashed outline + spacing overlays
- `sub_selectors[]` — repeating elements (cards, headlines, buttons), all matches get 1px dotted outline, label shows count + width range

Pass with `--config /path/to/my-profile.json`.

## Palettes

The palette generates `n_primary + n_sub + 4` distinct colors (the last 4 are margin, padding, grid, center).

| Palette | Description |
|---|---|
| `distinct` | 16+ hand-curated maximally-distinct named colors. Best when n > 10. |
| `golden` (default) | 137.508° golden-angle hue stepping; mathematically optimal distinctness. |
| `wheel` | Even `360/n` spacing around the wheel; very regular. |
| `diverging` | Cool 220° ↔ warm 25°, lightness peaks in middle; good for ordered layers. |
| `redblue` | Strong blue ↔ red contrast; high-impact for two-camp comparisons. |
| `profile` | Uses `color` field from profile JSON (backward-compat with hand-tuned profiles). |

## Recipes

```bash
# 1) Classic Divi+WC audit, three viewports, with version stamp
node bin/layout-snap.js \
  --project PlanetPure --task WidthAudit \
  --base https://planetpure.com \
  --pages "/, /produkt-kategorie/waschen/, /warenkorb/" \
  --viewports 1920,1440,390 --version 1.2.0

# 2) Clean client-report screenshots — blueprint style, no overlays
node bin/layout-snap.js \
  --project Acme --task ClientReport \
  --base https://acme.example --pages "/, /shop/" --viewports 1440 \
  --style blueprint --palette distinct --minimal

# 3) Full-page captures, clipped at 8000px, for above-the-fold and scroll-state proof
node bin/layout-snap.js \
  --project FemFut --task LandingPageAudit \
  --base https://female-future.com --pages "/" --viewports 1920,390 \
  --profile bricks --fullpage --max-height 8000

# 4) Reference shots without any annotation (for design briefs)
node bin/layout-snap.js \
  --project Acme --task Reference \
  --base https://acme.example --pages "/, /pricing/" --viewports 1920 \
  --no-annotate

# 5) Diff before/after a CSS patch
node bin/layout-snap.js --project Acme --task before --base ... # commit run
git apply patch.diff && deploy
node bin/layout-snap.js --project Acme --task after --base ...
diff before/04-EVAL.json after/04-EVAL.json
```

## Limitations

- **Auth-gated pages**: no login flow. For basic-auth staging, use `--base https://user:pass@host`. For cookie/session-based auth, no built-in support — fork or rerun behind a tunnel that handles it.
- **JS-heavy SPAs**: navigation waits for `domcontentloaded` + 1.2s settle. Client-side routers that take longer to render may be captured pre-render.
- **Cookie banners**: only handles a single button-text match. Multi-step CMP flows (Cookiebot, OneTrust with custom toggles) need manual handling.
- **WebKit only**: uses Playwright's WebKit engine for closer macOS Safari parity. No Chromium/Firefox alternative; fork `loadPlaywright()` if you need it.
- **Not a pixel-diff tool**: this is for layout-eval and measurement audits, not regression detection. For pixel-perfect diffs use Percy, Chromatic, or Playwright's `toHaveScreenshot()`.

## License

MIT — see [LICENSE](LICENSE).
