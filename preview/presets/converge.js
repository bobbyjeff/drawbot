import {
  W, H, VIEW_SCALE, LEFT_X, RIGHT_X, START_YS, N, CY, CONVERGE_X,
  lerp, clamp, fillBackground,
  subdivideBezierLeft, subdivideBezierRight,
  mulberry32, makeSegs, applySegs, makeNodes, applyNodes, bezierPoint, segNow,
} from '../og-shared.js';

export function create(ctx) {
  const sv = VIEW_SCALE;
  const CURVE_SPAN = CONVERGE_X - LEFT_X;

  const LINES = START_YS.map((sy) => ({
    sy,
    c1x: LEFT_X + CURVE_SPAN * 0.75, c1y: sy,
    c2x: LEFT_X + CURVE_SPAN * 0.95, c2y: CY,
  }));

  const MAX_DIST = Math.max(...START_YS.map(sy => Math.abs(sy - CY)));
  const lineMeta = START_YS.map(sy => ({ normDist: Math.abs(sy - CY) / MAX_DIST }));

  function drawLineSegment(line, tStart, tEnd, strokeColor, lineWidth, convX, convY) {
    if (tEnd <= tStart) return;
    const p0x = LEFT_X * sv, p0y = line.sy * sv;
    const p1x = line.c1x * sv, p1y = line.c1y * sv;
    const p2x = line.c2x * sv, p2y = line.c2y * sv;
    const p3x = (convX !== undefined ? convX : CONVERGE_X) * sv;
    const p3y = (convY !== undefined ? convY : CY) * sv;

    let sub;
    if (tStart <= 0 && tEnd >= 1) {
      sub = { x0: p0x, y0: p0y, x1: p1x, y1: p1y, x2: p2x, y2: p2y, x3: p3x, y3: p3y };
    } else if (tStart <= 0) {
      sub = subdivideBezierLeft(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, tEnd);
    } else if (tEnd >= 1) {
      sub = subdivideBezierRight(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, tStart);
    } else {
      const r = subdivideBezierRight(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, tStart);
      const tRemap = (tEnd - tStart) / (1 - tStart);
      sub = subdivideBezierLeft(r.x0, r.y0, r.x1, r.y1, r.x2, r.y2, r.x3, r.y3, tRemap);
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
    fillBackground(ctx, p);

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
            return { s0: clamp(pos - hw, 0, COLOR_ZONE), s1: clamp(pos + hw, 0, COLOR_ZONE) };
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

    if (p.nodeEnabled) {
      ctx.fillStyle = p.nodeColor;
      for (let i = 0; i < N; i++) {
        const line = BENT_LINES[i];
        const p0x = LEFT_X * sv, p0y = line.sy * sv;
        const p1x = line.c1x * sv, p1y = line.c1y * sv;
        const p2x = line.c2x * sv, p2y = line.c2y * sv;
        const p3x = bentConvergeX * sv, p3y = bentConvergeY * sv;
        applyNodes(CONVERGE_NODE_DESCS[i], p, (pos) => {
          const pt = bezierPoint(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, pos);
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, p.strokeW * 2, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    }
  }

  return { render };
}
