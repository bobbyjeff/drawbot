(function () {
  "use strict";

  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d");
  const W = 2400, H = 1260;
  const VIEW_SCALE = 2;

  const LEFT_X = 0;
  const RIGHT_X = 1200;
  const TARGET_SPAN = RIGHT_X - LEFT_X;

  const START_TOP = 55.66;
  const START_BOT = 574.34;
  const LINE_COUNT = 15;
  const START_YS = Array.from({ length: LINE_COUNT }, (_, i) =>
    +(START_BOT - (START_BOT - START_TOP) * i / (LINE_COUNT - 1)).toFixed(2)
  );

  const N = START_YS.length;
  const CY = 315;
  const CONVERGE_X = 1350;
  const CURVE_SPAN = CONVERGE_X - LEFT_X;

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function subdivideBezierLeft(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, t) {
    const ax = lerp(p0x, p1x, t), ay = lerp(p0y, p1y, t);
    const bx = lerp(p1x, p2x, t), by = lerp(p1y, p2y, t);
    const cx = lerp(p2x, p3x, t), cy = lerp(p2y, p3y, t);
    const dx = lerp(ax, bx, t),   dy = lerp(ay, by, t);
    const ex = lerp(bx, cx, t),   ey = lerp(by, cy, t);
    const fx = lerp(dx, ex, t),   fy = lerp(dy, ey, t);
    return { x0: p0x, y0: p0y, x1: ax, y1: ay, x2: dx, y2: dy, x3: fx, y3: fy };
  }

  function subdivideBezierRight(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, t) {
    const ax = lerp(p0x, p1x, t), ay = lerp(p0y, p1y, t);
    const bx = lerp(p1x, p2x, t), by = lerp(p1y, p2y, t);
    const cx = lerp(p2x, p3x, t), cy = lerp(p2y, p3y, t);
    const dx = lerp(ax, bx, t),   dy = lerp(ay, by, t);
    const ex = lerp(bx, cx, t),   ey = lerp(by, cy, t);
    const fx = lerp(dx, ex, t),   fy = lerp(dy, ey, t);
    return { x0: fx, y0: fy, x1: ex, y1: ey, x2: cx, y2: cy, x3: p3x, y3: p3y };
  }

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* ─── shared segment helpers ─── */
  function makeSegs(seed, count) {
    const rng = mulberry32(seed);
    return Array.from({ length: count }, () => ({
      pos:   rng(),
      width: [0.03, 0.08, 0.18][Math.floor(rng() * 3)] + rng() * 0.04,
      drift: (0.2 + rng() * 0.8) * (rng() > 0.5 ? 1 : -1),
      phase: rng(),
    }));
  }

  /* Continuous time base for segments — independent of frame rate.
     During exports the loop sets _exportFrameIndex so every frame gets
     the exact simulated time it would have at that position in the loop,
     matching the live preview. -1 means use real wall-clock time. */
  let _exportFrameIndex = -1;
  function segNow(p) {
    if (_exportFrameIndex >= 0) return _exportFrameIndex / p.emergeFr;
    return (performance.now() / 1000) * (p.fps / p.emergeFr);
  }

  /* drawFn(s0, s1, color) — s0/s1 in [0,1] along the stroke */
  function applySegs(segs, _gp, p, drawFn) {
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
      /* Wrap-around: when a segment straddles the 0/1 boundary draw both halves
         so it crosses smoothly rather than teleporting to the other end. */
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

  /* ─── shared node helpers ─── */
  function makeNodes(seed, count) {
    const rng = mulberry32(seed);
    return Array.from({ length: count }, () => ({
      pos:   rng(),
      drift: (0.3 + rng() * 0.7) * (rng() > 0.5 ? 1 : -1),
      phase: rng(),
    }));
  }

  /** Evaluate a cubic bezier at parameter t — returns canvas-space {x,y}. */
  function bezierPoint(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, t) {
    const ax = lerp(p0x, p1x, t), ay = lerp(p0y, p1y, t);
    const bx = lerp(p1x, p2x, t), by = lerp(p1y, p2y, t);
    const cx = lerp(p2x, p3x, t), cy = lerp(p2y, p3y, t);
    const dx = lerp(ax, bx, t),   dy = lerp(ay, by, t);
    const ex = lerp(bx, cx, t),   ey = lerp(by, cy, t);
    return { x: lerp(dx, ex, t), y: lerp(dy, ey, t) };
  }

  /** Point on rounded-rect perimeter at pos [0,1], in logical (pre-sv) coords. */
  function roundRectPoint(cx, cy, hw, hh, pos) {
    const d = ((pos % 1) + 1) % 1 * (4 * (hw + hh));
    const w2 = 2 * hw, h2 = 2 * hh;
    if (d < w2)           return { x: cx - hw + d,              y: cy - hh };
    if (d < w2 + h2)      return { x: cx + hw,                  y: cy - hh + (d - w2) };
    if (d < 2 * w2 + h2)  return { x: cx + hw - (d - w2 - h2), y: cy + hh };
    return                       { x: cx - hw,                  y: cy + hh - (d - 2 * w2 - h2) };
  }

  /** drawFn(pos) — pos in [0,1] along the stroke */
  function applyNodes(nodes, p, drawFn) {
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

  /* ─── active preset ─── */
  let activePreset = "parametric";

  /* ══════════════════════════════════════════
     CONVERGE preset
     ══════════════════════════════════════════ */
  const converge = (function () {
    const LINES = START_YS.map((sy) => {
      const dy = CY - sy;
      return {
        sy,
        c1x: LEFT_X + CURVE_SPAN * 0.75, c1y: sy,
        c2x: LEFT_X + CURVE_SPAN * 0.95, c2y: CY,
      };
    });

    const MAX_DIST = Math.max(...START_YS.map(sy => Math.abs(sy - CY)));
    const lineMeta = START_YS.map(sy => ({ normDist: Math.abs(sy - CY) / MAX_DIST }));

    function drawLineSegment(line, tStart, tEnd, strokeColor, lineWidth, convX, convY) {
      if (tEnd <= tStart) return;
      const s = VIEW_SCALE;
      const p0x = LEFT_X*s, p0y = line.sy*s;
      const p1x = line.c1x*s, p1y = line.c1y*s;
      const p2x = line.c2x*s, p2y = line.c2y*s;
      const p3x = (convX !== undefined ? convX : CONVERGE_X)*s;
      const p3y = (convY !== undefined ? convY : CY)*s;

      let sub;
      if (tStart <= 0 && tEnd >= 1) {
        sub = { x0:p0x, y0:p0y, x1:p1x, y1:p1y, x2:p2x, y2:p2y, x3:p3x, y3:p3y };
      } else if (tStart <= 0) {
        sub = subdivideBezierLeft(p0x,p0y, p1x,p1y, p2x,p2y, p3x,p3y, tEnd);
      } else if (tEnd >= 1) {
        sub = subdivideBezierRight(p0x,p0y, p1x,p1y, p2x,p2y, p3x,p3y, tStart);
      } else {
        const r = subdivideBezierRight(p0x,p0y, p1x,p1y, p2x,p2y, p3x,p3y, tStart);
        const tRemap = (tEnd - tStart) / (1 - tStart);
        sub = subdivideBezierLeft(r.x0,r.y0, r.x1,r.y1, r.x2,r.y2, r.x3,r.y3, tRemap);
      }

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(sub.x0, sub.y0);
      ctx.bezierCurveTo(sub.x1, sub.y1, sub.x2, sub.y2, sub.x3, sub.y3);
      ctx.stroke();
    }

    const CONVERGE_NODE_DESCS = Array.from({ length: N }, (_, i) => makeNodes(0xC0DE0000 + i * 29, 8));

    const rng = mulberry32(42);
    const BREAK_ZONE = (CONVERGE_X - LEFT_X) / (RIGHT_X - LEFT_X) * 0.7;
    const LINE_BREAKS = Array.from({ length: N }, (_, i) => {
      const nd = lineMeta[i].normDist;
      if (nd < 0.15) return [];
      const count = Math.round(lerp(0, 2, nd));
      if (count === 0) return [];
      return Array.from({ length: count }, () => {
        const baseSpeed = lerp(0.35, 0.01, nd) + rng() * 0.1;
        const mult = Math.max(1, Math.round(baseSpeed / BREAK_ZONE) + Math.floor(rng() * 3));
        return {
          pos: 0.05 + rng() * (BREAK_ZONE - 0.1),
          width: lerp(0.012, 0.03, nd) * (0.8 + rng() * 0.5),
          drift: BREAK_ZONE * mult,
          phase: rng(),
          max: BREAK_ZONE,
        };
      });
    });

    const COLOR_ZONE = BREAK_ZONE + 130 / (RIGHT_X - LEFT_X);
    const COLOR_FADE_START = COLOR_ZONE - 0.08;
    const colorRng = mulberry32(2749);
    const COLOR_SEGS = Array.from({ length: N }, (_, i) => {
      const nd = lineMeta[i].normDist;
      const count = 1 + Math.floor(colorRng() * 2);
      return Array.from({ length: count }, () => {
        const baseSpeed = lerp(0.4, 0.01, nd) + colorRng() * 0.12;
        const mult = Math.max(1, Math.round(baseSpeed / COLOR_ZONE) + Math.floor(colorRng() * 3));
        const widthVariant = [0.03, 0.08, 0.18][Math.floor(colorRng() * 3)];
        return {
          pos: colorRng() * COLOR_ZONE,
          width: widthVariant + colorRng() * 0.04,
          drift: COLOR_ZONE * mult,
          phase: colorRng(),
        };
      });
    });

    function render(fi, p) {
      ctx.fillStyle = p.bg;
      ctx.fillRect(0, 0, W, H);

      const VH = H / VIEW_SCALE;
      const bendVal = parseInt(document.getElementById("convergeBend").value, 10) / 100;
      const bentConvergeX = lerp(CONVERGE_X, RIGHT_X * 0.92, bendVal);
      const bentConvergeY = lerp(CY, VH * 0.06, bendVal);
      const bendShift = (VH * 0.85 - CY) * bendVal;
      const bentCurveSpan = bentConvergeX - LEFT_X;

      const BENT_LINES = LINES.map(line => {
        const bentSy = line.sy + bendShift;
        return {
          sy:  bentSy,
          c1x: LEFT_X + bentCurveSpan * 0.75,
          c1y: bentSy,
          c2x: LEFT_X + bentCurveSpan * 0.95,
          c2y: bentConvergeY,
        };
      });

      const tot = p.emergeFr;
      const t = ((fi % tot) + tot) % tot;
      const gp = t / tot;

      for (let i = 0; i < N; i++) {
        drawLineSegment(BENT_LINES[i], 0, 1, p.strokeColor, p.strokeW, bentConvergeX, bentConvergeY);
      }

      if (p.nodeEnabled) {
        const s = VIEW_SCALE;
        ctx.fillStyle = p.nodeColor;
        for (let i = 0; i < N; i++) {
          const line = BENT_LINES[i];
          const p0x = LEFT_X * s, p0y = line.sy * s;
          const p1x = line.c1x * s, p1y = line.c1y * s;
          const p2x = line.c2x * s, p2y = line.c2y * s;
          const p3x = bentConvergeX * s, p3y = bentConvergeY * s;
          applyNodes(CONVERGE_NODE_DESCS[i], p, (pos) => {
            const pt = bezierPoint(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, pos);
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, p.strokeW * 2, 0, Math.PI * 2);
            ctx.fill();
          });
        }
      }

      if (p.segEnabled) {
        const sizeScale  = lerp(0.1, 2.0, p.segSize);
        const speedScale = lerp(0.1, 2.0, p.segSpeed);
        const densCount  = Math.max(1, Math.round(N * clamp(lerp(0.15, 1, p.segDensity), 0, 1)));
        const MIN_GAP    = 0.04;
        const segT       = segNow(p);
        const gr = parseInt(p.strokeColor.slice(1, 3), 16);
        const gg = parseInt(p.strokeColor.slice(3, 5), 16);
        const gb = parseInt(p.strokeColor.slice(5, 7), 16);
        const cr = parseInt(p.segColor.slice(1, 3), 16);
        const cg = parseInt(p.segColor.slice(3, 5), 16);
        const cb = parseInt(p.segColor.slice(5, 7), 16);

        for (let i = 0; i < densCount; i++) {
          const line = BENT_LINES[i];
          const colorSegs = COLOR_SEGS[i]
            .map(cs => {
              const pos = (cs.pos + (segT + cs.phase) * cs.drift * speedScale) % COLOR_ZONE;
              const hw  = cs.width * sizeScale * 0.5;
              return {
                s0: clamp(pos - hw, 0, COLOR_ZONE),
                s1: clamp(pos + hw, 0, COLOR_ZONE),
              };
            })
            .filter(c => c.s1 > c.s0)
            .sort((a, b) => a.s0 - b.s0);

          for (let ci = 0; ci < colorSegs.length; ci++) {
            const cs   = colorSegs[ci];
            const prev = ci > 0 ? colorSegs[ci - 1] : null;
            if (prev && cs.s0 < prev.s1 + MIN_GAP) continue;

            const mid = (cs.s0 + cs.s1) / 2;
            const fadeBlend = cs.s1 > COLOR_FADE_START
              ? clamp((mid - COLOR_FADE_START) / (COLOR_ZONE - COLOR_FADE_START), 0, 1)
              : 0;

            const br  = Math.round(lerp(cr, gr, fadeBlend));
            const bg2 = Math.round(lerp(cg, gg, fadeBlend));
            const bb  = Math.round(lerp(cb, gb, fadeBlend));
            drawLineSegment(line, cs.s0, cs.s1, `rgb(${br},${bg2},${bb})`, p.strokeW, bentConvergeX, bentConvergeY);
          }
        }
      }
    }

    return { render };
  })();

  /* ══════════════════════════════════════════
     SPEED preset
     ══════════════════════════════════════════ */
  const speed = (function () {
    const sv = VIEW_SCALE;
    const BASE_MARGIN = 40;

    function drawHLine(y, x0, x1, strokeColor, lineWidth) {
      if (x1 <= x0) return;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x0 * sv, y * sv);
      ctx.lineTo(x1 * sv, y * sv);
      ctx.stroke();
    }

    const MAX_DIST = Math.max(...START_YS.map(sy => Math.abs(sy - CY)));

    const rng = mulberry32(7777);
    const SPEED_LINES = START_YS.map((sy) => {
      const nd = Math.abs(sy - CY) / MAX_DIST;
      const breakCount = 4 + Math.floor(rng() * 5);
      const breaks = [];
      for (let b = 0; b < breakCount; b++) {
        const xNorm = 0.1 + rng() * 0.85;
        const baseGap = lerp(3, 50, xNorm * xNorm) * (0.6 + rng() * 0.8);
        breaks.push({
          xNorm,
          baseGap,
          drift: (0.3 + rng() * 0.7) * (rng() > 0.5 ? 1 : -1),
          phase: rng(),
        });
      }
      const velJitterHead = 0.7 + rng() * 0.6;
      const velJitterTail = 0.5 + rng() * 1.0;
      return { sy, nd, breaks, velJitterHead, velJitterTail };
    });

    const ditherRng = mulberry32(5555);
    const DITHER_BREAKS = START_YS.map(() => {
      const count = 20 + Math.floor(ditherRng() * 20);
      return Array.from({ length: count }, () => ({
        xNorm: ditherRng() * 0.7,
        baseGap: 1 + ditherRng() * 8,
        drift: (0.15 + ditherRng() * 0.5) * (ditherRng() > 0.5 ? 1 : -1),
        phase: ditherRng(),
      }));
    });

    const colorRng = mulberry32(8888);
    const COLOR_SEGS = START_YS.map(() => {
      const count = 2 + Math.floor(colorRng() * 4);
      return Array.from({ length: count }, () => ({
        xNorm: 0.05 + colorRng() * 0.7,
        baseWidth: 15 + colorRng() * 70,
        drift: (0.15 + colorRng() * 0.5) * (colorRng() > 0.5 ? 1 : -1),
        phase: colorRng(),
      }));
    });

    const SPEED_SEG_DESCS  = Array.from({ length: N }, (_, i) => makeSegs(0xABCD0000 + i * 7, 3));
    const SPEED_NODE_DESCS = Array.from({ length: N }, (_, i) => makeNodes(0xC0DE1000 + i * 13, 8));

    function render(fi, p) {
      ctx.fillStyle = p.bg;
      ctx.fillRect(0, 0, W, H);

      const spaceVal = parseInt(document.getElementById("speedSpace").value, 10) / 100;
      const velVal = parseInt(document.getElementById("speedVelocity").value, 10) / 100;
      const colorVal = parseInt(document.getElementById("speedColor").value, 10) / 100;
      const scaleVal = parseInt(document.getElementById("speedScale").value, 10) / 100;
      const posVal = parseInt(document.getElementById("speedPosition").value, 10) / 100;
      const ditherVal = parseInt(document.getElementById("speedDither").value, 10) / 100;
      const perspVal = parseInt(document.getElementById("speedPersp").value, 10) / 100;

      const margin = lerp(RIGHT_X * 0.35, -RIGHT_X * 0.15, scaleVal);
      const posOffset = (posVal - 0.5) * RIGHT_X * 0.8;
      const LINE_LEFT = margin + posOffset;
      const LINE_RIGHT = RIGHT_X - margin + posOffset;
      const SPAN = LINE_RIGHT - LINE_LEFT;
      if (SPAN <= 0) return;

      const perspConvergeX = RIGHT_X + 150;
      const perspConvergeY = CY;

      const tot = p.emergeFr;
      const t = ((fi % tot) + tot) % tot;
      const gp = t / tot;

      for (let i = 0; i < N; i++) {
        const sl = SPEED_LINES[i];
        const nd = sl.nd;

        const headOffset = velVal * nd * SPAN * 0.35 * sl.velJitterHead;
        const tailOffset = -(velVal * nd * SPAN * 0.2 * sl.velJitterTail);

        const MIN_GAP = 6;
        const MIN_SEG = 8;

        const breakRanges = [];
        for (const br of sl.breaks) {
          const scaledGap = br.baseGap * lerp(0.3, 2.5, spaceVal);
          if (scaledGap < MIN_GAP) continue;

          const animated = ((br.xNorm + (gp + br.phase) * br.drift) % 1 + 1) % 1;
          const cx = LINE_LEFT + animated * SPAN;
          breakRanges.push({ x0: cx - scaledGap / 2, x1: cx + scaledGap / 2 });
        }

        if (ditherVal > 0.01) {
          for (const db of DITHER_BREAKS[i]) {
            const scaledGap = db.baseGap * lerp(0.5, 3, ditherVal);
            if (scaledGap < 2) continue;
            const animated = ((db.xNorm + (gp + db.phase) * db.drift) % 1 + 1) % 1;
            const xPos = LINE_LEFT + animated * SPAN;
            const leftBias = 1 - clamp((xPos - LINE_LEFT) / SPAN, 0, 1);
            const ditherScale = leftBias * leftBias * ditherVal;
            const finalGap = scaledGap * ditherScale;
            if (finalGap < 2) continue;
            breakRanges.push({ x0: xPos - finalGap / 2, x1: xPos + finalGap / 2 });
          }
        }

        breakRanges.sort((a, b) => a.x0 - b.x0);

        const lineLeft = LINE_LEFT + tailOffset;
        const lineRight = LINE_RIGHT - headOffset;

        const rawSegs = [];
        let cursor = lineLeft;
        for (const br of breakRanges) {
          const gx0 = Math.max(br.x0, lineLeft);
          const gx1 = Math.min(br.x1, lineRight);
          if (gx1 <= gx0) continue;
          if (gx0 > cursor) rawSegs.push({ x0: cursor, x1: gx0 });
          cursor = Math.max(cursor, gx1);
        }
        if (cursor < lineRight) rawSegs.push({ x0: cursor, x1: lineRight });

        const segments = rawSegs.filter(s => (s.x1 - s.x0) >= MIN_SEG);

        for (const seg of segments) {
          const segMidX = (seg.x0 + seg.x1) / 2;
          const tPersp = clamp((segMidX - LINE_LEFT) / SPAN, 0, 1);
          const yAt = lerp(sl.sy, perspConvergeY, tPersp * perspVal);
          drawHLine(yAt, seg.x0, seg.x1, p.strokeColor, p.strokeW);
        }

        if (colorVal > 0.01) {
          const gr = parseInt(p.strokeColor.slice(1,3),16);
          const gg = parseInt(p.strokeColor.slice(3,5),16);
          const gb = parseInt(p.strokeColor.slice(5,7),16);
          const cr = parseInt(p.segColor.slice(1,3),16);
          const cg = parseInt(p.segColor.slice(3,5),16);
          const cb = parseInt(p.segColor.slice(5,7),16);

          for (const cs of COLOR_SEGS[i]) {
            const showProb = colorVal;
            const seeded = (cs.phase * 1000) % 1;
            if (seeded > showProb) continue;

            const animated = ((cs.xNorm + (gp + cs.phase) * cs.drift) % 1 + 1) % 1;
            const cx = LINE_LEFT + animated * SPAN;
            const w = cs.baseWidth * lerp(0.5, 1.5, colorVal);
            const sx0 = Math.max(cx - w / 2, lineLeft);
            const sx1 = Math.min(cx + w / 2, lineRight);
            if (sx1 <= sx0) continue;

            const blend = clamp(1 - colorVal, 0, 0.7);
            const fr = Math.round(lerp(cr, gr, blend));
            const fg = Math.round(lerp(cg, gg, blend));
            const fb = Math.round(lerp(cb, gb, blend));

            for (const seg of segments) {
              const ox0 = Math.max(sx0, seg.x0);
              const ox1 = Math.min(sx1, seg.x1);
              if (ox1 > ox0) {
                const cMidX = (ox0 + ox1) / 2;
                const cTP = clamp((cMidX - LINE_LEFT) / SPAN, 0, 1);
                const cY = lerp(sl.sy, perspConvergeY, cTP * perspVal);
                drawHLine(cY, ox0, ox1, `rgb(${fr},${fg},${fb})`, p.strokeW);
              }
            }
          }
        }

        if (p.segEnabled) {
          applySegs(SPEED_SEG_DESCS[i], gp, p, (s0, s1, color) => {
            const x0 = lineLeft + s0 * SPAN;
            const x1 = lineLeft + s1 * SPAN;
            const segMidX = (x0 + x1) / 2;
            const tPersp  = clamp((segMidX - LINE_LEFT) / SPAN, 0, 1);
            const yAt     = lerp(sl.sy, perspConvergeY, tPersp * perspVal);
            drawHLine(yAt, x0, x1, color, p.strokeW);
          });
        }

        if (p.nodeEnabled) {
          ctx.fillStyle = p.nodeColor;
          applyNodes(SPEED_NODE_DESCS[i], p, (pos) => {
            const x   = lineLeft + pos * (lineRight - lineLeft);
            const tP  = clamp((x - LINE_LEFT) / SPAN, 0, 1);
            const yAt = lerp(sl.sy, perspConvergeY, tP * perspVal);
            ctx.beginPath();
            ctx.arc(x * sv, yAt * sv, p.strokeW * 2, 0, Math.PI * 2);
            ctx.fill();
          });
        }
      }
    }

    return { render };
  })();

  /* ══════════════════════════════════════════
     PERSPECTIVE preset
     ══════════════════════════════════════════ */
  const perspective = (function () {
    const sv = VIEW_SCALE;
    const VW = RIGHT_X;
    const VH = H / VIEW_SCALE;

    const PERSP_SEGS  = Array.from({ length: 30 }, (_, i) => makeSegs(0xFEED0000 + i * 17, 2));
    const PERSP_NODES = Array.from({ length: 30 }, (_, i) => makeNodes(0xC0DE2000 + i * 11, 8));

    function drawRoundedRect(cx, cy, hw, hh, r, strokeColor, lineWidth) {
      const x0 = cx - hw, y0 = cy - hh, x1 = cx + hw, y1 = cy + hh;
      const cr = Math.min(r, hw, hh);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth * sv;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo((x0 + cr) * sv, y0 * sv);
      ctx.lineTo((x1 - cr) * sv, y0 * sv);
      if (cr > 0.5) ctx.arcTo(x1 * sv, y0 * sv, x1 * sv, (y0 + cr) * sv, cr * sv);
      else ctx.lineTo(x1 * sv, y0 * sv);
      ctx.lineTo(x1 * sv, (y1 - cr) * sv);
      if (cr > 0.5) ctx.arcTo(x1 * sv, y1 * sv, (x1 - cr) * sv, y1 * sv, cr * sv);
      else ctx.lineTo(x1 * sv, y1 * sv);
      ctx.lineTo((x0 + cr) * sv, y1 * sv);
      if (cr > 0.5) ctx.arcTo(x0 * sv, y1 * sv, x0 * sv, (y1 - cr) * sv, cr * sv);
      else ctx.lineTo(x0 * sv, y1 * sv);
      ctx.lineTo(x0 * sv, (y0 + cr) * sv);
      if (cr > 0.5) ctx.arcTo(x0 * sv, y0 * sv, (x0 + cr) * sv, y0 * sv, cr * sv);
      else ctx.lineTo(x0 * sv, y0 * sv);
      ctx.closePath();
      ctx.stroke();
    }

    function drawLine(x0, y0, x1, y1, strokeColor, lineWidth) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth * sv;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x0 * sv, y0 * sv);
      ctx.lineTo(x1 * sv, y1 * sv);
      ctx.stroke();
    }

    function render(fi, p) {
      ctx.fillStyle = p.bg;
      ctx.fillRect(0, 0, W, H);

      const depthVal = parseInt(document.getElementById("perspDepth").value, 10) / 100;
      const angleVal = parseInt(document.getElementById("perspAngle").value, 10) / 100;
      const shapeVal = parseInt(document.getElementById("perspShape").value, 10) / 100;

      const tot = p.emergeFr;
      const t = ((fi % tot) + tot) % tot;
      const gp = t / tot;

      const posYVal = parseInt(document.getElementById("perspPosition").value, 10) / 100;

      const vpX = VW / 2 + (angleVal - 0.5) * VW * 0.8;
      const vpY = VH / 2 + (posYVal - 0.5) * VH * 0.8;

      const outerHW = VW / 2 + 40;
      const outerHH = VH / 2 + 40;

      const ringCount = Math.round(lerp(6, 30, depthVal));
      const minScale = lerp(0.15, 0.01, depthVal);

      const maxRadius = Math.min(outerHW, outerHH) * shapeVal;

      const animShift = gp;

      const expK = 3.5;
      const expDenom = Math.exp(expK) - 1;

      /* Depth-fade: rings blend toward bg as they recede, disappearing before
         the vanishing point.  Fade starts at t2 = FADE_START, fully gone at
         t2 = FADE_END.  Rings beyond that are culled entirely. */
      const FADE_START = 0.50;
      const FADE_END   = 0.92;
      const bgR  = parseInt(p.bg.slice(1,3),16), bgG  = parseInt(p.bg.slice(3,5),16), bgB  = parseInt(p.bg.slice(5,7),16);
      const fgR  = parseInt(p.strokeColor.slice(1,3),16), fgG  = parseInt(p.strokeColor.slice(3,5),16), fgB  = parseInt(p.strokeColor.slice(5,7),16);

      function fadedColor(t2) {
        const fadeT = clamp((t2 - FADE_START) / (FADE_END - FADE_START), 0, 1);
        const r = Math.round(fgR + (bgR - fgR) * fadeT);
        const g = Math.round(fgG + (bgG - fgG) * fadeT);
        const b = Math.round(fgB + (bgB - fgB) * fadeT);
        return `rgb(${r},${g},${b})`;
      }

      for (let r = 0; r < ringCount; r++) {
        const rawT = (r + animShift) / ringCount;
        const t2 = 1 - (Math.exp(expK * (1 - rawT)) - 1) / expDenom;

        /* Cull rings that have faded completely into the background */
        if (t2 >= FADE_END) continue;

        const hw = lerp(outerHW, outerHW * minScale, t2);
        const hh = lerp(outerHH, outerHH * minScale, t2);
        const cx = lerp(VW / 2, vpX, t2);
        const cy = lerp(VH / 2, vpY, t2);

        const cornerR = Math.min(maxRadius, hw, hh) * (1 - t2 * 0.3);
        const ringColor = fadedColor(t2);

        const lw = p.strokeW / sv;
        drawRoundedRect(cx, cy, hw, hh, cornerR, ringColor, lw);

        if (p.nodeEnabled) {
          applyNodes(PERSP_NODES[r % PERSP_NODES.length], p, (pos) => {
            const pt = roundRectPoint(cx, cy, hw, hh, pos);
            ctx.beginPath();
            ctx.arc(pt.x * sv, pt.y * sv, p.strokeW * 2, 0, Math.PI * 2);
            ctx.fillStyle = p.nodeColor;
            ctx.fill();
          });
        }

        if (p.segEnabled) {
          applySegs(PERSP_SEGS[r % PERSP_SEGS.length], gp, p, (s0, s1, color) => {
            const perimCanvas = 4 * (hw + hh) * sv;
            const segLen = (s1 - s0) * perimCanvas;
            ctx.setLineDash([segLen, Math.max(perimCanvas - segLen, 0)]);
            ctx.lineDashOffset = -s0 * perimCanvas;
            /* Segments also fade with depth */
            const segFadeT = clamp((t2 - FADE_START) / (FADE_END - FADE_START), 0, 1);
            const sr2 = parseInt(color.slice(1,3)||'0',16)||0, sg2 = parseInt(color.slice(3,5)||'0',16)||0, sb2 = parseInt(color.slice(5,7)||'0',16)||0;
            const sc = `rgb(${Math.round(sr2+(bgR-sr2)*segFadeT)},${Math.round(sg2+(bgG-sg2)*segFadeT)},${Math.round(sb2+(bgB-sb2)*segFadeT)})`;
            drawRoundedRect(cx, cy, hw, hh, cornerR, sc, lw);
          });
          ctx.setLineDash([]);
          ctx.lineDashOffset = 0;
        }
      }

      const lw = p.strokeW / sv;
      const innerT = ((ringCount - 1 + animShift) / ringCount);
      const innerT2 = 1 - (Math.exp(expK * (1 - innerT)) - 1) / expDenom;
      const innerHW = lerp(outerHW, outerHW * minScale, innerT2);
      const innerHH = lerp(outerHH, outerHH * minScale, innerT2);
      const innerCX = lerp(VW / 2, vpX, innerT2);
      const innerCY = lerp(VH / 2, vpY, innerT2);

      const outerCorners = [
        [VW / 2 - outerHW, VH / 2 - outerHH],
        [VW / 2 + outerHW, VH / 2 - outerHH],
        [VW / 2 + outerHW, VH / 2 + outerHH],
        [VW / 2 - outerHW, VH / 2 + outerHH],
      ];
      const innerCorners = [
        [innerCX - innerHW, innerCY - innerHH],
        [innerCX + innerHW, innerCY - innerHH],
        [innerCX + innerHW, innerCY + innerHH],
        [innerCX - innerHW, innerCY + innerHH],
      ];
      for (let c = 0; c < 4; c++) {
        drawLine(outerCorners[c][0], outerCorners[c][1], innerCorners[c][0], innerCorners[c][1], p.strokeColor, lw);
      }

    }

    return { render };
  })();

  /* ══════════════════════════════════════════
     GESTURE preset
     ══════════════════════════════════════════ */
  const gesture = (function () {
    const sv = VIEW_SCALE;
    const VW = RIGHT_X;
    const VH = H / VIEW_SCALE;

    const GESTURE_SEGS  = makeSegs(0xDEAD0000, 3);
    const GESTURE_NODES = makeNodes(0xC0DE3000, 12);

    function render(fi, p) {
      ctx.fillStyle = p.bg;
      ctx.fillRect(0, 0, W, H);

      const scaleVal = parseInt(document.getElementById("gestScale").value, 10) / 100;
      const ampVal = parseInt(document.getElementById("gestAmp").value, 10) / 100;
      const wavesVal = parseInt(document.getElementById("gestWaves").value, 10) / 100;
      const dampVal = parseInt(document.getElementById("gestDamp").value, 10) / 100;
      const skewVal = parseInt(document.getElementById("gestSkew").value, 10) / 100;
      const rhythmVal = parseInt(document.getElementById("gestRhythm").value, 10) / 100;

      const tot = p.emergeFr;
      const t = ((fi % tot) + tot) % tot;
      const gp = t / tot;

      const totalScale = lerp(0.15, 3.0, scaleVal);
      const maxAmp = lerp(20, VH * 0.45, ampVal) * totalScale;
      const waveCount = lerp(1.5, 8, wavesVal);
      const dampStrength = lerp(0.1, 6, dampVal);
      const gestPosVal = parseInt(document.getElementById("gestPos").value, 10) / 100;
      const skew = (skewVal - 0.5) * VW * 0.8;
      const posOffset = (gestPosVal - 0.5) * VW * 1.2;

      const heightVal = parseInt(document.getElementById("gestHeight").value, 10) / 100;

      const spanW = VW * totalScale;
      const cxOff = VW / 2 + posOffset;
      const cyOff = VH * lerp(0.1, 0.9, heightVal);
      const left = cxOff - spanW / 2;
      const right = cxOff + spanW / 2;
      const yCenter = cyOff;

      const phaseShift = gp * Math.PI * 2;

      const rhythmFreq = lerp(0, 3, rhythmVal);
      const rhythmAmpMod = lerp(0, 0.5, rhythmVal);
      const rhythmSpaceMod = lerp(0, 0.4, rhythmVal);

      const waveEnd = clamp(1 - dampStrength * 0.08, 0.3, 1);

      const steps = 400;
      const points = [];
      for (let s = 0; s <= steps; s++) {
        const t2 = s / steps;
        const rhythmWarp = t2 + Math.sin(t2 * rhythmFreq * Math.PI * 2 + phaseShift * 0.7) * rhythmSpaceMod * 0.1;
        const tWarped = clamp(rhythmWarp, 0, 1);

        const baseX = lerp(left, right, tWarped);

        const waveT = clamp(t2 / waveEnd, 0, 1);
        const fadeOut = waveT > 0.85 ? clamp((1 - waveT) / 0.15, 0, 1) : 1;
        const envelope = Math.exp(-dampStrength * waveT) * fadeOut;
        const rhythmEnvelope = 1 + Math.sin(waveT * rhythmFreq * Math.PI * 3 + phaseShift * 1.3) * rhythmAmpMod;
        const wave = Math.sin(waveT * waveCount * Math.PI * 2 + phaseShift);
        const waveY = wave * maxAmp * envelope * rhythmEnvelope;
        const x = baseX + waveY * skew / (VH * 0.5);
        const y = yCenter + waveY;
        points.push({ x, y });
      }

      const fragVal = parseInt(document.getElementById("gestFrag").value, 10) / 100;

      if (fragVal < 0.01) {
        ctx.strokeStyle = p.strokeColor;
        ctx.lineWidth = p.strokeW;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(points[0].x * sv, points[0].y * sv);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x * sv, points[i].y * sv);
        }
        ctx.stroke();
      } else {
        const minBlock = lerp(3, 6, fragVal);
        const maxBlock = lerp(6, 40, fragVal);
        const thickness = lerp(p.strokeW / sv, lerp(4, 20, fragVal), fragVal);

        ctx.fillStyle = p.strokeColor;

        let idx = 0;
        while (idx < points.length - 1) {
          const t2 = idx / (points.length - 1);
          const blockSize = lerp(minBlock, maxBlock, t2);
          const halfH = thickness * lerp(0.5 + t2 * 0.5, 0.5 + t2 * 1.5, fragVal);

          const px = points[idx].x;
          const py = points[idx].y;

          const nextIdx = Math.min(idx + Math.max(1, Math.round(blockSize / (spanW / steps))), points.length - 1);
          const px2 = points[nextIdx].x;

          const bw = Math.abs(px2 - px);
          const bh = halfH * 2;
          if (bw >= 3 && bh >= 3) {
            const bx = Math.min(px, px2);
            ctx.fillRect(bx * sv, (py - halfH) * sv, bw * sv, bh * sv);
          }

          idx = nextIdx;
          if (idx >= points.length - 1) break;
        }
      }

      if (p.nodeEnabled) {
        ctx.fillStyle = p.nodeColor;
        applyNodes(GESTURE_NODES, p, (pos) => {
          const fi = pos * (points.length - 1);
          const i0 = Math.min(Math.floor(fi), points.length - 2);
          const frac = fi - i0;
          const x = lerp(points[i0].x, points[i0 + 1].x, frac);
          const y = lerp(points[i0].y, points[i0 + 1].y, frac);
          ctx.beginPath();
          ctx.arc(x * sv, y * sv, p.strokeW * 2, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      if (p.segEnabled && fragVal < 0.01) {
        applySegs(GESTURE_SEGS, gp, p, (s0, s1, color) => {
          const i0 = Math.floor(s0 * (points.length - 1));
          const i1 = Math.ceil(s1 * (points.length - 1));
          if (i1 <= i0) return;
          ctx.strokeStyle = color;
          ctx.lineWidth   = p.strokeW;
          ctx.lineCap     = "round";
          ctx.lineJoin    = "round";
          ctx.beginPath();
          ctx.moveTo(points[i0].x * sv, points[i0].y * sv);
          for (let si = i0 + 1; si <= i1; si++) ctx.lineTo(points[si].x * sv, points[si].y * sv);
          ctx.stroke();
        });
      }
    }

    return { render };
  })();


  /* ══════════════════════════════════════════
     WIND — BL open/short → TR dense/long, shallow up-right heading, no overlaps.
     ══════════════════════════════════════════ */
  const wind = (function () {
    const sv = VIEW_SCALE;
    const VH = H / VIEW_SCALE;
    const MARGIN_USER = 20;
    const WIND_EDGE_PAD_U = 6;
    const WIND_LEFT   = LEFT_X + MARGIN_USER;
    const WIND_RIGHT  = RIGHT_X - MARGIN_USER;
    const WIND_TOP    = MARGIN_USER;
    const WIND_BOTTOM = VH - MARGIN_USER;
    const WIND_IN_LEFT  = WIND_LEFT  + WIND_EDGE_PAD_U;
    const WIND_IN_RIGHT = WIND_RIGHT - WIND_EDGE_PAD_U;
    const WIND_IN_TOP   = WIND_TOP   + WIND_EDGE_PAD_U;
    const WIND_IN_BOT   = WIND_BOTTOM - WIND_EDGE_PAD_U;
    const spanXG = WIND_IN_RIGHT - WIND_IN_LEFT;
    const spanYG = WIND_IN_BOT   - WIND_IN_TOP;

    /* ── grid counts ── */
    const WIND_CX = 20;
    const WIND_CY = 22;

    /*
     * Spacing warp: BL sparse, TR dense.
     * GRID_SLACK_TAIL_X = ratio of max-pitch / min-pitch in x.
     * A larger value gives a more visible density gradient.
     * GAMMA controls how sharply the slack concentrates at the dense end.
     */
    /* X-only warp: columns denser at right, sparser at left. Y is uniform. */
    const GRID_SLACK_TAIL_X  = 1.82;
    const WIND_GAMMA_X       = 0.58;

    function warpedCenters(count, span, minPitch, gamma) {
      if (count <= 0) return [];
      if (count === 1) return [0];
      const budget = span - count * minPitch;
      if (budget <= 1e-6) {
        const u = span / count;
        const out = [];
        let acc = -span / 2;
        for (let i = 0; i < count; i++) { out.push(acc + u * 0.5); acc += u; }
        return out;
      }
      const weights = [];
      for (let k = 0; k < count; k++) {
        const t = k / (count - 1);
        const s = t * t * (3 - 2 * t);          /* Hermite t */
        weights.push(Math.pow(Math.max(s, 1e-6), gamma));
      }
      const wSum = weights.reduce((a, b) => a + b, 0) || 1;
      const gaps = weights.map(w => minPitch + (budget * w) / wSum);
      const b = [-span / 2];
      for (let k = 0; k < count; k++) b.push(b[k] + gaps[k]);
      const out = [];
      for (let i = 0; i < count; i++) out.push((b[i] + b[i + 1]) / 2);
      return out;
    }

    function mapAxis(c, span, lo, hi) {
      return lo + ((c + span / 2) / span) * (hi - lo);
    }

    const minPX = spanXG / (GRID_SLACK_TAIL_X * WIND_CX);

    /* k=0 is tight end; map to RIGHT (TR dense), then sort ascending */
    const gx = warpedCenters(WIND_CX, spanXG, minPX, WIND_GAMMA_X)
      .map(c => mapAxis(c, spanXG, WIND_IN_RIGHT, WIND_IN_LEFT))
      .sort((a, b) => a - b);

    /* Centre the gx array inside [WIND_IN_LEFT, WIND_IN_RIGHT] */
    {
      const shift = ((WIND_IN_RIGHT - gx[WIND_CX - 1]) - (gx[0] - WIND_IN_LEFT)) * 0.5;
      for (let k = 0; k < WIND_CX; k++) gx[k] += shift;
      let bleed = WIND_IN_LEFT - gx[0];
      if (bleed > 0) for (let k = 0; k < WIND_CX; k++) gx[k] += bleed;
      else { bleed = gx[WIND_CX - 1] - WIND_IN_RIGHT; if (bleed > 0) for (let k = 0; k < WIND_CX; k++) gx[k] -= bleed; }
    }

    /* Uniform rows: all columns have WIND_CY rows, evenly spaced top to bottom. */
    const colN = Array.from({ length: WIND_CX }, () => WIND_CY);

    function ctrYAt(ix, iy) {
      void ix;
      return WIND_IN_TOP + spanYG * iy / (WIND_CY - 1);
    }

    /*
     * Heading: left column = horizontal (0°). Angle sweeps up exponentially toward TR.
     * Canvas: +x right, +y down. Upward tilt = negative angle.
     * ANGLE_MAX_RAD: max tilt at far-right (positive value, applied as −angle).
     * ANGLE_EXP > 1: slow start at left, rapid sweep near right (exponential feel).
     */
    const ANGLE_MAX_RAD = 0.90;   /* ~51.5° at far right — dramatic upward sweep */
    const ANGLE_EXP     = 1.8;    /* lower than before so sweep starts earlier, feels more dynamic */

    /*
     * Stroke length: fraction of local Voronoi corridor.
     * BL cells are large → use small fraction → physically short dashes.
     * TR cells are small → use large fraction → dashes fill the cell → visually longer relative to spacing.
     *
     * We also keep an absolute floor so BL is never completely invisible.
     */
    /*
     * Length: absolute target from nominal pitch so dense-right columns don't shrink strokes.
     * TOP of column = long, BOTTOM = short. Right side adds a boost so TR reads longest overall.
     * Power curve < 1 = exponential sweep: tiny stubs at bottom, fast climb, long at top.
     */
    const nomPitch = spanYG / WIND_CY;          /* uniform row pitch — same for all rows */
    const SEG_HALF_MIN  = nomPitch * 0.02;      /* BL corner: very short stub */
    const SEG_HALF_MAX  = nomPitch * 0.90;      /* TR corner: nearly full corridor */
    const SEG_LEN_EXP   = 0.28;                 /* sharper power curve = more dramatic length sweep */
    /* Scale factor applied per-column so left column strokes are half the target. */
    const SEG_LEFT_SCALE  = 0.50;               /* left-edge multiplier */
    const SEG_RIGHT_SCALE = 1.00;               /* right-edge multiplier */

    const WIND_BAND_SEGS = makeSegs(0xF00D0000, 4);

    function smoothstep(lo, hi, x) {
      const t = clamp((x - lo) / (hi - lo), 0, 1);
      return t * t * (3 - 2 * t);
    }

    function render(fi, p) {
      const tot = p.emergeFr;
      const gp  = ((fi % tot) + tot) % tot / tot;
      ctx.fillStyle = p.bg;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = p.strokeColor;
      ctx.lineWidth   = p.strokeW;
      ctx.lineJoin    = "round";
      ctx.lineCap     = "round";

      const invSXG = spanXG > 1e-9 ? 1 / spanXG : 0;
      const invSYG = spanYG > 1e-9 ? 1 / spanYG : 0;
      const pixHalf = z => Math.round(z * 2) / 2;
      const eps = 1e-5;

      for (let iy = 0; iy < WIND_CY; iy++) {
        for (let ix = 0; ix < WIND_CX; ix++) {
          const ctrX = gx[ix];
          const ctrY = ctrYAt(ix, iy);
          const fx = clamp((ctrX - WIND_IN_LEFT) * invSXG, 0, 1);
          const fy = clamp((ctrY - WIND_IN_TOP)  * invSYG, 0, 1);

          /* Right columns long, left columns short. Top of each column longer than bottom. */
          const uRowRaw = fx * 0.55 + (1 - fy) * 0.45;
          const uRamp   = Math.pow(clamp(uRowRaw, 0, 1), SEG_LEN_EXP);

          /*
           * Heading angle: 0 at left edge, sweeps up exponentially toward right.
           * Small fy contribution so top rows lean slightly steeper than bottom (TR = steepest).
           * angle is negative → wy < 0 = upward in canvas space.
           */
          /* Heading is purely column-based (no fy) so Voronoi cap is uniform per column.
             If fy contributed, top rows got steeper angles → tighter cap → shorter strokes
             despite having a larger length target — the opposite of what we want. */
          const uAngle = clamp(fx, 0, 1);
          const angle  = -ANGLE_MAX_RAD * Math.pow(uAngle, ANGLE_EXP);
          const wx     = Math.cos(angle);
          const wy     = Math.sin(angle);

          /* Skip rows that don't exist in this column */
          if (isNaN(ctrY)) continue;

          /* Voronoi cell bounds */
          const leftB  = ix > 0         ? (gx[ix - 1] + gx[ix]) * 0.5 : WIND_IN_LEFT;
          const rightB = ix < WIND_CX-1 ? (gx[ix] + gx[ix + 1]) * 0.5 : WIND_IN_RIGHT;
          const n       = colN[ix];
          const spacing = n > 1 ? spanYG / (n - 1) : spanYG;
          const yTop    = ctrY - spacing * 0.5;
          const yBot    = ctrY + spacing * 0.5;

          /*
           * Symmetric Voronoi cap: stroke is centered at (ctrX,ctrY) so BOTH endpoints
           * must stay inside the cell.  For each axis component, take the tighter of the
           * two one-sided constraints (forward AND backward from center).
           */
          let halfUCell = Infinity;
          if (Math.abs(wx) > eps)
            halfUCell = Math.min(halfUCell, Math.min(rightB - ctrX, ctrX - leftB) / Math.abs(wx));
          if (Math.abs(wy) > eps)
            halfUCell = Math.min(halfUCell, Math.min(yBot - ctrY, ctrY - yTop) / Math.abs(wy));

          if (!Number.isFinite(halfUCell)) continue;

          const capPad  = (p.strokeW * 0.5) / Math.max(sv, 1e-9);
          const halfUMax = Math.max(0, halfUCell - capPad * 1.1);

          /* Absolute length target, then scale by column position so left = half right. */
          const colScale   = SEG_LEFT_SCALE + (SEG_RIGHT_SCALE - SEG_LEFT_SCALE) * fx;
          const halfTarget = (SEG_HALF_MIN + (SEG_HALF_MAX - SEG_HALF_MIN) * uRamp) * colScale;
          const halfU      = Math.min(halfTarget, halfUMax);

          ctx.beginPath();
          ctx.moveTo(pixHalf((ctrX - halfU * wx) * sv), pixHalf((ctrY - halfU * wy) * sv));
          ctx.lineTo(pixHalf((ctrX + halfU * wx) * sv), pixHalf((ctrY + halfU * wy) * sv));
          ctx.stroke();
        }
      }

      if (p.segEnabled) {
        const sizeScale  = lerp(0.1, 2.0, p.segSize);
        const speedScale = lerp(0.1, 2.0, p.segSpeed);
        const count      = Math.max(1, Math.round(WIND_BAND_SEGS.length * clamp(lerp(0.15, 1, p.segDensity), 0.01, 1)));
        const cr = parseInt(p.segColor.slice(1, 3), 16);
        const cg = parseInt(p.segColor.slice(3, 5), 16);
        const cb = parseInt(p.segColor.slice(5, 7), 16);
        const segColorStr = `rgb(${cr},${cg},${cb})`;

        const segT2 = segNow(p);
        const bands = WIND_BAND_SEGS.slice(0, count).map(cs => {
          const pos = ((cs.pos + (segT2 + cs.phase) * cs.drift * speedScale) % 1 + 1) % 1;
          const hw  = cs.width * sizeScale * 0.5;
          return { lo: clamp(pos - hw, 0, 1), hi: clamp(pos + hw, 0, 1) };
        }).filter(b => b.hi > b.lo);

        if (bands.length) {
          ctx.strokeStyle = segColorStr;
          ctx.lineWidth   = p.strokeW;
          ctx.lineJoin    = "round";
          ctx.lineCap     = "round";

          for (let iy = 0; iy < WIND_CY; iy++) {
            for (let ix = 0; ix < WIND_CX; ix++) {
              const ctrX = gx[ix];
              const ctrY = ctrYAt(ix, iy);
              if (isNaN(ctrY)) continue;
              const fx2 = clamp((ctrX - WIND_IN_LEFT) * invSXG, 0, 1);
              if (!bands.some(b => fx2 >= b.lo && fx2 <= b.hi)) continue;

              const uAngle2 = clamp(fx2, 0, 1);
              const angle2  = -ANGLE_MAX_RAD * Math.pow(uAngle2, ANGLE_EXP);
              const wx2     = Math.cos(angle2);
              const wy2     = Math.sin(angle2);

              const leftB2  = ix > 0         ? (gx[ix - 1] + gx[ix]) * 0.5 : WIND_IN_LEFT;
              const rightB2 = ix < WIND_CX-1 ? (gx[ix] + gx[ix + 1]) * 0.5 : WIND_IN_RIGHT;
              const n2      = colN[ix];
              const spacing2 = n2 > 1 ? spanYG / (n2 - 1) : spanYG;
              const yTop2   = ctrY - spacing2 * 0.5;
              const yBot2   = ctrY + spacing2 * 0.5;

              let halfUCell2 = Infinity;
              if (Math.abs(wx2) > eps)
                halfUCell2 = Math.min(halfUCell2, Math.min(rightB2 - ctrX, ctrX - leftB2) / Math.abs(wx2));
              if (Math.abs(wy2) > eps)
                halfUCell2 = Math.min(halfUCell2, Math.min(yBot2 - ctrY, ctrY - yTop2) / Math.abs(wy2));
              if (!Number.isFinite(halfUCell2)) continue;

              const capPad2   = (p.strokeW * 0.5) / Math.max(sv, 1e-9);
              const halfUMax2 = Math.max(0, halfUCell2 - capPad2 * 1.1);
              const fy2       = clamp((ctrY - WIND_IN_TOP) * invSYG, 0, 1);
              const uRowRaw2  = fx2 * 0.55 + (1 - fy2) * 0.45;
              const uRamp2    = Math.pow(clamp(uRowRaw2, 0, 1), SEG_LEN_EXP);
              const colScale2 = SEG_LEFT_SCALE + (SEG_RIGHT_SCALE - SEG_LEFT_SCALE) * fx2;
              const halfTarget2 = (SEG_HALF_MIN + (SEG_HALF_MAX - SEG_HALF_MIN) * uRamp2) * colScale2;
              const halfU2    = Math.min(halfTarget2, halfUMax2);

              ctx.beginPath();
              ctx.moveTo(pixHalf((ctrX - halfU2 * wx2) * sv), pixHalf((ctrY - halfU2 * wy2) * sv));
              ctx.lineTo(pixHalf((ctrX + halfU2 * wx2) * sv), pixHalf((ctrY + halfU2 * wy2) * sv));
              ctx.stroke();
            }
          }
        }
      }
    }

    return { render };
  })();

  /* ══════════════════════════════════════════
     PLANES — reference: images/public/planes.svg
     All planes share the same center axis (canvas mid-x).
     Each plane expands from hw=0 (a vertical center line, far away / head-on)
     to hw=MAX_HW (nearly full canvas width, close / oblique).
     Six planes staggered so the composition always shows the full depth range.
     ══════════════════════════════════════════ */
  const planes = (function () {
    const sv   = VIEW_SCALE;
    const VH   = H / VIEW_SCALE;

    /* Scale SVG viewBox (1803.43 × 948.28) → canvas layout space (RIGHT_X × VH) */
    const SVG_W  = 1803.43;
    const SVG_H  = 948.28;
    const scaleX = RIGHT_X / SVG_W;
    const scaleY = VH      / SVG_H;

    const TOP    = 2.19   * scaleY;   /* ≈1.45 layout-px — top margin matches SVG */
    const BOT    = 946.12 * scaleY;   /* ≈628.6 layout-px — bottom margin matches SVG */
    const CX     = 901.71 * scaleX;   /* ≈599.6 layout-px — all planes share this center */
    const MAX_HW = 900.715 * scaleX;  /* ≈599.0 layout-px — widest plane nearly fills canvas */

    const NUM_PLANES = 6;
    const FADE_IN    = 0.08;
    const FADE_OUT   = 0.12;

    const PLANES_PATH_SEGS  = Array.from({ length: NUM_PLANES }, (_, i) => makeSegs(0xB00B0000 + i * 17, 3));
    const PLANES_NODE_DESCS = Array.from({ length: NUM_PLANES }, (_, i) => makeNodes(0xC0DE6000 + i * 19, 8));

    function drawPlane(cxPx, hw, tyPx, byPx) {
      const rx = cxPx + hw;
      const lx = cxPx - hw;
      ctx.beginPath();
      if (hw < sv) {
        /* Narrow enough to read as a single vertical line */
        ctx.moveTo(cxPx, tyPx);
        ctx.lineTo(cxPx, byPx);
      } else {
        /* SVG path: (rx,bot)→(rx,top)→(lx,bot)→(lx,top)→(rx,bot) */
        ctx.moveTo(rx, byPx);
        ctx.lineTo(rx, tyPx);
        ctx.lineTo(lx, byPx);
        ctx.lineTo(lx, tyPx);
        ctx.lineTo(rx, byPx);
      }
      ctx.stroke();
    }

    function render(fi, p) {
      ctx.fillStyle = p.bg;
      ctx.fillRect(0, 0, W, H);

      const tot  = p.emergeFr;
      const t    = ((fi % tot) + tot) % tot;
      const gp   = t / tot;

      const cxPx = CX  * sv;
      const tyPx = TOP * sv;
      const byPx = BOT * sv;
      const vLen = byPx - tyPx;

      ctx.lineWidth = p.strokeW;
      ctx.lineCap   = "round";
      ctx.lineJoin  = "round";

      for (let i = 0; i < NUM_PLANES; i++) {
        /* phase 0 = narrow/far, phase 1 = wide/close (then wraps back) */
        const phase = (gp + i / NUM_PLANES) % 1;
        const hw    = phase * MAX_HW * sv;   /* canvas px */

        /* Smooth fade in/out at the wrap boundary */
        const raw   = phase < FADE_IN
          ? phase / FADE_IN
          : phase > 1 - FADE_OUT
            ? (1 - phase) / FADE_OUT
            : 1;
        const alpha = raw * raw * (3 - 2 * raw);  /* smoothstep */

        ctx.globalAlpha = alpha;
        ctx.strokeStyle = p.strokeColor;
        drawPlane(cxPx, hw, tyPx, byPx);

        if (p.nodeEnabled && hw >= sv) {
          const rx   = cxPx + hw;
          const lx   = cxPx - hw;
          const dLen = Math.sqrt((rx - lx) ** 2 + vLen ** 2);
          const totalLen = 2 * vLen + 2 * dLen;
          applyNodes(PLANES_NODE_DESCS[i], p, (pos) => {
            const d = pos * totalLen;
            let nx, ny;
            if (d < vLen) {
              nx = rx; ny = byPx - d;
            } else if (d < vLen + dLen) {
              const t = (d - vLen) / dLen;
              nx = rx + (lx - rx) * t; ny = tyPx + (byPx - tyPx) * t;
            } else if (d < 2 * vLen + dLen) {
              const t = (d - vLen - dLen) / vLen;
              nx = lx; ny = byPx - vLen * t;
            } else {
              const t = (d - 2 * vLen - dLen) / dLen;
              nx = lx + (rx - lx) * t; ny = tyPx + (byPx - tyPx) * t;
            }
            ctx.beginPath();
            ctx.arc(nx, ny, p.strokeW * 2, 0, Math.PI * 2);
            ctx.fillStyle = p.nodeColor;
            ctx.fill();
          });
        }

        if (p.segEnabled && hw >= sv) {
          const rx      = cxPx + hw;
          const lx      = cxPx - hw;
          const dLen    = Math.sqrt((rx - lx) ** 2 + vLen ** 2);
          const perim   = 2 * vLen + 2 * dLen;
          applySegs(PLANES_PATH_SEGS[i], null, p, (s0, s1, color) => {
            const segLen = (s1 - s0) * perim;
            ctx.setLineDash([segLen, Math.max(perim - segLen, 0)]);
            ctx.lineDashOffset = -s0 * perim;
            ctx.strokeStyle    = color;
            ctx.lineWidth      = p.strokeW;
            ctx.lineCap        = "round";
            ctx.beginPath();
            ctx.moveTo(rx, byPx);
            ctx.lineTo(rx, tyPx);
            ctx.lineTo(lx, byPx);
            ctx.lineTo(lx, tyPx);
            ctx.lineTo(rx, byPx);
            ctx.stroke();
          });
          ctx.setLineDash([]);
          ctx.lineDashOffset = 0;
          ctx.strokeStyle    = p.strokeColor;
          ctx.lineWidth      = p.strokeW;
        }
      }

      ctx.globalAlpha = 1;
    }

    return { render };
  })();

  /* ══════════════════════════════════════════
     SPHERE — rings scale on and off, canvas rotated 45° so motion reads diagonal.
     No lat/lon lines. Sphere geometry: rx = R·sin(θ), y = R·cos(θ).
     ══════════════════════════════════════════ */
  const sphere = (function () {
    const sv      = VIEW_SCALE;
    const VH      = H / VIEW_SCALE;
    const CX      = RIGHT_X * 0.5;
    const CY      = VH * 0.5;
    /* Fill the shorter canvas dimension — sphere reads as large and dominant */
    const R       = Math.min(CX, CY) * 0.88;
    /* N_RINGS is controlled by the Rings slider */
    const MIN_RX  = 7;    /* layout-px minimum radius — suppresses tiny pole rings that cluster */

    /*
     * Mild power sharpens the equatorial peak without flattening the ring-lattice feel.
     * 1.4 keeps the distribution close to real latitude spacing while still making
     * the largest ring clearly dominant.
     */
    const RADIUS_POW = 1.4;

    /*
     * Eccentricity at 45° tilt: cos(45°) ≈ 0.707 is the geometrically correct value
     * for a sphere whose pole is tilted 45° from vertical in the screen plane.
     * Polar rings get more compressed (they're seen more edge-on).
     */
    const ECC_EQ  = 0.68;
    const ECC_POL = 0.20;

    const FADE_IN  = 0.06;
    const FADE_OUT = 0.06;

    const CYCLE_FRAMES = 270;  /* ~9s at 30fps */

    const SPHERE_SEGS  = Array.from({ length: 16 }, (_, i) => makeSegs(0xC0DE0000 + i * 13, 2));
    const SPHERE_NODES = Array.from({ length: 16 }, (_, i) => makeNodes(0xC0DE7000 + i * 23, 8));

    function ringAlpha(phase) {
      let a;
      if (phase < FADE_IN) {
        a = phase / FADE_IN;                  /* fast fade in */
      } else if (phase > 1 - FADE_OUT) {
        a = (1 - phase) / FADE_OUT;           /* fast fade out */
      } else {
        a = 1;                                /* full hold */
      }
      return a * a * (3 - 2 * a);            /* smoothstep for crispness */
    }

    function render(fi, p) {
      ctx.fillStyle = p.bg;
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = p.strokeColor;
      ctx.lineWidth   = p.strokeW;
      ctx.lineCap     = "round";

      const N_RINGS = parseInt(document.getElementById('sphereRings')?.value ?? '8', 10);
      const rawPhase = (fi % CYCLE_FRAMES) / CYCLE_FRAMES;

      ctx.save();
      ctx.translate(CX * sv, CY * sv);
      ctx.rotate(Math.PI / 4);

      for (let i = 0; i < N_RINGS; i++) {
        const phase = (rawPhase + i / N_RINGS) % 1;
        const alpha = ringAlpha(phase);
        if (alpha < 0.02) continue;

        /*
         * acos mapping: theta = acos(1 - 2·phase).
         * dsize/dphase = 2·cot(θ) → large near poles (fast snap on/off),
         * small near equator (ring lingers at max size). Naturally the pacing
         * the user described without any ad-hoc easing function.
         */
        const theta  = Math.acos(clamp(1 - 2 * phase, -1, 1));
        const sinT   = Math.sin(theta);
        const sinPow = Math.pow(sinT, RADIUS_POW);
        const rx     = R * sinPow;
        if (rx < MIN_RX) continue;

        /*
         * Size-based fade: rings dim as they shrink toward the poles.
         * Even if two small rings overlap, their combined weight ≈ one full ring.
         */
        const SIZE_FULL  = R * 0.48;   /* fully opaque above this radius — wider ramp = faster fade near poles */
        const sizeT      = Math.max(0, Math.min(1, (rx - MIN_RX) / (SIZE_FULL - MIN_RX)));
        const sizeAlpha  = sizeT * sizeT * (3 - 2 * sizeT);  /* smoothstep */

        const ecc    = ECC_POL + (ECC_EQ - ECC_POL) * sinPow;
        const ry     = rx * ecc;
        const yCtr   = R * Math.cos(theta);

        ctx.globalAlpha = alpha * sizeAlpha;
        ctx.beginPath();
        ctx.ellipse(0, yCtr * sv, Math.max(rx * sv, 0.5), Math.max(ry * sv, 0.5), 0, 0, Math.PI * 2);
        ctx.stroke();

        if (p.nodeEnabled) {
          /* Nodes disappear sooner than rings as size shrinks —
             squaring sizeAlpha makes them fade twice as fast. */
          const savedAlpha = ctx.globalAlpha;
          ctx.globalAlpha  = savedAlpha * sizeAlpha;
          applyNodes(SPHERE_NODES[i % SPHERE_NODES.length], p, (pos) => {
            const angle = pos * Math.PI * 2;
            const nx = rx * sv * Math.cos(angle);
            const ny = yCtr * sv + ry * sv * Math.sin(angle);
            ctx.beginPath();
            ctx.arc(nx, ny, p.strokeW * 2, 0, Math.PI * 2);
            ctx.fillStyle = p.nodeColor;
            ctx.fill();
          });
          ctx.globalAlpha = savedAlpha;
        }

        if (p.segEnabled) {
          applySegs(SPHERE_SEGS[i % SPHERE_SEGS.length], rawPhase, p, (s0, s1, color) => {
            ctx.strokeStyle = color;
            ctx.beginPath();
            ctx.ellipse(0, yCtr * sv, Math.max(rx * sv, 0.5), Math.max(ry * sv, 0.5), 0,
              s0 * Math.PI * 2, s1 * Math.PI * 2);
            ctx.stroke();
          });
          ctx.strokeStyle = p.strokeColor;
        }
      }

      ctx.restore();
      ctx.globalAlpha = 1;
    }

    return { render };
  })();


  /* ══════════════════════════════════════════
     PARAMETRIC — True Lissajous 3:2 curve animation.
     Two families of curves with phase offsets create the intersecting grid.
     Animating δ rotates the whole figure in fake 3D (Lissajous phase rotation).
     Margins: PAD=38 locked constants used for Rx / Ry.
     ══════════════════════════════════════════ */
  const parametric = (function () {
    const sv = VIEW_SCALE;
    const VH = H / VIEW_SCALE;
    const CX = RIGHT_X * 0.5;
    const CY = VH * 0.5;

    /* ═══════════════════════════════════════════════════════════════
     * MARGIN CONSTANTS — DO NOT CHANGE.
     * PAD = 38 canvas-px on every side.
     * ═══════════════════════════════════════════════════════════════ */
    const PAD  = 38;                                         /* locked */
    const sXc  = (RIGHT_X - 2 * PAD) / 1782.84;             /* locked */
    const sYc  = (VH      - 2 * PAD) / 942.46;              /* locked */

    /* Lissajous amplitudes from locked margins */
    const Rx   = CX - PAD;   /* ≈562 — fills canvas horizontally to PAD */
    const Ry   = CY - PAD;   /* ≈277 — fills canvas vertically to PAD   */

    /* Dashes from SVG stroke-dasharray: 2.21 1.38 */
    const DASH = 2.21 * ((sXc + sYc) / 2) * sv;
    const GAP  = 1.38 * ((sXc + sYc) / 2) * sv;

    /*
     * Lissajous 3:2  x(t) = Rx·sin(3t + δ + φ),  y(t) = Ry·sin(2t + ψ)
     *
     * Family A: φ steps across N_A values, ψ = 0
     * Family B: ψ steps across N_B values, φ = 0
     *
     * δ (global phase) increases with time → fake 3D rotation.
     * T: frames for one full δ cycle.
     */
    const A    = 3;
    const B    = 2;
    /* N_A is controlled via the Curves slider; N_B=1 always adds one dup of FA0 */
    const N_B  = 1;
    const SEGS = 400;
    const T    = 480;   /* phase cycle; visual sub-loop = T/N_A frames; 480/3 = 160fr = 6.7s @24fps */

    const PARAM_SEGS_A  = Array.from({ length: 9 }, (_, i) => makeSegs(0xAAAA0000 + i * 23, 2));
    const PARAM_SEGS_B  = makeSegs(0xBBBB0000, 2);
    const PARAM_NODES_A = Array.from({ length: 9 }, (_, i) => makeNodes(0xC0DE4000 + i * 37, 6));
    const PARAM_NODES_B = makeNodes(0xC0DE5000, 6);

    /** Evaluate a Lissajous point at normalised arc position s ∈ ℝ (wraps at integers). */
    function paramPointAt(s, φ, ψ, familyA) {
      const t  = s * Math.PI * 2;
      const sx = familyA
        ? (CX + Rx * Math.sin(B * t + δ_holder.δ + φ)) * sv
        : (CX + Rx * Math.sin(B * t + δ_holder.δ)) * sv;
      const sy = familyA
        ? (CY - Ry * Math.sin(A * t)) * sv
        : (CY - Ry * Math.sin(A * t + ψ)) * sv;
      return { x: sx, y: sy };
    }
    /* Mutable holder so paramPointAt can read the current frame's δ. */
    const δ_holder = { δ: 0 };

    /**
     * Draw one segment along the curve with fractional sampling and a single
     * continuous path across the 0/1 closure — no integer vertex snapping.
     */
    function drawParametricSegment(s0, s1, color, φ, ψ, familyA) {
      if (s1 <= s0) return;

      /* Normalise any real-valued arc endpoints into [0,1] spans.
         Without this, positions > 1 produce a [0, s1-1] span that covers
         almost the entire curve and hides the dashed base stroke. */
      const len   = Math.min(s1 - s0, 1);
      const a0    = ((s0 % 1) + 1) % 1;
      const a1    = a0 + len;
      const spans = a1 <= 1 + 1e-9
        ? [[a0, a1]]
        : [[a0, 1], [0, a1 - 1]];

      ctx.strokeStyle = color;
      ctx.lineWidth   = p_holder.strokeW;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      ctx.setLineDash([]);
      ctx.beginPath();
      let moved = false;
      for (const [a, b] of spans) {
        if (b <= a) continue;
        const steps = Math.max(6, Math.round((b - a) * SEGS));
        for (let j = 0; j <= steps; j++) {
          const s  = a + (b - a) * (j / steps);
          const pt = paramPointAt(s, φ, ψ, familyA);
          if (!moved) { ctx.moveTo(pt.x, pt.y); moved = true; }
          else        ctx.lineTo(pt.x, pt.y);
        }
      }
      if (moved) ctx.stroke();
    }
    const p_holder = { strokeW: 1 };

    /** Parametric segment pass — continuous position, clean round-capped ends. */
    function applyParametricSegs(segs, p, φ, ψ, familyA) {
      if (!segs.length) return;
      p_holder.strokeW = p.strokeW;
      const sizeScale  = lerp(0.1, 2.0, p.segSize);
      const speedScale = lerp(0.1, 2.0, p.segSpeed);
      const count      = Math.max(1, Math.round(segs.length * clamp(lerp(0.15, 1, p.segDensity), 0.01, 1)));
      const t          = segNow(p);
      const cr = parseInt(p.segColor.slice(1, 3), 16);
      const cg = parseInt(p.segColor.slice(3, 5), 16);
      const cb = parseInt(p.segColor.slice(5, 7), 16);
      const color = `rgb(${cr},${cg},${cb})`;

      for (let i = 0; i < count; i++) {
        const cs     = segs[i];
        const rawPos = cs.pos + (t + cs.phase) * cs.drift * speedScale;
        const hw     = cs.width * sizeScale * 0.5;
        const s0     = rawPos - hw;
        const s1     = rawPos + hw;
        if (s1 <= s0) continue;
        drawParametricSegment(s0, s1, color, φ, ψ, familyA);
      }
    }

    function render(fi, p) {
      /* N_A driven by the Curves slider: visible total = N_A + N_B = N_A + 1 */
      const N_A = Math.max(1, parseInt(document.getElementById('paramCurves')?.value ?? '3', 10) - 1);

      ctx.fillStyle = p.bg;
      ctx.fillRect(0, 0, W, H);

      const δ = (fi % T) / T * Math.PI * 2;
      δ_holder.δ = δ;

      ctx.strokeStyle = p.strokeColor;
      ctx.lineWidth   = p.strokeW;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      ctx.globalAlpha = 1;

      /*
       * Recursion: draws N nested copies of the figure at geometrically
       * decreasing scale, each slightly phase-shifted in δ so the levels
       * appear to recede into z-space.  At recursionVal=0 only one copy
       * is drawn — identical to the original behaviour.
       */
      const recursionVal  = parseInt(document.getElementById('paramRecursion')?.value ?? '0', 10) / 100;
      const recursionDepth = recursionVal < 0.01 ? 1 : 2 + Math.round(recursionVal * 5);
      const scaleStep      = recursionVal < 0.01 ? 1 : 1 - recursionVal * 0.42;

      for (let level = 0; level < recursionDepth; level++) {
        const scale  = Math.pow(scaleStep, level);
        if (scale < 0.04) break;
        const Rx_l   = Rx * scale;
        const Ry_l   = Ry * scale;
        /* Each inner level shifts δ slightly → looks like a different depth snapshot */
        const δ_l    = δ + level * recursionVal * Math.PI * 0.22;
        ctx.globalAlpha = level === 0 ? 1.0 : Math.pow(0.72, level);
        ctx.setLineDash([DASH * scale, GAP * scale]);

        /* Family A */
        for (let k = 0; k < N_A; k++) {
          const φ = k * Math.PI * 2 / N_A;
          ctx.beginPath();
          for (let j = 0; j <= SEGS; j++) {
            const t  = j / SEGS * Math.PI * 2;
            const sx = (CX + Rx_l * Math.sin(B * t + δ_l + φ)) * sv;
            const sy = (CY - Ry_l * Math.sin(A * t)) * sv;
            j === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
          }
          ctx.stroke();
        }

        /* Family B */
        for (let k = 0; k < N_B; k++) {
          const ψ = k * Math.PI * 2 / N_B;
          ctx.beginPath();
          for (let j = 0; j <= SEGS; j++) {
            const t  = j / SEGS * Math.PI * 2;
            const sx = (CX + Rx_l * Math.sin(B * t + δ_l)) * sv;
            const sy = (CY - Ry_l * Math.sin(A * t + ψ)) * sv;
            j === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
          }
          ctx.stroke();
        }
      }

      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      if (p.nodeEnabled) {
        ctx.globalAlpha = 1;
        ctx.fillStyle   = p.nodeColor;
        /* Pulse: each node breathes in size over time so movement is perceptible
           even when the curve topology makes positional drift hard to track. */
        const tPulse = segNow(p) * Math.PI * 3;
        for (let k = 0; k < N_A; k++) {
          const φ = k * Math.PI * 2 / N_A;
          applyNodes(PARAM_NODES_A[k % PARAM_NODES_A.length], p, (pos) => {
            const t  = pos * Math.PI * 2;
            const sx = (CX + Rx * Math.sin(B * t + δ + φ)) * sv;
            const sy = (CY - Ry * Math.sin(A * t)) * sv;
            const pulse = 1 + 0.35 * Math.sin(tPulse + pos * 9);
            ctx.beginPath();
            ctx.arc(sx, sy, p.strokeW * 3 * pulse, 0, Math.PI * 2);
            ctx.fill();
          });
        }
        for (let k = 0; k < N_B; k++) {
          const ψ = k * Math.PI * 2 / N_B;
          applyNodes(PARAM_NODES_B, p, (pos) => {
            const t  = pos * Math.PI * 2;
            const sx = (CX + Rx * Math.sin(B * t + δ)) * sv;
            const sy = (CY - Ry * Math.sin(A * t + ψ)) * sv;
            const pulse = 1 + 0.35 * Math.sin(tPulse + pos * 9);
            ctx.beginPath();
            ctx.arc(sx, sy, p.strokeW * 3 * pulse, 0, Math.PI * 2);
            ctx.fill();
          });
        }
      }

      if (p.segEnabled) {
        /* Family A segments */
        for (let k = 0; k < N_A; k++) {
          const φ = k * Math.PI * 2 / N_A;
          applyParametricSegs(PARAM_SEGS_A[k % PARAM_SEGS_A.length], p, φ, 0, true);
        }

        /* Family B segments */
        applyParametricSegs(PARAM_SEGS_B, p, 0, 0, false);
      }
    }

    return { render };
  })();


  /* ══════════════════════════════════════════
     TREE MAP preset
     ══════════════════════════════════════════ */
  const treemap = (function () {
    let _cache = null;
    const TM_MARGIN = 40 * VIEW_SCALE;  /* 40 logical-px margin on each side */

    /* ── color helpers ── */
    function hexToRgb(hex) {
      return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
    }

    function blendHex(a, b, t) {
      const [ar,ag,ab_] = hexToRgb(a);
      const [br,bg_,bb] = hexToRgb(b);
      const r = Math.round(ar + (br-ar)*t).toString(16).padStart(2,'0');
      const g = Math.round(ag + (bg_-ag)*t).toString(16).padStart(2,'0');
      const bv = Math.round(ab_ + (bb-ab_)*t).toString(16).padStart(2,'0');
      return '#' + r + g + bv;
    }

    function rgbDist(a, b) {
      const [ar,ag,ab_] = hexToRgb(a);
      const [br,bg_,bb] = hexToRgb(b);
      return Math.sqrt((ar-br)**2 + (ag-bg_)**2 + (ab_-bb)**2);
    }

    /* Brand saturated row — used to pick accent colour */
    const BRAND_SAT = [
      '#E03E0A','#D45050','#A0703C','#9A920A','#18A050',
      '#04A098','#1858D8','#5058C8','#B030A8','#CC3838',
    ];

    /** Returns the brand-saturated entry most perceptually distant from both bg and fg. */
    function pickAccent(bgHex, fgHex) {
      let best = BRAND_SAT[0], bestScore = -1;
      for (const c of BRAND_SAT) {
        const score = rgbDist(c, bgHex) + rgbDist(c, fgHex);
        if (score > bestScore) { bestScore = score; best = c; }
      }
      return best;
    }

    /**
     * Build the fill palette.
     *   colorVal = 0      → 5 monochromatic tints (bg → stroke)
     *   colorVal > 0.33   → + neutral 1 (#8B8B82, mid-grey)
     *   colorVal > 0.66   → + neutral 2 (#C4C4BC, light-grey)
     *   colorVal > 0.88   → + 1 saturated accent (computed from palette)
     */
    function buildPalette(bgHex, fgHex, colorVal) {
      const palette = [
        bgHex,
        blendHex(bgHex, fgHex, 0.2),
        blendHex(bgHex, fgHex, 0.5),
        blendHex(bgHex, fgHex, 0.8),
        fgHex,
      ];
      if (colorVal > 1/3) palette.push('#8B8B82');
      if (colorVal > 2/3) palette.push('#C4C4BC');
      if (colorVal > 0.88) palette.push(pickAccent(bgHex, fgHex));
      return palette;
    }

    /* ── BSP builder ── */
    const PHI = 0.6180339887;   /* golden ratio */

    /**
     * Recursively partition the canvas into leaf rects.
     *
     * Complexity  → maxDepth (2–18).  Higher = far more subdivision layers.
     * Scale       → minW (log-spaced 600 → 6 px).  Right end feels massively different.
     * Rhythm      → biases every split-point toward the golden cascade PHI / (1−PHI),
     *               varying by diagonal position → compositional flow from BL→TR.
     *
     * Each leaf carries:
     *   fillRand   — uniform [0,1], threshold for whether the cell is filled
     *   colorRand  — uniform [0,1], maps to palette index
     */
    function buildRects(maxDepth, minW, minH, rhythmVal, complexityVal, gravityVal) {
      const IW = W - 2 * TM_MARGIN;  /* inner width  — rects live in [0, IW] × [0, IH] */
      const IH = H - 2 * TM_MARGIN;  /* inner height — TM_MARGIN offset applied at render */
      const MAX_RECTS = 12000;
      const rng = mulberry32(0x1A2B3C4D);
      const result = [];

      function split(x, y, w, h, depth) {
        /* Always push a leaf when the budget is exhausted so every pixel of
           the canvas is accounted for — no holes when the dense side of the
           rhythm cascade fills the array before the sparse side is visited. */
        if (result.length >= MAX_RECTS) {
          result.push({ x, y, w, h, depth, fillRand: rng(), colorRand: rng() });
          return;
        }

        /*
         * Gravity: distance from the gravity anchor, normalised against the inner area.
         * diagFlow = 0 → at gravity point → stop early → large block.
         * diagFlow = 1 → farthest corner   → full depth  → tiny blocks.
         * Quadratic curve concentrates the large-block zone tightly around the anchor,
         * mimicking an Illustrator blend-tool large→small radial gradient.
         */
        const nx   = (x + w * 0.5) / IW;
        const ny   = (y + h * 0.5) / IH;
        const vizX = nx;
        const vizY = 1 - ny;  /* 0=bottom, 1=top */
        const dx   = vizX - gravityVal;
        const dy   = vizY - gravityVal;
        const diagFlow   = clamp(Math.sqrt(dx * dx + dy * dy) / Math.SQRT2, 0, 1);
        const depthBudget = Math.max(1, Math.floor(maxDepth * diagFlow * diagFlow));

        const tooSmall   = w < minW * 2 && h < minH * 2;
        const atMax      = depth >= maxDepth;
        const overBudget = depth >= depthBudget;
        /* At high complexity cells rarely stop early — they recurse all the way to minW */
        const stopChance = depth > 0 ? clamp(0.035 * depth * (1 - complexityVal * 0.72), 0, 0.40) : 0;
        const stopEarly  = rng() < stopChance;

        if (atMax || tooSmall || overBudget || stopEarly) {
          result.push({ x, y, w, h, depth, fillRand: rng(), colorRand: rng() });
          return;
        }

        /* Split along whichever axis has more room relative to the minimum size */
        const splitAlongWidth = (w / Math.max(minW, 1)) >= (h / Math.max(minH, 1));

        /* Rhythm: split-point bias rides along the same diagFlow gradient */
        const rhythmTarget = lerp(PHI, 1 - PHI, diagFlow);
        const baseT        = 0.28 + rng() * 0.44;
        const t            = lerp(baseT, rhythmTarget, rhythmVal);

        if (splitAlongWidth) {
          const w1 = Math.max(1, Math.round(w * t));
          const w2 = Math.max(1, w - w1);
          if (w1 >= minW) split(x,      y, w1, h, depth + 1);
          else result.push({ x,      y, w: w1, h, depth, fillRand: rng(), colorRand: rng() });
          if (w2 >= minW) split(x + w1, y, w2, h, depth + 1);
          else result.push({ x: x+w1, y, w: w2, h, depth, fillRand: rng(), colorRand: rng() });
        } else {
          const h1 = Math.max(1, Math.round(h * t));
          const h2 = Math.max(1, h - h1);
          if (h1 >= minH) split(x, y,      w, h1, depth + 1);
          else result.push({ x, y,      w, h: h1, depth, fillRand: rng(), colorRand: rng() });
          if (h2 >= minH) split(x, y + h1, w, h2, depth + 1);
          else result.push({ x, y: y+h1, w, h: h2, depth, fillRand: rng(), colorRand: rng() });
        }
      }

      split(0, 0, IW, IH, 0);
      return result;
    }

    function getRects(maxDepth, minW, minH, rhythmVal, complexityVal, gravityVal) {
      const key = `${maxDepth}|${minW.toFixed(1)}|${minH.toFixed(1)}|${Math.round(rhythmVal * 100)}|${Math.round(complexityVal * 100)}|${Math.round(gravityVal * 100)}`;
      if (!_cache || _cache.key !== key) {
        _cache = { key, rects: buildRects(maxDepth, minW, minH, rhythmVal, complexityVal, gravityVal) };
      }
      return _cache.rects;
    }

    function render(fi, p) {
      const IW = W - 2 * TM_MARGIN;
      const IH = H - 2 * TM_MARGIN;

      ctx.fillStyle = p.bg;
      ctx.fillRect(0, 0, W, H);

      const complexityVal = parseInt(document.getElementById("tmComplexity").value, 10) / 100;
      const scaleVal      = parseInt(document.getElementById("tmScale").value,      10) / 100;
      const colorVal      = parseInt(document.getElementById("tmColors").value,     10) / 100;
      const fillVal       = parseInt(document.getElementById("tmFill").value,       10) / 100;
      const rhythmVal     = parseInt(document.getElementById("tmRhythm").value,     10) / 100;
      const gravityVal    = parseInt(document.getElementById("tmGravity").value,    10) / 100;

      const maxDepth = Math.max(1, Math.round(2 + 16 * complexityVal));
      const complexFactor = Math.pow(10, 2 * complexityVal);
      const scaleFactor   = lerp(1, 10, scaleVal);
      const minW          = Math.max(2, 600 / (complexFactor * scaleFactor));
      const minH          = Math.max(1, minW * (IH / IW));

      const rects   = getRects(maxDepth, minW, minH, rhythmVal, complexityVal, gravityVal);
      const palette = buildPalette(p.bg, p.strokeColor, colorVal);

      /*
       * Animation: diagonal sweep from BL → TR.
       * sweepGp compresses the full reveal into 78% of the loop, leaving a
       * clean hold at the end before looping. This prevents the dense TR region
       * (many small blocks) from dragging across the tail of the animation.
       * REVEAL_WIN: how long each block takes to grow in (fraction of loop).
       * Smaller = snappier individual reveals, less simultaneous overlap.
       */
      const tot = p.emergeFr;
      const gp  = ((fi % tot) + tot) % tot / tot;

      /*
       * Scatter / assemble loop.
       * cosT oscillates 1→0→1 per loop (gp=0: scattered, gp=0.5: assembled,
       * gp=1: scattered again). Cubing gives ease-out into the assembled state:
       * blocks drift slowly into their final positions and linger there, then
       * gently scatter back out — perfectly seamless because cos is smooth at
       * both ends of the loop (position AND velocity are continuous).
       */
      const cosT     = 0.5 + 0.5 * Math.cos(2 * Math.PI * gp);
      const scatterT = cosT * cosT * cosT;

      /* Fills */
      for (const r of rects) {
        if (r.fillRand >= fillVal) continue;
        const rcx = r.x + r.w * 0.5;
        const rcy = r.y + r.h * 0.5;
        /* Deterministic per-block scatter vector — no RNG state change,
           derived purely from the block's geometry via integer hash. */
        let h = (Math.round(r.x) * 73856093 ^ Math.round(r.y) * 19349663 ^ Math.round(r.w) * 83492791) >>> 0;
        h ^= h >>> 16; h = Math.imul(h, 0x45d9f3b) >>> 0; h ^= h >>> 16;
        const v1 = h / 0x100000000;
        h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; h ^= h >>> 16;
        const v2 = h / 0x100000000;
        /* Radial outward from inner-area centre + angular jitter so pieces
           scatter like a real explosion rather than a uniform radial fan. */
        const angle = Math.atan2(rcy - IH * 0.5, rcx - IW * 0.5) + (v1 - 0.5) * 1.8;
        const mag   = lerp(800, 2800, v2);
        const offX  = Math.cos(angle) * mag * scatterT;
        const offY  = Math.sin(angle) * mag * scatterT;
        ctx.fillStyle = palette[Math.floor(r.colorRand * palette.length) % palette.length];
        ctx.fillRect(TM_MARGIN + r.x + offX, TM_MARGIN + r.y + offY, r.w, r.h);
      }

      /* Outlines */
      if (p.strokeW > 0) {
        ctx.strokeStyle = p.strokeColor;
        ctx.lineWidth   = p.strokeW;
        ctx.lineJoin    = "miter";
        for (const r of rects) {
          const rcx = r.x + r.w * 0.5;
          const rcy = r.y + r.h * 0.5;
          let h = (Math.round(r.x) * 73856093 ^ Math.round(r.y) * 19349663 ^ Math.round(r.w) * 83492791) >>> 0;
          h ^= h >>> 16; h = Math.imul(h, 0x45d9f3b) >>> 0; h ^= h >>> 16;
          const v1 = h / 0x100000000;
          h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; h ^= h >>> 16;
          const v2 = h / 0x100000000;
          const angle = Math.atan2(rcy - IH * 0.5, rcx - IW * 0.5) + (v1 - 0.5) * 1.8;
          const mag   = lerp(800, 2800, v2);
          const offX  = Math.cos(angle) * mag * scatterT;
          const offY  = Math.sin(angle) * mag * scatterT;
          ctx.strokeRect(TM_MARGIN + r.x + offX, TM_MARGIN + r.y + offY, r.w, r.h);
        }
      }
    }

    return { render };
  })();

  /* ══════════════════════════════════════════
     SOCCER — slowly rotating truncated icosahedron (soccer-ball wireframe).
     32 faces (12 pentagons + 20 hexagons) with depth-fade for 3-D roundness.
     ══════════════════════════════════════════ */
  const soccer = (function () {
    const sv = VIEW_SCALE;
    const VH = H / VIEW_SCALE;
    const CX = RIGHT_X * 0.5;
    const CY = VH * 0.5;
    const R  = Math.min(CX, CY) * 0.88;

    const CYCLE_FRAMES = 270;

    /* ── Truncated-icosahedron geometry — built once at module load ── */
    const _phi = (1 + Math.sqrt(5)) / 2;

    /* 60 raw (pre-normalisation) vertices.
     * Three families, each being all cyclic permutations of a signed triple. */
    const _raw = [];
    /* Family A: cyclic perms of (0, ±1, ±3φ) */
    const _3phi = 3 * _phi;
    for (const s1 of [1, -1]) for (const s2 of [1, -1]) {
      _raw.push([0,          s1,         s2 * _3phi]);
      _raw.push([s1,         s2 * _3phi, 0         ]);
      _raw.push([s2 * _3phi, 0,          s1        ]);
    }
    /* Family B: cyclic perms of (±2, ±(1+2φ), ±φ) */
    const _1p2phi = 1 + 2 * _phi;
    for (const s1 of [1, -1]) for (const s2 of [1, -1]) for (const s3 of [1, -1]) {
      _raw.push([2 * s1,       _1p2phi * s2, _phi * s3   ]);
      _raw.push([_1p2phi * s2, _phi * s3,    2 * s1      ]);
      _raw.push([_phi * s3,    2 * s1,       _1p2phi * s2]);
    }
    /* Family C: cyclic perms of (±1, ±(2+φ), ±2φ) */
    const _2pphi = 2 + _phi, _2phi = 2 * _phi;
    for (const s1 of [1, -1]) for (const s2 of [1, -1]) for (const s3 of [1, -1]) {
      _raw.push([s1,          _2pphi * s2, _2phi * s3 ]);
      _raw.push([_2pphi * s2, _2phi * s3,  s1         ]);
      _raw.push([_2phi * s3,  s1,          _2pphi * s2]);
    }
    /* 60 vertices total */

    /* Normalise to unit sphere */
    const VERTS = _raw.map(([x, y, z]) => {
      const r = Math.sqrt(x * x + y * y + z * z);
      return [x / r, y / r, z / r];
    });

    /* Adjacency: edge length in raw space = 2 throughout (uniform edge length). */
    const ADJ = Array.from({ length: 60 }, () => []);
    for (let i = 0; i < 60; i++) {
      for (let j = i + 1; j < 60; j++) {
        const dx = _raw[i][0] - _raw[j][0];
        const dy = _raw[i][1] - _raw[j][1];
        const dz = _raw[i][2] - _raw[j][2];
        if (Math.abs(dx * dx + dy * dy + dz * dz - 4) < 0.1) {
          ADJ[i].push(j);
          ADJ[j].push(i);
        }
      }
    }

    /* For directed edge from→at, return next vertex in the face on the left
     * (= CCW face when viewed from outside the sphere). */
    function _next(from, at) {
      const n = VERTS[at];
      const inc = [VERTS[from][0] - n[0], VERTS[from][1] - n[1], VERTS[from][2] - n[2]];
      /* Project incoming direction onto tangent plane at 'at' */
      const id  = inc[0] * n[0] + inc[1] * n[1] + inc[2] * n[2];
      let e1x = inc[0] - id * n[0], e1y = inc[1] - id * n[1], e1z = inc[2] - id * n[2];
      const el = Math.sqrt(e1x * e1x + e1y * e1y + e1z * e1z);
      e1x /= el; e1y /= el; e1z /= el;
      /* e2 = n × e1  →  "left" in tangent plane when viewed from outside */
      const e2x = n[1] * e1z - n[2] * e1y;
      const e2y = n[2] * e1x - n[0] * e1z;
      const e2z = n[0] * e1y - n[1] * e1x;

      let best = -Infinity, bestNb = -1;
      for (const nb of ADJ[at]) {
        if (nb === from) continue;
        const out = [VERTS[nb][0] - n[0], VERTS[nb][1] - n[1], VERTS[nb][2] - n[2]];
        const od  = out[0] * n[0] + out[1] * n[1] + out[2] * n[2];
        const tx  = out[0] - od * n[0], ty = out[1] - od * n[1], tz = out[2] - od * n[2];
        const ang = Math.atan2(tx * e2x + ty * e2y + tz * e2z,
                               tx * e1x + ty * e1y + tz * e1z);
        if (ang > best) { best = ang; bestNb = nb; }
      }
      return bestNb;
    }

    /* Trace all 32 faces (12 pentagons + 20 hexagons). */
    const FACES = [];
    {
      const seen = new Set();
      for (let i = 0; i < 60; i++) {
        for (const j of ADJ[i]) {
          if (seen.has(i * 60 + j)) continue;
          const vi = [];
          let prev = i, cur = j;
          for (let k = 0; k < 8; k++) {
            seen.add(prev * 60 + cur);
            vi.push(prev);
            const nxt = _next(prev, cur);
            if (nxt < 0) break;
            prev = cur; cur = nxt;
            if (cur === i) { seen.add(prev * 60 + cur); vi.push(prev); break; }
          }
          if (vi.length === 5 || vi.length === 6) {
            FACES.push({ vi, isPentagon: vi.length === 5 });
          }
        }
      }
    }

    const SOCCER_SEGS  = makeSegs(0xD0DB0000, 8);
    const SOCCER_NODES = makeNodes(0xD0DB7000, 12);

    /* Apply Ry(rotY) × Rx(rotX) rotation to a 3-vector. */
    function _rotV([x, y, z], cX, sX, cY, sY) {
      const x1 =  x * cY + z * sY;
      const z1 = -x * sY + z * cY;
      return [x1, y * cX - z1 * sX, y * sX + z1 * cX];
    }

    function render(fi, p) {
      ctx.fillStyle = p.bg;
      ctx.fillRect(0, 0, W, H);

      const spinVal  = parseInt(document.getElementById('soccerSpin')?.value    ?? '50', 10) / 100;
      const patchVal = parseInt(document.getElementById('soccerPatches')?.value ?? '50', 10) / 100;

      /* speedMul=1 at default (50) → exactly one full rotation per CYCLE_FRAMES → seamless loop */
      const speedMul = lerp(0.0, 2.0, spinVal);
      const rotY     = (fi % CYCLE_FRAMES) / CYCLE_FRAMES * Math.PI * 2 * speedMul;
      const rotX     = 0.4;   /* fixed tilt — ball never spins in a flat plane */

      const cX = Math.cos(rotX), sX = Math.sin(rotX);
      const cY = Math.cos(rotY), sY = Math.sin(rotY);
      const rv = VERTS.map(v => _rotV(v, cX, sX, cY, sY));

      /* Decompose bg / stroke hex colours for fill blending */
      const br  = parseInt(p.bg.slice(1, 3), 16);
      const bgg = parseInt(p.bg.slice(3, 5), 16);
      const bb  = parseInt(p.bg.slice(5, 7), 16);
      const fr  = parseInt(p.strokeColor.slice(1, 3), 16);
      const fgg = parseInt(p.strokeColor.slice(3, 5), 16);
      const fb  = parseInt(p.strokeColor.slice(5, 7), 16);

      /* Painter's algorithm — back to front */
      const sorted = FACES.map(face => ({
        face,
        avgZ: face.vi.reduce((s, i) => s + rv[i][2], 0) / face.vi.length,
      })).sort((a, b) => a.avgZ - b.avgZ);

      ctx.lineWidth = p.strokeW;
      ctx.lineCap   = 'round';
      ctx.lineJoin  = 'round';

      for (const { face, avgZ } of sorted) {
        /* Back-face cull: z-component of the face normal (cross product of first two edges). */
        const v0 = rv[face.vi[0]], v1 = rv[face.vi[1]], v2 = rv[face.vi[2]];
        const nZ = (v1[0] - v0[0]) * (v2[1] - v0[1]) - (v1[1] - v0[1]) * (v2[0] - v0[0]);
        if (nZ >= 0) continue;  /* faces are CW-wound from outside → front-facing have nZ < 0 */

        /* Depth fade: faces near the silhouette edge (low z) fade toward bg,
         * giving the ball a convincingly round appearance. */
        const FADE_Z = 0.18;
        const alpha  = avgZ < FADE_Z ? Math.max(0, avgZ / FADE_Z) : 1.0;
        if (alpha < 0.02) continue;
        ctx.globalAlpha = alpha;

        /* Orthographic projection */
        const pts = face.vi.map(i => [
          (CX + R * rv[i][0]) * sv,
          (CY - R * rv[i][1]) * sv,
        ]);

        /* Fill: pentagons tinted more strongly, hexagons subtly, both toward fg */
        if (patchVal > 0) {
          const t = face.isPentagon ? patchVal * 0.38 : patchVal * 0.12;
          ctx.fillStyle = `rgb(${Math.round(br + (fr - br) * t)},${Math.round(bgg + (fgg - bgg) * t)},${Math.round(bb + (fb - bb) * t)})`;
          ctx.beginPath();
          ctx.moveTo(pts[0][0], pts[0][1]);
          for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
          ctx.closePath();
          ctx.fill();
        }

        /* Seam lines */
        ctx.strokeStyle = p.strokeColor;
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
        ctx.closePath();
        ctx.stroke();
      }

      ctx.globalAlpha = 1;

      /* Segments — arcs on the equatorial silhouette circle, sphere-preset style */
      if (p.segEnabled) {
        const rawPhase = (fi % CYCLE_FRAMES) / CYCLE_FRAMES;
        applySegs(SOCCER_SEGS, rawPhase, p, (s0, s1, color) => {
          ctx.globalAlpha = 1;
          ctx.strokeStyle = color;
          ctx.beginPath();
          ctx.arc(CX * sv, CY * sv, R * sv, s0 * Math.PI * 2, s1 * Math.PI * 2);
          ctx.stroke();
        });
        ctx.strokeStyle = p.strokeColor;
      }

      /* Nodes — dots travelling the equatorial circle */
      if (p.nodeEnabled) {
        ctx.globalAlpha = 1;
        ctx.fillStyle   = p.nodeColor;
        applyNodes(SOCCER_NODES, p, (pos) => {
          const a = pos * Math.PI * 2;
          ctx.beginPath();
          ctx.arc((CX + R * Math.cos(a)) * sv, (CY + R * Math.sin(a)) * sv,
                  p.strokeW * 2, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      ctx.globalAlpha = 1;
    }

    return { render };
  })();


  const presets = { converge, speed, perspective, gesture, wind, planes, sphere, parametric, treemap, soccer };

  function readParams() {
    const el = id => document.getElementById(id);
    return {
      bg: el("bgHex").value,
      strokeColor: el("fgHex").value,
      segColor: el("segHex").value,
      strokeW: parseFloat(el("strokeW").value) * VIEW_SCALE,
      fps: parseInt(el("fps").value, 10),
      emergeFr: parseInt(el("emergeFr").value, 10),
      segEnabled: el("segEnabled").checked,
      segDensity: parseInt(el("segDensity").value, 10) / 100,
      segSize:    parseInt(el("segSize").value, 10) / 100,
      segSpeed:   parseInt(el("segSpeed").value, 10) / 100,
      nodeEnabled: el("nodeEnabled").checked,
      nodeColor:   el("nodeHex").value,
      nodeDensity: parseInt(el("nodeDensity").value, 10) / 100,
      nodeSpeed:   parseInt(el("nodeSpeed").value, 10) / 100,
    };
  }

  function totalFrames(p) {
    return p.emergeFr;
  }

  /** Hero still for Converge: midpoint of loop (segment travel reads “alive”; frame 0 is an arbitrary seam). */
  const CONVERGE_DEFAULT_LOOP_T = 0.5;

  function defaultConvergeFrame(p) {
    const tot = totalFrames(p);
    if (tot <= 1) return 0;
    return Math.min(tot - 1, Math.round(CONVERGE_DEFAULT_LOOP_T * (tot - 1)));
  }

  /* ── canvas size toggle ── */
  let canvasMode = '1080p';  /* default for parametric style */

  function applyCanvasMode() {
    if (canvasMode === '1080p') {
      canvas.width  = 1920;
      canvas.height = 1080;
      canvas.style.aspectRatio = '1920 / 1080';
    } else if (canvasMode === '4k') {
      canvas.width  = 3840;
      canvas.height = 2160;
      canvas.style.aspectRatio = '3840 / 2160';
    } else {
      canvas.width  = W;
      canvas.height = H;
      canvas.style.aspectRatio = `${W} / ${H}`;
    }
  }

  function renderFrame(fi, p) {
    if (canvasMode === '1080p' || canvasMode === '4k') {
      const cW = canvasMode === '4k' ? 3840 : 1920;
      const cH = canvasMode === '4k' ? 2160 : 1080;
      ctx.save();
      if (activePreset === 'parametric') {
        /* Parametric: non-uniform stretch to fill canvas with even margins */
        ctx.setTransform(cW / W, 0, 0, cH / H, 0, 0);
      } else {
        /* All other styles: uniform scale, letterbox top/bottom */
        const scale   = Math.min(cW / W, cH / H);
        const offsetX = (cW - W * scale) / 2;
        const offsetY = (cH - H * scale) / 2;
        ctx.fillStyle = p.bg;
        ctx.fillRect(0, 0, cW, cH);
        ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
      }
      presets[activePreset].render(fi, p);
      ctx.restore();
    } else {
      presets[activePreset].render(fi, p);
    }
  }

  let playing = false;
  let frameIndex = 0;
  let lastT = 0;
  let raf = null;
  let segRaf = null;

  const el = id => document.getElementById(id);

  function updateLabels() {
    const p = readParams();
    el("vStrokeW").textContent = (p.strokeW / VIEW_SCALE).toFixed(0);
    el("vFps").textContent = String(p.fps);
    el("vEmergeFr").textContent = String(p.emergeFr);
    const maxFi = Math.max(0, totalFrames(p) - 1);
    el("scrub").max = String(maxFi);
    if (frameIndex > maxFi) frameIndex = maxFi;

    if (document.getElementById("convergeBend")) {
      el("vConvergeBend").textContent = el("convergeBend").value;
    }
    if (document.getElementById("sphereRings")) {
      el("vSphereRings").textContent = el("sphereRings").value;
    }
    if (document.getElementById("paramCurves")) {
      const curves = parseInt(el("paramCurves").value, 10);
      el("vParamCurves").textContent    = String(curves);
      el("vParamRecursion").textContent = el("paramRecursion").value;
      /* Auto-sync frames to T/N_A for a seamless single loop */
      const N_A_current = curves - 1;
      const T_param     = 480;
      const loopFrames  = Math.round(T_param / N_A_current);
      if (activePreset === "parametric") {
        el("emergeFr").value = String(loopFrames);
        el("vEmergeFr").textContent = String(loopFrames);
      }
    }
    if (document.getElementById("speedSpace")) {
      el("vSpace").textContent = el("speedSpace").value;
      el("vVelocity").textContent = el("speedVelocity").value;
      el("vColor").textContent = el("speedColor").value;
      el("vScale").textContent = el("speedScale").value;
      el("vPosition").textContent = el("speedPosition").value;
      el("vDither").textContent = el("speedDither").value;
      el("vSpeedPersp").textContent = el("speedPersp").value;
    }
    if (document.getElementById("perspDepth")) {
      el("vDepth").textContent = el("perspDepth").value;
      el("vAngle").textContent = el("perspAngle").value;
      el("vPerspPos").textContent = el("perspPosition").value;
      el("vShape").textContent = el("perspShape").value;
    }
    if (document.getElementById("gestScale")) {
      el("vGestScale").textContent = el("gestScale").value;
      el("vGestAmp").textContent = el("gestAmp").value;
      el("vGestWaves").textContent = el("gestWaves").value;
      el("vGestDamp").textContent = el("gestDamp").value;
      el("vGestSkew").textContent = el("gestSkew").value;
      el("vGestRhythm").textContent = el("gestRhythm").value;
      el("vGestPos").textContent = el("gestPos").value;
      el("vGestFrag").textContent = el("gestFrag").value;
      el("vGestHeight").textContent = el("gestHeight").value;
    }
    el("vSegDensity").textContent  = el("segDensity").value;
    el("vSegSize").textContent     = el("segSize").value;
    el("vSegSpeed").textContent    = el("segSpeed").value;
    el("vNodeDensity").textContent = el("nodeDensity").value;
    el("vNodeSpeed").textContent   = el("nodeSpeed").value;
    if (document.getElementById("tmComplexity")) {
      el("vTmComplexity").textContent = el("tmComplexity").value;
      el("vTmScale").textContent      = el("tmScale").value;
      el("vTmColors").textContent     = el("tmColors").value;
      el("vTmFill").textContent       = el("tmFill").value;
      el("vTmRhythm").textContent     = el("tmRhythm").value;
      el("vTmGravity").textContent    = el("tmGravity").value;
    }
    if (document.getElementById("soccerSpin")) {
      el("vSoccerSpin").textContent    = el("soccerSpin").value;
      el("vSoccerPatches").textContent = el("soccerPatches").value;
    }
  }

  function updatePresetUI() {
    document.getElementById("convergeControls").style.display     = activePreset === "converge"     ? "" : "none";
    document.getElementById("speedControls").style.display        = activePreset === "speed"        ? "" : "none";
    document.getElementById("perspectiveControls").style.display  = activePreset === "perspective"  ? "" : "none";
    document.getElementById("gestureControls").style.display      = activePreset === "gesture"      ? "" : "none";
    document.getElementById("parametricControls").style.display   = activePreset === "parametric"   ? "" : "none";
    document.getElementById("sphereControls").style.display       = activePreset === "sphere"       ? "" : "none";
    document.getElementById("treemapControls").style.display      = activePreset === "treemap"      ? "" : "none";
    document.getElementById("soccerControls").style.display       = activePreset === "soccer"       ? "" : "none";
  }

  function paint() {
    const p = readParams();
    renderFrame(frameIndex, p);
    const tot = totalFrames(p);
    el("scrub").value = String(frameIndex % tot);
    el("frameLabel").textContent = `${frameIndex % tot} / ${tot - 1}`;
  }

  function stopSegLoop() {
    if (segRaf) { cancelAnimationFrame(segRaf); segRaf = null; }
  }

  function segLoopActive() {
    return el("segEnabled").checked || el("nodeEnabled").checked;
  }

  function startSegLoop() {
    if (segRaf || playing) return;
    function loop() {
      if (playing || !segLoopActive()) { segRaf = null; return; }
      const p = readParams();
      renderFrame(frameIndex, p);
      segRaf = requestAnimationFrame(loop);
    }
    segRaf = requestAnimationFrame(loop);
  }

  function tick(now) {
    if (!playing) return;
    const p = readParams();
    const interval = 1000 / p.fps;
    if (now - lastT >= interval) {
      lastT = now;
      frameIndex++;
      const tot = totalFrames(p);
      if (!el("loop").checked && frameIndex >= tot) {
        frameIndex = tot - 1;
        setPlaying(false);
        return;
      }
      /* Update scrub/label only when frame actually advances */
      el("scrub").value = String(frameIndex % tot);
      el("frameLabel").textContent = `${frameIndex % tot} / ${tot - 1}`;
    }
    /* Always repaint at RAF rate — keeps segments silky even at low FPS settings */
    renderFrame(frameIndex, p);
    raf = requestAnimationFrame(tick);
  }

  function setPlaying(val) {
    playing = val;
    el("playToggle").innerHTML = playing ? '&#9646;&#9646;' : '&#9654;';
    if (playing) {
      stopSegLoop();
      lastT = performance.now();
      raf = requestAnimationFrame(tick);
    } else {
      if (raf) cancelAnimationFrame(raf);
      if (segLoopActive()) startSegLoop();
    }
  }

  el("playToggle").addEventListener("click", () => setPlaying(!playing));

  el("scrub").addEventListener("input", () => {
    frameIndex = parseInt(el("scrub").value, 10);
    paint();
  });

  document.querySelectorAll(".controls input").forEach(inp => {
    inp.addEventListener("input", () => { updateLabels(); paint(); saveUIState(); });
  });

  el("segEnabled").addEventListener("input", () => {
    el("segControls").style.display = el("segEnabled").checked ? "" : "none";
    if (segLoopActive() && !playing) startSegLoop();
    else if (!segLoopActive()) stopSegLoop();
  });

  el("nodeEnabled").addEventListener("input", () => {
    el("nodeControls").style.display = el("nodeEnabled").checked ? "" : "none";
    if (segLoopActive() && !playing) startSegLoop();
    else if (!segLoopActive()) stopSegLoop();
  });


  /* ── export status helpers ── */
  function exportPct(el, pct) {
    el.style.opacity = '1';
    el.textContent = pct < 100 ? `${pct}%` : '';
  }
  function exportDone(el) {
    el.style.opacity = '1';
    el.textContent = '✓';
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => { el.textContent = ''; }, 400); }, 1200);
  }

  el("exportPng").addEventListener("click", () => {
    const p = readParams();
    /* Render at 2× OG (2400×1260) regardless of current canvas mode */
    const offscreen = document.createElement("canvas");
    offscreen.width  = W;
    offscreen.height = H;
    const offCtx = canvas.getContext("2d");
    /* Re-render the current frame into the main canvas at OG size, then snapshot */
    const prevMode = canvasMode;
    canvasMode = "og";
    applyCanvasMode();
    paint();
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a   = document.createElement("a");
      a.href     = url;
      a.download = `og-${activePreset}.png`;
      a.click();
      URL.revokeObjectURL(url);
      /* Restore previous canvas mode */
      canvasMode = prevMode;
      applyCanvasMode();
      paint();
    }, "image/png");
  });

  el("exportSvg").addEventListener("click", () => {
    const p = readParams();
    const svgElements = [];
    let currentBg = p.bg;

    const origStroke = ctx.stroke.bind(ctx);
    const origFillRect = ctx.fillRect.bind(ctx);
    const origBeginPath = ctx.beginPath.bind(ctx);
    const origMoveTo = ctx.moveTo.bind(ctx);
    const origLineTo = ctx.lineTo.bind(ctx);
    const origBezierCurveTo = ctx.bezierCurveTo.bind(ctx);
    const origArcTo = ctx.arcTo.bind(ctx);
    const origSetLineDash = ctx.setLineDash.bind(ctx);
    const origEllipse     = ctx.ellipse.bind(ctx);

    let curPath = "";
    let curDash = [];
    ctx.beginPath = function () { curPath = ""; origBeginPath(); };
    ctx.moveTo = function (x, y) { curPath += `M${(x/VIEW_SCALE).toFixed(2)},${(y/VIEW_SCALE).toFixed(2)}`; origMoveTo(x, y); };
    ctx.lineTo = function (x, y) { curPath += `L${(x/VIEW_SCALE).toFixed(2)},${(y/VIEW_SCALE).toFixed(2)}`; origLineTo(x, y); };
    ctx.bezierCurveTo = function (c1x,c1y,c2x,c2y,ex,ey) {
      curPath += `C${(c1x/VIEW_SCALE).toFixed(2)},${(c1y/VIEW_SCALE).toFixed(2)} ${(c2x/VIEW_SCALE).toFixed(2)},${(c2y/VIEW_SCALE).toFixed(2)} ${(ex/VIEW_SCALE).toFixed(2)},${(ey/VIEW_SCALE).toFixed(2)}`;
      origBezierCurveTo(c1x,c1y,c2x,c2y,ex,ey);
    };
    ctx.arcTo = function (x1,y1,x2,y2,r) {
      curPath += `L${(x1/VIEW_SCALE).toFixed(2)},${(y1/VIEW_SCALE).toFixed(2)}`;
      origArcTo(x1,y1,x2,y2,r);
    };
    ctx.setLineDash = function (arr) { curDash = arr || []; origSetLineDash(arr); };
    /* Intercept ellipse — convert to path points so SVG capture works */
    ctx.ellipse = function (cx, cy, rx, ry, rotation, startAngle, endAngle) {
      const STEPS = 72;
      const cr = Math.cos(rotation), sr = Math.sin(rotation);
      for (let i = 0; i <= STEPS; i++) {
        const a  = startAngle + (endAngle - startAngle) * i / STEPS;
        const ex = rx * Math.cos(a), ey = ry * Math.sin(a);
        const px = cx + ex * cr - ey * sr;
        const py = cy + ex * sr + ey * cr;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      origEllipse(cx, cy, rx, ry, rotation, startAngle, endAngle);
    };
    ctx.stroke = function () {
      if (curPath) {
        const alpha  = (ctx.globalAlpha !== undefined && ctx.globalAlpha < 1) ? ` opacity="${ctx.globalAlpha.toFixed(3)}"` : '';
        const dashes = curDash.length >= 2
          ? ` stroke-dasharray="${curDash.map(v => (v/VIEW_SCALE).toFixed(2)).join(' ')}"` : '';
        svgElements.push(`  <path d="${curPath}" stroke="${ctx.strokeStyle}" stroke-width="${(ctx.lineWidth / VIEW_SCALE).toFixed(2)}" stroke-linecap="${ctx.lineCap}" fill="none"${alpha}${dashes}/>`);
      }
      origStroke();
    };
    ctx.fillRect = function (x, y, w, h) {
      if (w >= W && h >= H) {
        currentBg = ctx.fillStyle;
      } else {
        svgElements.push(`  <rect x="${(x/VIEW_SCALE).toFixed(2)}" y="${(y/VIEW_SCALE).toFixed(2)}" width="${(w/VIEW_SCALE).toFixed(2)}" height="${(h/VIEW_SCALE).toFixed(2)}" fill="${ctx.fillStyle}"/>`);
      }
      origFillRect(x, y, w, h);
    };

    renderFrame(frameIndex, p);

    ctx.beginPath = origBeginPath;
    ctx.moveTo = origMoveTo;
    ctx.lineTo = origLineTo;
    ctx.bezierCurveTo = origBezierCurveTo;
    ctx.arcTo = origArcTo;
    ctx.setLineDash = origSetLineDash;
    ctx.ellipse     = origEllipse;
    ctx.stroke = origStroke;
    ctx.fillRect = origFillRect;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${RIGHT_X} ${H/VIEW_SCALE}" width="${RIGHT_X}" height="${H/VIEW_SCALE}">\n  <rect width="100%" height="100%" fill="${currentBg}"/>\n${svgElements.join("\n")}\n</svg>`;

    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "og-lines.svg";
    a.click();
    URL.revokeObjectURL(url);
    exportDone(el("exportStatus"));
  });

  el("exportGif").addEventListener("click", () => {
    const p = readParams();
    const tot = totalFrames(p);
    const status = el("exportStatus");
    

    const gif = new GIF({
      workers: 2,
      quality: 10,
      width: canvas.width,
      height: canvas.height,
      workerScript: "vendor/gifjs/gif.worker.js",
    });

    for (let i = 0; i < tot; i++) {
      _exportFrameIndex = i;
      renderFrame(i, p);
      gif.addFrame(ctx, { copy: true, delay: Math.round(1000 / p.fps) });
    }
    _exportFrameIndex = -1;

    gif.on("finished", blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "nvidia-lines.gif";
      a.click();
      URL.revokeObjectURL(url);
      exportDone(status);
    });

    gif.on("progress", pct => {
      exportPct(status, Math.round(pct * 100));
    });

    gif.render();
  });

  el("exportWebm").addEventListener("click", async () => {
    const p = readParams();
    const tot = totalFrames(p);
    const status = el("exportStatus");
    

    const stream = canvas.captureStream(0);
    const recorder = new MediaRecorder(stream, {
      mimeType: "video/webm;codecs=vp9",
      videoBitsPerSecond: 8000000,
    });

    const chunks = [];
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };

    recorder.start();

    for (let i = 0; i < tot; i++) {
      _exportFrameIndex = i;
      renderFrame(i, p);
      stream.getVideoTracks()[0].requestFrame();
      await new Promise(r => setTimeout(r, Math.round(1000 / p.fps)));
      exportPct(status, Math.round((i + 1) / tot * 100));
    }
    _exportFrameIndex = -1;

    recorder.stop();
    await new Promise(r => { recorder.onstop = r; });

    const blob = new Blob(chunks, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "nvidia-lines.webm";
    a.click();
    URL.revokeObjectURL(url);
    exportDone(status);
  });

  el("exportMp4").addEventListener("click", async () => {
    const p = readParams();
    const tot = totalFrames(p);
    const status = el("exportStatus");
    

    const muxer = new Mp4Muxer.Muxer({
      target: new Mp4Muxer.ArrayBufferTarget(),
      video: {
        codec: "avc",
        width: canvas.width,
        height: canvas.height,
      },
      fastStart: "in-memory",
    });

    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: e => { status.textContent = `Error`; },
    });

    encoder.configure({
      codec: "avc1.640033",
      width: canvas.width,
      height: canvas.height,
      bitrate: 8_000_000,
      framerate: p.fps,
    });

    for (let i = 0; i < tot; i++) {
      _exportFrameIndex = i;
      renderFrame(i, p);
      const frame = new VideoFrame(canvas, {
        timestamp: Math.round(i * 1_000_000 / p.fps),
        duration: Math.round(1_000_000 / p.fps),
      });
      const keyFrame = i % (p.fps * 2) === 0;
      encoder.encode(frame, { keyFrame });
      frame.close();

      if (encoder.encodeQueueSize > 5) {
        await encoder.flush();
      }

      exportPct(status, Math.round((i + 1) / tot * 100));
    }
    _exportFrameIndex = -1;

    await encoder.flush();
    encoder.close();
    muxer.finalize();

    const buf = muxer.target.buffer;
    const blob = new Blob([buf], { type: "video/mp4" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "nvidia-lines.mp4";
    a.click();
    URL.revokeObjectURL(url);
    exportDone(status);
  });

  const OG_PRESET_STORAGE_KEY = "og-nvidia-05-preset-v1";

  /* Per-preset default colors — applied when switching presets */
  const PRESET_DEFAULTS = {
    parametric: { bg: '#2D2D2B', fg: '#F44E00', curves: 4, frames: 160  },  /* T/N_A = 480/3 = 160fr = 6.7s @24fps */
    sphere:     { bg: '#2D2D2B', fg: '#CCA78C', frames: 135  },  /* CYCLE_FRAMES/2 = 135 = half rotation (sphere is symmetric at 180°) */
    treemap:    { strokeW: 1, frames: 150, canvasMode: 'og' },    /* OG canvas avoids letterbox margin asymmetry */
    soccer:     { bg: '#181814', fg: '#D0CCBC', frames: 270  },  /* CYCLE_FRAMES = 270 = one full rotation at default spin */
  };

  function applyPresetColors(presetName) {
    const d = PRESET_DEFAULTS[presetName];
    if (!d) return;
    if (d.bg) { el('bgHex').value = d.bg; el('bgText').value = d.bg.toUpperCase(); }
    if (d.fg) { el('fgHex').value = d.fg; el('fgText').value = d.fg.toUpperCase(); }
    if (d.curves != null && document.getElementById('paramCurves')) {
      el('paramCurves').value = String(d.curves);
    }
    if (d.frames) { el('emergeFr').value = d.frames; updateLabels(); }
    if (d.strokeW != null) { el('strokeW').value = String(d.strokeW); updateLabels(); }
    if (d.canvasMode) {
      canvasMode = d.canvasMode;
      el('sizeOG').classList.toggle('primary',   d.canvasMode === 'og');
      el('size1080').classList.toggle('primary', d.canvasMode === '1080p');
      el('size4k').classList.toggle('primary',   d.canvasMode === '4k');
      /* applyCanvasMode() is called by the caller after this returns */
    }
  }

  el("preset").addEventListener("change", () => {
    activePreset = el("preset").value;
    try {
      localStorage.setItem(OG_PRESET_STORAGE_KEY, activePreset);
    } catch (_) {}
    applyPresetColors(activePreset);   /* may update canvasMode */
    applyCanvasMode();                 /* re-apply in case canvasMode changed */
    updatePresetUI();
    if (activePreset === "converge") {
      frameIndex = defaultConvergeFrame(readParams());
    } else if (activePreset === "wind") {
      frameIndex = 0;
    }
    paint();
    saveUIState();
  });

  [["bgHex","bgText"], ["fgHex","fgText"], ["segHex","segText"], ["nodeHex","nodeText"]].forEach(([pickerId, textId]) => {
    const picker = document.getElementById(pickerId);
    const text = document.getElementById(textId);
    picker.addEventListener("input", () => { text.value = picker.value.toUpperCase(); paint(); saveUIState(); });
    text.addEventListener("input", () => {
      const v = text.value.trim();
      if (/^#[0-9A-Fa-f]{6}$/.test(v)) { picker.value = v; paint(); }
    });
    text.addEventListener("change", () => {
      let v = text.value.trim();
      if (!v.startsWith("#")) v = "#" + v;
      if (/^#[0-9A-Fa-f]{6}$/.test(v)) { picker.value = v; text.value = v.toUpperCase(); paint(); }
      else { text.value = picker.value.toUpperCase(); }
    });
  });

  try {
    const storedPreset = localStorage.getItem(OG_PRESET_STORAGE_KEY);
    if (storedPreset && Object.prototype.hasOwnProperty.call(presets, storedPreset)) {
      activePreset = storedPreset;
      el("preset").value = storedPreset;
    }
  } catch (_) {}

  updatePresetUI();
  applyPresetColors(activePreset);  /* may update canvasMode (e.g. treemap → OG) */
  applyCanvasMode();                /* apply canvas size for current mode */

  /* ── brand color swatches ── */
  /*
   * Brand palette — organised to match the reference images:
   *   Row 1: 5 grayscale (dark → light)
   *   Rows 2–5: 10 hue families × 4 shades (light → dark, read left→right per row).
   *   Each column = one hue family; each row = one shade level.
   *   Hue order: orange · salmon · tan · olive · green · teal · blue · periwinkle · pink · red
   */
  const BRAND_PALETTE = [
    /* ── Grayscale ── */
    '#131412', '#3C3C38', '#8B8B82', '#C4C4BC', '#EDECE8',
    /* ── Light tints (row 2) ── */
    '#FBCFC0', '#FBC8C8', '#F5E0C8', '#F0EAC4', '#BEECD8', '#B4F0E8', '#C0D8F8', '#D0CDF8', '#F4C4F0', '#F8C4B4',
    /* ── Medium-light (row 3) ── */
    '#F09378', '#F09090', '#CCAA82', '#D0CC7A', '#60D090', '#3EDCC8', '#6898E8', '#9898E8', '#DC80D8', '#E8887A',
    /* ── Saturated brand (row 4) ── */
    '#E03E0A', '#D45050', '#A0703C', '#9A920A', '#18A050', '#04A098', '#1858D8', '#5058C8', '#B030A8', '#CC3838',
    /* ── Dark shades (row 5) ── */
    '#8A1E00', '#883030', '#4E2800', '#3E380A', '#004820', '#004038', '#082038', '#14104C', '#4C0C48', '#4C0C10',
  ];

  function buildSwatches(gridId, pickerId, textId) {
    const grid   = el(gridId);
    const picker = el(pickerId);
    const text   = el(textId);

    function setColor(hex) {
      picker.value = hex;
      text.value   = hex.toUpperCase();
      grid.querySelectorAll('.swatch').forEach(s => s.classList.toggle('active', s.dataset.hex === hex.toLowerCase()));
      paint();
    }

    const NEUTRAL_COUNT = 5;
    BRAND_PALETTE.forEach((hex, idx) => {
      /* Insert a full-width gap after the neutral row */
      if (idx === NEUTRAL_COUNT) {
        const sep = document.createElement('div');
        sep.style.cssText = 'width:100%;height:4px;flex-shrink:0;';
        grid.appendChild(sep);
      }
      const s = document.createElement('div');
      s.className    = 'swatch';
      s.style.background = hex;
      s.dataset.hex  = hex.toLowerCase();
      s.title        = hex;
      if (hex.toLowerCase() === picker.value.toLowerCase()) s.classList.add('active');
      s.addEventListener('click', () => setColor(hex));
      grid.appendChild(s);
    });

    /* Keep active state in sync when user types a hex manually */
    picker.addEventListener('input', () => {
      grid.querySelectorAll('.swatch').forEach(s => s.classList.toggle('active', s.dataset.hex === picker.value.toLowerCase()));
    });
  }

  buildSwatches('bgSwatches', 'bgHex', 'bgText');
  buildSwatches('fgSwatches', 'fgHex', 'fgText');
  buildSwatches('segSwatches', 'segHex', 'segText');
  buildSwatches('nodeSwatches', 'nodeHex', 'nodeText');

  /* ── UI state persistence ── */
  const OG_STATE_KEY = 'og-nvidia-05-ui-v1';

  function saveUIState() {
    try {
      const state = { _canvasMode: canvasMode };
      document.querySelectorAll('.controls input, .controls select').forEach(inp => {
        if (!inp.id) return;
        state[inp.id] = inp.type === 'checkbox' ? inp.checked : inp.value;
      });
      localStorage.setItem(OG_STATE_KEY, JSON.stringify(state));
    } catch (_) {}
  }

  function restoreUIState() {
    try {
      const raw = localStorage.getItem(OG_STATE_KEY);
      if (!raw) return;
      const state = JSON.parse(raw);
      document.querySelectorAll('.controls input, .controls select').forEach(inp => {
        if (!inp.id || !(inp.id in state)) return;
        if (inp.type === 'checkbox') inp.checked = state[inp.id];
        else inp.value = state[inp.id];
      });
      /* Restore canvas size mode */
      if (state._canvasMode) {
        canvasMode = state._canvasMode;
        el('sizeOG').classList.toggle('primary',   canvasMode === 'og');
        el('size1080').classList.toggle('primary', canvasMode === '1080p');
        el('size4k').classList.toggle('primary',   canvasMode === '4k');
        applyCanvasMode();
      }
      /* Sync colour text fields with restored pickers */
      [['bgHex','bgText'],['fgHex','fgText'],['segHex','segText'],['nodeHex','nodeText']].forEach(([p, t]) => {
        const pk = el(p), tx = el(t);
        if (pk && tx) tx.value = pk.value.toUpperCase();
      });
      /* Show/hide seg & node sub-panels */
      el('segControls').style.display  = el('segEnabled').checked  ? '' : 'none';
      el('nodeControls').style.display = el('nodeEnabled').checked ? '' : 'none';
      /* Refresh swatch active classes */
      ['bg','fg','seg','node'].forEach(prefix => {
        const picker = el(prefix + 'Hex');
        const grid   = el(prefix + 'Swatches');
        if (!picker || !grid) return;
        grid.querySelectorAll('.swatch').forEach(s =>
          s.classList.toggle('active', s.dataset.hex === picker.value.toLowerCase())
        );
      });
    } catch (_) {}
  }

  /* ── size toggle buttons ── */
  function setSizeMode(mode) {
    canvasMode = mode;
    el('sizeOG').classList.toggle('primary', mode === 'og');
    el('size1080').classList.toggle('primary', mode === '1080p');
    el('size4k').classList.toggle('primary', mode === '4k');
    applyCanvasMode();
    paint();
    saveUIState();
  }
  el('sizeOG').addEventListener('click',   () => setSizeMode('og'));
  el('size1080').addEventListener('click', () => setSizeMode('1080p'));
  el('size4k').addEventListener('click',   () => setSizeMode('4k'));

  /* ── R key: randomize colors + form params ── */
  function paletteContrast(hex1, hex2) {
    function lum(hex) {
      const r = parseInt(hex.slice(1,3),16)/255;
      const g = parseInt(hex.slice(3,5),16)/255;
      const b = parseInt(hex.slice(5,7),16)/255;
      const lin = c => c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055,2.4);
      return 0.2126*lin(r) + 0.7152*lin(g) + 0.0722*lin(b);
    }
    const l1 = lum(hex1), l2 = lum(hex2);
    const hi = Math.max(l1,l2), lo = Math.min(l1,l2);
    return (hi+0.05)/(lo+0.05);
  }

  function randomize() {
    /* Pick a high-contrast bg+fg pair from the brand palette */
    const MIN_CONTRAST = 4.5;
    let bg, fg, attempts = 0;
    do {
      bg = BRAND_PALETTE[Math.floor(Math.random() * BRAND_PALETTE.length)];
      fg = BRAND_PALETTE[Math.floor(Math.random() * BRAND_PALETTE.length)];
      attempts++;
    } while (paletteContrast(bg, fg) < MIN_CONTRAST && attempts < 400);

    el('bgHex').value = bg;  el('bgText').value = bg.toUpperCase();
    el('fgHex').value = fg;  el('fgText').value = fg.toUpperCase();

    /* Randomize form params for the active preset */
    function rnd(id, lo, hi) { el(id).value = lo + Math.floor(Math.random() * (hi - lo + 1)); }

    if (activePreset === 'converge') {
      rnd('convergeBend', 0, 100);
    } else if (activePreset === 'parametric') {
      rnd('paramCurves',    2,  9);
      rnd('paramRecursion', 0, 70);
    } else if (activePreset === 'sphere') {
      rnd('sphereRings', 3, 16);
    } else if (activePreset === 'speed') {
      rnd('speedSpace',    0, 100);
      rnd('speedVelocity', 0, 100);
      rnd('speedColor',    0, 100);
      rnd('speedScale',   15,  85);
      rnd('speedPosition',15,  85);
      rnd('speedDither',   0,  60);
      rnd('speedPersp',    0,  80);
    } else if (activePreset === 'perspective') {
      rnd('perspDepth',    10, 90);
      rnd('perspAngle',     0, 100);
      rnd('perspPosition', 15,  85);
      rnd('perspShape',     0, 100);
    } else if (activePreset === 'gesture') {
      rnd('gestScale',    20,  80);
      rnd('gestAmp',      10,  90);
      rnd('gestWaves',    10,  90);
      rnd('gestDamp',     10,  80);
      rnd('gestSkew',     20,  80);
      rnd('gestRhythm',    0,  80);
      rnd('gestPos',      15,  85);
      rnd('gestFrag',      0,  50);
      rnd('gestHeight',   15,  85);
    } else if (activePreset === 'treemap') {
      rnd('tmComplexity', 20,  90);
      rnd('tmScale',       5,  75);
      rnd('tmColors',      0,  80);
      rnd('tmFill',        0,  70);
      rnd('tmRhythm',      0,  85);
      rnd('tmGravity',     0, 100);
    } else if (activePreset === 'soccer') {
      rnd('soccerSpin',    15,  85);
      rnd('soccerPatches',  0, 100);
    }

    updateLabels();
    paint();
    saveUIState();
  }

  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'r' || e.key === 'R') randomize();
  });

  /* Restore all slider/colour/checkbox state from the previous session.
     Called after swatches are built so active classes can be refreshed. */
  restoreUIState();
  updatePresetUI();  /* re-apply in case preset was changed by restore */

  const p0 = readParams();
  if (activePreset === "converge") {
    frameIndex = defaultConvergeFrame(p0);
  } else if (activePreset === "wind") {
    frameIndex = 0;
  } else {
    frameIndex = 0;
  }

  updateLabels();
  paint();
})();
