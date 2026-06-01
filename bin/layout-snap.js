#!/usr/bin/env node
/**
 * layout-snap — Standardized visual layout audit.
 *
 * Captures annotated screenshots (color-coded outlines + measurement label)
 * across multiple viewports + pages, into a timestamped run-folder with
 * INDEX.md, LEGEND, CONFIG, EVAL.md, EVAL.json + screens/.
 *
 * See SKILL.md / README.md in this folder for full usage docs.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// ────────────────────────────────────────────────────────────────────────────
// Constants.
// ────────────────────────────────────────────────────────────────────────────
const GENERATOR_VERSION = '1.0.0';
const DEFAULT_VIEWPORTS = [1920, 1440, 390];
const DEFAULT_OUT_DIR = path.join(os.homedir(), 'Documents/Projects/visual-evals');
const DEFAULT_MAX_HEIGHT = 5000;
const DEFAULT_COOKIE_TEXT = 'Akzeptieren';
const NAV_TIMEOUT_MS = 30000;
const POST_NAV_SETTLE_MS = 1200;
const COOKIE_CLICK_TIMEOUT_MS = 2000;
const COOKIE_POST_CLICK_MS = 400;
// Container widths used by most WP/Divi themes — drawn by --show-grid
const GRID_WIDTHS = [1080, 1280];
const VALID_PALETTES = ['distinct', 'golden', 'wheel', 'diverging', 'redblue', 'profile'];

// ────────────────────────────────────────────────────────────────────────────
// Locate Playwright — try common paths, vendoring-aware.
// ────────────────────────────────────────────────────────────────────────────
function loadPlaywright() {
  const candidates = [
    '/Users/guntrambechtold/node_modules/playwright',
    '/private/tmp/node_modules/playwright',
    path.join(os.homedir(), 'node_modules', 'playwright'),
    'playwright',
  ];
  for (const c of candidates) {
    try { return require(c); } catch (e) { /* try next */ }
  }
  console.error('FATAL: playwright not found. Tried:', candidates.join(', '));
  console.error('Install via `npm i playwright` in any reachable node_modules.');
  process.exit(2);
}

// ────────────────────────────────────────────────────────────────────────────
// Argv parser (no external deps).
// ────────────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = {
    project: null,
    task: null,
    base: null,
    pages: [],
    viewports: DEFAULT_VIEWPORTS.slice(),
    profile: 'divi-wc',
    config: null,
    version: '',
    cookieAccept: DEFAULT_COOKIE_TEXT,
    out: DEFAULT_OUT_DIR,
    noAnnotate: false,
    fullpage: false,
    maxHeight: DEFAULT_MAX_HEIGHT,
    style: 'classic',
    palette: 'golden',
    // Defaults match the "MultiTag" preset: all visualization layers enabled.
    showSpacing: true,
    showGrid: true,
    showCenter: true,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '--project': args.project = next(); break;
      case '--task': args.task = next(); break;
      case '--base': args.base = next().replace(/\/+$/, ''); break;
      case '--pages': args.pages = next().split(',').map(s => s.trim()).filter(Boolean); break;
      case '--viewports': args.viewports = next().split(',').map(s => parseInt(s.trim(), 10)).filter(n => n > 0); break;
      case '--profile': args.profile = next(); break;
      case '--config': args.config = next(); break;
      case '--version': args.version = next(); break;
      case '--cookie-accept': args.cookieAccept = next(); break;
      case '--out': args.out = next().replace(/^~/, os.homedir()); break;
      case '--no-annotate': args.noAnnotate = true; break;
      case '--fullpage': args.fullpage = true; break;
      case '--max-height': args.maxHeight = parseInt(next(), 10); break;
      case '--style': args.style = next(); break;
      case '--palette': args.palette = next(); break;
      case '--show-spacing': args.showSpacing = true; break;
      case '--show-grid': args.showGrid = true; break;
      case '--show-center': args.showCenter = true; break;
      case '--show-all': args.showSpacing = true; args.showGrid = true; args.showCenter = true; break;
      case '--no-spacing': args.showSpacing = false; break;
      case '--no-grid': args.showGrid = false; break;
      case '--no-center': args.showCenter = false; break;
      case '--minimal': args.showSpacing = false; args.showGrid = false; args.showCenter = false; break;
      case '-h': case '--help': printHelp(); process.exit(0);
      default:
        if (a.startsWith('--')) {
          console.error('Unknown flag:', a);
          process.exit(2);
        }
    }
  }
  // Validate
  const missing = ['project', 'task', 'base'].filter(k => !args[k]);
  if (missing.length || !args.pages.length) {
    console.error('Missing required: --' + (missing[0] || 'pages'));
    console.error('Run with --help for usage.');
    process.exit(2);
  }
  if (!STYLES[args.style]) {
    console.error('Unknown --style: ' + args.style + '. Available: ' + Object.keys(STYLES).join(', '));
    process.exit(2);
  }
  if (!VALID_PALETTES.includes(args.palette)) {
    console.error('Unknown --palette: ' + args.palette + '. Available: ' + VALID_PALETTES.join(', '));
    process.exit(2);
  }
  return args;
}

// ────────────────────────────────────────────────────────────────────────────
// Palette generator — palettes for selector outlines + spacing/grid/center.
// Layout: [primaries...][subs...][margin, padding, grid, center]
// ────────────────────────────────────────────────────────────────────────────
// Hand-curated 16+ maximally-distinct named colors (Trubetskoy's list, filtered).
// Used by --palette distinct. Tested for high mutual hue/lightness distance.
const DISTINCT_COLORS_16 = [
  '#00ffc3', // turquoise (brand accent)
  '#1e5087', // darkblue (brand contrast)
  '#e6194B', // vivid red
  '#3cb44b', // green
  '#4363d8', // blue
  '#f58231', // orange
  '#911eb4', // purple
  '#46f0f0', // cyan
  '#f032e6', // magenta
  '#bfef45', // lime
  '#fabed4', // pink
  '#469990', // teal
  '#dcbeff', // lavender
  '#9A6324', // brown
  '#800000', // maroon
  '#aaffc3', // mint
  '#808000', // olive
  '#000075', // navy
  '#ffd700', // gold
  '#008b8b', // dark cyan
  '#8b0000', // dark red
  '#ff69b4', // hot pink
  '#1e90ff', // dodger blue
  '#8a2be2', // blue violet
  '#228b22', // forest green
  '#daa520', // goldenrod
];

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function makeColorEntry(solid, rgb) {
  return {
    solid,
    alpha60: rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.60)` : null,
    alpha40: rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.40)` : null,
    alpha25: rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.25)` : null,
  };
}

function generatePalette(scheme, n = 11) {
  if (scheme === 'profile') return null; // signal: use profile colors
  if (scheme === 'distinct') {
    return DISTINCT_COLORS_16.slice(0, n).map(hex => makeColorEntry(hex, hexToRgb(hex)));
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    let h, s, l;
    if (scheme === 'golden') {
      h = (40 + i * 137.508) % 360; s = 65; l = 55;
    } else if (scheme === 'wheel') {
      h = (i * (360 / n)) % 360; s = 65; l = 55;
    } else if (scheme === 'diverging') {
      const mid = (n - 1) / 2;
      const dist = Math.abs(i - mid) / mid;
      h = i < mid ? 220 : 25;
      l = 80 - dist * 30;
      s = 20 + dist * 55;
    } else if (scheme === 'redblue') {
      const mid = (n - 1) / 2;
      const dist = Math.abs(i - mid) / mid;
      h = i < mid ? 250 : 30;
      l = 70 - dist * 25;
      s = 35 + dist * 60;
    }
    const H = h.toFixed(0);
    out.push({
      solid:   `hsl(${H}, ${s}%, ${l}%)`,
      alpha60: `hsla(${H}, ${s}%, ${l}%, 0.60)`,
      alpha40: `hsla(${H}, ${s}%, ${l}%, 0.40)`,
      alpha25: `hsla(${H}, ${s}%, ${l}%, 0.25)`,
    });
  }
  return out;
}

function printHelp() {
  console.log(`
layout-snap — standardized visual layout audit

Required:
  --project <name>            e.g. PlanetPure
  --task <name>               e.g. WidthAudit
  --base <url>                e.g. https://planetpure.com
  --pages "<csv-paths>"       e.g. "/, /shop/, /cart/"

Optional:
  --viewports <csv>           default 1920,1440,390  (390 = iPhone 14 emulation)
  --profile <name>            default divi-wc        (also: bricks, bare-wp)
  --config <path>             custom profile JSON (overrides --profile)
  --version <str>             site version stamp for the label
  --cookie-accept <text>      default "Akzeptieren"  (empty string = skip)
  --out <dir>                 default ~/Documents/Projects/visual-evals
  --no-annotate               skip outlines (only measure + screenshot)
  --fullpage                  capture full scrollable page (not just viewport)
  --max-height <px>           cap fullpage at this height (default 5000)
  --style <name>              annotation style: classic | blueprint (default classic)
  --palette <name>            color palette (default golden):
                              distinct  : 16+ hand-curated maximally-distinct named colors (recommended for n>10)
                              golden    : max-distinct via 137.508° golden angle
                              wheel     : even (360/n)° steps around color wheel (n-adaptive)
                              diverging : cool 220° ↔ warm 25°, light to middle
                              redblue   : strong blue 250° ↔ red 30° contrast variant
                              profile   : use selector colors from profile JSON (backward compat)
  --show-spacing              show margin + padding overlays (DevTools box-model)
  --show-grid                 show vertical lines at container-widths 1080 + 1280
  --show-center               show 50% center line of viewport
  --show-all                  enable --show-spacing + --show-grid + --show-center
  --no-spacing                disable spacing overlays (override default-on)
  --no-grid                   disable grid lines (override default-on)
  --no-center                 disable center line (override default-on)
  --minimal                   disable all 3 layers (only outlines + label)
  --help

Example:
  node ~/.claude/skills/layout-snap/bin/layout-snap.js \\
    --project PlanetPure --task WidthAudit \\
    --base https://planetpure.com \\
    --pages "/, /produkt-kategorie/waschen/, /warenkorb/" \\
    --viewports 1920,1440,390 \\
    --version 1.2.0 \\
    --out ~/Documents/Projects/BusinessProjects/001-PlanetpureWebsite/visual-evals/
`);
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers.
// ────────────────────────────────────────────────────────────────────────────
function timestamp() {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yy}${mm}${dd}-${hh}${mi}`;
}

function slugify(pagePath) {
  let s = pagePath.replace(/^\/+|\/+$/g, '').replace(/\//g, '-');
  if (!s) s = 'home';
  return s.toLowerCase().replace(/[^a-z0-9\-]/g, '');
}

function loadProfile(args) {
  const skillRoot = path.resolve(__dirname, '..');
  const profilePath = args.config
    ? path.resolve(args.config)
    : path.join(skillRoot, 'lib/profiles', args.profile + '.json');
  if (!fs.existsSync(profilePath)) {
    console.error('Profile not found:', profilePath);
    process.exit(2);
  }
  const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
  if (!Array.isArray(profile.selectors) || profile.selectors.length === 0) {
    console.error('Profile "' + profilePath + '" has no selectors. At least 1 selector is required.');
    process.exit(2);
  }
  return profile;
}

// Common mobile viewport → Playwright device map (logical CSS pixels).
const MOBILE_DEVICE_MAP = {
  320: 'iPhone SE',
  375: 'iPhone SE',
  390: 'iPhone 14',
  393: 'Pixel 7',
  412: 'Pixel 5',
  414: 'iPhone 11',
  430: 'iPhone 15 Pro Max',
};

function makeContextConfig(vp, devices) {
  const mapped = MOBILE_DEVICE_MAP[vp];
  if (mapped && devices[mapped]) {
    return { ...devices[mapped], hasTouch: true, _deviceName: mapped };
  }
  if (vp <= 480) {
    return { ...devices['iPhone 14'], hasTouch: true, _deviceName: 'iPhone 14 (~' + vp + ')' };
  }
  return {
    viewport: { width: vp, height: Math.round(vp * 9 / 16) },
    deviceScaleFactor: 2, // Retina-sharp screenshots
    _deviceName: vp + 'px desktop @2x',
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Annotation Styles — visual presets.
// ────────────────────────────────────────────────────────────────────────────
const STYLES = {
  classic: {
    name: 'DevTools Classic',
    label: {
      bg: 'rgba(0,0,0,0.5)',
      color: '#fff',
      font: "8px/1.4 ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
      padding: '5px 8px',
      borderRadius: '4px',
      border: '',
      shadow: '0 2px 8px rgba(0,0,0,0.3)',
      backdrop: 'blur(2px)',
    },
    outlineStyle: 'dashed',
    outlineWidth: '2px',
    margin: 'rgba(246, 178, 107, 0.45)',
    padding: 'rgba(147, 196, 125, 0.45)',
    gridColor: 'rgba(0, 188, 212, 0.45)',
    gridStyle: 'dotted',
    centerColor: 'rgba(255, 215, 0, 0.6)',
  },
  blueprint: {
    name: 'Print-Editorial Blueprint',
    label: {
      bg: '#fff',
      color: '#222',
      font: "8px/1.4 'Helvetica Neue', Helvetica, Arial, sans-serif",
      padding: '6px 10px',
      borderRadius: '2px',
      border: '1px solid #ccc',
      shadow: '0 1px 4px rgba(0,0,0,0.15)',
      backdrop: '',
    },
    outlineStyle: 'solid',
    outlineWidth: '1.5px',
    margin: 'repeating-linear-gradient(45deg, rgba(120,120,120,0.18) 0 3px, transparent 3px 8px)',
    padding: 'radial-gradient(rgba(120,120,120,0.25) 1.2px, transparent 1.5px) 0 0 / 6px 6px',
    gridColor: 'rgba(80, 80, 80, 0.20)',
    gridStyle: 'solid',
    centerColor: 'rgba(180, 50, 50, 0.45)',
  },
};

// ────────────────────────────────────────────────────────────────────────────
// Browser-side annotator (runs inside page.evaluate).
//
// IMPORTANT: This is serialized and injected into the page context — it has
// access only to its single `opts` argument and browser globals (no closures
// over Node-side state). All Node-side constants (grid widths, z-indices)
// must be passed in via `opts.constants`.
//
// Returns: { primary: {[code]: {width, selector}}, sub: {[code]: {count, width, minWidth, maxWidth, selector}} }
// ────────────────────────────────────────────────────────────────────────────
function annotateInPage(opts) {
  const { targets, subTargets, meta, noAnnotate, style, layers, palette, constants } = opts;
  const { Z_OVERLAY, Z_LABEL, GRID_WIDTHS } = constants;

  const results = {};
  const subResults = {};
  const px = v => parseFloat(v) || 0;
  const docH = Math.max(
    document.documentElement.scrollHeight,
    document.body.scrollHeight,
    window.innerHeight
  );
  const vp = window.innerWidth;

  function makeOverlay(x, y, w, h, bg) {
    if (w <= 0 || h <= 0) return;
    const d = document.createElement('div');
    d.className = 'layout-snap-overlay';
    d.style.cssText = [
      'position:absolute', 'pointer-events:none',
      'z-index:' + Z_OVERLAY,
      'left:' + x + 'px',
      'top:' + (y + window.scrollY) + 'px',
      'width:' + w + 'px',
      'height:' + h + 'px',
      'background:' + bg,
    ].join(';');
    document.body.appendChild(d);
  }

  function makeVerticalLine(xPx, color, lineStyle) {
    const d = document.createElement('div');
    d.className = 'layout-snap-overlay';
    d.style.cssText = 'position:absolute;pointer-events:none;z-index:' + Z_OVERLAY +
      ';left:' + (xPx - 1) + 'px;top:0;width:0;height:' + docH +
      'px;border-left:2px ' + lineStyle + ' ' + color + ';opacity:0.7;';
    document.body.appendChild(d);
  }

  // Palette layout: [primaries...][subs...][margin, padding, grid, center]
  const nPrim = targets.length;
  const nSub = (subTargets || []).length;
  const mIdx = nPrim + nSub;       // margin index
  const pIdx = nPrim + nSub + 1;   // padding index
  const gIdx = nPrim + nSub + 2;   // grid index
  const cIdx = nPrim + nSub + 3;   // center index
  const isHatch = style.outlineStyle === 'solid';

  function marginBg() {
    if (!palette) return style.margin;
    const c = palette[mIdx];
    return isHatch
      ? 'repeating-linear-gradient(45deg, ' + c.alpha40 + ' 0 3px, transparent 3px 8px)'
      : c.alpha40;
  }
  function paddingBg() {
    if (!palette) return style.padding;
    const c = palette[pIdx];
    return isHatch
      ? 'radial-gradient(' + c.alpha60 + ' 1.2px, transparent 1.5px) 0 0 / 6px 6px'
      : c.alpha40;
  }
  function selColor(i, fallback) {
    return palette ? palette[i].solid : fallback;
  }

  // Per-target outlines + spacing overlays + measurements
  targets.forEach((t, idx) => {
    let el = null, matched = null;
    for (const sel of t.fallbacks) {
      try { el = document.querySelector(sel); } catch (e) { el = null; }
      if (el) { matched = sel; break; }
    }
    if (!el) { results[t.code] = { width: null, selector: null }; return; }
    const r = el.getBoundingClientRect();
    const cs = window.getComputedStyle(el);
    results[t.code] = { width: Math.round(r.width), selector: matched };
    if (noAnnotate) return;

    // Spacing overlays (margin + padding)
    if (layers.spacing) {
      const mt = px(cs.marginTop), mr = px(cs.marginRight),
            mb = px(cs.marginBottom), ml = px(cs.marginLeft);
      const mBg = marginBg();
      if (mt > 0) makeOverlay(r.left, r.top - mt, r.width, mt, mBg);
      if (mb > 0) makeOverlay(r.left, r.bottom, r.width, mb, mBg);
      if (ml > 0) makeOverlay(r.left - ml, r.top, ml, r.height, mBg);
      if (mr > 0) makeOverlay(r.right, r.top, mr, r.height, mBg);

      const pt = px(cs.paddingTop), pr = px(cs.paddingRight),
            pb = px(cs.paddingBottom), pl = px(cs.paddingLeft);
      const pBg = paddingBg();
      if (pt > 0) makeOverlay(r.left, r.top, r.width, pt, pBg);
      if (pb > 0) makeOverlay(r.left, r.bottom - pb, r.width, pb, pBg);
      if (pl > 0) makeOverlay(r.left, r.top + pt, pl, Math.max(0, r.height - pt - pb), pBg);
      if (pr > 0) makeOverlay(r.right - pr, r.top + pt, pr, Math.max(0, r.height - pt - pb), pBg);
    }

    // Element outline (border-box) — palette color or profile color
    el.style.outline = style.outlineWidth + ' ' + style.outlineStyle + ' ' + selColor(idx, t.color);
    el.style.outlineOffset = '-' + style.outlineWidth;
  });

  // Sub-Selectors — outline ALL matches (multi-element), measure count + range
  (subTargets || []).forEach((st, sidx) => {
    let elements = [], matched = null;
    for (const sel of st.fallbacks) {
      try {
        const found = document.querySelectorAll(sel);
        if (found && found.length > 0) {
          elements = Array.from(found).filter(el => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          });
          if (elements.length > 0) { matched = sel; break; }
        }
      } catch (e) {}
    }
    if (elements.length === 0) {
      subResults[st.code] = { width: null, count: 0, selector: null };
      return;
    }
    const widths = elements.map(el => Math.round(el.getBoundingClientRect().width));
    const minW = Math.min(...widths);
    const maxW = Math.max(...widths);
    subResults[st.code] = {
      count: elements.length,
      width: widths[0],
      minWidth: minW,
      maxWidth: maxW,
      selector: matched,
    };
    if (noAnnotate) return;
    const c = palette ? palette[nPrim + sidx].solid : (st.color || '#666');
    elements.forEach(el => {
      el.style.outline = '1px dotted ' + c;
      el.style.outlineOffset = '-1px';
    });
  });

  if (noAnnotate) {
    return { primary: results, sub: subResults };
  }

  // Container-width grid lines
  if (layers.grid) {
    const gridCol = palette ? palette[gIdx].solid : style.gridColor;
    for (const w of GRID_WIDTHS) {
      if (w >= vp) continue;
      const xLeft = Math.round((vp - w) / 2);
      makeVerticalLine(xLeft, gridCol, style.gridStyle);
      makeVerticalLine(xLeft + w, gridCol, style.gridStyle);
    }
  }

  // Center line — 50% of viewport, full document height
  if (layers.center) {
    const centerCol = palette ? palette[cIdx].solid : style.centerColor;
    const d = document.createElement('div');
    d.className = 'layout-snap-overlay';
    d.style.cssText = 'position:absolute;pointer-events:none;z-index:' + Z_OVERLAY +
      ';left:' + (Math.round(vp / 2) - 1) + 'px;top:0;width:0;height:' + docH +
      'px;border-left:2px solid ' + centerCol + ';opacity:0.85;';
    document.body.appendChild(d);
  }

  // Info-label (center, fixed) — innerHTML with color swatches
  const lbl = document.createElement('div');
  lbl.id = 'layout-snap-label';
  const L = style.label;
  lbl.style.cssText = [
    'position:fixed', 'top:50%', 'left:50%',
    'transform:translate(-50%, -50%)',
    'background:' + L.bg,
    'color:' + L.color,
    'font:' + L.font,
    'padding:' + L.padding,
    'z-index:' + Z_LABEL,
    L.shadow ? 'box-shadow:' + L.shadow : '',
    L.border ? 'border:' + L.border : '',
    'max-width:340px',
    'pointer-events:none',
    'border-radius:' + L.borderRadius,
    L.backdrop ? 'backdrop-filter:' + L.backdrop + ';-webkit-backdrop-filter:' + L.backdrop : '',
  ].filter(Boolean).join(';');

  const sw = c => '<span style="display:inline-block;width:7px;height:7px;background:' + c +
                  ';border-radius:1px;vertical-align:middle;margin-right:4px;' +
                  'box-shadow:0 0 0 0.5px rgba(0,0,0,0.3)"></span>';
  const sep = '<div style="border-top:1px solid currentColor;opacity:0.25;margin:3px 0"></div>';
  const head =
    '<div style="font-weight:600">' + meta.project + ' · ' + meta.task +
      (meta.version ? ' · v' + meta.version : '') + '</div>' +
    '<div style="opacity:0.8">' + meta.runId + ' · ' + meta.styleName + ' · ' +
      meta.paletteName + ' · ' + meta.screenNum + '/' + meta.screenTotal + '</div>' +
    '<div style="opacity:0.8">VP=' + vp + ' · ' + meta.deviceName + '</div>';

  const measLines = targets.map((t, idx) => {
    const v = results[t.code].width;
    const c = palette ? palette[idx].solid : t.color;
    return '<div>' + sw(c) + '<b>' + t.code.padEnd(5) + '</b> = ' +
           (v == null ? '—' : String(v) + 'px') + '</div>';
  }).join('');

  let subLines = '';
  if (nSub > 0) {
    subLines = sep + '<div style="opacity:0.6;font-size:0.92em">sub-elements</div>' +
      (subTargets || []).map((st, sidx) => {
        const sr = subResults[st.code];
        const c = palette ? palette[nPrim + sidx].solid : (st.color || '#666');
        let measure;
        if (!sr || sr.count === 0) {
          measure = '—';
        } else if (sr.count === 1) {
          measure = sr.width + 'px';
        } else if (sr.minWidth === sr.maxWidth) {
          measure = sr.count + '× ' + sr.width + 'px';
        } else {
          measure = sr.count + '× ' + sr.minWidth + '–' + sr.maxWidth + 'px';
        }
        return '<div>' + sw(c) + st.code.padEnd(5) + ' = ' + measure + '</div>';
      }).join('');
  }

  let layerLines = '';
  const layerEntries = [];
  if (layers.spacing) {
    if (palette) {
      layerEntries.push(sw(palette[mIdx].solid) + 'margin');
      layerEntries.push(sw(palette[pIdx].solid) + 'padding');
    } else {
      layerEntries.push('margin · padding');
    }
  }
  if (layers.grid) {
    layerEntries.push(palette ? sw(palette[gIdx].solid) + 'grid 1080/1280' : 'grid 1080/1280');
  }
  if (layers.center) {
    layerEntries.push(palette ? sw(palette[cIdx].solid) + 'center 50%' : 'center 50%');
  }
  if (layerEntries.length) {
    layerLines = sep + '<div style="opacity:0.7;font-size:0.92em">layers</div>' +
      layerEntries.map(e => '<div>' + e + '</div>').join('');
  }

  lbl.innerHTML = head + sep + measLines + subLines + layerLines + sep +
                  '<div style="opacity:0.6;font-size:0.92em">' + meta.pagePath + '</div>';
  document.body.appendChild(lbl);

  return { primary: results, sub: subResults };
}

// ────────────────────────────────────────────────────────────────────────────
// Output writers.
// ────────────────────────────────────────────────────────────────────────────
function writeLegend(runDir, profile) {
  const lines = [];
  lines.push('# ' + profile.name + ' — Layout Field Legend');
  lines.push('');
  lines.push('> ' + profile.description);
  lines.push('');
  lines.push('Annotation method: `outline: 2px dashed <color>` with `outline-offset: -2px`.');
  lines.push('Outlines do NOT shift layout (render-only). Label is `position: fixed` (out of flow).');
  lines.push('');
  lines.push('| Code | Color | Name | Default Selector | Fallbacks |');
  lines.push('|---|---|---|---|---|');
  for (const s of profile.selectors) {
    const fb = s.fallbacks.slice(1).map(x => '`' + x + '`').join(', ') || '–';
    lines.push('| **' + s.code + '** | `' + s.color + '` | ' + s.name + ' | `' + s.fallbacks[0] + '` | ' + fb + ' |');
  }
  lines.push('');
  lines.push('First matching selector wins per element. Missing selector → recorded as `null`, no outline drawn.');
  fs.writeFileSync(path.join(runDir, '01-LEGEND.md'), lines.join('\n') + '\n');
}

function writeConfig(runDir, args, profile, runId) {
  const cfg = {
    runId,
    project: args.project,
    task: args.task,
    version: args.version || null,
    base: args.base,
    pages: args.pages,
    viewports: args.viewports,
    profile: profile.name,
    profileSelectors: profile.selectors,
    cookieAccept: args.cookieAccept,
    annotated: !args.noAnnotate,
    generator: 'layout-snap',
    generatorVersion: GENERATOR_VERSION,
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(runDir, '02-CONFIG.json'), JSON.stringify(cfg, null, 2) + '\n');
}

function formatSubCell(s) {
  if (!s || s.count === 0) return '—';
  if (s.count === 1) return String(s.width);
  if (s.minWidth === s.maxWidth) return s.count + '×' + s.width;
  return s.count + '×' + s.minWidth + '–' + s.maxWidth;
}

function writeEvalMd(runDir, results, profile) {
  const codes = profile.selectors.map(s => s.code);
  const subCodes = (profile.sub_selectors || []).map(s => s.code);
  const allCodes = [...codes, ...subCodes];
  const lines = [];
  lines.push('# Eval — Measurements');
  lines.push('');
  lines.push('All widths in pixels. `—` = selector did not match on this page (not a failure).');
  lines.push('Primary selectors first, then sub-selectors (individual headlines, cards, buttons).');
  lines.push('');
  const head = ['#', 'VP', 'Page', ...allCodes].join(' | ');
  const sep = ['---', '---', '---', ...allCodes.map(() => '---:')].join(' | ');
  lines.push('| ' + head + ' |');
  lines.push('| ' + sep + ' |');
  for (const r of results) {
    if (r.error) {
      lines.push('| ' + r.num + ' | ' + r.vp + ' | ' + r.page + ' | **ERROR: ' + r.error.slice(0, 60) + '** ' + allCodes.slice(1).map(() => '|').join(' '));
      continue;
    }
    const prim = (r.measured && r.measured.primary) || {};
    const sub = (r.measured && r.measured.sub) || {};
    const cells = [
      ...codes.map(c => prim[c] && prim[c].width != null ? String(prim[c].width) : '—'),
      ...subCodes.map(c => formatSubCell(sub[c])),
    ];
    lines.push('| ' + [r.num, r.vp, r.page, ...cells].join(' | ') + ' |');
  }
  lines.push('');
  fs.writeFileSync(path.join(runDir, '03-EVAL.md'), lines.join('\n') + '\n');
}

function writeEvalJson(runDir, results) {
  fs.writeFileSync(path.join(runDir, '04-EVAL.json'), JSON.stringify({ results }, null, 2) + '\n');
}

function writeIndex(runDir, args, profile, results, runId) {
  const lines = [];
  lines.push('# Visual-Eval · ' + args.project + ' · ' + args.task);
  lines.push('');
  lines.push('**Run-ID**: `' + runId + '`  ');
  if (args.version) lines.push('**Site-Version**: `' + args.version + '`  ');
  lines.push('**Base-URL**: ' + args.base + '  ');
  lines.push('**Profile**: `' + profile.name + '` — ' + profile.description + '  ');
  lines.push('**Viewports**: ' + args.viewports.join(', ') + '  ');
  lines.push('**Pages**: ' + args.pages.length + '  ');
  lines.push('**Screens captured**: ' + results.length + ' (' + results.filter(r => !r.error).length + ' OK, ' + results.filter(r => r.error).length + ' errored)  ');
  lines.push('');
  lines.push('## Files');
  lines.push('- [`01-LEGEND.md`](01-LEGEND.md) — color/selector reference');
  lines.push('- [`02-CONFIG.json`](02-CONFIG.json) — reproducibility (URLs, viewports, selectors)');
  lines.push('- [`03-EVAL.md`](03-EVAL.md) — human-readable measurements');
  lines.push('- [`04-EVAL.json`](04-EVAL.json) — machine-readable, diff-friendly');
  lines.push('- `screens/` — annotated screenshots (' + results.length + ')');
  lines.push('');
  lines.push('## Screens');
  lines.push('');
  const codes = profile.selectors.map(s => s.code);
  const head = ['#', 'VP', 'Page', 'File', ...codes].join(' | ');
  const sep = ['---', '---', '---', '---', ...codes.map(() => '---:')].join(' | ');
  lines.push('| ' + head + ' |');
  lines.push('| ' + sep + ' |');
  for (const r of results) {
    if (r.error) {
      lines.push('| ' + r.num + ' | ' + r.vp + ' | ' + r.page + ' | **ERROR** | ' + codes.map(() => '—').join(' | ') + ' |');
      continue;
    }
    const fileLink = '[`' + r.filename + '`](screens/' + r.filename + ')';
    const prim = (r.measured && r.measured.primary) || {};
    const cells = codes.map(c => prim[c] && prim[c].width != null ? String(prim[c].width) : '—');
    lines.push('| ' + [r.num, r.vp, r.page, fileLink, ...cells].join(' | ') + ' |');
  }
  lines.push('');
  if (results.some(r => r.error)) {
    lines.push('## Errors');
    lines.push('');
    for (const r of results) {
      if (!r.error) continue;
      lines.push('- **' + r.vp + ' ' + r.page + '** — ' + r.error);
    }
    lines.push('');
  }
  fs.writeFileSync(path.join(runDir, '00-INDEX.md'), lines.join('\n') + '\n');
}

// ────────────────────────────────────────────────────────────────────────────
// Per-page capture — loads URL, accepts cookie banner, runs annotator,
// takes screenshot, returns result row.
// ────────────────────────────────────────────────────────────────────────────
async function captureOne({ browser, contextConfig, deviceName, args, profile, pagePath, screenNum, screenTotal, num, vp, screensDir, runId }) {
  const filename = num + '-' + vp + '-' + slugify(pagePath) + '.png';
  const url = args.base + pagePath + (pagePath.includes('?') ? '&' : '?') + '_cb=' + Date.now();

  process.stdout.write('  ' + num + '/' + screenTotal + ' [' + vp + '] ' + pagePath + ' … ');

  const ctx = await browser.newContext(contextConfig);
  const page = await ctx.newPage();
  let measured = {};
  let error = null;

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
    if (args.cookieAccept) {
      try {
        await page.locator('button:has-text("' + args.cookieAccept + '")').first().click({ timeout: COOKIE_CLICK_TIMEOUT_MS });
        await page.waitForTimeout(COOKIE_POST_CLICK_MS);
      } catch (e) { /* no banner — fine */ }
    }
    await page.waitForTimeout(POST_NAV_SETTLE_MS);

    const meta = {
      project: args.project,
      task: args.task,
      version: args.version,
      runId,
      screenNum,
      screenTotal,
      deviceName,
      pagePath,
      styleName: STYLES[args.style].name,
      paletteName: args.palette,
    };
    const paletteSize = profile.selectors.length + (profile.sub_selectors || []).length + 4;

    measured = await page.evaluate(annotateInPage, {
      targets: profile.selectors,
      subTargets: profile.sub_selectors || [],
      meta,
      noAnnotate: args.noAnnotate,
      style: STYLES[args.style],
      layers: {
        spacing: args.showSpacing,
        grid: args.showGrid,
        center: args.showCenter,
      },
      palette: generatePalette(args.palette, paletteSize),
      constants: {
        Z_OVERLAY: 2147483646,
        Z_LABEL: 2147483647,
        GRID_WIDTHS,
      },
    });

    if (args.fullpage) {
      const scrollH = await page.evaluate(() => Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
      ));
      const captureH = Math.min(scrollH, args.maxHeight);
      const captureW = await page.evaluate(() => window.innerWidth);
      await page.screenshot({
        path: path.join(screensDir, filename),
        clip: { x: 0, y: 0, width: captureW, height: captureH },
      });
      process.stdout.write('✓ (' + captureH + 'px' + (scrollH > args.maxHeight ? ' clipped from ' + scrollH : '') + ')\n');
    } else {
      await page.screenshot({ path: path.join(screensDir, filename), fullPage: false });
      process.stdout.write('✓\n');
    }
  } catch (e) {
    error = e.message;
    process.stdout.write('ERR ' + e.message.slice(0, 50) + '\n');
  } finally {
    await ctx.close();
  }

  return { num, vp, page: pagePath, slug: slugify(pagePath), filename, measured, error };
}

// ────────────────────────────────────────────────────────────────────────────
// Main orchestrator.
// ────────────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const profile = loadProfile(args);
  const { webkit, devices } = loadPlaywright();

  const runId = timestamp();
  const runFolderName = runId + '-' + args.project + '-' + args.task;
  const runDir = path.join(args.out, runFolderName);
  const screensDir = path.join(runDir, 'screens');
  fs.mkdirSync(screensDir, { recursive: true });

  console.log('[layout-snap] run ' + runId + ' → ' + runDir);

  const screenTotal = args.viewports.length * args.pages.length;
  const browser = await webkit.launch({ headless: true });
  const results = [];
  let screenNum = 0;

  try {
    for (const vp of args.viewports) {
      const cfg = makeContextConfig(vp, devices);
      const deviceName = cfg._deviceName;
      delete cfg._deviceName;

      for (const pagePath of args.pages) {
        screenNum++;
        const num = String(screenNum).padStart(2, '0');
        const row = await captureOne({
          browser,
          contextConfig: cfg,
          deviceName,
          args,
          profile,
          pagePath,
          screenNum,
          screenTotal,
          num,
          vp,
          screensDir,
          runId,
        });
        results.push(row);
      }
    }
  } finally {
    await browser.close();
  }

  // Write outputs
  writeLegend(runDir, profile);
  writeConfig(runDir, args, profile, runId);
  writeEvalMd(runDir, results, profile);
  writeEvalJson(runDir, results);
  writeIndex(runDir, args, profile, results, runId);

  const ok = results.filter(r => !r.error).length;
  console.log('\n✓ Run complete: ' + ok + '/' + results.length + ' screens OK');
  console.log('  → ' + runDir);
  console.log('  → open ' + path.join(runDir, '00-INDEX.md'));
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
