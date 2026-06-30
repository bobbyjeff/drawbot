"use strict";

/* ── Canvas layout constants ─────────────────────────────────────── */
export const W           = 2400;
export const H           = 1260;
export const VIEW_SCALE  = 2;
export const LEFT_X      = 0;
export const RIGHT_X     = 1200;

/* Converge / Sankey shared geometry */
const START_TOP  = 55.66;
const START_BOT  = 574.34;
const LINE_COUNT = 15;
export const START_YS = Array.from({ length: LINE_COUNT }, (_, i) =>
  +(START_BOT - (START_BOT - START_TOP) * i / (LINE_COUNT - 1)).toFixed(2)
);
export const N          = START_YS.length;
export const CY         = 315;                  /* converge / sankey center-y */
export const CONVERGE_X = 1350;

/* ── Mutable export state (use setters from og-ui.js) ─────────────── */
export let _exportFrameIndex = -1;
export let _skipBg = false;
export function setExportFrameIndex(v) { _exportFrameIndex = v; }
export function setSkipBg(v) { _skipBg = v; }

/* ── Math helpers ─────────────────────────────────────────────────── */
export function lerp(a, b, t) { return a + (b - a) * t; }
export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

export function subdivideBezierLeft(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, t) {
  const ax = lerp(p0x, p1x, t), ay = lerp(p0y, p1y, t);
  const bx = lerp(p1x, p2x, t), by = lerp(p1y, p2y, t);
  const cx = lerp(p2x, p3x, t), cy = lerp(p2y, p3y, t);
  const dx = lerp(ax, bx, t),   dy = lerp(ay, by, t);
  const ex = lerp(bx, cx, t),   ey = lerp(by, cy, t);
  const fx = lerp(dx, ex, t),   fy = lerp(dy, ey, t);
  return { x0: p0x, y0: p0y, x1: ax, y1: ay, x2: dx, y2: dy, x3: fx, y3: fy };
}

export function subdivideBezierRight(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, t) {
  const ax = lerp(p0x, p1x, t), ay = lerp(p0y, p1y, t);
  const bx = lerp(p1x, p2x, t), by = lerp(p1y, p2y, t);
  const cx = lerp(p2x, p3x, t), cy = lerp(p2y, p3y, t);
  const dx = lerp(ax, bx, t),   dy = lerp(ay, by, t);
  const ex = lerp(bx, cx, t),   ey = lerp(by, cy, t);
  const fx = lerp(dx, ex, t),   fy = lerp(dy, ey, t);
  return { x0: fx, y0: fy, x1: ex, y1: ey, x2: cx, y2: cy, x3: p3x, y3: p3y };
}

export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ── Segment / node timing ────────────────────────────────────────── */

/* During exports _exportFrameIndex is set to the exact frame so timing
   matches the live preview; -1 means use real wall-clock time. */
export function segNow(p) {
  if (_exportFrameIndex >= 0) return _exportFrameIndex / p.emergeFr;
  return (performance.now() / 1000) * (p.fps / p.emergeFr);
}

/* ── Shared segment helpers ───────────────────────────────────────── */
export function makeSegs(seed, count) {
  const rng = mulberry32(seed);
  return Array.from({ length: count }, () => ({
    pos:   rng(),
    width: [0.03, 0.08, 0.18][Math.floor(rng() * 3)] + rng() * 0.04,
    drift: (0.2 + rng() * 0.8) * (rng() > 0.5 ? 1 : -1),
    phase: rng(),
  }));
}

/* drawFn(s0, s1, color) — s0/s1 in [0,1] along the stroke */
export function applySegs(segs, _gp, p, drawFn) {
  if (!segs.length) return;
  const sizeScale  = lerp(0.1, 2.0, p.segSize);
  const speedScale = lerp(0.1, 2.0, p.segSpeed);
  const count      = Math.max(1, Math.round(segs.length * clamp(lerp(0.15, 1, p.segDensity), 0.01, 1)));
  const t          = segNow(p);
  const cr = parseInt(p.segColor.slice(1, 3), 16);
  const cg = parseInt(p.segColor.slice(3, 5), 16);
  const cb = parseInt(p.segColor.slice(5, 7), 16);
  const color = `rgb(${cr},${cg},${cb})`;
  for (let i = 0; i < count; i++) {
    const cs  = segs[i];
    const pos = ((cs.pos + (t + cs.phase) * cs.drift * speedScale) % 1 + 1) % 1;
    const hw  = cs.width * sizeScale * 0.5;
    const s0  = pos - hw;
    const s1  = pos + hw;
    if (s1 <= s0) continue;
    if (s0 < 0) {
      if (1 + s0 < 1) drawFn(1 + s0, 1, color);
      if (s1 > 0)     drawFn(0, s1,   color);
    } else if (s1 > 1) {
      drawFn(s0,     1,      color);
      drawFn(0, s1 - 1,      color);
    } else {
      drawFn(s0, s1, color);
    }
  }
}

/* ── Shared node helpers ──────────────────────────────────────────── */
export function makeNodes(seed, count) {
  const rng = mulberry32(seed);
  return Array.from({ length: count }, () => ({
    pos:   rng(),
    drift: (0.3 + rng() * 0.7) * (rng() > 0.5 ? 1 : -1),
    phase: rng(),
  }));
}

export function bezierPoint(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, t) {
  const ax = lerp(p0x, p1x, t), ay = lerp(p0y, p1y, t);
  const bx = lerp(p1x, p2x, t), by = lerp(p1y, p2y, t);
  const cx = lerp(p2x, p3x, t), cy = lerp(p2y, p3y, t);
  const dx = lerp(ax, bx, t),   dy = lerp(ay, by, t);
  const ex = lerp(bx, cx, t),   ey = lerp(by, cy, t);
  return { x: lerp(dx, ex, t), y: lerp(dy, ey, t) };
}

export function roundRectPoint(cx, cy, hw, hh, pos) {
  const d = ((pos % 1) + 1) % 1 * (4 * (hw + hh));
  const w2 = 2 * hw, h2 = 2 * hh;
  if (d < w2)           return { x: cx - hw + d,              y: cy - hh };
  if (d < w2 + h2)      return { x: cx + hw,                  y: cy - hh + (d - w2) };
  if (d < 2 * w2 + h2)  return { x: cx + hw - (d - w2 - h2), y: cy + hh };
  return                       { x: cx - hw,                  y: cy + hh - (d - 2 * w2 - h2) };
}

export function applyNodes(nodes, p, drawFn) {
  if (!nodes.length || !p.nodeEnabled) return;
  const speedScale = lerp(0.05, 3.0, p.nodeSpeed);
  const count      = Math.max(1, Math.round(nodes.length * clamp(lerp(0.05, 1.0, p.nodeDensity), 0.01, 1)));
  const t          = segNow(p);
  for (let i = 0; i < Math.min(count, nodes.length); i++) {
    const n   = nodes[i];
    const pos = ((n.pos + (t + n.phase) * n.drift * speedScale) % 1 + 1) % 1;
    drawFn(pos);
  }
}

/* ── Canvas background helper ─────────────────────────────────────── */
export function fillBackground(ctx, p) {
  if (_skipBg) { ctx.clearRect(0, 0, W, H); }
  else { ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H); }
}
