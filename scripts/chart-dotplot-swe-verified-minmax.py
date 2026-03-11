# Chart: CursorBench vs SWE-bench Verified — min-max normalized dumbbell
# Each column independently scaled to its own min–max range.
# Actual scores shown on dot labels; range annotations under column headers.

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
swe_ver = [float(r["swe_bench_verified"]) if r["swe_bench_verified"] else None for r in rows]

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

# Paired models (those with swe_ver score)
p_ver = [(lbl, c, s) for lbl, c, s in zip(labels, cb, swe_ver) if s is not None]
cb_vals  = [x[1] for x in p_ver]
sv_vals  = [x[2] for x in p_ver]

cb_min, cb_max = min(cb_vals), max(cb_vals)
sv_min, sv_max = min(sv_vals), max(sv_vals)

def norm_cb(v): return (v - cb_min) / (cb_max - cb_min)
def norm_sv(v): return (v - sv_min) / (sv_max - sv_min)

norm_pad   = 0.08
norm_scale = make_scale(-norm_pad, 1.0 + norm_pad, chart_yb, chart_h)

# ── Draw ──────────────────────────────────────────────────────────────────────
newPage(W, H)

# Faint quartile tick labels only — no grid lines
for t in [0.0, 0.25, 0.5, 0.75, 1.0]:
    py = norm_scale(t)

# Connecting lines
for lbl, c, s in p_ver:
    stroke(*GRAY, 0.5); strokeWidth(2); lineDash(None)
    line((col_swe, norm_scale(norm_sv(s))), (col_cb, norm_scale(norm_cb(c))))

# SWE-bench Verified dots
for lbl, c, s in p_ver:
    py = norm_scale(norm_sv(s))
    draw_dot(col_swe, py, GRAY)
    draw_value_label(s, col_swe, py, GRAY, "right", -1)
    draw_name_label(lbl, col_swe, py, GRAY, "right", -4.5)

# CursorBench dots
for lbl, c, s in p_ver:
    py = norm_scale(norm_cb(c))
    draw_dot(col_cb, py, RED)
    draw_value_label(c, col_cb, py, RED, "left", 1)
    draw_name_label(lbl, col_cb, py, RED, "left", 4.5)

# Range annotations under headers
stroke(None); fill(*GRAY); font("Helvetica"); fontSize(30)
text(f"{sv_min:.0f}% – {sv_max:.0f}%", (col_swe, header_y - 52), align="center")
stroke(None); fill(*RED)
text(f"{cb_min:.0f}% – {cb_max:.0f}%", (col_cb, header_y - 52), align="center")

draw_header("SWE-bench Verified", col_swe, header_y, GRAY)
draw_header("CursorBench",        col_cb,  header_y, RED)

stroke(None); fill(*GRAY); font("Helvetica"); fontSize(30)
text("Each column independently scaled to its own min–max range",
     (W / 2, chart_yb - 56), align="center")

# ── Save ──────────────────────────────────────────────────────────────────────
if shouldSave:
    ts   = currentTime.strftime("%Y%m%d-%H%M%S")
    base = os.path.join(EXPORTS, f"chart-dotplot-swe-verified-minmax-{ts}")
    saveImage(base + ".png")
    saveImage(base + ".svg")
