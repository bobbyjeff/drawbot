# Chart: CursorBench scores — horizontal bar chart, all models
# Models on y-axis sorted weakest (bottom) to strongest (top).

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

models = [r["model"]                  for r in rows]
scores = [float(r["cursorbench_pct"]) for r in rows]

# Display names keyed by raw model id
DISPLAY_NAMES = {
    "kimi2.5":       "Kimi 2.5",
    "sonnet4.5":     "Sonnet 4.5",
    "glm5":          "GLM-5",
    "composer1.5":   "Composer 1.5",
    "opus4.5":       "Opus 4.5",
    "gemini3.1pro":  "Gemini 3.1 Pro",
    "opus4.6":       "Opus 4.6",
    "gpt-5.3-codex": "GPT-5.3 Codex",
}
labels = [DISPLAY_NAMES.get(m, m) for m in models]

# ── Shared constants ─────────────────────────────────────────────────────────
W    = 2400
H    = W * (11 / 24)

RED  = (0xF5/255, 0x4E/255, 0x00/255)

# Sort ascending → weakest at bottom, strongest at top
hb_sorted = sorted(zip(labels, scores), key=lambda x: x[1])
hb_models = [p[0] for p in hb_sorted]
hb_scores = [p[1] for p in hb_sorted]

hb_n          = len(hb_models)
hb_margin_l   = 96
hb_label_w    = 480
hb_margin_r   = 220
hb_margin_top = 140
hb_margin_bot = 120

hb_chart_x  = hb_margin_l + hb_label_w
hb_chart_yb = hb_margin_bot
hb_chart_w  = W - hb_chart_x - hb_margin_r
hb_chart_h  = H - hb_margin_bot - hb_margin_top

hb_row_h  = hb_chart_h / hb_n
hb_bar_th = hb_row_h * 0.50

hb_x_max   = 70.0
hb_x_ticks = [0, 10, 20, 30, 40, 50, 60, 70]

def hb_val_to_px(val):
    return hb_chart_x + (val / hb_x_max) * hb_chart_w

def hb_row_cy(i):
    return hb_chart_yb + (i + 0.5) * hb_row_h

# ── Draw ─────────────────────────────────────────────────────────────────────
newPage(W, H)

# Vertical grid lines — solid faint gray, baseline black
for tv in hb_x_ticks:
    px = hb_val_to_px(tv)
    if tv == 0:
        stroke(0, 0, 0); strokeWidth(3)
    else:
        stroke(0.88, 0.88, 0.88); strokeWidth(2)
    lineDash(None)
    line((px, hb_chart_yb), (px, hb_chart_yb + hb_chart_h))
    if show_labels:
        stroke(None); fill(0, 0, 0)
        font("Helvetica"); fontSize(32)
        text(f"{tv}%", (px, hb_chart_yb - 28), align="center")

# Bars + labels
for i, (m, score) in enumerate(zip(hb_models, hb_scores)):
    cy = hb_row_cy(i)
    by = cy - hb_bar_th / 2
    bw = hb_val_to_px(score) - hb_chart_x

    stroke(None); fill(*RED)
    rect(hb_chart_x, by, bw, hb_bar_th)

    if show_labels:
        stroke(None); fill(0, 0, 0)
        font("Helvetica"); fontSize(40)
        text(m, (hb_chart_x - 18, cy - 22), align="right")

        stroke(None); fill(*RED)
        font("Helvetica-Bold"); fontSize(40)
        text(f"{score:.2f}%", (hb_chart_x + bw + 18, cy - 22), align="left")

if show_labels:
    stroke(None); fill(0, 0, 0)
    font("Helvetica"); fontSize(36)
    text("CursorBench Score",
         (hb_chart_x + hb_chart_w / 2, hb_chart_yb - 28 - 52), align="center")

# ── Save ─────────────────────────────────────────────────────────────────────
if shouldSave:
    ts   = currentTime.strftime("%Y%m%d-%H%M%S")
    base = os.path.join(EXPORTS, f"chart-cursorbench-hbar-{ts}")
    saveImage(base + ".png")
    saveImage(base + ".svg")
