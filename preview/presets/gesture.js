import {
  H, VIEW_SCALE, RIGHT_X,
  lerp, clamp, fillBackground,
  makeSegs, applySegs, makeNodes, applyNodes,
} from '../og-shared.js';

export function create(ctx) {
  const sv = VIEW_SCALE;
  const VW = RIGHT_X;
  const VH = H / VIEW_SCALE;

  const GESTURE_SEGS  = makeSegs(0xDEAD0000, 3);
  const GESTURE_NODES = makeNodes(0xC0DE3000, 12);

  function render(fi, p) {
    fillBackground(ctx, p);

    const scaleVal  = parseInt(document.getElementById("gestScale").value,  10) / 100;
    const ampVal    = parseInt(document.getElementById("gestAmp").value,    10) / 100;
    const wavesVal  = parseInt(document.getElementById("gestWaves").value,  10) / 100;
    const dampVal   = parseInt(document.getElementById("gestDamp").value,   10) / 100;
    const skewVal   = parseInt(document.getElementById("gestSkew").value,   10) / 100;
    const rhythmVal = parseInt(document.getElementById("gestRhythm").value, 10) / 100;
    const gestPosVal = parseInt(document.getElementById("gestPos").value,   10) / 100;
    const heightVal = parseInt(document.getElementById("gestHeight").value, 10) / 100;
    const fragVal   = parseInt(document.getElementById("gestFrag").value,   10) / 100;

    const tot = p.emergeFr;
    const t = ((fi % tot) + tot) % tot;
    const gp = t / tot;

    const totalScale  = lerp(0.15, 3.0, scaleVal);
    const maxAmp      = lerp(20, VH * 0.45, ampVal) * totalScale;
    const waveCount   = lerp(1.5, 8, wavesVal);
    const dampStrength = lerp(0.1, 6, dampVal);
    const skew        = (skewVal - 0.5) * VW * 0.8;
    const posOffset   = (gestPosVal - 0.5) * VW * 1.2;

    const spanW  = VW * totalScale;
    const cxOff  = VW / 2 + posOffset;
    const cyOff  = VH * lerp(0.1, 0.9, heightVal);
    const left   = cxOff - spanW / 2;
    const right  = cxOff + spanW / 2;
    const yCenter = cyOff;

    const phaseShift    = gp * Math.PI * 2;
    const rhythmFreq    = lerp(0, 3, rhythmVal);
    const rhythmAmpMod  = lerp(0, 0.5, rhythmVal);
    const rhythmSpaceMod = lerp(0, 0.4, rhythmVal);
    const waveEnd       = clamp(1 - dampStrength * 0.08, 0.3, 1);

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

    if (p.nodeEnabled) {
      ctx.fillStyle = p.nodeColor;
      applyNodes(GESTURE_NODES, p, (pos) => {
        const fi2 = pos * (points.length - 1);
        const i0  = Math.min(Math.floor(fi2), points.length - 2);
        const frac = fi2 - i0;
        const x = lerp(points[i0].x, points[i0 + 1].x, frac);
        const y = lerp(points[i0].y, points[i0 + 1].y, frac);
        ctx.beginPath();
        ctx.arc(x * sv, y * sv, p.strokeW * 2, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }

  return { render };
}
