import {
  H, VIEW_SCALE, RIGHT_X,
  lerp, clamp, fillBackground,
  makeSegs, applySegs, makeNodes, applyNodes, roundRectPoint,
} from '../og-shared.js';

export function create(ctx) {
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
    fillBackground(ctx, p);

    const depthVal = parseInt(document.getElementById("perspDepth").value,    10) / 100;
    const angleVal = parseInt(document.getElementById("perspAngle").value,    10) / 100;
    const shapeVal = parseInt(document.getElementById("perspShape").value,    10) / 100;
    const posYVal  = parseInt(document.getElementById("perspPosition").value, 10) / 100;

    const tot = p.emergeFr;
    const t = ((fi % tot) + tot) % tot;
    const gp = t / tot;

    const vpX = VW / 2 + (angleVal - 0.5) * VW * 0.8;
    const vpY = VH / 2 + (posYVal - 0.5) * VH * 0.8;

    const outerHW = VW / 2 + 40;
    const outerHH = VH / 2 + 40;

    const ringCount = Math.round(lerp(6, 30, depthVal));
    const minScale  = lerp(0.15, 0.01, depthVal);
    const maxRadius = Math.min(outerHW, outerHH) * shapeVal;
    const animShift = gp;
    const expK      = 3.5;
    const expDenom  = Math.exp(expK) - 1;

    const FADE_START = 0.50;
    const FADE_END   = 0.92;
    const bgR = parseInt(p.bg.slice(1, 3), 16), bgG = parseInt(p.bg.slice(3, 5), 16), bgB = parseInt(p.bg.slice(5, 7), 16);
    const fgR = parseInt(p.strokeColor.slice(1, 3), 16), fgG = parseInt(p.strokeColor.slice(3, 5), 16), fgB = parseInt(p.strokeColor.slice(5, 7), 16);

    function fadedColor(t2) {
      const fadeT = clamp((t2 - FADE_START) / (FADE_END - FADE_START), 0, 1);
      const r = Math.round(fgR + (bgR - fgR) * fadeT);
      const g = Math.round(fgG + (bgG - fgG) * fadeT);
      const b = Math.round(fgB + (bgB - fgB) * fadeT);
      return `rgb(${r},${g},${b})`;
    }

    for (let r = 0; r < ringCount; r++) {
      const rawT = (r + animShift) / ringCount;
      const t2   = 1 - (Math.exp(expK * (1 - rawT)) - 1) / expDenom;
      if (t2 >= FADE_END) continue;

      const hw = lerp(outerHW, outerHW * minScale, t2);
      const hh = lerp(outerHH, outerHH * minScale, t2);
      const cx = lerp(VW / 2, vpX, t2);
      const cy = lerp(VH / 2, vpY, t2);
      const cornerR  = Math.min(maxRadius, hw, hh) * (1 - t2 * 0.3);
      const ringColor = fadedColor(t2);
      const lw = p.strokeW / sv;

      drawRoundedRect(cx, cy, hw, hh, cornerR, ringColor, lw);

      if (p.segEnabled) {
        applySegs(PERSP_SEGS[r % PERSP_SEGS.length], gp, p, (s0, s1, color) => {
          const perimCanvas = 4 * (hw + hh) * sv;
          const segLen = (s1 - s0) * perimCanvas;
          ctx.setLineDash([segLen, Math.max(perimCanvas - segLen, 0)]);
          ctx.lineDashOffset = -s0 * perimCanvas;
          const segFadeT = clamp((t2 - FADE_START) / (FADE_END - FADE_START), 0, 1);
          const sr2 = parseInt(color.slice(1, 3) || '0', 16) || 0;
          const sg2 = parseInt(color.slice(3, 5) || '0', 16) || 0;
          const sb2 = parseInt(color.slice(5, 7) || '0', 16) || 0;
          const sc = `rgb(${Math.round(sr2 + (bgR - sr2) * segFadeT)},${Math.round(sg2 + (bgG - sg2) * segFadeT)},${Math.round(sb2 + (bgB - sb2) * segFadeT)})`;
          drawRoundedRect(cx, cy, hw, hh, cornerR, sc, lw);
        });
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;
      }
    }

    if (p.nodeEnabled) {
      for (let r = 0; r < ringCount; r++) {
        const rawT = (r + animShift) / ringCount;
        const t2   = 1 - (Math.exp(expK * (1 - rawT)) - 1) / expDenom;
        if (t2 >= FADE_END) continue;
        const hw = lerp(outerHW, outerHW * minScale, t2);
        const hh = lerp(outerHH, outerHH * minScale, t2);
        const cx = lerp(VW / 2, vpX, t2);
        const cy = lerp(VH / 2, vpY, t2);
        applyNodes(PERSP_NODES[r % PERSP_NODES.length], p, (pos) => {
          const pt = roundRectPoint(cx, cy, hw, hh, pos);
          ctx.beginPath();
          ctx.arc(pt.x * sv, pt.y * sv, p.strokeW * 2, 0, Math.PI * 2);
          ctx.fillStyle = p.nodeColor;
          ctx.fill();
        });
      }
    }

    const lw = p.strokeW / sv;
    const innerT  = (ringCount - 1 + animShift) / ringCount;
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
}
