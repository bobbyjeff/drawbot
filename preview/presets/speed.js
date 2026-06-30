import {
  H, VIEW_SCALE, LEFT_X, RIGHT_X, START_YS, N, CY,
  lerp, clamp, fillBackground,
  mulberry32, makeSegs, applySegs, makeNodes, applyNodes, segNow,
} from '../og-shared.js';

export function create(ctx) {
  const sv = VIEW_SCALE;

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

  function render(fi, p) {
    fillBackground(ctx, p);

    const spaceVal    = parseInt(document.getElementById("speedSpace").value,    10) / 100;
    const velVal      = parseInt(document.getElementById("speedVelocity").value, 10) / 100;
    const colorVal    = parseInt(document.getElementById("speedColor").value,    10) / 100;
    const scaleVal    = parseInt(document.getElementById("speedScale").value,    10) / 100;
    const posVal      = parseInt(document.getElementById("speedPosition").value, 10) / 100;
    const ditherVal   = parseInt(document.getElementById("speedDither").value,   10) / 100;
    const perspVal    = parseInt(document.getElementById("speedPersp").value,    10) / 100;

    const margin = lerp(RIGHT_X * 0.35, -RIGHT_X * 0.15, scaleVal);
    const posOffset = (posVal - 0.5) * RIGHT_X * 0.8;
    const LINE_LEFT  = margin + posOffset;
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

      const lineLeft  = LINE_LEFT + tailOffset;
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
        const gr = parseInt(p.strokeColor.slice(1, 3), 16);
        const gg = parseInt(p.strokeColor.slice(3, 5), 16);
        const gb = parseInt(p.strokeColor.slice(5, 7), 16);
        const cr = parseInt(p.segColor.slice(1, 3), 16);
        const cg = parseInt(p.segColor.slice(3, 5), 16);
        const cb = parseInt(p.segColor.slice(5, 7), 16);

        for (const cs of COLOR_SEGS[i]) {
          const seeded = (cs.phase * 1000) % 1;
          if (seeded > colorVal) continue;
          const animated = ((cs.xNorm + (gp + cs.phase) * cs.drift) % 1 + 1) % 1;
          const cx = LINE_LEFT + animated * SPAN;
          const w  = cs.baseWidth * lerp(0.5, 1.5, colorVal);
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
}
