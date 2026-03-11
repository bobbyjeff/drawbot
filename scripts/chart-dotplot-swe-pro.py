# Chart: CursorBench vs SWE-bench Pro — vertical dumbbell dot plot

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
cb      = [float(r["cursorbench_pct"]) for r in rows]
swe_pro = [float(r["swe_bench_pro"]) if r["swe_bench_pro"] else None for r in rows]

# ── Shared constants ──────────────────────────────────────────────────────────
W    = 2400
H    = W * (11 / 24)

RED  = (0xF5/255, 0x4E/255, 0x00/255)
GRAY = (0x92/255, 0x92/255, 0x8E/255)

DOT_R = 20

# ── Helpers ───────────────────────────────────────────────────────────────────
def make_scale(y_min, y_max, chart_yb, chart_h):
    def val_to_py(val):
        return chart_yb + (val - y_min) / (y_max - y_min) * chart_h
    return val_to_py

def draw_grid(y_ticks, val_to_py, margin_l, margin_r):
    for tv in y_ticks:
        py = val_to_py(tv)
        if show_labels:
            stroke(None); fill(*GRAY)
            font("Helvetica"); fontSize(32)
            text(f"{tv}%", (margin_l, py + 10), align="left")

def draw_dot(px, py, color):
    stroke(1, 1, 1); strokeWidth(3); fill(*color)
    oval(px - DOT_R, py - DOT_R, DOT_R * 2, DOT_R * 2)

def draw_value_label(val, px, py, color, align, side):
    stroke(None); fill(*color)
    font("Helvetica-Bold"); fontSize(36)
    text(f"{val:.1f}", (px + (DOT_R + 14) * side, py - 16), align=align)

def draw_name_label(lbl, px, py, color, align, side):
    stroke(None); fill(*color)
    font("Helvetica"); fontSize(36)
    text(lbl, (px + (DOT_R + 14) * side, py - 16), align=align)

def draw_header(label, col_x, top_y, color):
    stroke(None); fill(*color)
    font("Helvetica-Bold"); fontSize(48)
    text(label, (col_x, top_y), align="center")

# ── Layout ────────────────────────────────────────────────────────────────────
ML, MR, MT, MB = 96, 96, 140, 120
chart_yb = MB
chart_h  = H - MB - MT
header_y = chart_yb + chart_h + 40

col_swe = W * 0.32
col_cb  = W * 0.68

y_ticks = [30, 35, 40, 45, 50, 55, 60, 65]
vtp     = make_scale(28.0, 67.0, chart_yb, chart_h)

p1 = [(lbl, c, s) for lbl, c, s in zip(labels, cb, swe_pro) if s is not None]

# ── Draw ──────────────────────────────────────────────────────────────────────
newPage(W, H)
draw_grid(y_ticks, vtp, ML, MR)

for lbl, c, s in p1:
    stroke(*GRAY, 0.5); strokeWidth(2); lineDash(None)
    line((col_swe, vtp(s)), (col_cb, vtp(c)))

for lbl, c, s in p1:
    py = vtp(s)
    draw_dot(col_swe, py, GRAY)
    draw_value_label(s, col_swe, py, GRAY, "right", -1)
    draw_name_label(lbl, col_swe, py, GRAY, "right", -4.5)

for lbl, c, s in zip(labels, cb, swe_pro):
    py = vtp(c)
    draw_dot(col_cb, py, RED)
    draw_value_label(c, col_cb, py, RED, "left", 1)
    draw_name_label(lbl, col_cb, py, RED, "left", 4.5)

draw_header("SWE-bench Pro", col_swe, header_y, GRAY)
draw_header("CursorBench",   col_cb,  header_y, RED)

# ── Save ──────────────────────────────────────────────────────────────────────
if shouldSave:
    ts   = currentTime.strftime("%Y%m%d-%H%M%S")
    base = os.path.join(EXPORTS, f"chart-dotplot-swe-pro-{ts}")
    saveImage(base + ".png")
    saveImage(base + ".svg")
