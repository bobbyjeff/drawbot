# Chart: CursorBench vs SWE-bench Verified vs SWE-bench Pro
# Three vertical columns, shared y-axis, no normalization.
# SWE-bench Verified (left) | CursorBench (middle) | SWE-bench Pro (right)
# Connecting lines: both SWE columns → CursorBench (no SWE↔SWE line)

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
with open(os.path.join(DATA, "cursorbench-model-comparison.csv")) as f:
    rows = list(csv.DictReader(f))

DISPLAY_NAMES = {
    "haiku":         "Haiku",
    "kimi2.5":       "Kimi 2.5",
    "sonnet4.5":     "Sonnet 4.5",
    "glm5":          "GLM-5",
    "composer1.5":   "Composer 1.5",
    "opus4.5":       "Opus 4.5",
    "gemini3.1pro":  "Gemini 3.1 Pro",
    "opus4.6":       "Opus 4.6",
    "gpt-5.3-codex": "GPT-5.3 Codex",
}

models  = [r["model"] for r in rows]
labels  = [DISPLAY_NAMES.get(m, m) for m in models]
cb      = [float(r["cursorbench_pct"])                        for r in rows]
swe_pro = [float(r["swe_bench_pro"])      if r["swe_bench_pro"]      else None for r in rows]
swe_ver = [float(r["swe_bench_verified"]) if r["swe_bench_verified"] else None for r in rows]

# ── Shared constants ──────────────────────────────────────────────────────────
W    = 2400
H    = W * (4 / 5)

RED  = (0xF5/255, 0x4E/255, 0x00/255)
GRAY = (0x92/255, 0x92/255, 0x8E/255)

DOT_R         = 20
MIN_LABEL_GAP = 52   # px between stacked label baselines

# ── Layout ────────────────────────────────────────────────────────────────────
ML, MR, MT, MB = 96, 96, 140, 220   # MB larger to fit table
chart_yb = MB
chart_h  = H - MB - MT
header_y = chart_yb + chart_h + 40

col_ver = W * 0.22
col_cb  = W * 0.50
col_pro = W * 0.78

y_min, y_max = 22.0, 87.0

def vtp(val):
    return chart_yb + (val - y_min) / (y_max - y_min) * chart_h

# ── Helpers ───────────────────────────────────────────────────────────────────
def draw_dot(px, py, color):
    stroke(1, 1, 1); strokeWidth(3); fill(*color)
    oval(px - DOT_R, py - DOT_R, DOT_R * 2, DOT_R * 2)

def stacked_labels(entries, dot_x, dot_color, name_x, name_align, val_side):
    """
    entries: list of (label, value) sorted top→bottom (descending value).
    Draws: dot at true y, value label next to dot, name label stacked with min gap.
    val_side: +1 = right of dot, -1 = left of dot
    """
    label_ys = []
    for lbl, val in entries:
        py_dot = vtp(val)
        draw_dot(dot_x, py_dot, dot_color)
        # Value label — pinned to dot y
        stroke(None); fill(*dot_color)
        font("Helvetica-Bold"); fontSize(36)
        val_x = dot_x + (DOT_R + 12) * val_side
        val_align = "left" if val_side > 0 else "right"
        text(f"{val:.1f}", (val_x, py_dot - 16), align=val_align)
        # Name label — stacked with min gap, nudged down if needed
        if label_ys:
            py_lbl = min(py_dot, label_ys[-1] - MIN_LABEL_GAP)
        else:
            py_lbl = py_dot
        label_ys.append(py_lbl)
        stroke(None); fill(*dot_color)
        font("Helvetica"); fontSize(36)
        text(lbl, (name_x, py_lbl - 16), align=name_align)

def draw_header(label_str, col_x, top_y, color):
    stroke(None); fill(*color)
    font("Helvetica-Bold"); fontSize(48)
    text(label_str, (col_x, top_y), align="center")

# ── Subsets ───────────────────────────────────────────────────────────────────
all3   = [(lbl, c, sp, sv)
          for lbl, c, sp, sv in zip(labels, cb, swe_pro, swe_ver)
          if sp is not None and sv is not None]
no_pro = [(lbl, c, sv)
          for lbl, c, sp, sv in zip(labels, cb, swe_pro, swe_ver)
          if sp is None and sv is not None]

# ── Draw ──────────────────────────────────────────────────────────────────────
newPage(W, H)

# Connecting lines — both SWE columns fan into CursorBench middle
for lbl, c, sp, sv in all3:
    stroke(*GRAY, 0.45); strokeWidth(2); lineDash(None)
    line((col_ver, vtp(sv)), (col_cb, vtp(c)))
    line((col_pro, vtp(sp)), (col_cb, vtp(c)))

for lbl, c, sv in no_pro:
    stroke(*GRAY, 0.45); strokeWidth(2); lineDash(None)
    line((col_ver, vtp(sv)), (col_cb, vtp(c)))

# SWE-bench Verified dots + stacked labels (left column)
ver_entries = sorted(
    [(lbl, sv) for lbl, c, sp, sv in all3] + [(lbl, sv) for lbl, c, sv in no_pro],
    key=lambda x: x[1], reverse=True
)
stacked_labels(ver_entries,
               dot_x=col_ver, dot_color=GRAY,
               name_x=col_ver - (DOT_R + 100), name_align="right",
               val_side=-1)

# SWE-bench Pro dots + stacked labels (right column)
pro_entries = sorted(
    [(lbl, sp) for lbl, c, sp, sv in all3],
    key=lambda x: x[1], reverse=True
)
stacked_labels(pro_entries,
               dot_x=col_pro, dot_color=GRAY,
               name_x=col_pro + (DOT_R + 100), name_align="left",
               val_side=1)

# CursorBench dots + value labels only, no names (middle column)
for lbl, c, sp, sv in zip(labels, cb, swe_pro, swe_ver):
    py = vtp(c)
    draw_dot(col_cb, py, RED)
    stroke(None); fill(*RED)
    font("Helvetica-Bold"); fontSize(36)
    text(f"{c:.1f}", (col_cb + DOT_R + 12, py - 16), align="left")

draw_header("SWE-bench Verified", col_ver, header_y, GRAY)
draw_header("CursorBench",        col_cb,  header_y, RED)
draw_header("SWE-bench Pro",      col_pro, header_y, GRAY)

# ── Reference table bottom-left ───────────────────────────────────────────────
# Sorted by CursorBench descending
table_data = sorted(
    [(lbl, c, sp, sv)
     for lbl, c, sp, sv in zip(labels, cb, swe_pro, swe_ver)],
    key=lambda x: x[1], reverse=True
)

tx        = ML
ty_start  = MB - 32     # start just above bottom margin
row_h_t   = 34
col_w_val = 110
font_sz   = 26

# Header row
stroke(None); fill(*GRAY)
font("Helvetica-Bold"); fontSize(font_sz)
text("Model",             (tx,                    ty_start), align="left")
text("CursorBench",       (tx + 380,              ty_start), align="right")
text("SWE-bench Verified",(tx + 380 + col_w_val + 20,  ty_start), align="right")
text("SWE-bench Pro",     (tx + 380 + col_w_val*2 + 50, ty_start), align="right")

for i, (lbl, c, sp, sv) in enumerate(table_data):
    ty = ty_start - (i + 1) * row_h_t
    stroke(None)
    fill(*GRAY); font("Helvetica"); fontSize(font_sz)
    text(lbl, (tx, ty), align="left")
    fill(*RED);  font("Helvetica-Bold"); fontSize(font_sz)
    text(f"{c:.1f}%",  (tx + 380, ty), align="right")
    fill(*GRAY); font("Helvetica"); fontSize(font_sz)
    text(f"{sv:.1f}%" if sv else "—", (tx + 380 + col_w_val + 20,  ty), align="right")
    text(f"{sp:.1f}%" if sp else "—", (tx + 380 + col_w_val*2 + 50, ty), align="right")

# ── Save ──────────────────────────────────────────────────────────────────────
if shouldSave:
    ts   = currentTime.strftime("%Y%m%d-%H%M%S")
    base = os.path.join(EXPORTS, f"chart-dotplot-all3-{ts}")
    saveImage(base + ".png")
    saveImage(base + ".svg")
