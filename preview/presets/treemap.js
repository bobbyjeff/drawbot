import {
  W, H, VIEW_SCALE,
  lerp, clamp, fillBackground,
  mulberry32,
} from '../og-shared.js';

export function create(ctx) {
  let _cache = null;
  const TM_MARGIN = 40 * VIEW_SCALE;

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

  const BRAND_SAT = [
    '#E03E0A','#D45050','#A0703C','#9A920A','#18A050',
    '#04A098','#1858D8','#5058C8','#B030A8','#CC3838',
  ];

  function pickAccent(bgHex, fgHex) {
    let best = BRAND_SAT[0], bestScore = -1;
    for (const c of BRAND_SAT) {
      const score = rgbDist(c, bgHex) + rgbDist(c, fgHex);
      if (score > bestScore) { bestScore = score; best = c; }
    }
    return best;
  }

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

  const PHI = 0.6180339887;

  function buildRects(maxDepth, minW, minH, rhythmVal, complexityVal, gravityVal) {
    const IW = W - 2 * TM_MARGIN;
    const IH = H - 2 * TM_MARGIN;
    const MAX_RECTS = 12000;
    const rng = mulberry32(0x1A2B3C4D);
    const result = [];

    function split(x, y, w, h, depth) {
      if (result.length >= MAX_RECTS) {
        result.push({ x, y, w, h, depth, fillRand: rng(), colorRand: rng() });
        return;
      }
      const nx   = (x + w * 0.5) / IW;
      const ny   = (y + h * 0.5) / IH;
      const dx   = nx - gravityVal;
      const dy   = (1 - ny) - gravityVal;
      const diagFlow    = clamp(Math.sqrt(dx * dx + dy * dy) / Math.SQRT2, 0, 1);
      const depthBudget = Math.max(1, Math.floor(maxDepth * diagFlow * diagFlow));

      const tooSmall   = w < minW * 2 && h < minH * 2;
      const atMax      = depth >= maxDepth;
      const overBudget = depth >= depthBudget;
      const stopChance = depth > 0 ? clamp(0.035 * depth * (1 - complexityVal * 0.72), 0, 0.40) : 0;
      const stopEarly  = rng() < stopChance;

      if (atMax || tooSmall || overBudget || stopEarly) {
        result.push({ x, y, w, h, depth, fillRand: rng(), colorRand: rng() });
        return;
      }

      const splitAlongWidth = (w / Math.max(minW, 1)) >= (h / Math.max(minH, 1));
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

    fillBackground(ctx, p);

    const complexityVal = parseInt(document.getElementById("tmComplexity").value, 10) / 100;
    const scaleVal      = parseInt(document.getElementById("tmScale").value,      10) / 100;
    const colorVal      = parseInt(document.getElementById("tmColors").value,     10) / 100;
    const fillVal       = parseInt(document.getElementById("tmFill").value,       10) / 100;
    const rhythmVal     = parseInt(document.getElementById("tmRhythm").value,     10) / 100;
    const gravityVal    = parseInt(document.getElementById("tmGravity").value,    10) / 100;

    const maxDepth      = Math.max(1, Math.round(2 + 16 * complexityVal));
    const complexFactor = Math.pow(10, 2 * complexityVal);
    const scaleFactor   = lerp(1, 10, scaleVal);
    const minW          = Math.max(2, 600 / (complexFactor * scaleFactor));
    const minH          = Math.max(1, minW * (IH / IW));

    const rects   = getRects(maxDepth, minW, minH, rhythmVal, complexityVal, gravityVal);
    const palette = buildPalette(p.bg, p.strokeColor, colorVal);

    const tot = p.emergeFr;
    const gp  = ((fi % tot) + tot) % tot / tot;
    const cosT     = 0.5 + 0.5 * Math.cos(2 * Math.PI * gp);
    const scatterT = cosT * cosT * cosT;

    for (const r of rects) {
      if (r.fillRand >= fillVal) continue;
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
      ctx.fillStyle = palette[Math.floor(r.colorRand * palette.length) % palette.length];
      ctx.fillRect(TM_MARGIN + r.x + offX, TM_MARGIN + r.y + offY, r.w, r.h);
    }

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
}
