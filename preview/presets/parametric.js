import {
  H, VIEW_SCALE, RIGHT_X,
  lerp, clamp, fillBackground,
  makeSegs, makeNodes, applyNodes, segNow,
} from '../og-shared.js';

export function create(ctx) {
  const sv = VIEW_SCALE;
  const VH = H / VIEW_SCALE;
  const CX = RIGHT_X * 0.5;
  const CY = VH * 0.5;

  const PAD = 38;
  const sXc = (RIGHT_X - 2 * PAD) / 1782.84;
  const sYc = (VH      - 2 * PAD) / 942.46;
  const Rx  = CX - PAD;
  const Ry  = CY - PAD;

  const DASH = 2.21 * ((sXc + sYc) / 2) * sv;
  const GAP  = 1.38 * ((sXc + sYc) / 2) * sv;

  const A    = 3;
  const B    = 2;
  const N_B  = 1;
  const SEGS = 400;
  const T    = 480;

  const PARAM_SEGS_A  = Array.from({ length: 9 }, (_, i) => makeSegs(0xAAAA0000 + i * 23, 2));
  const PARAM_SEGS_B  = makeSegs(0xBBBB0000, 2);
  const PARAM_NODES_A = Array.from({ length: 9 }, (_, i) => makeNodes(0xC0DE4000 + i * 37, 6));
  const PARAM_NODES_B = makeNodes(0xC0DE5000, 6);

  const δ_holder = { δ: 0 };
  const p_holder = { strokeW: 1 };

  function paramPointAt(s, φ, ψ, familyA) {
    const t  = s * Math.PI * 2;
    const sx = familyA
      ? (CX + Rx * Math.sin(B * t + δ_holder.δ + φ)) * sv
      : (CX + Rx * Math.sin(B * t + δ_holder.δ)) * sv;
    const sy = familyA
      ? (CY - Ry * Math.sin(A * t)) * sv
      : (CY - Ry * Math.sin(A * t + ψ)) * sv;
    return { x: sx, y: sy };
  }

  function drawParametricSegment(s0, s1, color, φ, ψ, familyA) {
    if (s1 <= s0) return;
    const len   = Math.min(s1 - s0, 1);
    const a0    = ((s0 % 1) + 1) % 1;
    const a1    = a0 + len;
    const spans = a1 <= 1 + 1e-9 ? [[a0, a1]] : [[a0, 1], [0, a1 - 1]];

    ctx.strokeStyle = color;
    ctx.lineWidth   = p_holder.strokeW;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.setLineDash([]);
    ctx.beginPath();
    let moved = false;
    for (const [a, b] of spans) {
      if (b <= a) continue;
      const steps = Math.max(6, Math.round((b - a) * SEGS));
      for (let j = 0; j <= steps; j++) {
        const s  = a + (b - a) * (j / steps);
        const pt = paramPointAt(s, φ, ψ, familyA);
        if (!moved) { ctx.moveTo(pt.x, pt.y); moved = true; }
        else        ctx.lineTo(pt.x, pt.y);
      }
    }
    if (moved) ctx.stroke();
  }

  function applyParametricSegs(segs, p, φ, ψ, familyA) {
    if (!segs.length) return;
    p_holder.strokeW = p.strokeW;
    const sizeScale  = lerp(0.1, 2.0, p.segSize);
    const speedScale = lerp(0.1, 2.0, p.segSpeed);
    const count      = Math.max(1, Math.round(segs.length * clamp(lerp(0.15, 1, p.segDensity), 0.01, 1)));
    const t          = segNow(p);
    const cr = parseInt(p.segColor.slice(1, 3), 16);
    const cg = parseInt(p.segColor.slice(3, 5), 16);
    const cb = parseInt(p.segColor.slice(5, 7), 16);
    const color = `rgb(${cr},${cg},${cb})`;
    for (let i = 0; i < count; i++) {
      const cs     = segs[i];
      const rawPos = cs.pos + (t + cs.phase) * cs.drift * speedScale;
      const hw     = cs.width * sizeScale * 0.5;
      drawParametricSegment(rawPos - hw, rawPos + hw, color, φ, ψ, familyA);
    }
  }

  function render(fi, p) {
    const N_A = Math.max(1, parseInt(document.getElementById('paramCurves')?.value ?? '3', 10) - 1);
    fillBackground(ctx, p);

    const δ = (fi % T) / T * Math.PI * 2;
    δ_holder.δ = δ;

    ctx.strokeStyle = p.strokeColor;
    ctx.lineWidth   = p.strokeW;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.globalAlpha = 1;

    const recursionVal   = parseInt(document.getElementById('paramRecursion')?.value ?? '0', 10) / 100;
    const recursionDepth = recursionVal < 0.01 ? 1 : 2 + Math.round(recursionVal * 5);
    const scaleStep      = recursionVal < 0.01 ? 1 : 1 - recursionVal * 0.42;

    for (let level = 0; level < recursionDepth; level++) {
      const scale = Math.pow(scaleStep, level);
      if (scale < 0.04) break;
      const Rx_l = Rx * scale;
      const Ry_l = Ry * scale;
      const δ_l  = δ + level * recursionVal * Math.PI * 0.22;
      ctx.globalAlpha = level === 0 ? 1.0 : Math.pow(0.72, level);
      ctx.setLineDash([DASH * scale, GAP * scale]);

      for (let k = 0; k < N_A; k++) {
        const φ = k * Math.PI * 2 / N_A;
        ctx.beginPath();
        for (let j = 0; j <= SEGS; j++) {
          const t  = j / SEGS * Math.PI * 2;
          const sx = (CX + Rx_l * Math.sin(B * t + δ_l + φ)) * sv;
          const sy = (CY - Ry_l * Math.sin(A * t)) * sv;
          j === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      }

      for (let k = 0; k < N_B; k++) {
        const ψ = k * Math.PI * 2 / N_B;
        ctx.beginPath();
        for (let j = 0; j <= SEGS; j++) {
          const t  = j / SEGS * Math.PI * 2;
          const sx = (CX + Rx_l * Math.sin(B * t + δ_l)) * sv;
          const sy = (CY - Ry_l * Math.sin(A * t + ψ)) * sv;
          j === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      }
    }

    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    if (p.segEnabled) {
      for (let k = 0; k < N_A; k++) {
        const φ = k * Math.PI * 2 / N_A;
        applyParametricSegs(PARAM_SEGS_A[k % PARAM_SEGS_A.length], p, φ, 0, true);
      }
      applyParametricSegs(PARAM_SEGS_B, p, 0, 0, false);
    }

    if (p.nodeEnabled) {
      ctx.globalAlpha = 1;
      ctx.fillStyle   = p.nodeColor;
      const tPulse = segNow(p) * Math.PI * 3;
      for (let k = 0; k < N_A; k++) {
        const φ = k * Math.PI * 2 / N_A;
        applyNodes(PARAM_NODES_A[k % PARAM_NODES_A.length], p, (pos) => {
          const t  = pos * Math.PI * 2;
          const sx = (CX + Rx * Math.sin(B * t + δ + φ)) * sv;
          const sy = (CY - Ry * Math.sin(A * t)) * sv;
          const pulse = 1 + 0.35 * Math.sin(tPulse + pos * 9);
          ctx.beginPath();
          ctx.arc(sx, sy, p.strokeW * 3 * pulse, 0, Math.PI * 2);
          ctx.fill();
        });
      }
      for (let k = 0; k < N_B; k++) {
        const ψ = k * Math.PI * 2 / N_B;
        applyNodes(PARAM_NODES_B, p, (pos) => {
          const t  = pos * Math.PI * 2;
          const sx = (CX + Rx * Math.sin(B * t + δ)) * sv;
          const sy = (CY - Ry * Math.sin(A * t + ψ)) * sv;
          const pulse = 1 + 0.35 * Math.sin(tPulse + pos * 9);
          ctx.beginPath();
          ctx.arc(sx, sy, p.strokeW * 3 * pulse, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    }
  }

  return { render };
}
