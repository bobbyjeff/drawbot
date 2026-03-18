# Chart for Composer 2 blog post — horizontal bar chart
# Model scores: generous left padding for manual model labels, bars from x=840 to right inset 96.

# Flags
shouldSave  = 1
show_labels = 1

# Imports
import os
import datetime

currentTime = datetime.datetime.now()

ROOT    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORTS = os.path.join(ROOT, "exports")

# ── Data (from model comparison table) ────────────────────────────────────────
# Order: top = strongest (longest bar), bottom = weakest
models = ["GPT-5.4", "Composer 2", "Opus 4.6", "Composer 1.5", "Sonnet 4.5"]
scores = [75.1, 59.8, 58.0, 47.9, 41.6]  # Terminal-Bench

# ── Colours ───────────────────────────────────────────────────────────────────
def rgb(r, g, b): return r/255, g/255, b/255

C_BAR   = (0, 0, 0)   # black
C_GRAY  = rgb(0x92, 0x92, 0x8E)

# ── Artboard ──────────────────────────────────────────────────────────────────
W = 2400
H = W * (11 / 24)

margin_left   = 96
margin_right  = 96
margin_top    = 120
margin_bottom = 120

# Bar layout: start x=840, end at right inset 96. Labels: model names at 96, scores right-aligned before bars.
bar_start_x   = 840
bar_end_x     = W - margin_right
label_x       = margin_left  # 96
score_right_x = bar_start_x - 24  # scores right-aligned, end 24px before bars
chart_w     = bar_end_x - bar_start_x

bar_height   = 64
bar_spacing  = 56
row_height   = bar_height + bar_spacing

# Chart vertical extent — bars from bottom up
chart_yb = margin_bottom
n_bars  = len(models)
chart_h = n_bars * bar_height + (n_bars - 1) * bar_spacing

# Scale: 0–100 for scores (stands alone if x labels removed)
x_min, x_max = 0, 100

def val_to_px(val):
    return bar_start_x + (val - x_min) / (x_max - x_min) * chart_w

def row_cy(i):
    # i=0 at top (longest bar), i=n-1 at bottom
    return chart_yb + chart_h - i * row_height - bar_height / 2

# ── Draw ─────────────────────────────────────────────────────────────────────
newPage(W, H)

# Vertical grid lines
stroke(0.88, 0.88, 0.88)
strokeWidth(1)
for xv in [0, 25, 50, 75, 100]:
    px = val_to_px(xv)
    line((px, chart_yb), (px, chart_yb + chart_h))

# X-axis ticks and labels
if show_labels:
    stroke(None)
    fill(0, 0, 0)
    font("Helvetica")
    fontSize(28)
    tick_len = 8
    for xv in [0, 25, 50, 75, 100]:
        px = val_to_px(xv)
        stroke(0, 0, 0)
        strokeWidth(2)
        line((px, chart_yb), (px, chart_yb - tick_len))
        stroke(None)
        text(f"{xv}", (px, chart_yb - tick_len - 24), align="center")

# Bars + model labels (left) + scores (right-aligned before bars)
for i, (model, score) in enumerate(zip(models, scores)):
    cy = row_cy(i)
    by = cy - bar_height / 2
    bw = val_to_px(score) - bar_start_x

    stroke(None)
    fill(*C_BAR)
    rect(bar_start_x, by, bw, bar_height)

    if show_labels:
        fill(0, 0, 0)
        font("Helvetica")
        fontSize(32)
        text(model, (label_x, cy - 12), align="left")
        text(f"{score:.1f}", (score_right_x, cy - 12), align="right")

# ── Save ─────────────────────────────────────────────────────────────────────
if shouldSave:
    ts   = currentTime.strftime("%Y%m%d-%H%M%S")
    base = os.path.join(EXPORTS, f"chart-composer-2-blog-{ts}")
    saveImage(base + ".png")
    saveImage(base + ".svg")
