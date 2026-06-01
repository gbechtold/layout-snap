---
name: layout-snap
description: Run a standardized visual layout audit on any website. Captures annotated Playwright screenshots (color-coded outlines, spacing/grid/center overlays, centered measurement label with color swatches) across multiple viewports and pages, into a timestamped run-folder with INDEX.md, LEGEND, CONFIG, EVAL.md, and machine-readable EVAL.json. Trigger when the user asks for "visual eval", "layout audit", "Vorher/Nachher screenshots", "container width check", "annotierte Screenshots", responsive checks across multiple pages, or hands you a list of URLs + viewports to compare. Default profile is `divi-wc` (Divi + WooCommerce); switch via `--profile bricks|bare-wp` or pass a custom one with `--config`.
---

# layout-snap

## When to use

Trigger this skill when the user wants a **standardized visual layout audit** across multiple pages and/or viewports:

- "Mach mir Screenshots von <URL> auf Desktop + Mobile"
- "Visual eval für die 4 Hauptseiten"
- "Container-Width-Check auf Cat + Product + Cart"
- "Vorher/Nachher Vergleich nach dem CSS-Patch"
- "Annotierte Screenshots mit Outlines"
- "Audit auf 1920/1440/390 + Vergleich gegen Staging"
- Or any time you'd otherwise hand-write an ad-hoc Playwright snippet to screenshot + measure DOM elements

**Do not** trigger for:
- Single-screenshot needs without comparison (use Playwright inline instead)
- Pure functional E2E tests (clicks, form submits)
- Performance audits — use Lighthouse skill / WebPageTest
- Pixel-perfect regression detection — use Percy, Chromatic, or Playwright `toHaveScreenshot`

## What it produces

Every run creates one folder under the configured output base:

```
<out>/YYMMDD-HHMM-<Project>-<Task>/
├── 00-INDEX.md              # Entry-point with summary table + click-through to screens
├── 01-LEGEND.md             # Color × Selector × Semantic-Name reference (per profile)
├── 02-CONFIG.json           # Reproducibility: URLs, viewports, selectors, generator version
├── 03-EVAL.md               # Human-readable measurements table (primary + sub-element widths)
├── 04-EVAL.json             # Machine-readable measurements (diff-friendly between runs)
└── screens/
    ├── 01-1920-home.png
    ├── 02-1920-cat-waschen.png
    ├── ...
    └── NN-<vp>-<slug>.png
```

All screenshots include (defaults):
- **Color-coded outlines** on primary layout elements — `outline` not `border`, so zero layout shift
- **Color-coded dotted outlines** on every match of each sub-selector (multi-element)
- **Margin (warm) + padding (cool) spacing overlays** on every primary element
- **Vertical grid lines** at common container widths (1080 + 1280)
- **Center line** at viewport-50%
- **Centered info-label** with color swatches, project · task · version · style · palette · viewport · device · per-selector measurements · sub-element counts/ranges · layer legend · page path
- **Retina @2x** on desktop viewports for sharp screenshots
- **Cache-buster** `?_cb=<ts>` on every URL

Disable any layer with `--no-spacing` / `--no-grid` / `--no-center` / `--minimal`.

## How to invoke

### From Claude (Bash tool)

```bash
node ~/.claude/skills/layout-snap/bin/layout-snap.js \
  --project PlanetPure \
  --task WidthAudit \
  --base https://planetpure.com \
  --pages "/, /produkt-kategorie/waschen/, /produkt/bunt-waschmittel-hibiskus-pfingstrose/, /warenkorb/" \
  --viewports 1920,1440,390 \
  --profile divi-wc \
  --version 1.2.0 \
  --out /Users/guntrambechtold/Documents/Projects/BusinessProjects/001-PlanetpureWebsite/visual-evals/
```

### Available flags

| Flag | Required | Default | Purpose |
|---|---|---|---|
| `--project` | yes | – | Project name (goes into folder name + label) |
| `--task` | yes | – | Task slug (e.g. "WidthAudit", "Wave5Verify") |
| `--base` | yes | – | Site base URL (trailing slash auto-stripped) |
| `--pages` | yes | – | Comma-separated paths (e.g. `"/, /shop/, /cart/"`) |
| `--viewports` | no | `1920,1440,390` | Comma-separated. Widths in `MOBILE_DEVICE_MAP` (320/375/390/393/412/414/430) use Playwright device emulation; other widths render as desktop viewports of that size with `deviceScaleFactor: 2` |
| `--profile` | no | `divi-wc` | Profile name from `lib/profiles/<name>.json`. Available: `divi-wc`, `bricks`, `bare-wp` |
| `--config` | no | – | Path to custom profile JSON (overrides `--profile`) |
| `--version` | no | – | Site/plugin version stamp shown in label |
| `--cookie-accept` | no | `Akzeptieren` | Button text to auto-click for cookie banners (empty string = skip) |
| `--out` | no | `~/Documents/Projects/visual-evals/` | Base dir for run folders (`~` expanded) |
| `--no-annotate` | no | false | Skip all annotation (only measure + screenshot — useful for clean reference shots) |
| `--fullpage` | no | false | Capture full scrollable page instead of just viewport |
| `--max-height <px>` | no | `5000` | Cap fullpage capture at this height (clip from top) |
| `--style <name>` | no | `classic` | Annotation style. See [Styles](#styles) |
| `--palette <name>` | no | `golden` | Color palette. See [Palettes](#palettes) |
| `--show-spacing` | no | **on** | Show margin + padding overlays (DevTools-style box-model viz) |
| `--show-grid` | no | **on** | Show vertical lines at container widths 1080 + 1280 |
| `--show-center` | no | **on** | Show 50% center line of viewport |
| `--show-all` | no | – | Force all three layers on (idempotent when defaults are on) |
| `--no-spacing` | no | – | Disable spacing overlays |
| `--no-grid` | no | – | Disable grid lines |
| `--no-center` | no | – | Disable center line |
| `--minimal` | no | – | Disable all 3 layers — only outlines + label |

### Profiles

A profile defines which DOM elements get measured and outlined. JSON structure: `{ name, description, selectors: [...], sub_selectors: [...] }`.

- **`divi-wc`** — Divi Theme + WooCommerce (most StarsMedia clients). 7 primary selectors (HDR, NAV, MC, CA, ROW, PROD, FTR) + 8 sub-selectors (h1, h2, h3, card, img, price, btn, form).
- **`bricks`** — Bricks Builder themes (FemaleFuture style).
- **`bare-wp`** — Default WP themes (Twenty-Twenty-Five style).

**Custom profile**: copy `lib/profiles/divi-wc.json`, edit selectors + fallbacks (first matching wins), pass via `--config /path/to/my-profile.json`. Each selector needs `code` (short label), `fallbacks` (selector list), `name` (full name), and optionally `color` (used only when `--palette profile`).

### Styles

- **`classic`** (default) — DevTools Inspector look. Solid color margin (warm orange-tan), solid color padding (cool teal), dashed colored outlines, cyan dotted grid lines, gold center line, dark semi-transparent label with monospace font.
- **`blueprint`** — Print-editorial / architectural look. Diagonal hatch margin pattern, dot pattern padding, solid thin colored outlines, gray solid grid lines, red center line, white card label with sans-serif font. More elegant for client-facing reports.

### Palettes

The palette generates `n` distinct colors for `n_primary + n_sub + 4` slots (4 = margin, padding, grid, center).

- **`distinct`** — 16+ hand-curated maximally-distinct named colors (Trubetskoy's list, brand turquoise + darkblue first). Recommended when `n > 10`.
- **`golden`** (default) — Max-distinct hues via 137.508° golden angle, S=65 L=55.
- **`wheel`** — Even `360/n` steps around the color wheel.
- **`diverging`** — Cool 220° ↔ warm 25°, lightness peaks at center.
- **`redblue`** — Strong blue 250° ↔ red 30° contrast variant.
- **`profile`** — Use `color` from profile JSON (backward compat with older profiles).

### Sub-element multi-match behavior

Sub-selectors match **all** elements (not just the first), filter out hidden/zero-size nodes, and the label/eval show:

- `1 match` → just the width (`120px`)
- `N matches, all same width` → `N× 120px`
- `N matches, range` → `N× 100–180px`
- `0 matches` → `—`

All matches get the 1px-dotted outline drawn — so on a product grid you see every card outlined at once.

## After the run

1. `Read` the `00-INDEX.md` for the summary table
2. `Read` individual `screens/NN-*.png` to view annotated screenshots
3. For diff: compare `04-EVAL.json` between two runs (e.g. before/after a CSS patch)

## Failure modes

- **Playwright not installed** → tool looks in `/Users/guntrambechtold/node_modules/playwright`, `/private/tmp/node_modules/playwright`, `$HOME/node_modules/playwright`, then global require. If none reachable, exits with code 2. Fix: `npm i playwright` somewhere reachable.
- **Goto-timeout** (30s) → individual page recorded with `error` field in EVAL.json + INDEX, run continues. Check if URL needs auth, has Cloudflare challenge, or 404s.
- **Selector not found** → `width: null, selector: null` in eval, no outline drawn, label shows `—`. NOT a failure — common for Cart pages without `.et_pb_row`.
- **Cookie banner doesn't match `--cookie-accept`** → click silently fails after 2s, annotation may capture the banner. Pass `--cookie-accept "<exact text>"` or `--cookie-accept ""` to skip and accept the banner being visible.
- **Auth-gated pages** → no login flow built-in. For staging behind basic-auth, embed credentials in `--base https://user:pass@host`.
- **JS-heavy SPAs** → `waitUntil: domcontentloaded` + 1.2s settle. For client-rendered routes that take longer, the tool may capture pre-render. Workaround: rerun, or fork the tool to extend settle time.
- **Empty profile** → exits with code 2 if profile has zero selectors.

## Naming convention

- **Run folder**: `YYMMDD-HHMM-<Project>-<Task>` (chronological-sortable in Finder/ls)
- **Screenshot**: `NN-<vp>-<slug>.png` where `NN` = global sequence (zero-padded), `vp` = viewport width, `slug` = URL path with `/` → `-`
- **INDEX.md** prefixed `00-` so Finder/`ls` sorts it first

## When to skip

- User wants a one-off screenshot of one page → just use Playwright inline
- User wants pixel-perfect regression detection → use a visual-regression tool (Percy, Chromatic, Playwright's built-in `toHaveScreenshot`) — this skill is for layout-eval, not pixel-diff
