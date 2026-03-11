# Charts: Model Comparison — Vertical dumbbell dot plot
# Page 1: CursorBench (right) vs SWE-bench Verified (left) — separation chart
# Page 2: CursorBench (right) vs AFC / agent evals (left), AFC inverted (lower = better)

# Flags
shouldSave  = 1
show_labels = 1

# Imports
import os, datetime, csv
currentTime = datetime.datetime.now()

ROOT    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORTS = os.path.join(ROOT, "exports")
DATA    = os.path.join(ROOT, "data")

# ── Load data ────────────────────────────────────────────────────────────────
# CSV has duplicate column headers (SWE-Bench x2, AFC x2) — read raw to dedup.
with open(os.path.join(DATA, "cursorbench-scores.csv")) as f:
    reader = csv.reader(f)
    raw_headers = next(reader)
    seen = {}
    headers = []
    for h in raw_headers:
        if h in seen:
            seen[h] += 1
            headers.append(f"{h}_{seen[h]}")
        else:
            seen[h] = 1
            headers.append(h)
    rows = [dict(zip(headers, row)) for row in reader if any(row)]

# Column key after dedup:
# "SWE-Bench"   → SWE-bench Verified score
# "SWE-Bench_2" → inclusion flag (yes/no) for dumbbell
# "AFC"         → AFC / agent eval score
# "AFC_2"       → inclusion flag (yes/no) for dumbbell

DISPLAY_NAMES = {
    "GPT52":      "GPT-5.2",
    "GPT54":      "GPT-5.4",
    "Opus46":     "Opus 4.6",
    "Opus45":     "Opus 4.5",
    "Gemini31":   "Gemini 3.1",
    "Composer15": "Composer 1.5",
    "GLM5":       "GLM-5",
    "Kimi25":     "Kimi 2.5",
    "Sonnet45":   "Sonnet 4.5",
    "Haiku45":    "Haiku",
    "GPT-5":      "GPT-5",
}

def parse(r, col):
    v = r.get(col, "").strip()
    return float(v) if v else None

def flag(r, col):
    return r.get(col, "").strip().lower() == "yes"

models  = [r["Model"].strip() for r in rows]
labels  = [DISPLAY_NAMES.get(m, m) for m in models]
cb      = [parse(r, "CursorBench") for r in rows]
swe_ver = [parse(r, "SWE-Bench") if flag(r, "SWE-Bench_2") else None for r in rows]
afc     = [parse(r, "AFC")        if flag(r, "AFC_2")        else None for r in rows]

# ── Shared constants ──────────────────────────────────────────────────────────
W    = 2400
H    = W * (3 / 4)

RED  = (0xF5/255, 0x4E/255, 0x00/255)
GRAY = (0x92/255, 0x92/255, 0x8E/255)

DOT_R         = 22   # kept for reference, unused in tick mode
MIN_LABEL_GAP = 68
PAD_FRAC      = 0.06   # fractional padding added to each side of data range

ML, MR, MT, MB = 96, 96, 140, 120
chart_yb = MB
chart_h  = H - MB - MT
header_y = chart_yb + chart_h + 40

col_left  = W * 0.38
col_right = W * 0.62

# ── Scale helpers ─────────────────────────────────────────────────────────────
def padded_scale(values, inverted=False):
    """Auto-center scale on actual data with padding. Inverted: lower val = top."""
    vals = [v for v in values if v is not None]
    vmin, vmax = min(vals), max(vals)
    pad = (vmax - vmin) * PAD_FRAC
    lo, hi = vmin - pad, vmax + pad
    if inverted:
        def vtp(val):
            return chart_yb + (hi - val) / (hi - lo) * chart_h
    else:
        def vtp(val):
            return chart_yb + (val - lo) / (hi - lo) * chart_h
    return vtp

# ── Drawing helpers ───────────────────────────────────────────────────────────
def draw_dot(px, py, color):
    stroke(1, 1, 1); strokeWidth(3); fill(*color)
    oval(px - DOT_R, py - DOT_R, DOT_R * 2, DOT_R * 2)

def draw_header(label_str, side, color, subtitle=None):
    """side: 'left' or 'right' — label sits at the outer margin, vertically centered."""
    stroke(None); fill(*color)
    font("Helvetica-Bold"); fontSize(48)
    if side == "left":
        text(label_str, (ML, chart_yb + chart_h / 2), align="left")
    else:
        text(label_str, (W - MR, chart_yb + chart_h / 2), align="right")

TICK_W     = 40    # half-width of tick mark on each side of column
TICK_SW    = 6     # stroke width of tick mark

def draw_header(label_str, side, color, subtitle=None):
    """side: 'left' or 'right' — label sits at the outer margin, vertically centered."""
    stroke(None); fill(*color)
    font("Helvetica-Bold"); fontSize(48)
    if side == "left":
        text(label_str, (ML, chart_yb + chart_h / 2), align="left")
    else:
        text(label_str, (W - MR, chart_yb + chart_h / 2), align="right")

def stacked_col(entries, dot_x, dot_color, val_side, name_side, vtp):
    """
    Draw tick marks + combined label for one column. Stacked with MIN_LABEL_GAP.
    val_side: +1 = labels to the right, -1 = labels to the left.
    """
    tick_pys = [vtp(val) for _, val in entries]
    label_ys = []

    # Draw ticks lowest score first so highest score lands on top (highest z-index)
    draw_order = sorted(range(len(entries)), key=lambda i: entries[i][1])

    for i in draw_order:
        lbl, val = entries[i]
        py_tick  = tick_pys[i]
        # Tick mark: white outline first, then colored fill
        stroke(1, 1, 1); strokeWidth(TICK_SW + 6); lineCap("round"); lineDash(None)
        line((dot_x - TICK_W, py_tick), (dot_x + TICK_W, py_tick))
        stroke(*dot_color); strokeWidth(TICK_SW); lineCap("round")
        line((dot_x - TICK_W, py_tick), (dot_x + TICK_W, py_tick))
        lineCap("butt")

    # Labels in original (sorted) order for stacking logic
    for i, (lbl, val) in enumerate(entries):
        py_tick = tick_pys[i]
        py_lbl  = min(py_tick, label_ys[-1] - MIN_LABEL_GAP) if label_ys else py_tick
        label_ys.append(py_lbl)

        anchor_x = dot_x + (TICK_W + 14) * val_side
        stroke(None); fill(*dot_color)
        if val_side > 0:
            font("Helvetica-Bold"); fontSize(36)
            val_str = f"{val:.1f}"
            text(val_str, (anchor_x, py_lbl - 16), align="left")
            val_w = textSize(val_str)[0]
            font("Helvetica"); fontSize(36)
            text(f"   {lbl}", (anchor_x + val_w, py_lbl - 16), align="left")
        else:
            font("Helvetica-Bold"); fontSize(36)
            val_str = f"{val:.1f}"
            val_w = textSize(val_str)[0]
            text(val_str, (anchor_x, py_lbl - 16), align="right")
            font("Helvetica"); fontSize(36)
            text(f"{lbl}   ", (anchor_x - val_w, py_lbl - 16), align="right")

def draw_lines(left_vals, right_vals, vtp_left, vtp_right):
    for lv, rv in zip(left_vals, right_vals):
        if lv is None or rv is None: continue
        stroke(*GRAY, 0.45); strokeWidth(2); lineDash(None)
        line((col_left + TICK_W, vtp_left(lv)), (col_right - TICK_W, vtp_right(rv)))

def centered_offset_scale(values, shared_lo, shared_hi):
    """
    Same tick scale as (shared_lo, shared_hi), but the pixel mapping is
    shifted so this column's data cluster is vertically centered in the chart.
    Returns a vtp function.
    """
    vals     = [v for v in values if v is not None]
    data_mid = (min(vals) + max(vals)) / 2.0
    chart_mid = chart_yb + chart_h / 2.0
    scale    = chart_h / (shared_hi - shared_lo)   # px per unit (same as shared scale)
    def vtp(val):
        return chart_mid + (val - data_mid) * scale
    return vtp

def shared_scale(lo, hi):
    def vtp(val):
        return chart_yb + (val - lo) / (hi - lo) * chart_h
    return vtp

# ════════════════════════════════════════════════════════════════════════════
# PAGE 1 — CursorBench vs SWE-bench Verified
# Same tick scale, but each column independently centered on its own cluster.
# ════════════════════════════════════════════════════════════════════════════
# Determine a shared unit scale that fits both clusters with padding
swe_vals_p1 = [v for v in swe_ver if v is not None]
cb_vals_p1  = [c for c, sv in zip(cb, swe_ver) if c is not None and sv is not None]

all_p1_vals  = swe_vals_p1 + cb_vals_p1
spread       = max(max(swe_vals_p1) - min(swe_vals_p1),
                   max(cb_vals_p1)  - min(cb_vals_p1))
shared_lo    = 0
shared_hi    = spread * (1 + 2 * PAD_FRAC)

# Each column uses the same scale factor but is shifted to center its cluster
vtp_swe_p1  = centered_offset_scale(swe_vals_p1, shared_lo, shared_hi)
vtp_cb_p1   = centered_offset_scale(cb_vals_p1,  shared_lo, shared_hi)

swe_entries = sorted(
    [(lbl, sv) for lbl, sv in zip(labels, swe_ver) if sv is not None],
    key=lambda x: x[1], reverse=True
)
cb_entries_p1 = sorted(
    [(lbl, c) for lbl, c, sv in zip(labels, cb, swe_ver) if c is not None and sv is not None],
    key=lambda x: x[1], reverse=True
)

newPage(W, H)
draw_lines(swe_ver, cb, vtp_swe_p1, vtp_cb_p1)
stacked_col(swe_entries,   col_left,  GRAY, val_side=-1, name_side=-1, vtp=vtp_swe_p1)
stacked_col(cb_entries_p1, col_right, RED,  val_side=1,  name_side=1,  vtp=vtp_cb_p1)
draw_header("SWE-bench Verified", "left",  GRAY)
draw_header("CursorBench",        "right", RED)

# ════════════════════════════════════════════════════════════════════════════
# PAGE 2 — CursorBench vs Online evals (AFC)
# True scale (same px-per-unit), each column offset so its cluster is centered.
# AFC inverted: lower = better = top.
# ════════════════════════════════════════════════════════════════════════════
afc_vals = [v for v in afc if v is not None]
cb_vals  = [c for c, a in zip(cb, afc) if c is not None and a is not None]

# Shared scale: use the larger of the two spreads so both fit comfortably
afc_spread = max(afc_vals) - min(afc_vals)
cb_spread  = max(cb_vals)  - min(cb_vals)
p2_spread  = max(afc_spread, cb_spread)
p2_lo      = 0
p2_hi      = p2_spread * (1 + 2 * PAD_FRAC)

# AFC inverted: lower value = top of chart
def centered_offset_scale_inverted(values, lo, hi):
    vals      = [v for v in values if v is not None]
    data_mid  = (min(vals) + max(vals)) / 2.0
    chart_mid = chart_yb + chart_h / 2.0
    scale     = chart_h / (hi - lo)
    def vtp(val):
        return chart_mid - (val - data_mid) * scale   # negated = inverted
    return vtp

vtp_afc_p2 = centered_offset_scale_inverted(afc_vals, p2_lo, p2_hi)
vtp_cb_p2  = centered_offset_scale(cb_vals, p2_lo, p2_hi)

# Sort AFC ascending (lowest = best = topmost on inverted axis)
afc_entries = sorted(
    [(lbl, a) for lbl, a in zip(labels, afc) if a is not None],
    key=lambda x: x[1]
)
cb_entries_p2 = sorted(
    [(lbl, c) for lbl, c, a in zip(labels, cb, afc) if c is not None and a is not None],
    key=lambda x: x[1], reverse=True
)

newPage(W, H)
draw_lines(afc, cb, vtp_afc_p2, vtp_cb_p2)
stacked_col(afc_entries,   col_left,  GRAY, val_side=-1, name_side=-1, vtp=vtp_afc_p2)
stacked_col(cb_entries_p2, col_right, RED,  val_side=1,  name_side=1,  vtp=vtp_cb_p2)
draw_header("Online evals", "left",  GRAY)
draw_header("CursorBench",  "right", RED)

# ── Save ──────────────────────────────────────────────────────────────────────
if shouldSave:
    ts    = currentTime.strftime("%Y%m%d-%H%M%S")
    base  = os.path.join(EXPORTS, f"chart-model-comparison-{ts}")
    saveImage(base + ".pdf")
    for page_num, suffix in enumerate(["swe-verified", "online-evals"], start=1):
        saveImage(base + f"-p{page_num}-{suffix}.png", multipage=page_num - 1)
        saveImage(base + f"-p{page_num}-{suffix}.svg", multipage=page_num - 1)
