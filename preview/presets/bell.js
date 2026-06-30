import {
  H, VIEW_SCALE, LEFT_X, RIGHT_X, START_YS,
  lerp, clamp, fillBackground,
  subdivideBezierLeft, subdivideBezierRight,
  mulberry32, applyNodes, bezierPoint, segNow,
} from '../og-shared.js';

/*
 * Bell curve geometry — two cubic bezier segments per line, C1-continuous at apex.
 *
 *  α  = fraction of each half-span that stays perfectly flat (horizontal tangent)
 *  β  = fraction at which the curve reaches apex height (β > α)
 *
 * All lines use the SAME lift, so spacing between lines is identical at every
 * x-position — the curves are parallel throughout.
 *
 * Line base positions are computed so the topmost arch always peaks at the same
 * margin from the top canvas edge as the bottom line sits from the bottom edge.
 */
const BELL_ALPHA  = 0.76;   // flat section ends here
const BELL_BETA   = 0.772;  // dome = 22.8% of half-span, rise zone = 1.2%
const N_BELL      = 12;    // number of lines

export function create(ctx) {
  const sv = VIEW_SCALE;

  const rng = mulberry32(0xBE117C);
  const LINE_SEGS = Array.from({ length: N_BELL }, () => {
    const count = 2 + Math.floor(rng() * 3);
    return Array.from({ length: count }, () => ({
      pos:   rng(),
      width: [0.03, 0.08, 0.18][Math.floor(rng() * 3)] + rng() * 0.04,
      drift: (0.2 + rng() * 0.8) * (rng() > 0.5 ? 1 : -1),
      phase: rng(),
    }));
  });

  const NODE_DESCS = Array.from({ length: N_BELL }, (_, i) => {
    const nr = mulberry32(0xCAFE0000 + i * 37);
    return Array.from({ length: 8 }, () => ({
      pos:   nr(),
      drift: (0.3 + nr() * 0.7) * (nr() > 0.5 ? 1 : -1),
      phase: nr(),
    }));
  });

  function drawBez(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, t0, t1, color, lw) {
    if (t1 <= t0) return;
    let sub;
    if (t0 <= 0 && t1 >= 1) {
      sub = { x0: p0x, y0: p0y, x1: p1x, y1: p1y, x2: p2x, y2: p2y, x3: p3x, y3: p3y };
    } else if (t0 <= 0) {
      sub = subdivideBezierLeft(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, t1);
    } else if (t1 >= 1) {
      sub = subdivideBezierRight(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, t0);
    } else {
      const r      = subdivideBezierRight(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, t0);
      const tRemap = (t1 - t0) / (1 - t0);
      sub = subdivideBezierLeft(r.x0, r.y0, r.x1, r.y1, r.x2, r.y2, r.x3, r.y3, tRemap);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth   = lw;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(sub.x0, sub.y0);
    ctx.bezierCurveTo(sub.x1, sub.y1, sub.x2, sub.y2, sub.x3, sub.y3);
    ctx.stroke();
  }

  function render(fi, p) {
    fillBackground(ctx, p);

    const lift = parseInt(document.getElementById('bellHeight').value, 10) * sv;

    /*
     * Line base positions — evenly spaced between topLineY and bottomY.
     *
     * bottomY       = natural position of the lowest START_YS line (canvas px)
     * bottomMargin  = gap from bottomY to the canvas bottom edge
     * topLineY      = bottomMargin + lift  →  its arch peaks at exactly bottomMargin
     *                 from the top, giving symmetric top/bottom margins.
     *
     * Every line uses the same lift, so arch height is identical across all
     * lines → spacing between curves is uniform throughout.
     */
    const bottomMargin = 20 * sv;          // margin at top and bottom (canvas px)
    const bottomY      = H - bottomMargin;
    const topLineY     = bottomMargin + lift;

    const apx      = (RIGHT_X / 2) * sv;
    const endX     = RIGHT_X * sv;
    const halfSpan = endX - apx;

    const sizeScale  = lerp(0.1, 2.0, p.segSize);
    const speedScale = lerp(0.1, 2.0, p.segSpeed);
    const densCount  = Math.max(1, Math.round(N_BELL * clamp(lerp(0.15, 1, p.segDensity), 0, 1)));
    const segT       = segNow(p);
    const cr = parseInt(p.segColor.slice(1, 3), 16);
    const cg = parseInt(p.segColor.slice(3, 5), 16);
    const cb = parseInt(p.segColor.slice(5, 7), 16);
    const segColorStr = `rgb(${cr},${cg},${cb})`;

    for (let i = 0; i < N_BELL; i++) {
      const sy  = lerp(topLineY, bottomY, i / (N_BELL - 1));
      const apy = sy - lift;

      if (apy < 5 * sv) continue;   // skip if apex would clip above canvas

      // Segment 1: left edge → apex
      const s1p0x = LEFT_X * sv,           s1p0y = sy;
      const s1p1x = apx * BELL_ALPHA,       s1p1y = sy;
      const s1p2x = apx * BELL_BETA,        s1p2y = apy;
      const s1p3x = apx,                    s1p3y = apy;

      // Segment 2: apex → right edge (mirror of seg 1)
      const s2p0x = apx,                             s2p0y = apy;
      const s2p1x = apx + halfSpan * (1 - BELL_BETA), s2p1y = apy;
      const s2p2x = apx + halfSpan * (1 - BELL_ALPHA),s2p2y = sy;
      const s2p3x = endX,                             s2p3y = sy;

      drawBez(s1p0x, s1p0y, s1p1x, s1p1y, s1p2x, s1p2y, s1p3x, s1p3y, 0, 1, p.strokeColor, p.strokeW);
      drawBez(s2p0x, s2p0y, s2p1x, s2p1y, s2p2x, s2p2y, s2p3x, s2p3y, 0, 1, p.strokeColor, p.strokeW);

      if (p.segEnabled && i < densCount) {
        const segs  = LINE_SEGS[i];
        const count = Math.max(1, Math.round(segs.length * clamp(lerp(0.15, 1, p.segDensity), 0.01, 1)));

        for (let j = 0; j < count; j++) {
          const cs  = segs[j];
          const pos = ((cs.pos + (segT + cs.phase) * cs.drift * speedScale) % 1 + 1) % 1;
          const hw  = cs.width * sizeScale * 0.5;
          const s0  = pos - hw;
          const s1e = pos + hw;

          if (s0 < 0) {
            if (1 + s0 < 1) drawBez(s2p0x, s2p0y, s2p1x, s2p1y, s2p2x, s2p2y, s2p3x, s2p3y, 1 + s0, 1,    segColorStr, p.strokeW);
            if (s1e > 0)    drawBez(s2p0x, s2p0y, s2p1x, s2p1y, s2p2x, s2p2y, s2p3x, s2p3y, 0,      s1e,  segColorStr, p.strokeW);
          } else if (s1e > 1) {
            drawBez(s2p0x, s2p0y, s2p1x, s2p1y, s2p2x, s2p2y, s2p3x, s2p3y, s0,  1,      segColorStr, p.strokeW);
            drawBez(s2p0x, s2p0y, s2p1x, s2p1y, s2p2x, s2p2y, s2p3x, s2p3y, 0,   s1e-1, segColorStr, p.strokeW);
          } else {
            drawBez(s2p0x, s2p0y, s2p1x, s2p1y, s2p2x, s2p2y, s2p3x, s2p3y, s0,  s1e,   segColorStr, p.strokeW);
          }
        }
      }

      if (p.nodeEnabled) {
        ctx.fillStyle = p.nodeColor;
        applyNodes(NODE_DESCS[i], p, (pos) => {
          const pt = bezierPoint(s2p0x, s2p0y, s2p1x, s2p1y, s2p2x, s2p2y, s2p3x, s2p3y, pos);
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, p.strokeW * 2, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    }
  }

  return { render };
}
