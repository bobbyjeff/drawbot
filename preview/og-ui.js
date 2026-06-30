"use strict";

import {
  W, H, VIEW_SCALE,
  _skipBg, setSkipBg, setExportFrameIndex,
} from './og-shared.js';

/* ── Canvas ──────────────────────────────────────────────────────── */
const canvas = document.getElementById("c");
const ctx    = canvas.getContext("2d", { alpha: true });

/* ── Preset registry ─────────────────────────────────────────────── */
const PRESET_MODULES = {
  converge:     () => import('./presets/converge.js'),
  speed:        () => import('./presets/speed.js'),
  perspective:  () => import('./presets/perspective.js'),
  gesture:      () => import('./presets/gesture.js'),
  wind:         () => import('./presets/wind.js'),
  sphere:       () => import('./presets/sphere.js'),
  parametric:   () => import('./presets/parametric.js'),
  treemap:      () => import('./presets/treemap.js'),
  sankey:       () => import('./presets/sankey.js'),
  originLaunch: () => import('./presets/originLaunch.js'),
  bell:         () => import('./presets/bell.js'),
};

const VALID_PRESETS = new Set(Object.keys(PRESET_MODULES));

const presetCache = {};

async function loadPreset(name) {
  if (!presetCache[name]) {
    const mod = await PRESET_MODULES[name]();
    presetCache[name] = mod.create(ctx);
  }
  return presetCache[name];
}

/* ── State ───────────────────────────────────────────────────────── */
let activePresetName = "parametric";
let playing    = false;
let frameIndex = 0;
let lastT      = 0;
let raf        = null;
let segRaf     = null;
let canvasMode = '1080p';

const el = id => document.getElementById(id);

/* ── Param reader ────────────────────────────────────────────────── */
function readParams() {
  return {
    bg:          el("bgHex").value,
    strokeColor: el("fgHex").value,
    segColor:    el("segHex").value,
    strokeW:     parseFloat(el("strokeW").value) * VIEW_SCALE,
    fps:         parseInt(el("fps").value, 10),
    emergeFr:    parseInt(el("emergeFr").value, 10),
    segEnabled:  el("segEnabled").checked,
    segDensity:  parseInt(el("segDensity").value, 10) / 100,
    segSize:     parseInt(el("segSize").value, 10) / 100,
    segSpeed:    parseInt(el("segSpeed").value, 10) / 100,
    nodeEnabled: el("nodeEnabled").checked,
    nodeColor:   el("nodeHex").value,
    nodeDensity: parseInt(el("nodeDensity").value, 10) / 100,
    nodeSpeed:   parseInt(el("nodeSpeed").value, 10) / 100,
  };
}

function totalFrames(p) { return p.emergeFr; }

const CONVERGE_DEFAULT_LOOP_T = 0.5;
function defaultConvergeFrame(p) {
  const tot = totalFrames(p);
  if (tot <= 1) return 0;
  return Math.min(tot - 1, Math.round(CONVERGE_DEFAULT_LOOP_T * (tot - 1)));
}

/* ── Canvas mode ─────────────────────────────────────────────────── */
function applyCanvasMode() {
  if (canvasMode === '1080p') {
    canvas.width  = 1920; canvas.height = 1080;
    canvas.style.aspectRatio = '1920 / 1080';
  } else if (canvasMode === '4k') {
    canvas.width  = 3840; canvas.height = 2160;
    canvas.style.aspectRatio = '3840 / 2160';
  } else {
    canvas.width  = W;    canvas.height = H;
    canvas.style.aspectRatio = `${W} / ${H}`;
  }
}

/* ── Frame renderer ──────────────────────────────────────────────── */
function renderFrame(fi, p) {
  const preset = presetCache[activePresetName];
  if (!preset) return;

  if (canvasMode === '1080p' || canvasMode === '4k') {
    const cW = canvasMode === '4k' ? 3840 : 1920;
    const cH = canvasMode === '4k' ? 2160 : 1080;
    ctx.save();
    if (activePresetName === 'parametric' || activePresetName === 'originLaunch') {
      ctx.setTransform(cW / W, 0, 0, cH / H, 0, 0);
    } else {
      const scale   = Math.min(cW / W, cH / H);
      const offsetX = (cW - W * scale) / 2;
      const offsetY = (cH - H * scale) / 2;
      if (_skipBg) { ctx.clearRect(0, 0, cW, cH); }
      else { ctx.fillStyle = p.bg; ctx.fillRect(0, 0, cW, cH); }
      ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    }
    preset.render(fi, p);
    ctx.restore();
  } else {
    preset.render(fi, p);
  }
}

/* ── Labels ──────────────────────────────────────────────────────── */
function updateLabels() {
  const p = readParams();
  el("vStrokeW").textContent  = (p.strokeW / VIEW_SCALE).toFixed(0);
  el("vFps").textContent      = String(p.fps);
  el("vEmergeFr").textContent = String(p.emergeFr);
  const maxFi = Math.max(0, totalFrames(p) - 1);
  el("scrub").max = String(maxFi);
  if (frameIndex > maxFi) frameIndex = maxFi;

  if (el("bellHeight"))     el("vBellHeight").textContent   = el("bellHeight").value;
  if (el("convergeBend"))   el("vConvergeBend").textContent = el("convergeBend").value;
  if (el("sphereRings"))    el("vSphereRings").textContent  = el("sphereRings").value;
  if (el("paramCurves")) {
    const curves = parseInt(el("paramCurves").value, 10);
    el("vParamCurves").textContent    = String(curves);
    el("vParamRecursion").textContent = el("paramRecursion").value;
    const N_A_current = curves - 1;
    const loopFrames  = Math.round(480 / N_A_current);
    if (activePresetName === "parametric" || activePresetName === "originLaunch") {
      el("emergeFr").value = String(loopFrames);
      el("vEmergeFr").textContent = String(loopFrames);
    }
  }
  if (el("speedSpace")) {
    el("vSpace").textContent      = el("speedSpace").value;
    el("vVelocity").textContent   = el("speedVelocity").value;
    el("vColor").textContent      = el("speedColor").value;
    el("vScale").textContent      = el("speedScale").value;
    el("vPosition").textContent   = el("speedPosition").value;
    el("vDither").textContent     = el("speedDither").value;
    el("vSpeedPersp").textContent = el("speedPersp").value;
  }
  if (el("perspDepth")) {
    el("vDepth").textContent    = el("perspDepth").value;
    el("vAngle").textContent    = el("perspAngle").value;
    el("vPerspPos").textContent = el("perspPosition").value;
    el("vShape").textContent    = el("perspShape").value;
  }
  if (el("gestScale")) {
    el("vGestScale").textContent  = el("gestScale").value;
    el("vGestAmp").textContent    = el("gestAmp").value;
    el("vGestWaves").textContent  = el("gestWaves").value;
    el("vGestDamp").textContent   = el("gestDamp").value;
    el("vGestSkew").textContent   = el("gestSkew").value;
    el("vGestRhythm").textContent = el("gestRhythm").value;
    el("vGestPos").textContent    = el("gestPos").value;
    el("vGestFrag").textContent   = el("gestFrag").value;
    el("vGestHeight").textContent = el("gestHeight").value;
  }
  el("vSegDensity").textContent  = el("segDensity").value;
  el("vSegSize").textContent     = el("segSize").value;
  el("vSegSpeed").textContent    = el("segSpeed").value;
  el("vNodeDensity").textContent = el("nodeDensity").value;
  el("vNodeSpeed").textContent   = el("nodeSpeed").value;
  if (el("tmComplexity")) {
    el("vTmComplexity").textContent = el("tmComplexity").value;
    el("vTmScale").textContent      = el("tmScale").value;
    el("vTmColors").textContent     = el("tmColors").value;
    el("vTmFill").textContent       = el("tmFill").value;
    el("vTmRhythm").textContent     = el("tmRhythm").value;
    el("vTmGravity").textContent    = el("tmGravity").value;
  }
  if (activePresetName === 'sankey') {
    el("vSankeyBundle").textContent = el("sankeyBundle").value;
    el("vSankeyCenter").textContent = el("sankeyCenter").value;
    el("vSankeyWidth").textContent  = el("sankeyWidth").value;
  }
  if (activePresetName === 'originLaunch' && el('ovalSize')) {
    el("vOvalSize").textContent   = el("ovalSize").value;
    el("vOvalAspect").textContent = el("ovalAspect").value;
    el("vOvalTilt").textContent   = el("ovalTilt").value;
    el("vOvalDash").textContent   = el("ovalDash").value;
    const dashGroup = el("ovalDashGroup");
    if (dashGroup) dashGroup.style.display = el("ovalDashed").checked ? "" : "none";
  }
}

/* ── Preset UI toggle ────────────────────────────────────────────── */
function updatePresetUI() {
  el("convergeControls").style.display    = activePresetName === "converge"    ? "" : "none";
  el("speedControls").style.display       = activePresetName === "speed"       ? "" : "none";
  el("perspectiveControls").style.display = activePresetName === "perspective" ? "" : "none";
  el("gestureControls").style.display     = activePresetName === "gesture"     ? "" : "none";
  el("parametricControls").style.display  = (activePresetName === "parametric" || activePresetName === "originLaunch") ? "" : "none";
  el("sphereControls").style.display      = activePresetName === "sphere"      ? "" : "none";
  el("treemapControls").style.display     = activePresetName === "treemap"     ? "" : "none";
  el("sankeyControls").style.display      = activePresetName === "sankey"      ? "" : "none";
  el("ovalControls").style.display        = activePresetName === "originLaunch" ? "" : "none";
  el("bellControls").style.display        = activePresetName === "bell"         ? "" : "none";
}

/* ── Paint (single frame) ────────────────────────────────────────── */
function paint() {
  const p = readParams();
  renderFrame(frameIndex, p);
  const tot = totalFrames(p);
  el("scrub").value = String(frameIndex % tot);
  el("frameLabel").textContent = `${frameIndex % tot} / ${tot - 1}`;
}

/* ── rAF loops ───────────────────────────────────────────────────── */
function stopSegLoop() {
  if (segRaf) { cancelAnimationFrame(segRaf); segRaf = null; }
}

function segLoopActive() {
  return el("segEnabled").checked || el("nodeEnabled").checked ||
         activePresetName === "originLaunch" || activePresetName === "sankey";
}

function startSegLoop() {
  if (segRaf || playing) return;
  function loop() {
    if (playing || !segLoopActive()) { segRaf = null; return; }
    const p = readParams();
    renderFrame(frameIndex, p);
    segRaf = requestAnimationFrame(loop);
  }
  segRaf = requestAnimationFrame(loop);
}

function tick(now) {
  if (!playing) return;
  const p = readParams();
  const interval = 1000 / p.fps;
  if (now - lastT >= interval) {
    lastT = now;
    frameIndex++;
    const tot = totalFrames(p);
    if (!el("loop").checked && frameIndex >= tot) {
      frameIndex = tot - 1;
      setPlaying(false);
      return;
    }
    el("scrub").value = String(frameIndex % tot);
    el("frameLabel").textContent = `${frameIndex % tot} / ${tot - 1}`;
  }
  renderFrame(frameIndex, p);
  raf = requestAnimationFrame(tick);
}

function setPlaying(val) {
  playing = val;
  el("playToggle").innerHTML = playing ? '&#9646;&#9646;' : '&#9654;';
  if (playing) {
    stopSegLoop();
    lastT = performance.now();
    raf = requestAnimationFrame(tick);
  } else {
    if (raf) cancelAnimationFrame(raf);
    if (segLoopActive()) startSegLoop();
  }
}

/* ── Basic controls ──────────────────────────────────────────────── */
el("playToggle").addEventListener("click", () => setPlaying(!playing));

el("scrub").addEventListener("input", () => {
  frameIndex = parseInt(el("scrub").value, 10);
  paint();
});

document.querySelectorAll(".controls input").forEach(inp => {
  inp.addEventListener("input", () => { updateLabels(); paint(); saveUIState(); });
});

el("segEnabled").addEventListener("input", () => {
  el("segControls").style.display = el("segEnabled").checked ? "" : "none";
  if (segLoopActive() && !playing) startSegLoop();
  else if (!segLoopActive()) stopSegLoop();
});

el("nodeEnabled").addEventListener("input", () => {
  el("nodeControls").style.display = el("nodeEnabled").checked ? "" : "none";
  if (segLoopActive() && !playing) startSegLoop();
  else if (!segLoopActive()) stopSegLoop();
});

/* ── Export status helpers ───────────────────────────────────────── */
function exportPct(statusEl, pct) {
  statusEl.style.opacity = '1';
  statusEl.textContent = pct < 100 ? `${pct}%` : '';
}
function exportDone(statusEl) {
  statusEl.style.opacity = '1';
  statusEl.textContent = '✓';
  setTimeout(() => { statusEl.style.opacity = '0'; setTimeout(() => { statusEl.textContent = ''; }, 400); }, 1200);
}

/* ── PNG export ──────────────────────────────────────────────────── */
el("exportPng").addEventListener("click", () => {
  const p = readParams();
  const prevMode = canvasMode;
  canvasMode = "og";
  applyCanvasMode();
  setSkipBg(!!(el("transparentBg") && el("transparentBg").checked));
  paint();
  setSkipBg(false);
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `og-${activePresetName}.png`; a.click();
    URL.revokeObjectURL(url);
    canvasMode = prevMode; applyCanvasMode(); paint();
  }, "image/png");
});

/* ── SVG export ──────────────────────────────────────────────────── */
el("exportSvg").addEventListener("click", () => {
  const p = readParams();
  const svgElements = [];
  let currentBg = p.bg;

  let svgMatStack = [{ a:1, b:0, c:0, d:1, tx:0, ty:0 }];
  function svgMat() { return svgMatStack[svgMatStack.length - 1]; }
  function matMul(m, n) {
    return {
      a:  m.a*n.a  + m.c*n.b,   b:  m.b*n.a  + m.d*n.b,
      c:  m.a*n.c  + m.c*n.d,   d:  m.b*n.c  + m.d*n.d,
      tx: m.a*n.tx + m.c*n.ty + m.tx,
      ty: m.b*n.tx + m.d*n.ty + m.ty,
    };
  }
  function svgPt(x, y) {
    const m = svgMat();
    return [(m.a*x + m.c*y + m.tx) / VIEW_SCALE, (m.b*x + m.d*y + m.ty) / VIEW_SCALE];
  }

  const origSave          = ctx.save.bind(ctx);
  const origRestore       = ctx.restore.bind(ctx);
  const origTranslate     = ctx.translate.bind(ctx);
  const origRotate        = ctx.rotate.bind(ctx);
  const origStroke        = ctx.stroke.bind(ctx);
  const origFill          = ctx.fill.bind(ctx);
  const origFillRect      = ctx.fillRect.bind(ctx);
  const origBeginPath     = ctx.beginPath.bind(ctx);
  const origMoveTo        = ctx.moveTo.bind(ctx);
  const origLineTo        = ctx.lineTo.bind(ctx);
  const origBezierCurveTo = ctx.bezierCurveTo.bind(ctx);
  const origArcTo         = ctx.arcTo.bind(ctx);
  const origArc           = ctx.arc.bind(ctx);
  const origSetLineDash   = ctx.setLineDash.bind(ctx);
  const origEllipse       = ctx.ellipse.bind(ctx);
  const origClosePath     = ctx.closePath.bind(ctx);

  let curPath = "";
  let curDash = [];
  let svgCurX = 0, svgCurY = 0;

  ctx.save      = function () { svgMatStack.push({ ...svgMat() }); origSave(); };
  ctx.restore   = function () { if (svgMatStack.length > 1) svgMatStack.pop(); origRestore(); };
  ctx.translate = function (tx, ty) {
    svgMatStack[svgMatStack.length - 1] = matMul(svgMat(), { a:1, b:0, c:0, d:1, tx, ty });
    origTranslate(tx, ty);
  };
  ctx.rotate = function (angle) {
    const cs = Math.cos(angle), sn = Math.sin(angle);
    svgMatStack[svgMatStack.length - 1] = matMul(svgMat(), { a:cs, b:sn, c:-sn, d:cs, tx:0, ty:0 });
    origRotate(angle);
  };
  ctx.beginPath  = function ()    { curPath = ""; svgCurX = 0; svgCurY = 0; origBeginPath(); };
  ctx.closePath  = function ()    { curPath += "Z"; origClosePath(); };
  ctx.moveTo = function (x, y) {
    svgCurX = x; svgCurY = y;
    const [sx, sy] = svgPt(x, y);
    curPath += `M${sx.toFixed(2)},${sy.toFixed(2)}`;
    origMoveTo(x, y);
  };
  ctx.lineTo = function (x, y) {
    svgCurX = x; svgCurY = y;
    const [sx, sy] = svgPt(x, y);
    curPath += `L${sx.toFixed(2)},${sy.toFixed(2)}`;
    origLineTo(x, y);
  };
  ctx.bezierCurveTo = function (c1x, c1y, c2x, c2y, ex, ey) {
    const [sc1x, sc1y] = svgPt(c1x, c1y);
    const [sc2x, sc2y] = svgPt(c2x, c2y);
    const [sex,  sey]  = svgPt(ex, ey);
    curPath += `C${sc1x.toFixed(2)},${sc1y.toFixed(2)} ${sc2x.toFixed(2)},${sc2y.toFixed(2)} ${sex.toFixed(2)},${sey.toFixed(2)}`;
    svgCurX = ex; svgCurY = ey;
    origBezierCurveTo(c1x, c1y, c2x, c2y, ex, ey);
  };
  ctx.arcTo = function (x1, y1, x2, y2, r) {
    if (r < 0.01) {
      svgCurX = x1; svgCurY = y1;
      const [sx1, sy1] = svgPt(x1, y1);
      curPath += `L${sx1.toFixed(2)},${sy1.toFixed(2)}`;
      origArcTo(x1, y1, x2, y2, r); return;
    }
    const dx1 = x1 - svgCurX, dy1 = y1 - svgCurY;
    const l1  = Math.sqrt(dx1*dx1 + dy1*dy1) || 1;
    const ux1 = dx1/l1, uy1 = dy1/l1;
    const dx2 = x2 - x1,  dy2 = y2 - y1;
    const l2  = Math.sqrt(dx2*dx2 + dy2*dy2) || 1;
    const ux2 = dx2/l2, uy2 = dy2/l2;
    const dot     = ux1*ux2 + uy1*uy2;
    const sinHalf = Math.sqrt(Math.max(0, (1 - dot) * 0.5));
    const cosHalf = Math.sqrt(Math.max(0, (1 + dot) * 0.5));
    const tl      = sinHalf > 0.0001 ? r * cosHalf / sinHalf : r;
    const cl      = Math.min(tl, l1, l2);
    const asx = x1 - ux1*cl,  asy = y1 - uy1*cl;
    const aex = x1 + ux2*cl,  aey = y1 + uy2*cl;
    if (Math.abs(asx - svgCurX) > 0.05 || Math.abs(asy - svgCurY) > 0.05) {
      const [sasx, sasy] = svgPt(asx, asy);
      curPath += `L${sasx.toFixed(2)},${sasy.toFixed(2)}`;
    }
    const sweep = (ux1*uy2 - uy1*ux2) > 0 ? 1 : 0;
    const svgR  = (r / VIEW_SCALE).toFixed(2);
    const [saex, saey] = svgPt(aex, aey);
    curPath += `A${svgR},${svgR},0,0,${sweep},${saex.toFixed(2)},${saey.toFixed(2)}`;
    svgCurX = aex; svgCurY = aey;
    origArcTo(x1, y1, x2, y2, r);
  };
  ctx.arc = function (cx, cy, r, startAngle, endAngle, anticlockwise) {
    const STEPS = 36;
    const dir   = anticlockwise ? -1 : 1;
    for (let i = 0; i <= STEPS; i++) {
      const a  = startAngle + dir * (endAngle - startAngle) * i / STEPS;
      const px = cx + r * Math.cos(a);
      const py = cy + r * Math.sin(a);
      const [sx, sy] = svgPt(px, py);
      curPath += (i === 0 ? `M` : `L`) + `${sx.toFixed(2)},${sy.toFixed(2)}`;
    }
    origArc(cx, cy, r, startAngle, endAngle, anticlockwise);
  };
  ctx.setLineDash = function (arr) { curDash = arr || []; origSetLineDash(arr); };
  ctx.ellipse = function (cx, cy, rx, ry, rotation, startAngle, endAngle) {
    const STEPS = 72;
    const cr = Math.cos(rotation), sr = Math.sin(rotation);
    for (let i = 0; i <= STEPS; i++) {
      const a  = startAngle + (endAngle - startAngle) * i / STEPS;
      const ex = rx * Math.cos(a), ey = ry * Math.sin(a);
      const px = cx + ex * cr - ey * sr;
      const py = cy + ex * sr + ey * cr;
      const [sx, sy] = svgPt(px, py);
      curPath += (i === 0 ? `M` : `L`) + `${sx.toFixed(2)},${sy.toFixed(2)}`;
    }
    origEllipse(cx, cy, rx, ry, rotation, startAngle, endAngle);
  };
  ctx.stroke = function () {
    if (curPath) {
      const alpha  = (ctx.globalAlpha !== undefined && ctx.globalAlpha < 1) ? ` opacity="${ctx.globalAlpha.toFixed(3)}"` : '';
      const dashes = curDash.length >= 2
        ? ` stroke-dasharray="${curDash.map(v => (v/VIEW_SCALE).toFixed(2)).join(' ')}"` : '';
      const dashOff = ctx.lineDashOffset
        ? ` stroke-dashoffset="${(-ctx.lineDashOffset / VIEW_SCALE).toFixed(2)}"` : '';
      svgElements.push(`  <path d="${curPath}" stroke="${ctx.strokeStyle}" stroke-width="${(ctx.lineWidth / VIEW_SCALE).toFixed(2)}" stroke-linecap="${ctx.lineCap}" fill="none"${alpha}${dashes}${dashOff}/>`);
    }
    origStroke();
  };
  ctx.fill = function () {
    if (curPath) {
      const alpha = (ctx.globalAlpha !== undefined && ctx.globalAlpha < 1) ? ` opacity="${ctx.globalAlpha.toFixed(3)}"` : '';
      svgElements.push(`  <path d="${curPath}" fill="${ctx.fillStyle}" stroke="none"${alpha}/>`);
    }
    origFill();
  };
  ctx.fillRect = function (x, y, w, h) {
    if (w >= W && h >= H) { currentBg = ctx.fillStyle; }
    else { svgElements.push(`  <rect x="${(x/VIEW_SCALE).toFixed(2)}" y="${(y/VIEW_SCALE).toFixed(2)}" width="${(w/VIEW_SCALE).toFixed(2)}" height="${(h/VIEW_SCALE).toFixed(2)}" fill="${ctx.fillStyle}"/>`); }
    origFillRect(x, y, w, h);
  };

  renderFrame(frameIndex, p);

  ctx.save = origSave; ctx.restore = origRestore; ctx.translate = origTranslate;
  ctx.rotate = origRotate; ctx.beginPath = origBeginPath; ctx.closePath = origClosePath;
  ctx.moveTo = origMoveTo; ctx.lineTo = origLineTo; ctx.bezierCurveTo = origBezierCurveTo;
  ctx.arcTo = origArcTo; ctx.arc = origArc; ctx.setLineDash = origSetLineDash;
  ctx.ellipse = origEllipse; ctx.stroke = origStroke; ctx.fill = origFill;
  ctx.fillRect = origFillRect;

  const VW = W / VIEW_SCALE, VH = H / VIEW_SCALE;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW} ${VH}" width="${VW}" height="${VH}">\n  <rect width="100%" height="100%" fill="${currentBg}"/>\n${svgElements.join("\n")}\n</svg>`;
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "og-lines.svg"; a.click();
  URL.revokeObjectURL(url);
  exportDone(el("exportStatus"));
});

/* ── GIF export ──────────────────────────────────────────────────── */
el("exportGif").addEventListener("click", () => {
  const p = readParams();
  const tot = totalFrames(p);
  const status = el("exportStatus");
  const transparentExport = !!(el("transparentBg") && el("transparentBg").checked);
  const gif = new GIF({
    workers: 2, quality: 10,
    width: canvas.width, height: canvas.height,
    workerScript: "vendor/gifjs/gif.worker.js",
    transparent: transparentExport ? 0x00000000 : null,
  });
  setSkipBg(transparentExport);
  for (let i = 0; i < tot; i++) {
    setExportFrameIndex(i);
    renderFrame(i, p);
    gif.addFrame(ctx, { copy: true, delay: Math.round(1000 / p.fps) });
  }
  setExportFrameIndex(-1);
  setSkipBg(false);
  gif.on("finished", blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "nvidia-lines.gif"; a.click();
    URL.revokeObjectURL(url);
    exportDone(status);
  });
  gif.on("progress", pct => exportPct(status, Math.round(pct * 100)));
  gif.render();
});

/* ── WebM export ─────────────────────────────────────────────────── */
el("exportWebm").addEventListener("click", async () => {
  const p = readParams();
  const tot = totalFrames(p);
  const status = el("exportStatus");
  const stream   = canvas.captureStream(0);
  const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9", videoBitsPerSecond: 8000000 });
  const chunks = [];
  recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  setSkipBg(!!(el("transparentBg") && el("transparentBg").checked));
  recorder.start();
  for (let i = 0; i < tot; i++) {
    setExportFrameIndex(i);
    renderFrame(i, p);
    stream.getVideoTracks()[0].requestFrame();
    await new Promise(r => setTimeout(r, Math.round(1000 / p.fps)));
    exportPct(status, Math.round((i + 1) / tot * 100));
  }
  setExportFrameIndex(-1);
  setSkipBg(false);
  recorder.stop();
  await new Promise(r => { recorder.onstop = r; });
  const blob = new Blob(chunks, { type: "video/webm" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "nvidia-lines.webm"; a.click();
  URL.revokeObjectURL(url);
  exportDone(status);
});

/* ── MP4 export ──────────────────────────────────────────────────── */
el("exportMp4").addEventListener("click", async () => {
  const p = readParams();
  const tot = totalFrames(p);
  const status = el("exportStatus");
  const muxer = new Mp4Muxer.Muxer({
    target: new Mp4Muxer.ArrayBufferTarget(),
    video: { codec: "avc", width: canvas.width, height: canvas.height },
    fastStart: "in-memory",
  });
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: () => { status.textContent = `Error`; },
  });
  encoder.configure({
    codec: "avc1.640033", width: canvas.width, height: canvas.height,
    bitrate: 8_000_000, framerate: p.fps,
  });
  for (let i = 0; i < tot; i++) {
    setExportFrameIndex(i);
    renderFrame(i, p);
    const frame = new VideoFrame(canvas, {
      timestamp: Math.round(i * 1_000_000 / p.fps),
      duration:  Math.round(1_000_000 / p.fps),
    });
    encoder.encode(frame, { keyFrame: i % (p.fps * 2) === 0 });
    frame.close();
    if (encoder.encodeQueueSize > 5) await encoder.flush();
    exportPct(status, Math.round((i + 1) / tot * 100));
  }
  setExportFrameIndex(-1);
  await encoder.flush();
  encoder.close();
  muxer.finalize();
  const blob = new Blob([muxer.target.buffer], { type: "video/mp4" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "nvidia-lines.mp4"; a.click();
  URL.revokeObjectURL(url);
  exportDone(status);
});

/* ── Preset defaults & colors ────────────────────────────────────── */
const OG_PRESET_STORAGE_KEY = "og-nvidia-05-preset-v1";

const PRESET_DEFAULTS = {
  parametric:   { bg: '#2D2D2B', fg: '#F44E00', curves: 4, frames: 160  },
  sphere:       { bg: '#2D2D2B', fg: '#CCA78C', frames: 135  },
  treemap:      { strokeW: 1, frames: 150, canvasMode: 'og' },
  sankey:       { frames: 75, segEnabled: true, sankeyBundle: 38, fps: 25 },
  originLaunch: { bg: '#2D2D2B', fg: '#F44E00', curves: 4, frames: 160, fps: 20, strokeW: 2, segEnabled: false, nodeEnabled: false },
};

function applyPresetColors(presetName) {
  const d = PRESET_DEFAULTS[presetName];
  if (!d) return;
  if (d.bg) { el('bgHex').value = d.bg; el('bgText').value = d.bg.toUpperCase(); }
  if (d.fg) { el('fgHex').value = d.fg; el('fgText').value = d.fg.toUpperCase(); }
  if (d.segEnabled != null) {
    el('segEnabled').checked = d.segEnabled;
    el('segControls').style.display = d.segEnabled ? '' : 'none';
  }
  if (d.nodeEnabled != null) {
    el('nodeEnabled').checked = d.nodeEnabled;
    el('nodeControls').style.display = d.nodeEnabled ? '' : 'none';
  }
  if (d.curves != null && el('paramCurves')) el('paramCurves').value = String(d.curves);
  if (d.frames)   { el('emergeFr').value = d.frames; updateLabels(); }
  if (d.strokeW != null) { el('strokeW').value = String(d.strokeW); updateLabels(); }
  if (d.sankeyBundle != null && el('sankeyBundle')) el('sankeyBundle').value = String(d.sankeyBundle);
  if (d.fps != null && el('fps')) { el('fps').value = String(d.fps); updateLabels(); }
  if (d.canvasMode) {
    canvasMode = d.canvasMode;
    el('sizeOG').classList.toggle('primary',   d.canvasMode === 'og');
    el('size1080').classList.toggle('primary', d.canvasMode === '1080p');
    el('size4k').classList.toggle('primary',   d.canvasMode === '4k');
  }
}

/* ── Preset dropdown ─────────────────────────────────────────────── */
el("preset").addEventListener("change", async () => {
  activePresetName = el("preset").value;
  try { localStorage.setItem(OG_PRESET_STORAGE_KEY, activePresetName); } catch (_) {}
  applyPresetColors(activePresetName);
  applyCanvasMode();
  updatePresetUI();
  if (activePresetName === "converge") {
    frameIndex = defaultConvergeFrame(readParams());
  } else {
    frameIndex = 0;
  }
  await loadPreset(activePresetName);
  paint();
  if (segLoopActive() && !playing) startSegLoop();
  else if (!segLoopActive()) stopSegLoop();
  saveUIState();
});

/* ── Color pickers ───────────────────────────────────────────────── */
[["bgHex","bgText"], ["fgHex","fgText"], ["segHex","segText"], ["nodeHex","nodeText"]].forEach(([pickerId, textId]) => {
  const picker = el(pickerId);
  const text   = el(textId);
  picker.addEventListener("input", () => { text.value = picker.value.toUpperCase(); paint(); saveUIState(); });
  text.addEventListener("input", () => {
    const v = text.value.trim();
    if (/^#[0-9A-Fa-f]{6}$/.test(v)) { picker.value = v; paint(); }
  });
  text.addEventListener("change", () => {
    let v = text.value.trim();
    if (!v.startsWith("#")) v = "#" + v;
    if (/^#[0-9A-Fa-f]{6}$/.test(v)) { picker.value = v; text.value = v.toUpperCase(); paint(); }
    else { text.value = picker.value.toUpperCase(); }
  });
});

/* ── Brand palette / swatches ────────────────────────────────────── */
const BRAND_PALETTE = [
  '#131412', '#3C3C38', '#8B8B82', '#C4C4BC', '#EDECE8',
  '#FBCFC0', '#FBC8C8', '#F5E0C8', '#F0EAC4', '#BEECD8', '#B4F0E8', '#C0D8F8', '#D0CDF8', '#F4C4F0', '#F8C4B4',
  '#F09378', '#F09090', '#CCAA82', '#D0CC7A', '#60D090', '#3EDCC8', '#6898E8', '#9898E8', '#DC80D8', '#E8887A',
  '#E03E0A', '#D45050', '#A0703C', '#9A920A', '#18A050', '#04A098', '#1858D8', '#5058C8', '#B030A8', '#CC3838',
  '#8A1E00', '#883030', '#4E2800', '#3E380A', '#004820', '#004038', '#082038', '#14104C', '#4C0C48', '#4C0C10',
];

function buildSwatches(gridId, pickerId, textId) {
  const grid   = el(gridId);
  const picker = el(pickerId);
  const text   = el(textId);

  function setColor(hex) {
    picker.value = hex;
    text.value   = hex.toUpperCase();
    grid.querySelectorAll('.swatch').forEach(s => s.classList.toggle('active', s.dataset.hex === hex.toLowerCase()));
    paint(); saveUIState();
  }

  const NEUTRAL_COUNT = 5;
  BRAND_PALETTE.forEach((hex, idx) => {
    if (idx === NEUTRAL_COUNT) {
      const sep = document.createElement('div');
      sep.style.cssText = 'width:100%;height:4px;flex-shrink:0;';
      grid.appendChild(sep);
    }
    const s = document.createElement('div');
    s.className = 'swatch';
    s.style.background = hex;
    s.dataset.hex = hex.toLowerCase();
    s.title = hex;
    if (hex.toLowerCase() === picker.value.toLowerCase()) s.classList.add('active');
    s.addEventListener('click', () => setColor(hex));
    grid.appendChild(s);
  });

  picker.addEventListener('input', () => {
    grid.querySelectorAll('.swatch').forEach(s =>
      s.classList.toggle('active', s.dataset.hex === picker.value.toLowerCase())
    );
  });
}

buildSwatches('bgSwatches',   'bgHex',   'bgText');
buildSwatches('fgSwatches',   'fgHex',   'fgText');
buildSwatches('segSwatches',  'segHex',  'segText');
buildSwatches('nodeSwatches', 'nodeHex', 'nodeText');

/* ── UI state persistence ────────────────────────────────────────── */
const OG_STATE_KEY = 'og-nvidia-05-ui-v4';

function saveUIState() {
  try {
    const state = { _canvasMode: canvasMode };
    document.querySelectorAll('.controls input, .controls select').forEach(inp => {
      if (!inp.id) return;
      state[inp.id] = inp.type === 'checkbox' ? inp.checked : inp.value;
    });
    localStorage.setItem(OG_STATE_KEY, JSON.stringify(state));
  } catch (_) {}
}

function restoreUIState() {
  try {
    let raw = localStorage.getItem(OG_STATE_KEY);
    if (!raw) {
      for (const oldKey of ['og-nvidia-05-ui-v3', 'og-nvidia-05-ui-v2', 'og-nvidia-05-ui-v1']) {
        const old = localStorage.getItem(oldKey);
        if (old) {
          const migrated = JSON.parse(old);
          migrated.emergeFr = '75';
          migrated.fps      = '25';
          raw = JSON.stringify(migrated);
          localStorage.setItem(OG_STATE_KEY, raw);
          break;
        }
      }
    }
    if (!raw) return;
    const state = JSON.parse(raw);
    document.querySelectorAll('.controls input, .controls select').forEach(inp => {
      if (!inp.id || !(inp.id in state)) return;
      if (inp.type === 'checkbox') inp.checked = state[inp.id];
      else inp.value = state[inp.id];
    });
    if (state._canvasMode) {
      canvasMode = state._canvasMode;
      el('sizeOG').classList.toggle('primary',   canvasMode === 'og');
      el('size1080').classList.toggle('primary', canvasMode === '1080p');
      el('size4k').classList.toggle('primary',   canvasMode === '4k');
      applyCanvasMode();
    }
    [['bgHex','bgText'],['fgHex','fgText'],['segHex','segText'],['nodeHex','nodeText']].forEach(([p, t]) => {
      const pk = el(p), tx = el(t);
      if (pk && tx) tx.value = pk.value.toUpperCase();
    });
    el('segControls').style.display  = el('segEnabled').checked  ? '' : 'none';
    el('nodeControls').style.display = el('nodeEnabled').checked ? '' : 'none';
    ['bg','fg','seg','node'].forEach(prefix => {
      const picker = el(prefix + 'Hex');
      const grid   = el(prefix + 'Swatches');
      if (!picker || !grid) return;
      grid.querySelectorAll('.swatch').forEach(s =>
        s.classList.toggle('active', s.dataset.hex === picker.value.toLowerCase())
      );
    });
  } catch (_) {}
}

/* ── Size buttons ────────────────────────────────────────────────── */
function setSizeMode(mode) {
  canvasMode = mode;
  el('sizeOG').classList.toggle('primary',   mode === 'og');
  el('size1080').classList.toggle('primary', mode === '1080p');
  el('size4k').classList.toggle('primary',   mode === '4k');
  applyCanvasMode(); paint(); saveUIState();
}
el('sizeOG').addEventListener('click',   () => setSizeMode('og'));
el('size1080').addEventListener('click', () => setSizeMode('1080p'));
el('size4k').addEventListener('click',   () => setSizeMode('4k'));

/* ── R key: randomize ────────────────────────────────────────────── */
function paletteContrast(hex1, hex2) {
  function lum(hex) {
    const r = parseInt(hex.slice(1,3),16)/255;
    const g = parseInt(hex.slice(3,5),16)/255;
    const b = parseInt(hex.slice(5,7),16)/255;
    const lin = c => c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055,2.4);
    return 0.2126*lin(r) + 0.7152*lin(g) + 0.0722*lin(b);
  }
  const l1 = lum(hex1), l2 = lum(hex2);
  const hi = Math.max(l1,l2), lo = Math.min(l1,l2);
  return (hi+0.05)/(lo+0.05);
}

function randomize() {
  const MIN_CONTRAST = 4.5;
  let bg, fg, attempts = 0;
  do {
    bg = BRAND_PALETTE[Math.floor(Math.random() * BRAND_PALETTE.length)];
    fg = BRAND_PALETTE[Math.floor(Math.random() * BRAND_PALETTE.length)];
    attempts++;
  } while (paletteContrast(bg, fg) < MIN_CONTRAST && attempts < 400);

  el('bgHex').value = bg; el('bgText').value = bg.toUpperCase();
  el('fgHex').value = fg; el('fgText').value = fg.toUpperCase();

  function rnd(id, lo, hi) { el(id).value = lo + Math.floor(Math.random() * (hi - lo + 1)); }

  if (activePresetName === 'converge')    { rnd('convergeBend', 0, 100); }
  else if (activePresetName === 'parametric') { rnd('paramCurves', 2, 9); rnd('paramRecursion', 0, 70); }
  else if (activePresetName === 'sphere')     { rnd('sphereRings', 3, 16); }
  else if (activePresetName === 'speed') {
    rnd('speedSpace',15,85); rnd('speedVelocity',0,100); rnd('speedColor',0,100);
    rnd('speedScale',15,85); rnd('speedPosition',15,85); rnd('speedDither',0,60); rnd('speedPersp',0,80);
  }
  else if (activePresetName === 'perspective') {
    rnd('perspDepth',10,90); rnd('perspAngle',0,100); rnd('perspPosition',15,85); rnd('perspShape',0,100);
  }
  else if (activePresetName === 'gesture') {
    rnd('gestScale',20,80); rnd('gestAmp',10,90); rnd('gestWaves',10,90); rnd('gestDamp',10,80);
    rnd('gestSkew',20,80); rnd('gestRhythm',0,80); rnd('gestPos',15,85); rnd('gestFrag',0,50); rnd('gestHeight',15,85);
  }
  else if (activePresetName === 'treemap') {
    rnd('tmComplexity',20,90); rnd('tmScale',5,75); rnd('tmColors',0,80);
    rnd('tmFill',0,70); rnd('tmRhythm',0,85); rnd('tmGravity',0,100);
  }

  updateLabels(); paint(); saveUIState();
}

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'r' || e.key === 'R') randomize();
});

/* ── Boot sequence ───────────────────────────────────────────────── */
(async function boot() {
  /* Restore saved preset name */
  try {
    let storedPreset = localStorage.getItem(OG_PRESET_STORAGE_KEY);
    if (storedPreset === "oval") storedPreset = "originLaunch";
    if (storedPreset === "soccer" || storedPreset === "planes" || storedPreset === "origin") {
      storedPreset = "parametric"; /* removed presets fall back to default */
    }
    if (storedPreset && VALID_PRESETS.has(storedPreset)) {
      activePresetName = storedPreset;
      el("preset").value = storedPreset;
    }
  } catch (_) {}

  restoreUIState();

  /* One-time stroke migration for originLaunch */
  try {
    if (activePresetName === 'originLaunch' && !localStorage.getItem('og-ol-stroke-v1')) {
      el('strokeW').value = '2';
      localStorage.setItem('og-ol-stroke-v1', '1');
    }
  } catch (_) {}

  updatePresetUI();
  applyPresetColors(activePresetName);
  applyCanvasMode();

  /* Re-apply timing defaults so loop lengths are always correct */
  (function reapplyTimingDefaults() {
    const d = PRESET_DEFAULTS[activePresetName];
    if (!d) return;
    if (d.frames != null) el('emergeFr').value = String(d.frames);
    if (d.fps    != null) el('fps').value      = String(d.fps);
    updateLabels(); saveUIState();
  })();

  frameIndex = activePresetName === "converge" ? defaultConvergeFrame(readParams()) : 0;
  updateLabels();

  /* Load the active preset, then start drawing */
  await loadPreset(activePresetName);
  paint();
  if (segLoopActive() && !playing) startSegLoop();

  /* Pre-warm remaining presets in the background (idle time) */
  if ('requestIdleCallback' in window) {
    const names = Object.keys(PRESET_MODULES).filter(n => n !== activePresetName);
    let i = 0;
    function warmNext(deadline) {
      while (i < names.length && deadline.timeRemaining() > 2) {
        loadPreset(names[i++]);
      }
      if (i < names.length) requestIdleCallback(warmNext);
    }
    requestIdleCallback(warmNext);
  }
})();
