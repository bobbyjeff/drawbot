import { W, H, VIEW_SCALE, lerp, segNow } from '../og-shared.js';
import { create as createParametric } from './parametric.js';

export function create(ctx) {
  const parametric = createParametric(ctx);
  const sv = VIEW_SCALE;
  const VW = W / VIEW_SCALE;
  const VH = H / VIEW_SCALE;

  function drawOval(fi, p) {
    const size   = parseInt(document.getElementById('ovalSize').value,   10) / 100;
    const aspect = parseInt(document.getElementById('ovalAspect').value, 10) / 100;
    const tilt   = parseInt(document.getElementById('ovalTilt').value,   10) / 100;
    const dashed = document.getElementById('ovalDashed').checked;
    const dash   = parseInt(document.getElementById('ovalDash').value,   10) / 100;

    const cx = VW / 2, cy = VH / 2;
    const gp = segNow(p) % 1;

    const a    = VW * lerp(0.12, 0.46, size);
    const bMax = a  * lerp(0.22, 0.80, aspect);
    const cosV  = Math.cos(gp * Math.PI);
    const breath = cosV * cosV;
    const b = Math.max(bMax * breath, p.strokeW * 0.5 / sv);

    const angle = lerp(-Math.PI / 3, Math.PI / 3, tilt);

    ctx.save();
    ctx.translate(cx * sv, cy * sv);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.ellipse(0, 0, a * sv, b * sv, 0, 0, Math.PI * 2);

    if (dashed) {
      const dashPx  = lerp(4, 70, dash) * sv;
      const dashGap = dashPx * 0.6;
      const circ    = Math.PI * a * sv * 2;
      const period  = dashPx + dashGap;
      const marchSpan = Math.max(period, Math.round(circ * 0.12 / period) * period);
      const marchDist = gp * marchSpan;
      ctx.setLineDash([dashPx, dashGap]);
      ctx.lineDashOffset = -marchDist;
    }

    ctx.strokeStyle = p.strokeColor;
    ctx.lineWidth   = p.strokeW;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function render(fi, p) {
    parametric.render(fi, p);
    drawOval(fi, p);
  }

  return { render };
}
