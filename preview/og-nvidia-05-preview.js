(function () {
  "use strict";

  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d");
  const W = 2400, H = 1260;
  const VIEW_SCALE = 2;

  const LEFT_X = 0;
  const RIGHT_X = 1200;
  const TARGET_SPAN = RIGHT_X - LEFT_X;

  const START_TOP = 55.66;
  const START_BOT = 574.34;
  const LINE_COUNT = 15;
  const START_YS = Array.from({ length: LINE_COUNT }, (_, i) =>
    +(START_BOT - (START_BOT - START_TOP) * i / (LINE_COUNT - 1)).toFixed(2)
  );

  const N = START_YS.length;
  const CY = 315;
  const CONVERGE_X = 1350;
  const CURVE_SPAN = CONVERGE_X - LEFT_X;

  const LINES = START_YS.map((sy) => {
    const dy = CY - sy;

    return {
      sy,
      c1x: LEFT_X + CURVE_SPAN * 0.75, c1y: sy,
      c2x: LEFT_X + CURVE_SPAN * 0.95, c2y: CY,
    };
  });

  const MAX_DIST = Math.max(...START_YS.map(sy => Math.abs(sy - CY)));
  const lineMeta = START_YS.map(sy => {
    return { normDist: Math.abs(sy - CY) / MAX_DIST };
  });

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function subdivideBezierLeft(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, t) {
    const ax = lerp(p0x, p1x, t), ay = lerp(p0y, p1y, t);
    const bx = lerp(p1x, p2x, t), by = lerp(p1y, p2y, t);
    const cx = lerp(p2x, p3x, t), cy = lerp(p2y, p3y, t);
    const dx = lerp(ax, bx, t),   dy = lerp(ay, by, t);
    const ex = lerp(bx, cx, t),   ey = lerp(by, cy, t);
    const fx = lerp(dx, ex, t),   fy = lerp(dy, ey, t);
    return { x0: p0x, y0: p0y, x1: ax, y1: ay, x2: dx, y2: dy, x3: fx, y3: fy };
  }

  function subdivideBezierRight(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, t) {
    const ax = lerp(p0x, p1x, t), ay = lerp(p0y, p1y, t);
    const bx = lerp(p1x, p2x, t), by = lerp(p1y, p2y, t);
    const cx = lerp(p2x, p3x, t), cy = lerp(p2y, p3y, t);
    const dx = lerp(ax, bx, t),   dy = lerp(ay, by, t);
    const ex = lerp(bx, cx, t),   ey = lerp(by, cy, t);
    const fx = lerp(dx, ex, t),   fy = lerp(dy, ey, t);
    return { x0: fx, y0: fy, x1: ex, y1: ey, x2: cx, y2: cy, x3: p3x, y3: p3y };
  }

  function drawLineSegment(line, tStart, tEnd, strokeColor, lineWidth) {
    if (tEnd <= tStart) return;
    const s = VIEW_SCALE;

    const p0x = LEFT_X*s,        p0y = line.sy*s;
    const p1x = line.c1x*s,      p1y = line.c1y*s;
    const p2x = line.c2x*s,      p2y = line.c2y*s;
    const p3x = CONVERGE_X*s,    p3y = CY*s;

    let sub;
    if (tStart <= 0 && tEnd >= 1) {
      sub = { x0:p0x, y0:p0y, x1:p1x, y1:p1y, x2:p2x, y2:p2y, x3:p3x, y3:p3y };
    } else if (tStart <= 0) {
      sub = subdivideBezierLeft(p0x,p0y, p1x,p1y, p2x,p2y, p3x,p3y, tEnd);
    } else if (tEnd >= 1) {
      sub = subdivideBezierRight(p0x,p0y, p1x,p1y, p2x,p2y, p3x,p3y, tStart);
    } else {
      const r = subdivideBezierRight(p0x,p0y, p1x,p1y, p2x,p2y, p3x,p3y, tStart);
      const tRemap = (tEnd - tStart) / (1 - tStart);
      sub = subdivideBezierLeft(r.x0,r.y0, r.x1,r.y1, r.x2,r.y2, r.x3,r.y3, tRemap);
    }

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(sub.x0, sub.y0);
    ctx.bezierCurveTo(sub.x1, sub.y1, sub.x2, sub.y2, sub.x3, sub.y3);
    ctx.stroke();
  }

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry32(42);

  const BREAK_ZONE = (CONVERGE_X - LEFT_X) / (RIGHT_X - LEFT_X) * 0.7;

  const LINE_BREAKS = Array.from({ length: N }, (_, i) => {
    const nd = lineMeta[i].normDist;
    if (nd < 0.15) return [];
    const count = Math.round(lerp(0, 2, nd));
    if (count === 0) return [];
    return Array.from({ length: count }, () => {
      const baseSpeed = lerp(0.35, 0.01, nd) + rng() * 0.1;
      const mult = Math.max(1, Math.round(baseSpeed / BREAK_ZONE) + Math.floor(rng() * 3));
      return {
        pos: 0.05 + rng() * (BREAK_ZONE - 0.1),
        width: lerp(0.012, 0.03, nd) * (0.8 + rng() * 0.5),
        drift: BREAK_ZONE * mult,
        phase: rng(),
        max: BREAK_ZONE,
      };
    });
  });


  const COLOR_ZONE = BREAK_ZONE + 130 / (RIGHT_X - LEFT_X);
  const COLOR_FADE_START = COLOR_ZONE - 0.08;

  const colorRng = mulberry32(2749);
  const COLOR_SEGS = Array.from({ length: N }, (_, i) => {
    const nd = lineMeta[i].normDist;
    const count = 1 + Math.floor(colorRng() * 2);
    return Array.from({ length: count }, () => {
      const baseSpeed = lerp(0.4, 0.01, nd) + colorRng() * 0.12;
      const mult = Math.max(1, Math.round(baseSpeed / COLOR_ZONE) + Math.floor(colorRng() * 3));
      const widthVariant = [0.03, 0.08, 0.18][Math.floor(colorRng() * 3)];
      return {
        pos: colorRng() * COLOR_ZONE,
        width: widthVariant + colorRng() * 0.04,
        drift: COLOR_ZONE * mult,
        phase: colorRng(),
      };
    });
  });


  function readParams() {
    const el = id => document.getElementById(id);
    return {
      bg: el("bgHex").value,
      strokeColor: el("fgHex").value,
      segColor: el("segHex").value,
      strokeW: parseFloat(el("strokeW").value) * VIEW_SCALE,
      fps: parseInt(el("fps").value, 10),
      emergeFr: parseInt(el("emergeFr").value, 10),
    };
  }

  function totalFrames(p) {
    return p.emergeFr;
  }

  const PULSE_AMP = 4;
  const PULSE_CYCLES = 1;

  function renderFrame(fi, p) {
    ctx.fillStyle = p.bg;
    ctx.fillRect(0, 0, W, H);

    const tot = totalFrames(p);
    const t = ((fi % tot) + tot) % tot;
    const gp = t / tot;

    for (let i = 0; i < N; i++) {
      const nd = lineMeta[i].normDist;
      const line = LINES[i];

      drawLineSegment(line, 0, 1, p.strokeColor, p.strokeW);

      const colorSegs = COLOR_SEGS[i]
        .map(cs => {
          const pos = (cs.pos + (gp + cs.phase) * cs.drift) % COLOR_ZONE;
          return {
            s0: clamp(pos - cs.width / 2, 0, COLOR_ZONE),
            s1: clamp(pos + cs.width / 2, 0, COLOR_ZONE),
          };
        })
        .filter(c => c.s1 > c.s0)
        .sort((a, b) => a.s0 - b.s0);

      const MIN_GAP = 0.04;
      const FADE_STEPS = 4;
      const gr = parseInt(p.strokeColor.slice(1,3),16);
      const gg = parseInt(p.strokeColor.slice(3,5),16);
      const gb = parseInt(p.strokeColor.slice(5,7),16);

      for (let ci = 0; ci < colorSegs.length; ci++) {
        const cs = colorSegs[ci];
        const prev = ci > 0 ? colorSegs[ci - 1] : null;
        if (prev && cs.s0 < prev.s1 + MIN_GAP) continue;

        const cr = parseInt(p.segColor.slice(1,3),16);
        const cg = parseInt(p.segColor.slice(3,5),16);
        const cb = parseInt(p.segColor.slice(5,7),16);

        const mid = (cs.s0 + cs.s1) / 2;
        const fadeBlend = cs.s1 > COLOR_FADE_START
          ? clamp((mid - COLOR_FADE_START) / (COLOR_ZONE - COLOR_FADE_START), 0, 1)
          : 0;

        const br = Math.round(lerp(cr, gr, fadeBlend));
        const bg2 = Math.round(lerp(cg, gg, fadeBlend));
        const bb = Math.round(lerp(cb, gb, fadeBlend));

        drawLineSegment(line, cs.s0, cs.s1, `rgb(${br},${bg2},${bb})`, p.strokeW);
      }
    }
  }

  let playing = false;
  let frameIndex = 0;
  let lastT = 0;
  let raf = null;

  const el = id => document.getElementById(id);

  function updateLabels() {
    const p = readParams();
    el("vStrokeW").textContent = (p.strokeW / VIEW_SCALE).toFixed(0);
    el("vFps").textContent = String(p.fps);
    el("vEmergeFr").textContent = String(p.emergeFr);
    el("scrub").max = String(totalFrames(p) - 1);
  }

  function paint() {
    const p = readParams();
    renderFrame(frameIndex, p);
    const tot = totalFrames(p);
    el("scrub").value = String(frameIndex % tot);
    el("frameLabel").textContent = `${frameIndex % tot} / ${tot - 1}`;
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
        playing = false;
        return;
      }
      paint();
    }
    raf = requestAnimationFrame(tick);
  }

  el("play").addEventListener("click", () => {
    if (playing) return;
    playing = true;
    lastT = performance.now();
    raf = requestAnimationFrame(tick);
  });

  el("pause").addEventListener("click", () => {
    playing = false;
    if (raf) cancelAnimationFrame(raf);
  });

  el("scrub").addEventListener("input", () => {
    frameIndex = parseInt(el("scrub").value, 10);
    paint();
  });

  document.querySelectorAll(".controls input").forEach(inp => {
    inp.addEventListener("input", () => { updateLabels(); paint(); });
  });

  el("exportGif").addEventListener("click", () => {
    const p = readParams();
    const tot = totalFrames(p);
    const status = el("exportStatus");
    status.textContent = "Rendering GIF…";

    const gif = new GIF({
      workers: 2,
      quality: 10,
      width: W,
      height: H,
      workerScript: "vendor/gifjs/gif.worker.js",
    });

    for (let i = 0; i < tot; i++) {
      renderFrame(i, p);
      gif.addFrame(ctx, { copy: true, delay: Math.round(1000 / p.fps) });
    }

    gif.on("finished", blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "nvidia-lines.gif";
      a.click();
      URL.revokeObjectURL(url);
      status.textContent = "GIF saved!";
    });

    gif.on("progress", pct => {
      status.textContent = `Encoding GIF… ${Math.round(pct * 100)}%`;
    });

    gif.render();
  });

  el("exportWebm").addEventListener("click", async () => {
    const p = readParams();
    const tot = totalFrames(p);
    const status = el("exportStatus");
    status.textContent = "Recording WebM…";

    const stream = canvas.captureStream(0);
    const recorder = new MediaRecorder(stream, {
      mimeType: "video/webm;codecs=vp9",
      videoBitsPerSecond: 8000000,
    });

    const chunks = [];
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };

    recorder.start();

    for (let i = 0; i < tot; i++) {
      renderFrame(i, p);
      stream.getVideoTracks()[0].requestFrame();
      await new Promise(r => setTimeout(r, Math.round(1000 / p.fps)));
      status.textContent = `Recording… ${Math.round((i + 1) / tot * 100)}%`;
    }

    recorder.stop();
    await new Promise(r => { recorder.onstop = r; });

    const blob = new Blob(chunks, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "nvidia-lines.webm";
    a.click();
    URL.revokeObjectURL(url);
    status.textContent = "WebM saved!";
  });

  el("exportMp4").addEventListener("click", async () => {
    const p = readParams();
    const tot = totalFrames(p);
    const status = el("exportStatus");
    status.textContent = "Encoding MP4…";

    const muxer = new Mp4Muxer.Muxer({
      target: new Mp4Muxer.ArrayBufferTarget(),
      video: {
        codec: "avc",
        width: W,
        height: H,
      },
      fastStart: "in-memory",
    });

    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: e => { status.textContent = `Encode error: ${e.message}`; },
    });

    encoder.configure({
      codec: "avc1.640033",
      width: W,
      height: H,
      bitrate: 8_000_000,
      framerate: p.fps,
    });

    for (let i = 0; i < tot; i++) {
      renderFrame(i, p);
      const frame = new VideoFrame(canvas, {
        timestamp: Math.round(i * 1_000_000 / p.fps),
        duration: Math.round(1_000_000 / p.fps),
      });
      const keyFrame = i % (p.fps * 2) === 0;
      encoder.encode(frame, { keyFrame });
      frame.close();

      if (encoder.encodeQueueSize > 5) {
        await encoder.flush();
      }

      status.textContent = `Encoding MP4… ${Math.round((i + 1) / tot * 100)}%`;
    }

    await encoder.flush();
    encoder.close();
    muxer.finalize();

    const buf = muxer.target.buffer;
    const blob = new Blob([buf], { type: "video/mp4" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "nvidia-lines.mp4";
    a.click();
    URL.revokeObjectURL(url);
    status.textContent = "MP4 saved!";
  });

  [["bgHex","bgText"], ["fgHex","fgText"], ["segHex","segText"]].forEach(([pickerId, textId]) => {
    const picker = document.getElementById(pickerId);
    const text = document.getElementById(textId);
    picker.addEventListener("input", () => { text.value = picker.value.toUpperCase(); paint(); });
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

  updateLabels();
  paint();
})();
