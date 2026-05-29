/**
 * Patterns2.cv — Booth Wall (Composition 10). Export is a real <a download> (fills blob URL on pointerdown
 * so the browser’s native download runs in the same gesture where previews often block scripted .click()).
 *
 * Density uses **extra grid span** (`GRID_SLACK_TAIL` > 1): min stripe width stays **CELL_PITCH** at TR
 * (`k→0`), **slackBudget = span − count·CELL_PITCH** is pooled toward BL with a **pow(fk, shape)** profile.
 * (When span = count·CELL alone, redistribution always collapses to uniform gaps — why earlier density “did nothing”.)
 *
 * **Wind** style: uniform grid; stroke length grows BL→TR (bilinear + focal dip); max half-length still **LINE_HALF**.
 */
(function () {
  /** @typedef {{ cx: number; cy: number; sx: number; sy: number }} PatternParams */

  const GRID_CX = 30;
  /** Row count bumped toward reference grid (~30 lines tall on the long dimension). */
  const GRID_CY = 30;

  const LINE_HALF = 118;
  const STROKE_USER_SLACK = 1;

  const CELL_PITCH =
    Math.ceil(LINE_HALF * 2 + STROKE_USER_SLACK + 112);

  /** >1 allocates real slack so BL can widen while TR stays at CELL_PITCH (skew is impossible otherwise). */
  const GRID_SLACK_TAIL = 1.48;

  /** @type {PatternParams} */
  const P = {
    cx: GRID_CX,
    cy: GRID_CY,
    sx: Math.ceil(CELL_PITCH * GRID_CX * GRID_SLACK_TAIL),
    sy: Math.ceil(CELL_PITCH * GRID_CY * GRID_SLACK_TAIL),
  };

  const VIEW_PAD = Math.ceil(
    LINE_HALF * Math.SQRT2 + LINE_HALF + STROKE_USER_SLACK / 2 + 32
  );

  const innerW = P.sx + 2 * VIEW_PAD;
  const innerH = P.sy + 2 * VIEW_PAD;

  const SQUARE_SIDE = Math.max(innerW, innerH);
  const VIEWBOX_X = -SQUARE_SIDE / 2;
  const VIEWBOX_Y = -SQUARE_SIDE / 2;

  /** Slack concentrates toward BL: gap slack ∝ fk^shape, fk=0 at TR dense corner. */
  const DENSITY_SHAPE = 0.52;

  /**
   * Centres along one axis TR (k≈0, tight) → BL (sparse). Every gap ≥ minPitch; Σ gaps = span.
   */
  function warpedCenters(
    count /** @type number */,
    span /** @type number */,
    minPitch /** @type number */
  ) {
    if (count <= 0) return [];
    if (count === 1) return [0];

    const slackBudget = span - count * minPitch;
    /** Uniform fallback if span not expanded */
    if (slackBudget <= 1e-6) {
      const u = span / count;
      /** @type number[] */
      const centersUni = [];
      let acc = -span / 2;
      for (let i = 0; i < count; i++) {
        const nx = acc + u;
        centersUni.push((acc + nx) / 2);
        acc = nx;
      }
      return centersUni;
    }

    /** @type number[] */
    const weights = [];
    for (let k = 0; k < count; k++) {
      const fk = k / Math.max(count - 1, 1);
      weights.push(Math.pow(fk, DENSITY_SHAPE));
    }
    const wSum = weights.reduce((a, b) => a + b, 0) || 1;

    /** @type number[] */
    const gaps = weights.map((w) => minPitch + (slackBudget * w) / wSum);

    /** @type number[] */
    const b = [-span / 2];
    for (let k = 0; k < count; k++) {
      b.push(b[k] + gaps[k]);
    }
    /** @type number[] */
    const centers = [];
    for (let i = 0; i < count; i++) {
      centers.push((b[i] + b[i + 1]) / 2);
    }
    return centers;
  }

  const GX_CENTERS = warpedCenters(P.cx, P.sx, CELL_PITCH);
  const GY_CENTERS = warpedCenters(P.cy, P.sy, CELL_PITCH);

  /** Equal spacing — matches reference grids where spacing is uniform and “density” is stroke length only. */
  function uniformCenters(count /** @type number */, span /** @type number */) {
    if (count <= 0) return [];
    if (count === 1) return [0];
    const cell = span / count;
    /** @type number[] */
    const out = [];
    for (let k = 0; k < count; k++) {
      out.push(-span / 2 + cell / 2 + k * cell);
    }
    return out;
  }

  const GX_UNIFORM = uniformCenters(P.cx, P.sx);
  const GY_UNIFORM = uniformCenters(P.cy, P.sy);

  function normViewXY(i /** @type number */, j /** @type number */) {
    const ni = Math.max(P.cx - 1, 1);
    const nj = Math.max(P.cy - 1, 1);
    const nx = P.cx > 1 ? (P.cx - 1 - i) / ni : 0.5;
    const ny = P.cy > 1 ? j / nj : 0.5;
    return { nx, ny };
  }

  const DIAG = { x: Math.SQRT1_2, y: -Math.SQRT1_2 };

  function pathChordCornerField(i /** @type number */, j /** @type number */) {
    const L = LINE_HALF;
    const { nx, ny } = normViewXY(i, j);
    const omx = 1 - nx;
    const omy = 1 - ny;

    let wx =
      omx * omy * 0 +
      nx * omy * DIAG.x +
      omx * ny * DIAG.x +
      nx * ny * 1;
    let wy =
      omx * omy * -1 +
      nx * omy * DIAG.y +
      omx * ny * DIAG.y +
      nx * ny * 0;

    const nrm = Math.hypot(wx, wy);
    if (nrm >= 1e-9) {
      wx /= nrm;
      wy /= nrm;
    } else {
      wx = DIAG.x;
      wy = DIAG.y;
    }

    const ux = -wx;
    const uy = wy;
    return `M ${-L * ux} ${-L * uy} L ${L * ux} ${L * uy}`;
  }

  /* Wind — uniform grid; length BL→TR; bilinear headings + focal softening (~reference right-edge “sink”). */

  /** Focal zone in normalized (nx,ny) same as normViewXY. */
  const WIND_FOC_NX = 0.82;
  const WIND_FOC_NY = 0.64;
  const WIND_FOC_R = 0.34;
  /** Shortest strokes at focal are still visible; ~full length at corners away from focal. */
  const WIND_FOC_LEN_FLOOR = 0.44;
  /** Shortest strokes at sparse BL (~same max half-length LINE_HALF cap as wall). */
  const WIND_MIN_LEN_RATIO = 0.068;
  const WIND_MIX_GAMMA = 0.8;

  function norm2(v /** @type {{ x:number; y:number }} */) {
    return Math.hypot(v.x, v.y);
  }

  function clamp01(t /** @type number */) {
    return t < 0 ? 0 : t > 1 ? 1 : t;
  }

  function nrmVec(v /** @type {{ x:number; y:number }} */) {
    const h = norm2(v);
    if (h < 1e-9) return { x: 0, y: 1 };
    return { x: v.x / h, y: v.y / h };
  }

  function pathWindField(i /** @type number */, j /** @type number */) {
    const { nx, ny } = normViewXY(i, j);
    const omx = 1 - nx;
    const omy = 1 - ny;

    const vTL = nrmVec({ x: Math.SQRT1_2, y: Math.SQRT1_2 });
    const vTR = nrmVec({ x: 1, y: 0.3 });
    const vBL = { x: 0, y: 1 };
    const vBR = nrmVec({
      x: -(WIND_FOC_NY - 1),
      y: WIND_FOC_NX - 1,
    });

    let wx =
      omx * omy * vTL.x +
      nx * omy * vTR.x +
      omx * ny * vBL.x +
      nx * ny * vBR.x;
    let wy =
      omx * omy * vTL.y +
      nx * omy * vTR.y +
      omx * ny * vBL.y +
      nx * ny * vBR.y;

    const nheading = norm2({ x: wx, y: wy });
    if (nheading >= 1e-9) {
      wx /= nheading;
      wy /= nheading;
    } else {
      wx = vBL.x;
      wy = vBL.y;
    }

    /** BL (nx≈0, ny≈1) → shortest; TR (nx≈1, ny≈0) longest (after scale flip still matches sketch). */
    let mixDense = nx * (1 - ny);
    if (WIND_MIX_GAMMA !== 1) {
      mixDense = Math.pow(mixDense, WIND_MIX_GAMMA);
    }

    let half =
      LINE_HALF *
      (WIND_MIN_LEN_RATIO + (1 - WIND_MIN_LEN_RATIO) * mixDense);

    const dF = Math.hypot(nx - WIND_FOC_NX, ny - WIND_FOC_NY);
    const fac = Math.pow(
      clamp01(dF / Math.max(WIND_FOC_R, 1e-6)),
      1.85
    );
    half *= WIND_FOC_LEN_FLOOR + (1 - WIND_FOC_LEN_FLOOR) * fac;

    half = Math.max(half, 1.5);

    const ux = wx;
    const uy = wy;
    return `M ${-half * ux} ${-half * uy} L ${half * ux} ${half * uy}`;
  }

  const SVG_NS = "http://www.w3.org/2000/svg";
  const CLIP_ID = "square-preview-clip";

  function appendClipDefs(svg /** @type {SVGSVGElement} */) {
    const defs = document.createElementNS(SVG_NS, "defs");
    const cp = document.createElementNS(SVG_NS, "clipPath");
    cp.setAttribute("id", CLIP_ID);
    const r = document.createElementNS(SVG_NS, "rect");
    r.setAttribute("x", String(VIEWBOX_X));
    r.setAttribute("y", String(VIEWBOX_Y));
    r.setAttribute("width", String(SQUARE_SIDE));
    r.setAttribute("height", String(SQUARE_SIDE));
    cp.appendChild(r);
    defs.appendChild(cp);
    svg.appendChild(defs);
  }

  function appendPatternTree(
    root /** @type {SVGGElement} */,
    style /** @type {"wall" | "wind"} */
  ) {
    const gx =
      style === "wind"
        /** wind: evenly spaced anchors (density = segment length only) */
        ? GX_UNIFORM
        : GX_CENTERS;
    const gy = style === "wind" ? GY_UNIFORM : GY_CENTERS;
    const pathFor =
      style === "wind" ? pathWindField : pathChordCornerField;

    for (let j = 0; j < P.cy; j++) {
      for (let i = 0; i < P.cx; i++) {
        const g = document.createElementNS(SVG_NS, "g");
        g.setAttribute("transform", `translate(${gx[i]} ${gy[j]})`);

        const path = document.createElementNS(SVG_NS, "path");
        path.setAttribute("d", pathFor(i, j));
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", "#000000");
        path.setAttribute("stroke-linecap", "butt");
        path.setAttribute("stroke-width", "1px");
        path.setAttribute("vector-effect", "non-scaling-stroke");

        g.appendChild(path);
        root.appendChild(g);
      }
    }
  }

  function readStyle() {
    const sel = /** @type {HTMLSelectElement | null} */ (
      document.getElementById("bw-style")
    );
    return sel && sel.value === "wind" ? "wind" : "wall";
  }

  /** @param {SVGSVGElement} svg */
  function render(svg) {
    const style = readStyle();
    svg.setAttribute(
      "viewBox",
      `${VIEWBOX_X} ${VIEWBOX_Y} ${SQUARE_SIDE} ${SQUARE_SIDE}`
    );
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.setAttribute("overflow", "hidden");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");

    svg.textContent = "";
    appendClipDefs(svg);
    const content = document.createElementNS(SVG_NS, "g");
    content.setAttribute("clip-path", `url(#${CLIP_ID})`);
    content.setAttribute("transform", "scale(-1, 1)");
    content.id = "wall-pattern-root";
    svg.appendChild(content);
    appendPatternTree(content, style);
  }

  function svgMarkup() {
    const el = /** @type {SVGSVGElement | null} */ (document.getElementById(
      "pattern-svg"
    ));
    if (!el) return "";

    /** @type {SVGElement} */
    const clone = el.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute(
      "viewBox",
      `${VIEWBOX_X} ${VIEWBOX_Y} ${SQUARE_SIDE} ${SQUARE_SIDE}`
    );
    clone.setAttribute("preserveAspectRatio", "xMidYMid meet");
    clone.setAttribute("width", String(SQUARE_SIDE));
    clone.setAttribute("height", String(SQUARE_SIDE));
    clone.setAttribute("overflow", "hidden");
    clone.removeAttribute("style");

    let out =
      typeof XMLSerializer !== "undefined"
        ? new XMLSerializer().serializeToString(clone)
        : clone.outerHTML;
    if (!/xmlns\s*=/.test(out)) {
      out = out.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + out;
  }

  let exportBlobUrl = null;

  /** Revoke previous blob URL and attach a fresh one from the live SVG tree. Returns false if no markup. */
  function refreshExportLink(/** @type {HTMLAnchorElement} */ link) {
    const m = svgMarkup().trim();
    if (!m) {
      if (exportBlobUrl) {
        URL.revokeObjectURL(exportBlobUrl);
        exportBlobUrl = null;
      }
      link.setAttribute("href", "#");
      return false;
    }
    if (exportBlobUrl) {
      URL.revokeObjectURL(exportBlobUrl);
      exportBlobUrl = null;
    }
    exportBlobUrl = URL.createObjectURL(
      new Blob([m], { type: "image/svg+xml;charset=utf-8" })
    );
    link.href = exportBlobUrl;
    return true;
  }

  function wireExportAnchor(/** @type {HTMLElement | null} */ el) {
    const link = /** @type {HTMLAnchorElement | null} */ (
      el && el.tagName.toLowerCase() === "a" ? el : null
    );
    if (!link || link.dataset.exportWired) return;
    link.dataset.exportWired = "1";

    /** Touch / mouse: populate href before the click navigation decision. */
    link.addEventListener(
      "pointerdown",
      function () {
        refreshExportLink(link);
      },
      { passive: true }
    );

    link.addEventListener("click", function (e) {
      /** Keyboard Activation (focus + Enter): no preceding pointerdown. */
      const hrefOk =
        String(link.href).indexOf("blob:") !== -1;
      if (!hrefOk) {
        if (!refreshExportLink(link)) {
          e.preventDefault();
          return;
        }
      }
      /** If markup vanished, abort navigation */
      if (!svgMarkup().trim()) {
        e.preventDefault();
      }
    });

    link.addEventListener("keydown", function (e) {
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        refreshExportLink(link);
        link.click();
      }
    });
  }

  window["boothWallExport"] = function () {
    const link = /** @type {HTMLAnchorElement | null} */ (
      document.getElementById("btn-export-svg")
    );
    if (!link) return;
    if (refreshExportLink(link)) {
      link.click();
    }
  };

  const BW_STYLE_STORAGE_KEY = "patterns2-booth-wall-style-v1";

  function boot() {
    try {
      const svg = /** @type {SVGElement | null} */ (document.getElementById(
        "pattern-svg"
      ));
      /** @type {HTMLSelectElement | null} */
      const styleSel = document.getElementById("bw-style");
      if (styleSel) {
        try {
          const sv = localStorage.getItem(BW_STYLE_STORAGE_KEY);
          if (sv === "wind" || sv === "wall") styleSel.value = sv;
        } catch (_) {}
      }

      if (svg instanceof window.SVGSVGElement) render(svg);

      /** @type {HTMLElement | null} */
      const rev = document.getElementById("bw-rev");
      if (rev) {
        rev.textContent =
          "Build patterns2-wind-style-20260430 — Wall (skewed grid) or Wind (uniform grid, length field).";
      }

      if (styleSel && !styleSel.dataset.bwWired) {
        styleSel.dataset.bwWired = "1";
        styleSel.addEventListener("change", function () {
          try {
            localStorage.setItem(BW_STYLE_STORAGE_KEY, styleSel.value);
          } catch (_) {}
          const s = /** @type {SVGSVGElement | null} */ (
            document.getElementById("pattern-svg")
          );
          if (s instanceof window.SVGSVGElement) render(s);
        });
      }

      wireExportAnchor(document.getElementById("btn-export-svg"));
    } catch (e) {
      console.error(e);
    }
  }

  function runBoot() {
    boot();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runBoot);
  } else {
    runBoot();
  }
  queueMicrotask(runBoot);
  window.addEventListener("load", runBoot);
})();
