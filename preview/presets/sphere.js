import {
  H, VIEW_SCALE, RIGHT_X,
  clamp, fillBackground,
  makeSegs, applySegs, makeNodes, applyNodes,
} from '../og-shared.js';

export function create(ctx) {
  const sv = VIEW_SCALE;
  const VH = H / VIEW_SCALE;
  const CX  = RIGHT_X * 0.5;
  const CY  = VH * 0.5;
  const R   = Math.min(CX, CY) * 0.88;
  const MIN_RX = 7;

  const RADIUS_POW = 1.4;
  const ECC_EQ  = 0.68;
  const ECC_POL = 0.20;
  const FADE_IN  = 0.06;
  const FADE_OUT = 0.06;
  const CYCLE_FRAMES = 270;

  const SPHERE_SEGS  = Array.from({ length: 16 }, (_, i) => makeSegs(0xC0DE0000 + i * 13, 2));
  const SPHERE_NODES = Array.from({ length: 16 }, (_, i) => makeNodes(0xC0DE7000 + i * 23, 8));

  function ringAlpha(phase) {
    let a;
    if (phase < FADE_IN) {
      a = phase / FADE_IN;
    } else if (phase > 1 - FADE_OUT) {
      a = (1 - phase) / FADE_OUT;
    } else {
      a = 1;
    }
    return a * a * (3 - 2 * a);
  }

  function render(fi, p) {
    fillBackground(ctx, p);

    ctx.strokeStyle = p.strokeColor;
    ctx.lineWidth   = p.strokeW;
    ctx.lineCap     = "round";

    const N_RINGS  = parseInt(document.getElementById('sphereRings')?.value ?? '8', 10);
    const rawPhase = (fi % CYCLE_FRAMES) / CYCLE_FRAMES;

    ctx.save();
    ctx.translate(CX * sv, CY * sv);
    ctx.rotate(Math.PI / 4);

    for (let i = 0; i < N_RINGS; i++) {
      const phase = (rawPhase + i / N_RINGS) % 1;
      const alpha = ringAlpha(phase);
      if (alpha < 0.02) continue;

      const theta  = Math.acos(clamp(1 - 2 * phase, -1, 1));
      const sinT   = Math.sin(theta);
      const sinPow = Math.pow(sinT, RADIUS_POW);
      const rx = R * sinPow;
      if (rx < MIN_RX) continue;

      const SIZE_FULL  = R * 0.48;
      const sizeT      = Math.max(0, Math.min(1, (rx - MIN_RX) / (SIZE_FULL - MIN_RX)));
      const sizeAlpha  = sizeT * sizeT * (3 - 2 * sizeT);

      const ecc  = ECC_POL + (ECC_EQ - ECC_POL) * sinPow;
      const ry   = rx * ecc;
      const yCtr = R * Math.cos(theta);

      ctx.globalAlpha = alpha * sizeAlpha;
      ctx.beginPath();
      ctx.ellipse(0, yCtr * sv, Math.max(rx * sv, 0.5), Math.max(ry * sv, 0.5), 0, 0, Math.PI * 2);
      ctx.stroke();

      if (p.segEnabled) {
        applySegs(SPHERE_SEGS[i % SPHERE_SEGS.length], rawPhase, p, (s0, s1, color) => {
          ctx.strokeStyle = color;
          ctx.beginPath();
          ctx.ellipse(0, yCtr * sv, Math.max(rx * sv, 0.5), Math.max(ry * sv, 0.5), 0,
            s0 * Math.PI * 2, s1 * Math.PI * 2);
          ctx.stroke();
        });
        ctx.strokeStyle = p.strokeColor;
      }
    }

    if (p.nodeEnabled) {
      const ringCountN = N_RINGS;
      for (let i = 0; i < ringCountN; i++) {
        const rawPhaseN = ((fi % CYCLE_FRAMES) / CYCLE_FRAMES + i / ringCountN) % 1;
        const phase_N   = ((rawPhaseN % 1) + 1) % 1;
        const alphaN    = ringAlpha(phase_N);
        if (alphaN < 0.02) continue;
        const thetaN  = Math.acos(clamp(1 - 2 * phase_N, -1, 1));
        const sinTN   = Math.sin(thetaN);
        const sinPowN = Math.pow(sinTN, RADIUS_POW);
        const rxN = R * sinPowN;
        if (rxN < MIN_RX) continue;
        const SIZE_FULL_N = R * 0.48;
        const sizeTN      = Math.max(0, Math.min(1, (rxN - MIN_RX) / (SIZE_FULL_N - MIN_RX)));
        const sizeAlphaN  = sizeTN * sizeTN * (3 - 2 * sizeTN);
        const eccN  = ECC_POL + (ECC_EQ - ECC_POL) * sinPowN;
        const ryN   = rxN * eccN;
        const yCtrN = R * Math.cos(thetaN);
        ctx.globalAlpha = alphaN * sizeAlphaN * sizeAlphaN;
        applyNodes(SPHERE_NODES[i % SPHERE_NODES.length], p, (pos) => {
          const angle = pos * Math.PI * 2;
          const nx = rxN * sv * Math.cos(angle);
          const ny = yCtrN * sv + ryN * sv * Math.sin(angle);
          ctx.beginPath();
          ctx.arc(nx, ny, p.strokeW * 2, 0, Math.PI * 2);
          ctx.fillStyle = p.nodeColor;
          ctx.fill();
        });
      }
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  return { render };
}
