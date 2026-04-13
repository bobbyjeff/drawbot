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
      collapseFr: Math.max(1, Math.round(motionFr * 0.5)),
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

  /** Ellipse in logical space → canvas with scaleX / scaleY (equal margins on all sides). */
  function strokeEllipse(cxL, cyL, rxL, ryL, vm) {
    const cxM = vm.mapCx(cxL);
    const rxM = vm.mapRx(rxL);
    ctx.beginPath();
    ctx.ellipse(
      vm.offsetX + cxM * vm.scaleX,
      vm.offsetY + cyL * vm.scaleY,
      rxM * vm.scaleX,
      ryL * vm.scaleY,
      0,
      0,
      Math.PI * 2
    );
    ctx.stroke();
  }

  /** Logical circle (r,r); uses scaleX/scaleY so L/R/T/B margins match (slight ellipse if scaleX ≠ scaleY). */
  function strokeCircleL(cxL, cyL, rL, vm) {
    strokeEllipse(cxL, cyL, rL, rL, vm);
  }

  /**
   * Hold frame: render the actual SVG file as an image.
   * drawImage scales the SVG (viewBox 1200×630) to the canvas (2400×1260).
   * This guarantees a pixel-perfect match with blog_og_nvidia_04.svg.
   */
  const holdImg = new Image();
  holdImg.src = "../images/public/blog_og_nvidia_04.svg";
  let holdImgReady = false;
  holdImg.onload = () => {
    holdImgReady = true;
    if (typeof fullRefresh === "function") fullRefresh();
  };

  function renderHold(p) {
    if (holdImgReady) {
      ctx.drawImage(holdImg, 0, 0, W, H);
      return;
    }
    ctx.lineWidth = p.strokeW;
    ctx.lineCap = "round";
    for (let i = 0; i < N; i++) {
      const g = RINGS[i];
      ctx.strokeStyle = i === 0 ? SEED_STROKE_HEX : p.ringFill;
      ctx.beginPath();
      ctx.ellipse(
        g.cx * VIEW_SCALE, CY * VIEW_SCALE,
        g.rOut * VIEW_SCALE, RY0 * VIEW_SCALE,
        0, 0, Math.PI * 2
      );
      ctx.stroke();
    }
  }

  /** Ring 0 = the seed. Always drawn as an orange circle at its SVG position. */
  const G0 = RINGS[0];

  function drawRing0(vm, p) {
    ctx.save();
    ctx.strokeStyle = SEED_STROKE_HEX;
    ctx.lineWidth = p.strokeW;
    ctx.lineCap = "round";
    strokeCircleL(G0.cx, CY, RY0, vm);
    ctx.restore();
  }

  /** Compute position of ring i (1..N-1) emerging from ring 0 center. u in [0,1]. */
  function emergePos(i, u) {
    const g = RINGS[i];
    const cx = lerp(G0.cx, g.cx, u);
    const rx = lerp(RY0, g.rOut, u);
    return { cx, cy: CY, rx, ry: RY0 };
  }

  /** Collapse rings N-1..1 back toward ring 0, one at a time. */
  function drawCollapseChained(tRel, collapseFr, vm) {
    const cf = Math.max(1, collapseFr);
    const maxSeg = N - 2;
    const seg = Math.min(maxSeg, Math.floor(tRel / cf));
    const u = easeInOutPow7(clamp((tRel - seg * cf) / cf, 0, 1));
    const iLead = N - 1 - seg;
    const iTarget = iLead - 1;
    const GL = RINGS[iLead];
    const GT = RINGS[iTarget];

    for (let i = 1; i < iTarget; i++) {
      strokeEllipse(RINGS[i].cx, CY, RINGS[i].rOut, RY0, vm);
    }
    if (iTarget >= 1 && u < 1 - 1e-6) {
      strokeEllipse(GT.cx, CY, GT.rOut, RY0, vm);
    }
    const cx = lerp(GL.cx, GT.cx, u);
    const rx = lerp(GL.rOut, GT.rOut, u);
    strokeEllipse(cx, CY, rx, RY0, vm);
  }

  function renderFrame(fi, p) {
    const { seedHold, strokeW, emergeFr, collapseFr, holdFull, bg, squashPeak } = p;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const { vm } = computeViewAndSeed(p);
    const tot = totalFrames(p);
    let t = ((fi % tot) + tot) % tot;

    /* ── Seed: just ring 0 (orange circle) ── */
    if (t < seedHold) {
      drawRing0(vm, p);
      return;
    }
    t -= seedHold;

    /* ── Emerge: rings 1..N-1 peel off from ring 0 one by one; ring 0 on top ── */
    const emergeLen = N * emergeFr;
    if (t < emergeLen) {
      paintRings(p, () => {
        for (let i = 1; i < N; i++) {
          const u = fanProgress(i, t, emergeLen, N);
          if (u <= 0) continue;
          const o = emergePos(i, u);
          strokeEllipse(o.cx, o.cy, o.rx, o.ry, vm);
        }
      });
      drawRing0(vm, p);
      return;
    }
    t -= emergeLen;

    /* ── Hold: SVG image (pixel-perfect) ── */
    if (t < holdFull) {
      renderHold(p);
      return;
    }
    t -= holdFull;

    /* ── Collapse: rings 1..N-1 fold back toward ring 0; ring 0 drawn on top ── */
    const collapseLen = N * collapseFr;
    if (t < collapseLen) {
      paintRings(p, () => drawCollapseChained(t, collapseFr, vm));
      drawRing0(vm, p);
      return;
    }

    /* ── Trailing seed: ring 0 again ── */
    drawRing0(vm, p);
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
