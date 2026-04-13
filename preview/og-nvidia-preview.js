/**
 * NVIDIA OG ring preview — stroked ellipses, animation seed → rings → hold → collapse → loop.
 *
 * Geometry from images/public/blog_og_nvidia_04.svg (viewBox 0 0 1200 630).
 * Each ring path: M{cx},54.01 … outer sub-path M{cx},54.01 c-{cp},0-{rx},{ry}-{rx},{ry}
 * → center = M x-coordinate, horizontal semi-axis rx from the outer cubic.
 * SVG vertical center is 315 (630/2); inner M y=54.01 = CY − RY0 for the largest ring.
 *
 * Preview: every ring uses the same logical vertical semi-axis RY0 = ring[0].rOut (same height);
 * only horizontal semi-axis varies (matches “narrow in X toward the right”).
 * Hold / full rings: exact map from SVG — canvas is 2× viewBox (1200×630 → 2400×1260), offset (0,0).
 * No margin fitting or non-uniform scale; ring positions match images/public/blog_og_nvidia_04.svg.
 * Orange seed is preview-only (not in SVG); it is drawn on top using the same coordinate system.
 */
(function () {
  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d");

  const W = 2400;
  const H = 1260;
  const VIEW_W = 1200;
  const VIEW_H = 630;
  /** 2× export: W/H must stay VIEW_W×VIEW_H times this. */
  const VIEW_SCALE = W / VIEW_W;

  /**
   * Six paths in blog_og_nvidia_04.svg (largest → smallest).
   * Each path: M{cx},54.01 … outer sub-path M{cx},54.01 c-{cp1},0-{rx},116.85-{rx},260.99
   * cx = the M x-coordinate (center); rx = horizontal semi-axis from the outer cubic.
   * All share ry = 260.99 (top 54.01 → bottom 575.99 in the 630-high viewBox).
   */
  const RINGS = [
    { cx: 315,     rOut: 260.99 },
    { cx: 475.69,  rOut: 213.35 },
    { cx: 636.37,  rOut: 165.71 },
    { cx: 797.06,  rOut: 118.07 },
    { cx: 957.74,  rOut: 70.43 },
    { cx: 1118.43, rOut: 22.8 },
  ];
  const N = RINGS.length;
  const CY = VIEW_H / 2;
  const RY0 = RINGS[0].rOut;

  const SEED_STROKE_HEX = "#F54E00";

  function ringHorizontalExtent() {
    let L = Infinity;
    let R = -Infinity;
    for (const g of RINGS) {
      L = Math.min(L, g.cx - g.rOut);
      R = Math.max(R, g.cx + g.rOut);
    }
    return { L, R, span: R - L };
  }

  function clamp(v, lo, hi) {
    return Math.min(hi, Math.max(lo, v));
  }

  /**
   * Horizontal inset = left edge of ring 0 in the SVG = cx − rOut ≈ 54.01.
   * Keeps the orange seed guide inside the artboard margins.
   */
  function svgViewBoxInsetX() {
    const g0 = RINGS[0];
    return g0.cx - g0.rOut;
  }

  function layoutSeed(rawX, rawR, strokeW, viewScale) {
    const mCanvas = strokeW * 0.5 + 20;
    const mLog = mCanvas / viewScale;
    let lr = rawR / 2;
    const lrMaxVert = Math.min(CY - mLog, VIEW_H - CY - mLog);
    lr = Math.max(8 / viewScale, Math.min(lr, lrMaxVert));
    const lrDraw = Math.min(Math.max(lr, RY0), lrMaxVert);
    const inset = svgViewBoxInsetX();
    const minLx = inset + lrDraw + mLog;
    const maxLx = VIEW_W - inset - lrDraw - mLog;
    const lx = clamp(rawX / 2, minLx, maxLx);
    return { lx, lr, lrDraw };
  }

  function computeViewAndSeed(p) {
    const seed = layoutSeed(p.seedX, p.seedR, p.strokeW, VIEW_SCALE);
    const { L: rL, R: rR } = ringHorizontalExtent();
    const L = Math.min(rL, seed.lx - seed.lrDraw);
    const R = Math.max(rR, seed.lx + seed.lrDraw);
    const vm = {
      scaleX: VIEW_SCALE,
      scaleY: VIEW_SCALE,
      offsetX: 0,
      offsetY: 0,
      leftLog: L,
      rightLog: R,
      mapCx(x) {
        return x;
      },
      mapRx(rxh) {
        return rxh;
      },
    };
    return { vm, seed };
  }

  const els = {
    seedHold: document.getElementById("seedHold"),
    seedX: document.getElementById("seedX"),
    seedR: document.getElementById("seedR"),
    seedLw: document.getElementById("seedLw"),
    emergeFr: document.getElementById("emergeFr"),
    holdFull: document.getElementById("holdFull"),
    squash: document.getElementById("squash"),
    screenBlend: document.getElementById("screenBlend"),
    bgHex: document.getElementById("bgHex"),
    fgHex: document.getElementById("fgHex"),
    ringLayer: document.getElementById("ringLayer"),
    fgOp: document.getElementById("fgOp"),
    fps: document.getElementById("fps"),
    scrub: document.getElementById("scrub"),
    frameLabel: document.getElementById("frameLabel"),
    play: document.getElementById("play"),
    pause: document.getElementById("pause"),
    loop: document.getElementById("loop"),
    pyOut: document.getElementById("pyOut"),
    copyPy: document.getElementById("copyPy"),
    exportGif: document.getElementById("exportGif"),
    exportGifStatus: document.getElementById("exportGifStatus"),
  };

  const vSeedHold = document.getElementById("vSeedHold");
  const vSeedX = document.getElementById("vSeedX");
  const vSeedR = document.getElementById("vSeedR");
  const vSeedLw = document.getElementById("vSeedLw");
  const vMotionFr = document.getElementById("vMotionFr");
  const vHoldFull = document.getElementById("vHoldFull");
  const vSquash = document.getElementById("vSquash");
  const vRingLayer = document.getElementById("vRingLayer");
  const vFgOp = document.getElementById("vFgOp");
  const vFps = document.getElementById("vFps");

  function easeInOutQuint(t) {
    return t < 0.5 ? 16 * t * t * t * t * t : 1 - (-2 * t + 2) ** 5 / 2;
  }

  function easeInOutPow7(t) {
    return t < 0.5 ? 64 * t ** 7 : 1 - ((-2 * t + 2) ** 7) / 2;
  }

  function easeOutQuart(t) {
    return 1 - (1 - t) ** 4;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smootherstep(edge0, edge1, x) {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  function fanProgress(i, tFrames, spanFrames, n) {
    const T = spanFrames;
    if (T <= 1) return i === 0 ? 1 : 0;
    const dBase = Math.max(3, Math.min(T * 0.36, (T / Math.max(1, n - 0.2)) * 1.12));
    const gap = n > 1 ? (T - dBase) / (n - 1) : 0;
    const t0 = gap * i;
    const speed = 1 + i * 0.18;
    const d = dBase / speed;
    const raw = clamp((tFrames - t0) / Math.max(1e-6, d), 0, 1);
    return easeInOutPow7(raw);
  }

  function globalSquashFactor(tFrames, spanFrames, peak) {
    if (peak <= 0 || spanFrames <= 1) return 1;
    const g = tFrames / (spanFrames - 1);
    const bump = Math.sin(Math.PI * g) ** 2;
    let w = bump * bump * (3 - 2 * bump);
    w = w * w * (3 - 2 * w);
    return 1 - peak * w;
  }

  function hexToRgb(hex) {
    const h = hex.replace("#", "");
    return {
      r: parseInt(h.slice(0, 2), 16) / 255,
      g: parseInt(h.slice(2, 4), 16) / 255,
      b: parseInt(h.slice(4, 6), 16) / 255,
    };
  }

  function readParams() {
    const c = hexToRgb(els.fgHex.value);
    const rr = Math.round(c.r * 255);
    const gg = Math.round(c.g * 255);
    const bb = Math.round(c.b * 255);
    const so = hexToRgb(SEED_STROKE_HEX);
    const sr = Math.round(so.r * 255);
    const sg = Math.round(so.g * 255);
    const sb = Math.round(so.b * 255);
    const ringA = +els.ringLayer.value / 100;
    const seedA = +els.fgOp.value / 100;
    const strokeW = +els.seedLw.value;
    const motionFr = +els.emergeFr.value;
    return {
      seedHold: +els.seedHold.value,
      seedX: +els.seedX.value,
      seedR: +els.seedR.value,
      strokeW,
      emergeFr: motionFr,
      collapseFr: Math.max(1, Math.round(motionFr * 0.7)),
      holdFull: +els.holdFull.value,
      squashPeak: +els.squash.value / 100,
      screenBlend: els.screenBlend.checked,
      bg: els.bgHex.value,
      ringFill: `rgba(${rr},${gg},${bb},${ringA})`,
      seedStroke: `rgba(${sr},${sg},${sb},${seedA})`,
      ringLayerAlpha: ringA,
    };
  }

  function totalFrames(p) {
    return p.seedHold + N * p.emergeFr + p.holdFull + N * p.collapseFr;
  }

  function paintRings(p, drawFn) {
    ctx.save();
    ctx.globalCompositeOperation = p.screenBlend ? "screen" : "source-over";
    ctx.strokeStyle = p.ringFill;
    ctx.lineWidth = p.strokeW;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    drawFn();
    ctx.restore();
  }

  /* ── Simple parametric loops (prolate trochoid, 5 loops tightening) ── */
  const SPRING_RIGHT = RINGS[N - 1].cx + RINGS[N - 1].rOut;
  const SPRING_AMP = RY0;

  const CURVE_LEFT = 95;
  const CURVE_RIGHT = SPRING_RIGHT;
  const CURVE_SPAN = CURVE_RIGHT - CURVE_LEFT;

  const NUM_LOOPS = 5;
  const RX_START = 100;
  const RX_END = 20;
  const RY_START = SPRING_AMP;
  const RY_END = SPRING_AMP * 0.25;
  const D_RX = RX_END - RX_START;
  const D_RY = RY_END - RY_START;
  const OMEGA = NUM_LOOPS * 2 * Math.PI;

  const BEZIER_SEGS = 120;

  function curveAt(s) {
    const rx = RX_START + D_RX * s;
    const ry = RY_START + D_RY * s;
    const theta = OMEGA * s;
    return {
      x: (CURVE_LEFT + CURVE_SPAN * s - rx * Math.sin(theta)) * VIEW_SCALE,
      y: (CY + ry * Math.cos(theta)) * VIEW_SCALE,
    };
  }

  function curveTangent(s) {
    const rx = RX_START + D_RX * s;
    const ry = RY_START + D_RY * s;
    const theta = OMEGA * s;
    return {
      dx: (CURVE_SPAN - D_RX * Math.sin(theta) - rx * Math.cos(theta) * OMEGA) * VIEW_SCALE,
      dy: (D_RY * Math.cos(theta) - ry * Math.sin(theta) * OMEGA) * VIEW_SCALE,
    };
  }

  function traceCurvePath(tEnd) {
    const segDt = 1 / BEZIER_SEGS;
    const drawSegs = Math.ceil(tEnd * BEZIER_SEGS);
    const p0 = curveAt(0);
    ctx.moveTo(p0.x, p0.y);
    for (let i = 0; i < drawSegs; i++) {
      const t0 = i * segDt;
      const t1 = Math.min((i + 1) * segDt, tEnd);
      const dt = t1 - t0;
      if (dt < 1e-9) break;
      const tan0 = curveTangent(t0);
      const tan1 = curveTangent(t1);
      const p1 = curveAt(t1);
      ctx.bezierCurveTo(
        p0.x + tan0.dx * dt / 3, p0.y + tan0.dy * dt / 3,
        p1.x - tan1.dx * dt / 3, p1.y - tan1.dy * dt / 3,
        p1.x, p1.y
      );
      p0.x = p1.x;
      p0.y = p1.y;
    }
  }

  /**
   * Coil drawn as cubic Bezier parametric curves.
   * Optional tipColor overlays a gradient at the leading edge.
   */
  function drawSpring(drawPct, color, lw, tipColor, tipOpacity) {
    if (drawPct <= 0) return;
    const tEnd = clamp(drawPct, 0, 1);
    if (tEnd < 0.001) return;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = lw;

    ctx.strokeStyle = color;
    ctx.beginPath();
    traceCurvePath(tEnd);
    ctx.stroke();

    if (tipColor && tEnd > 0.01) {
      const tipRgb = hexToRgb(tipColor);
      const tr = Math.round(tipRgb.r * 255);
      const tg = Math.round(tipRgb.g * 255);
      const tb = Math.round(tipRgb.b * 255);
      const gradSpan = 0.06;
      const gradStart = Math.max(0, tEnd - gradSpan);
      const gradRange = Math.max(1e-6, tEnd - gradStart);
      const gradSegs = 8;
      const segDt = gradRange / gradSegs;

      for (let i = 0; i < gradSegs; i++) {
        const st = gradStart + i * segDt;
        const et = Math.min(st + segDt, tEnd);
        const blend = (st - gradStart) / gradRange;
        const op = tipOpacity !== undefined ? tipOpacity : 1;
        const alpha = blend * blend * blend * op;
        ctx.strokeStyle = `rgba(${tr},${tg},${tb},${alpha})`;
        ctx.beginPath();
        const pa = curveAt(st);
        ctx.moveTo(pa.x, pa.y);
        const tanA = curveTangent(st);
        const tanB = curveTangent(et);
        const pb = curveAt(et);
        const dt = et - st;
        ctx.bezierCurveTo(
          pa.x + tanA.dx * dt / 3, pa.y + tanA.dy * dt / 3,
          pb.x - tanB.dx * dt / 3, pb.y - tanB.dy * dt / 3,
          pb.x, pb.y
        );
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  function renderFrame(fi, p) {
    const { seedHold, strokeW, emergeFr, collapseFr, holdFull, bg, ringFill } = p;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const tot = totalFrames(p);
    let t = ((fi % tot) + tot) % tot;

    if (t < seedHold) return;
    t -= seedHold;

    const emergeLen = N * emergeFr;
    if (t < emergeLen) {
      const raw = clamp(t / emergeLen, 0, 1);
      const u = raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;
      drawSpring(u, ringFill, strokeW, SEED_STROKE_HEX);
      return;
    }
    t -= emergeLen;

    if (t < holdFull) {
      const fadeFrames = Math.min(8, holdFull);
      const fade = t < fadeFrames ? 1 - t / fadeFrames : 0;
      if (fade > 0) {
        drawSpring(1, ringFill, strokeW, SEED_STROKE_HEX, fade);
      } else {
        drawSpring(1, ringFill, strokeW);
      }
      return;
    }
    t -= holdFull;

    const collapseLen = N * collapseFr;
    if (t < collapseLen) {
      const raw = clamp(t / collapseLen, 0, 1);
      const u = raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;
      drawSpring(1 - u, ringFill, strokeW);
      return;
    }
  }

  function phaseLabel(fi, p) {
    const tot = totalFrames(p);
    let t = ((fi % tot) + tot) % tot;
    const sh = p.seedHold;
    if (t < sh) return "seed";
    t -= sh;
    if (t < N * p.emergeFr) return "emerge";
    t -= N * p.emergeFr;
    if (t < p.holdFull) return "hold";
    t -= p.holdFull;
    if (t < N * p.collapseFr) return "collapse";
    return "seed";
  }

  let playing = false;
  let frameIndex = 0;
  let lastT = 0;
  let raf = null;
  let exportingGif = false;

  function updateLabels() {
    const p = readParams();
    const { seed } = computeViewAndSeed(p);
    vSeedHold.textContent = String(p.seedHold);
    const xFit = Math.abs(seed.lx - p.seedX / 2) >= 0.05;
    const rFit = Math.abs(seed.lr - p.seedR / 2) >= 0.05;
    vSeedX.textContent = xFit ? `${Math.round(seed.lx * 2)} (fit)` : String(p.seedX);
    const boostedR = seed.lrDraw > seed.lr + 0.05;
    vSeedR.textContent = rFit
      ? `${Math.round(seed.lr * 2)} (fit)`
      : boostedR
        ? `${Math.round(seed.lrDraw * 2)} (≥ ring height)`
        : String(p.seedR);
    vSeedLw.textContent = String(p.strokeW);
    vMotionFr.textContent = String(p.emergeFr);
    vHoldFull.textContent = String(p.holdFull);
    vSquash.textContent = p.squashPeak.toFixed(2);
    vRingLayer.textContent = p.ringLayerAlpha.toFixed(2);
    vFgOp.textContent = (+els.fgOp.value / 100).toFixed(2);
    vFps.textContent = els.fps.value;
  }

  function syncScrub() {
    const p = readParams();
    const n = totalFrames(p);
    els.scrub.max = String(Math.max(0, n - 1));
    if (frameIndex >= n) frameIndex = 0;
    els.scrub.value = String(frameIndex);
  }

  function drawUi() {
    const p = readParams();
    renderFrame(frameIndex, p);
    const n = totalFrames(p);
    els.frameLabel.textContent = `${frameIndex + 1} / ${n} · ${phaseLabel(frameIndex, p)}`;
  }

  function tick(t) {
    if (!playing) return;
    const interval = 1000 / +els.fps.value;
    if (t - lastT >= interval) {
      lastT = t;
      const p = readParams();
      const n = totalFrames(p);
      frameIndex++;
      if (frameIndex >= n) {
        if (els.loop.checked) frameIndex = 0;
        else {
          frameIndex = n - 1;
          playing = false;
        }
      }
      els.scrub.value = String(frameIndex);
    }
    renderFrame(frameIndex, readParams());
    const p = readParams();
    els.frameLabel.textContent = `${frameIndex + 1} / ${totalFrames(p)} · ${phaseLabel(frameIndex, p)}`;
    if (playing) raf = requestAnimationFrame(tick);
  }

  function snippet() {
    const p = readParams();
    const { vm, seed } = computeViewAndSeed(p);
    return `# blog_og_nvidia_04.svg — viewBox ${VIEW_W}×${VIEW_H}, CY=${CY}, RY0=${RY0} (all rings same height)
# Canvas ${W}×${H} = 2× viewBox; scale=${VIEW_SCALE}, offset (0,0); bbox ref [${vm.leftLog.toFixed(2)}, ${vm.rightLog.toFixed(2)}]
# Ring tint / BG / seed stroke α from preview Color section; seed stroke ${SEED_STROKE_HEX}
# Seed logical: lx=${seed.lx.toFixed(2)}, lr=${seed.lr.toFixed(2)} (sliders 2×); lrDraw=${seed.lrDraw.toFixed(2)}
stroke_px = ${p.strokeW}
SEED_HOLD = ${p.seedHold}
SEED_X = ${p.seedX}
SEED_R = ${p.seedR}
SQUASH_PEAK = ${p.squashPeak.toFixed(2)}
MOTION_FR = ${p.emergeFr}
HOLD_FULL = ${p.holdFull}
FRAME_DUR = 1 / ${els.fps.value}
SCREEN_BLEND = ${p.screenBlend}`;
  }

  function fullRefresh() {
    updateLabels();
    syncScrub();
    drawUi();
    els.pyOut.textContent = snippet();
  }

  [
    els.seedHold,
    els.seedX,
    els.seedR,
    els.seedLw,
    els.emergeFr,
    els.holdFull,
    els.squash,
    els.screenBlend,
    els.bgHex,
    els.fgHex,
    els.ringLayer,
    els.fgOp,
    els.fps,
  ].forEach((el) => el && el.addEventListener("input", fullRefresh));
  els.screenBlend && els.screenBlend.addEventListener("change", fullRefresh);

  els.scrub.addEventListener("input", () => {
    frameIndex = +els.scrub.value;
    drawUi();
  });

  els.play.addEventListener("click", () => {
    playing = true;
    lastT = performance.now();
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  });

  els.pause.addEventListener("click", () => {
    playing = false;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  });

  els.copyPy.addEventListener("click", async () => {
    els.pyOut.textContent = snippet();
    try {
      await navigator.clipboard.writeText(els.pyOut.textContent);
      els.copyPy.textContent = "Copied!";
      setTimeout(() => (els.copyPy.textContent = "Copy DrawBot hints"), 1500);
    } catch (_) {
      els.copyPy.textContent = "Copy manually";
    }
  });

  els.exportGif.addEventListener("click", () => {
    if (exportingGif) return;
    if (typeof GIF === "undefined") {
      els.exportGifStatus.textContent = "GIF encoder not loaded (check vendor/gifjs).";
      return;
    }
    const p = readParams();
    const n = totalFrames(p);
    if (n < 1) return;

    playing = false;
    if (raf) {
      cancelAnimationFrame(raf);
      raf = null;
    }
    const savedFrame = frameIndex;
    const delayMs = Math.max(1, Math.round(1000 / +els.fps.value));
    const workerScript = new URL("vendor/gifjs/gif.worker.js", document.baseURI).href;

    exportingGif = true;
    els.exportGif.disabled = true;
    els.exportGifStatus.textContent = `Adding frames (0 / ${n})…`;

    const gif = new GIF({
      workers: 2,
      quality: 12,
      width: W,
      height: H,
      workerScript,
      repeat: 0,
    });

    const finish = (msg) => {
      exportingGif = false;
      els.exportGif.disabled = false;
      frameIndex = savedFrame;
      els.scrub.value = String(frameIndex);
      drawUi();
      els.exportGifStatus.textContent = msg || "";
    };

    gif.on("progress", (t) => {
      els.exportGifStatus.textContent = `Encoding… ${Math.round(t * 100)}%`;
    });

    gif.on("finished", (blob) => {
      const a = document.createElement("a");
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = "nvidia-og-rings.gif";
      a.click();
      URL.revokeObjectURL(url);
      finish("Download started.");
      setTimeout(() => {
        if (els.exportGifStatus.textContent === "Download started.") els.exportGifStatus.textContent = "";
      }, 4000);
    });

    gif.on("abort", () => finish("Export cancelled."));

    (async () => {
      try {
        for (let i = 0; i < n; i++) {
          renderFrame(i, p);
          gif.addFrame(ctx, { copy: true, delay: delayMs });
          if (i % 3 === 0) {
            els.exportGifStatus.textContent = `Adding frames (${i + 1} / ${n})…`;
            await new Promise((r) => requestAnimationFrame(r));
          }
        }
        els.exportGifStatus.textContent = "Encoding…";
        gif.render();
      } catch (err) {
        finish(String(err && err.message ? err.message : err));
      }
    })();
  });

  fullRefresh();
})();
