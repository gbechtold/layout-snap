# Changelog

All notable changes to `layout-snap` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-05-30

### Added

- Initial public release as a Claude Code skill + standalone Node CLI.
- Single-file CLI (`bin/layout-snap.js`) — no external Node dependencies beyond Playwright.
- Multi-viewport + multi-page capture in one run; outputs a timestamped run folder.
- Five output artifacts per run: `00-INDEX.md`, `01-LEGEND.md`, `02-CONFIG.json`, `03-EVAL.md`, `04-EVAL.json` plus `screens/` PNGs.
- Two-tier selector model: primary `selectors[]` (dashed outline + spacing overlays) and `sub_selectors[]` (dotted outline on every match).
- Three bundled profiles: `divi-wc` (7 primary + 8 sub), `bricks`, `bare-wp`. Custom profiles via `--config`.
- Two annotation styles: `classic` (DevTools-look) and `blueprint` (print-editorial).
- Six color palettes: `distinct` (16+ hand-curated), `golden` (default, 137.508° golden-angle), `wheel`, `diverging`, `redblue`, `profile`.
- Optional visualization layers (all on by default): margin/padding spacing overlays, container-width grid lines (1080 + 1280), 50% center line. Disable per-layer with `--no-spacing` / `--no-grid` / `--no-center` or all at once with `--minimal`.
- Centered info-label with project · task · version · style · palette · viewport · device · per-selector measurements · sub-element counts/ranges · layer legend · page path; color swatches for every measurement.
- Sub-element multi-match: counts + min/max width range surfaced in label and `04-EVAL.json`.
- Playwright WebKit emulation for common mobile widths (320/375/390/393/412/414/430); desktop viewports rendered with `deviceScaleFactor: 2` for Retina-sharp screenshots.
- `--fullpage` capture with `--max-height` clipping (default 5000px).
- Cache-busting query string (`?_cb=<ts>`) appended to every URL.
- Auto cookie-banner click (`--cookie-accept`, default "Akzeptieren"; empty string skips).
- Outline-based annotation (zero layout shift — `outline` not `border`, with `outline-offset: -<width>`).
- Reproducibility: `02-CONFIG.json` captures every arg, profile, generator version, and ISO timestamp.
- Diff-friendly `04-EVAL.json` for before/after comparison between runs.
- Vendored Playwright auto-discovery — looks in common install locations.
- Empty-profile guard: exits with code 2 if a profile has zero selectors.
