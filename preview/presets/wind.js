import {
  H, VIEW_SCALE, LEFT_X, RIGHT_X,
  lerp, clamp, fillBackground,
  makeSegs, segNow,
} from '../og-shared.js';

export function create(ctx) {
  const sv = VIEW_SCALE;
  const VH = H / VIEW_SCALE;

  const MARGIN_USER    = 20;
  const WIND_EDGE_PAD  = 6;
  const WIND_LEFT      = LEFT_X + MARGIN_USER;
  const WIND_RIGHT     = RIGHT_X - MARGIN_USER;
  const WIND_TOP       = MARGIN_USER;
  const WIND_BOTTOM    = VH - MARGIN_USER;
  const WIND_IN_LEFT   = WIND_LEFT  + WIND_EDGE_PAD;
  const WIND_IN_RIGHT  = WIND_RIGHT - WIND_EDGE_PAD;
  const WIND_IN_TOP    = WIND_TOP   + WIND_EDGE_PAD;
  const WIND_IN_BOT    = WIND_BOTTOM - WIND_EDGE_PAD;
  const spanXG = WIND_IN_RIGHT - WIND_IN_LEFT;
  const spanYG = WIND_IN_BOT   - WIND_IN_TOP;

  const WIND_CX = 20;
  const WIND_CY = 22;

  const GRID_SLACK_TAIL_X = 1.82;
  const WIND_GAMMA_X      = 0.58;

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
      const s = t * t * (3 - 2 * t);
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
  const gx = warpedCenters(WIND_CX, spanXG, minPX, WIND_GAMMA_X)
    .map(c => mapAxis(c, spanXG, WIND_IN_RIGHT, WIND_IN_LEFT))
    .sort((a, b) => a - b);

  {
    const shift = ((WIND_IN_RIGHT - gx[WIND_CX - 1]) - (gx[0] - WIND_IN_LEFT)) * 0.5;
    for (let k = 0; k < WIND_CX; k++) gx[k] += shift;
    let bleed = WIND_IN_LEFT - gx[0];
    if (bleed > 0) for (let k = 0; k < WIND_CX; k++) gx[k] += bleed;
    else { bleed = gx[WIND_CX - 1] - WIND_IN_RIGHT; if (bleed > 0) for (let k = 0; k < WIND_CX; k++) gx[k] -= bleed; }
  }

  const colN = Array.from({ length: WIND_CX }, () => WIND_CY);

  function ctrYAt(_ix, iy) {
    return WIND_IN_TOP + spanYG * iy / (WIND_CY - 1);
  }

  const ANGLE_MAX_RAD = 0.90;
  const ANGLE_EXP     = 1.8;
  const nomPitch      = spanYG / WIND_CY;
  const SEG_HALF_MIN  = nomPitch * 0.02;
  const SEG_HALF_MAX  = nomPitch * 0.90;
  const SEG_LEN_EXP   = 0.28;
  const SEG_LEFT_SCALE  = 0.50;
  const SEG_RIGHT_SCALE = 1.00;

  const WIND_BAND_SEGS = makeSegs(0xF00D0000, 4);

  function render(fi, p) {
    const tot = p.emergeFr;
    const gp  = ((fi % tot) + tot) % tot / tot;
    fillBackground(ctx, p);
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

        const uRowRaw = fx * 0.55 + (1 - fy) * 0.45;
        const uRamp   = Math.pow(clamp(uRowRaw, 0, 1), SEG_LEN_EXP);
        const uAngle  = clamp(fx, 0, 1);
        const angle   = -ANGLE_MAX_RAD * Math.pow(uAngle, ANGLE_EXP);
        const wx = Math.cos(angle);
        const wy = Math.sin(angle);

        if (isNaN(ctrY)) continue;

        const leftB  = ix > 0        ? (gx[ix - 1] + gx[ix]) * 0.5 : WIND_IN_LEFT;
        const rightB = ix < WIND_CX-1 ? (gx[ix] + gx[ix + 1]) * 0.5 : WIND_IN_RIGHT;
        const n       = colN[ix];
        const spacing = n > 1 ? spanYG / (n - 1) : spanYG;
        const yTop    = ctrY - spacing * 0.5;
        const yBot    = ctrY + spacing * 0.5;

        let halfUCell = Infinity;
        if (Math.abs(wx) > eps)
          halfUCell = Math.min(halfUCell, Math.min(rightB - ctrX, ctrX - leftB) / Math.abs(wx));
        if (Math.abs(wy) > eps)
          halfUCell = Math.min(halfUCell, Math.min(yBot - ctrY, ctrY - yTop) / Math.abs(wy));
        if (!Number.isFinite(halfUCell)) continue;

        const capPad   = (p.strokeW * 0.5) / Math.max(sv, 1e-9);
        const halfUMax = Math.max(0, halfUCell - capPad * 1.1);
        const colScale = SEG_LEFT_SCALE + (SEG_RIGHT_SCALE - SEG_LEFT_SCALE) * fx;
        const halfTarget = (SEG_HALF_MIN + (SEG_HALF_MAX - SEG_HALF_MIN) * uRamp) * colScale;
        const halfU = Math.min(halfTarget, halfUMax);

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
            const wx2 = Math.cos(angle2);
            const wy2 = Math.sin(angle2);

            const leftB2  = ix > 0        ? (gx[ix - 1] + gx[ix]) * 0.5 : WIND_IN_LEFT;
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

            const capPad2    = (p.strokeW * 0.5) / Math.max(sv, 1e-9);
            const halfUMax2  = Math.max(0, halfUCell2 - capPad2 * 1.1);
            const fy2        = clamp((ctrY - WIND_IN_TOP) * invSYG, 0, 1);
            const uRowRaw2   = fx2 * 0.55 + (1 - fy2) * 0.45;
            const uRamp2     = Math.pow(clamp(uRowRaw2, 0, 1), SEG_LEN_EXP);
            const colScale2  = SEG_LEFT_SCALE + (SEG_RIGHT_SCALE - SEG_LEFT_SCALE) * fx2;
            const halfTarget2 = (SEG_HALF_MIN + (SEG_HALF_MAX - SEG_HALF_MIN) * uRamp2) * colScale2;
            const halfU2     = Math.min(halfTarget2, halfUMax2);

            const pixHalf2 = z => Math.round(z * 2) / 2;
            ctx.beginPath();
            ctx.moveTo(pixHalf2((ctrX - halfU2 * wx2) * sv), pixHalf2((ctrY - halfU2 * wy2) * sv));
            ctx.lineTo(pixHalf2((ctrX + halfU2 * wx2) * sv), pixHalf2((ctrY + halfU2 * wy2) * sv));
            ctx.stroke();
          }
        }
      }
    }
  }

  return { render };
}
