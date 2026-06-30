import {
  VIEW_SCALE, RIGHT_X, START_YS, N, CY,
  lerp, clamp, fillBackground,
  mulberry32, makeNodes, applyNodes, segNow,
} from '../og-shared.js';

export function create(ctx) {
  const sv = VIEW_SCALE;
  const VW = RIGHT_X;

  const SANKEY_LOOP_BASE  = 1.0;
  const MAX_DIST_SK       = Math.max(...START_YS.map(sy => Math.abs(sy - CY)));
  const SANKEY_NORM_DIST  = START_YS.map(sy => Math.abs(sy - CY) / MAX_DIST_SK);

  const SANKEY_SEG_DESCS = Array.from({ length: N }, (_, i) => {
    const rng = mulberry32(0xCAFE0000 + i * 37);
    const nd  = SANKEY_NORM_DIST[i];
    const count = nd > 0.5 ? 2 : 1;
    return Array.from({ length: count }, () => {
      const mult = 1 + Math.floor(rng() * 2);
      return {
        pos:   rng(),
        width: lerp(0.02, lerp(0.05, 0.14, nd), rng()),
        drift: SANKEY_LOOP_BASE * mult,
        phase: rng(),
      };
    });
  });

  const SANKEY_NODE_DESCS = Array.from({ length: N }, (_, i) => makeNodes(0xB00B0000 + i * 41, 6));

  function readSliders() {
    const g = id => parseInt(document.getElementById(id).value, 10) / 100;
    return {
      bundle:    g('sankeyBundle'),
      center:    g('sankeyCenter'),
      width:     g('sankeyWidth'),
      gateColor: document.getElementById('sankeyGateColor').value,
    };
  }

  function ss(u) { return u * u * u * (u * (u * 6 - 15) + 10); }

  function makeDesc(sy, cy, x0, x1) { return { sy, cy, x0, x1 }; }

  function samplePath(d, t) {
    t = clamp(t, 0, 1);
    const x = t * VW;
    let y;
    if      (x <= d.x0) { y = d.sy; }
    else if (x <= d.x1) { y = lerp(d.sy, d.cy, ss((x - d.x0) / (d.x1 - d.x0))); }
    else                 { y = d.cy; }
    return { x, y };
  }

  function drawSpan(d, t0, t1, color, lw) {
    if (t1 <= t0) return;
    const STEPS = 96;
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i <= STEPS; i++) {
      const pt = samplePath(d, lerp(t0, t1, i / STEPS));
      if (i === 0) ctx.moveTo(pt.x * sv, pt.y * sv);
      else         ctx.lineTo(pt.x * sv, pt.y * sv);
    }
    ctx.stroke();
  }

  function cpEase(pos, et1, et2) {
    const zone = 0.07;
    let p = pos;
    for (const cp of [et1, et2]) {
      const d = p - cp, ad = Math.abs(d);
      if (ad < zone) {
        const u = ad / zone;
        p = cp + Math.sign(d) * u * u * u * u * u * zone;
      }
    }
    return p;
  }

  function render(fi, p) {
    fillBackground(ctx, p);

    const s  = readSliders();
    const lw = p.strokeW;

    const cxZone = VW * clamp(s.center, 0.1, 0.9);
    const halfSp = lerp(0.12, 0.38, s.width) * VW;
    const x0 = clamp(cxZone - halfSp, VW * 0.02, VW * 0.60);
    const x1 = clamp(cxZone + halfSp, VW * 0.15, VW * 0.97);

    const easeT1 = x0 / VW;
    const easeT2 = x1 / VW;

    const descs = START_YS.map(sy => {
      const cy = lerp(CY, sy, clamp(s.bundle, 0.02, 1));
      return makeDesc(sy, cy, x0, x1);
    });

    const cp1x = x0;
    const cp2x = x1;

    function hexCh(hex, o) { return parseInt(hex.slice(o, o+2), 16); }
    const bgR=hexCh(p.bg,1), bgG=hexCh(p.bg,3), bgB=hexCh(p.bg,5);
    const fgR=hexCh(p.strokeColor,1), fgG=hexCh(p.strokeColor,3), fgB=hexCh(p.strokeColor,5);
    const sgR=hexCh(p.segColor,1), sgG=hexCh(p.segColor,3), sgB=hexCh(p.segColor,5);

    const ga = 0.30;
    const ghost = `rgb(${Math.round(lerp(bgR,fgR,ga))},${Math.round(lerp(bgG,fgG,ga))},${Math.round(lerp(bgB,fgB,ga))})`;
    for (let i = 0; i < N; i++) drawSpan(descs[i], 0, 1, ghost, lw);

    const gcHex = s.gateColor;
    const gcR = parseInt(gcHex.slice(1,3),16);
    const gcG = parseInt(gcHex.slice(3,5),16);
    const gcB = parseInt(gcHex.slice(5,7),16);
    ctx.save();
    ctx.setLineDash([6*sv, 5*sv]);
    ctx.strokeStyle = `rgba(${gcR},${gcG},${gcB},0.65)`;
    ctx.lineWidth = 1.5*sv; ctx.lineCap = 'butt';
    for (const gx of [cp1x, cp2x]) {
      ctx.beginPath();
      ctx.moveTo(gx*sv, Math.min(...START_YS)*sv*0.5);
      ctx.lineTo(gx*sv, Math.max(...START_YS)*sv*1.05);
      ctx.stroke();
    }
    ctx.setLineDash([]); ctx.restore();

    if (p.segEnabled) {
      const segT    = segNow(p);
      const speedSc = lerp(0.2, 1.8, p.segSpeed);
      const sizeSc  = lerp(0.1, 2.0, p.segSize);
      const segsPerLineFrac = clamp(p.segDensity * 2, 0.15, 1.0);
      const segCol  = `rgb(${sgR},${sgG},${sgB})`;
      for (let i = 0; i < N; i++) {
        const d = descs[i];
        const allSegs = SANKEY_SEG_DESCS[i];
        const nShow   = Math.max(1, Math.round(allSegs.length * segsPerLineFrac));
        for (let j = 0; j < nShow; j++) {
          const cs = allSegs[j];
          const snapDrift = Math.max(1, Math.round(cs.drift * speedSc));
          const raw = (cs.pos + (segT + cs.phase) * snapDrift) % 1;
          const pos = cpEase(raw, easeT1, easeT2);
          const hw  = cs.width * sizeSc * 0.5;
          const s0  = clamp(pos - hw, 0, 1);
          const s1  = clamp(pos + hw, 0, 1);
          if (s1 > s0) drawSpan(d, s0, s1, segCol, lw);
        }
      }
    }

    if (p.nodeEnabled) {
      ctx.fillStyle = p.nodeColor;
      const nodeSz = Math.max(p.strokeW*1.4, 2.5*sv);
      for (let i = 0; i < N; i++) {
        applyNodes(SANKEY_NODE_DESCS[i], p, (pos) => {
          const pt = samplePath(descs[i], cpEase(pos, easeT1, easeT2));
          ctx.beginPath(); ctx.arc(pt.x*sv, pt.y*sv, nodeSz, 0, Math.PI*2); ctx.fill();
        });
      }
    }
  }

  return { render };
}
