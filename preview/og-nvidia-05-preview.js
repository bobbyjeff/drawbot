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

    function drawLineSegment(line, tStart, tEnd, strokeColor, lineWidth) {
      if (tEnd <= tStart) return;
      const s = VIEW_SCALE;
      const p0x = LEFT_X*s, p0y = line.sy*s;
      const p1x = line.c1x*s, p1y = line.c1y*s;
      const p2x = line.c2x*s, p2y = line.c2y*s;
      const p3x = CONVERGE_X*s, p3y = CY*s;

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

      const tot = p.emergeFr;
      const t = ((fi % tot) + tot) % tot;
      const gp = t / tot;

      for (let i = 0; i < N; i++) {
        const line = LINES[i];
        drawLineSegment(line, 0, 1, p.strokeColor, p.strokeW);

        const colorSegs = COLOR_SEGS[i]
          .map(cs => {
            const pos = (cs.pos + (gp + cs.phase) * cs.drift) % COLOR_ZONE;
            return {
              s0: clamp(pos - cs.width / 2, 0, COLOR_ZONE),
              s1: clamp(pos + cs.width / 2, 0, COLOR_ZONE),
            };
          })
          .filter(c => c.s1 > c.s0)
          .sort((a, b) => a.s0 - b.s0);

        const MIN_GAP = 0.04;
        const gr = parseInt(p.strokeColor.slice(1,3),16);
        const gg = parseInt(p.strokeColor.slice(3,5),16);
        const gb = parseInt(p.strokeColor.slice(5,7),16);

        for (let ci = 0; ci < colorSegs.length; ci++) {
          const cs = colorSegs[ci];
          const prev = ci > 0 ? colorSegs[ci - 1] : null;
          if (prev && cs.s0 < prev.s1 + MIN_GAP) continue;

          const cr = parseInt(p.segColor.slice(1,3),16);
          const cg = parseInt(p.segColor.slice(3,5),16);
          const cb = parseInt(p.segColor.slice(5,7),16);

          const mid = (cs.s0 + cs.s1) / 2;
          const fadeBlend = cs.s1 > COLOR_FADE_START
            ? clamp((mid - COLOR_FADE_START) / (COLOR_ZONE - COLOR_FADE_START), 0, 1)
            : 0;

          const br = Math.round(lerp(cr, gr, fadeBlend));
          const bg2 = Math.round(lerp(cg, gg, fadeBlend));
          const bb = Math.round(lerp(cb, gb, fadeBlend));

          drawLineSegment(line, cs.s0, cs.s1, `rgb(${br},${bg2},${bb})`, p.strokeW);
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

      for (let r = 0; r < ringCount; r++) {
        const rawT = (r + animShift) / ringCount;
        const t2 = 1 - (Math.exp(expK * (1 - rawT)) - 1) / expDenom;

        const hw = lerp(outerHW, outerHW * minScale, t2);
        const hh = lerp(outerHH, outerHH * minScale, t2);
        const cx = lerp(VW / 2, vpX, t2);
        const cy = lerp(VH / 2, vpY, t2);

        const cornerR = Math.min(maxRadius, hw, hh) * (1 - t2 * 0.3);

        const lw = p.strokeW / sv;
        drawRoundedRect(cx, cy, hw, hh, cornerR, p.strokeColor, lw);
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

    function smoothstep(lo, hi, x) {
      const t = clamp((x - lo) / (hi - lo), 0, 1);
      return t * t * (3 - 2 * t);
    }

    function render(fi, p) {
      void fi;
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
    }

    return { render };
  })();

  /* ══════════════════════════════════════════
     PLANES — reference: images/public/planes.svg
     Each plane moves LEFT → RIGHT across the canvas.
     It enters as a wide X-shape from the left, narrows to a single vertical line
     as it passes canvas center (straight-on view), then widens again exiting right.
     Six planes staggered so the composition always looks like the SVG.
     ══════════════════════════════════════════ */
  const planes = (function () {
    const sv   = VIEW_SCALE;
    const VH   = H / VIEW_SCALE;

    /* Scale SVG viewBox (1803.43 × 948.28) → canvas (1200 × 630) */
    const SVG_W  = 1803.43;
    const SVG_H  = 948.28;
    const scaleX = RIGHT_X / SVG_W;           /* 0.6654 */
    const scaleY = VH      / SVG_H;           /* 0.6644 */

    const TOP    = 2.19  * scaleY;            /* 1.45 px — SVG top margin */
    const BOT    = 946.12 * scaleY;           /* 628.6 px — SVG bottom margin */
    const CX     = 901.71 * scaleX;           /* 599.7 ≈ 600 — canvas center */

    /*
     * MAX_HW: the widest X-shape spans from x≈1 to x≈1802 in SVG.
     * Half-width = 900.715 * scaleX ≈ 599 — almost exactly CX.
     */
    const MAX_HW     = 900.715 * scaleX;
    const NUM_PLANES = 6;

    /*
     * Each plane travels left→right. Its crossing-point x moves over TRAVEL pixels.
     * TRAVEL = 2·CX so:
     *   t=0  → xCross=0    (entering left, right vert at CX, left vert off-screen)
     *   t=0.5 → xCross=CX  (straight-on, appears as vertical line at canvas center)
     *   t=1  → xCross=1200 (exiting right, left vert at CX, right vert off-screen)
     */
    const TRAVEL = 2 * CX;

    function render(fi, p) {
      ctx.fillStyle = p.bg;
      ctx.fillRect(0, 0, W, H);

      const tot = p.emergeFr;
      const t   = ((fi % tot) + tot) % tot;
      const gp  = t / tot;

      ctx.strokeStyle = p.strokeColor;
      ctx.lineWidth   = p.strokeW;
      ctx.lineCap     = "round";
      ctx.lineJoin    = "round";

      const ty = TOP * sv;
      const by = BOT * sv;

      for (let i = 0; i < NUM_PLANES; i++) {
        const phase  = (gp + i / NUM_PLANES) % 1;

        /* hw: MAX at phase=0 (entering left), 0 at phase=0.5 (straight-on), MAX at phase=1 */
        const hw     = Math.abs(Math.cos(phase * Math.PI)) * MAX_HW;

        /* xCross: crossing point moves from 0 → TRAVEL across the canvas */
        const xCross = phase * TRAVEL;

        const lx = (xCross - hw) * sv;
        const rx = (xCross + hw) * sv;

        ctx.beginPath();
        if (hw < 1) {
          ctx.moveTo(xCross * sv, ty);
          ctx.lineTo(xCross * sv, by);
        } else {
          /* SVG path structure: RX,BOT → RX,TOP → LX,BOT → LX,TOP → RX,BOT */
          ctx.moveTo(rx, by);
          ctx.lineTo(rx, ty);
          ctx.lineTo(lx, by);
          ctx.lineTo(lx, ty);
          ctx.lineTo(rx, by);
        }
        ctx.stroke();
      }
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
    const T    = 900;   /* slightly slower; visual loop ≈ T/12 = 75 frames */

    function render(fi, p) {
      /* N_A driven by the Curves slider: visible total = N_A + N_B = N_A + 1 */
      const N_A = Math.max(1, parseInt(document.getElementById('paramCurves')?.value ?? '3', 10) - 1);

      ctx.fillStyle = p.bg;
      ctx.fillRect(0, 0, W, H);

      const δ = (fi % T) / T * Math.PI * 2;

      ctx.strokeStyle = p.strokeColor;
      ctx.lineWidth   = p.strokeW;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      ctx.globalAlpha = 1;
      ctx.setLineDash([DASH, GAP]);

      /* Family A: x-phase varied, y-phase fixed */
      for (let k = 0; k < N_A; k++) {
        const φ = k * Math.PI * 2 / N_A;
        ctx.beginPath();
        for (let j = 0; j <= SEGS; j++) {
          const t  = j / SEGS * Math.PI * 2;
          const sx = (CX + Rx * Math.sin(B * t + δ + φ)) * sv;
          const sy = (CY - Ry * Math.sin(A * t)) * sv;
          j === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      }

      /* Family B: y-phase varied, x-phase fixed */
      for (let k = 0; k < N_B; k++) {
        const ψ = k * Math.PI * 2 / N_B;
        ctx.beginPath();
        for (let j = 0; j <= SEGS; j++) {
          const t  = j / SEGS * Math.PI * 2;
          const sx = (CX + Rx * Math.sin(B * t + δ)) * sv;
          const sy = (CY - Ry * Math.sin(A * t + ψ)) * sv;
          j === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      }

      ctx.setLineDash([]);
    }

    return { render };
  })();


  const presets = { converge, speed, perspective, gesture, wind, planes, sphere, parametric };

  function readParams() {
    const el = id => document.getElementById(id);
    return {
      bg: el("bgHex").value,
      strokeColor: el("fgHex").value,
      segColor: el("segHex").value,
      strokeW: parseFloat(el("strokeW").value) * VIEW_SCALE,
      fps: parseInt(el("fps").value, 10),
      emergeFr: parseInt(el("emergeFr").value, 10),
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

  const el = id => document.getElementById(id);

  function updateLabels() {
    const p = readParams();
    el("vStrokeW").textContent = (p.strokeW / VIEW_SCALE).toFixed(0);
    el("vFps").textContent = String(p.fps);
    el("vEmergeFr").textContent = String(p.emergeFr);
    const maxFi = Math.max(0, totalFrames(p) - 1);
    el("scrub").max = String(maxFi);
    if (frameIndex > maxFi) frameIndex = maxFi;

    if (document.getElementById("sphereRings")) {
      el("vSphereRings").textContent = el("sphereRings").value;
    }
    if (document.getElementById("paramCurves")) {
      const curves = parseInt(el("paramCurves").value, 10);
      el("vParamCurves").textContent = String(curves);
      /* Auto-sync frames to T/N_A for a seamless loop */
      const N_A_current = curves - 1;
      const T_param = 900;
      const loopFrames = Math.round(T_param / N_A_current);
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
  }

  function updatePresetUI() {
    document.getElementById("speedControls").style.display        = activePreset === "speed"        ? "" : "none";
    document.getElementById("perspectiveControls").style.display  = activePreset === "perspective"  ? "" : "none";
    document.getElementById("gestureControls").style.display      = activePreset === "gesture"      ? "" : "none";
    document.getElementById("parametricControls").style.display   = activePreset === "parametric"   ? "" : "none";
    document.getElementById("sphereControls").style.display       = activePreset === "sphere"       ? "" : "none";
  }

  function paint() {
    const p = readParams();
    renderFrame(frameIndex, p);
    const tot = totalFrames(p);
    el("scrub").value = String(frameIndex % tot);
    el("frameLabel").textContent = `${frameIndex % tot} / ${tot - 1}`;
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
      paint();
    }
    raf = requestAnimationFrame(tick);
  }

  function setPlaying(val) {
    playing = val;
    el("playToggle").innerHTML = playing ? '&#9646;&#9646;' : '&#9654;';
    if (playing) { lastT = performance.now(); raf = requestAnimationFrame(tick); }
    else if (raf) cancelAnimationFrame(raf);
  }

  el("playToggle").addEventListener("click", () => setPlaying(!playing));

  el("scrub").addEventListener("input", () => {
    frameIndex = parseInt(el("scrub").value, 10);
    paint();
  });

  document.querySelectorAll(".controls input").forEach(inp => {
    inp.addEventListener("input", () => { updateLabels(); paint(); });
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
      renderFrame(i, p);
      gif.addFrame(ctx, { copy: true, delay: Math.round(1000 / p.fps) });
    }

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
      renderFrame(i, p);
      stream.getVideoTracks()[0].requestFrame();
      await new Promise(r => setTimeout(r, Math.round(1000 / p.fps)));
      exportPct(status, Math.round((i + 1) / tot * 100));
    }

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
    parametric: { bg: '#2D2D2B', fg: '#F44E00', frames: 450  },  /* T/N_A = 900/2 = 450 */
    sphere:     { bg: '#2D2D2B', fg: '#CCA78C', frames: 135  },  /* CYCLE_FRAMES/2 = 135 = half rotation (sphere is symmetric at 180°) */
  };

  function applyPresetColors(presetName) {
    const d = PRESET_DEFAULTS[presetName];
    if (!d) return;
    el('bgHex').value  = d.bg;  el('bgText').value  = d.bg.toUpperCase();
    el('fgHex').value  = d.fg;  el('fgText').value  = d.fg.toUpperCase();
    if (d.frames) {
      el('emergeFr').value = d.frames;
      updateLabels();
    }
  }

  el("preset").addEventListener("change", () => {
    activePreset = el("preset").value;
    try {
      localStorage.setItem(OG_PRESET_STORAGE_KEY, activePreset);
    } catch (_) {}
    applyPresetColors(activePreset);
    updatePresetUI();
    if (activePreset === "converge") {
      frameIndex = defaultConvergeFrame(readParams());
    } else if (activePreset === "wind") {
      frameIndex = 0;
    }
    paint();
  });

  [["bgHex","bgText"], ["fgHex","fgText"], ["segHex","segText"]].forEach(([pickerId, textId]) => {
    const picker = document.getElementById(pickerId);
    const text = document.getElementById(textId);
    picker.addEventListener("input", () => { text.value = picker.value.toUpperCase(); paint(); });
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
  applyPresetColors(activePreset);  /* set colors for default preset */
  applyCanvasMode();                /* apply default 1080p canvas size on load */

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

  /* ── size toggle buttons ── */
  function setSizeMode(mode) {
    canvasMode = mode;
    el('sizeOG').classList.toggle('primary', mode === 'og');
    el('size1080').classList.toggle('primary', mode === '1080p');
    el('size4k').classList.toggle('primary', mode === '4k');
    applyCanvasMode();
    paint();
  }
  el('sizeOG').addEventListener('click',   () => setSizeMode('og'));
  el('size1080').addEventListener('click', () => setSizeMode('1080p'));
  el('size4k').addEventListener('click',   () => setSizeMode('4k'));

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
