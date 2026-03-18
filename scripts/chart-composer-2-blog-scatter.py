# Chart for Composer 2 blog post — scatterplot: Cost (x) vs Score (y)
# Data: data/composer-2-scatter.csv. Only rows with scatter=yes are shown.

# Flags
shouldSave  = 1
show_labels = 1
show_all    = 0   # 1 = all points, 0 = only scatter=yes (for blog)

# Imports
import os
import csv
import datetime

currentTime = datetime.datetime.now()

ROOT    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORTS = os.path.join(ROOT, "exports")
DATA    = os.path.join(ROOT, "data")

# ── Load data ─────────────────────────────────────────────────────────────────
with open(os.path.join(DATA, "composer-2-scatter.csv")) as f:
    rows = list(csv.DictReader(f))

points = []
for r in rows:
    if not show_all and r.get("scatter", "").strip().lower() != "yes":
        continue
    try:
        score = float(r["score"])
        med   = float(r["med"])
    except (ValueError, KeyError):
        continue
    points.append({
        "model": r["model"].strip(),
        "score": score,
        "med_dollar": med,
    })

# ── Artboard ──────────────────────────────────────────────────────────────────
w = 2400
h = w * (10 / 16)

margin_left   = 96
margin_right  = 144
margin_top    = 144
margin_bottom = 192

chart_x = margin_left + 80
chart_y = margin_bottom
chart_w = w - chart_x - margin_right
chart_h = h - margin_bottom - margin_top

# ── Scales ────────────────────────────────────────────────────────────────────
# x = cost (Med$), y = score. Cost reversed: low cost right (better), high cost left.
x_min, x_max = 0.0, 2.8   # Med$ (cost)
y_min, y_max = (25, 70) if show_all else (40, 70)   # Score — extend down for Haiku when all

x_ticks = [0, 0.5, 1.0, 1.5, 2.0, 2.5]
y_ticks = [30, 40, 50, 60, 70] if show_all else [45, 50, 55, 60, 65, 70]

def x_to_px(val):
    # Reversed: high cost = left, low cost = right
    return chart_x + (x_max - val) / (x_max - x_min) * chart_w

def y_to_py(val):
    return chart_y + (val - y_min) / (y_max - y_min) * chart_h

# ── Colors ────────────────────────────────────────────────────────────────────
def rgb(r, g, b): return r/255, g/255, b/255

OAI_GPT54   = rgb(0x1E, 0x40, 0xAF)   # deep navy — GPT-5.4
OAI_GPT52   = rgb(0x1D, 0x6F, 0xEB)   # strong blue — GPT-5.2
OAI_CODEX   = rgb(0x3B, 0x82, 0xF6)   # blue — GPT-5.3 Codex
ANT_OPUS46  = rgb(0xA0, 0x3A, 0x0A)   # deep rust — Opus 4.6
ANT_OPUS45  = rgb(0xCB, 0x7C, 0x3A)   # bronze — Opus 4.5
ANT_SONNET  = rgb(0xE0, 0x9B, 0x3D)   # amber — Sonnet 4.5/4.6
ANT_HAIKU   = rgb(0xF5, 0xC8, 0x42)   # pale gold — Haiku
COMP        = rgb(0x7C, 0x3A, 0xED)   # purple — Composer
KIMI        = rgb(0x0E, 0x84, 0x95)   # teal — Kimi
GLM         = rgb(0x6B, 0x7B, 0x8A)   # slate — GLM-5
GRAY        = rgb(0x92, 0x92, 0x8E)   # fallback

def dot_color(pt):
    m = pt["model"]
    if "GPT-5.4" in m: return OAI_GPT54
    if "GPT-5.2" in m: return OAI_GPT52
    if "GPT-5.3 Codex" in m: return OAI_CODEX
    if "Opus 4.6" in m: return ANT_OPUS46
    if "Opus 4.5" in m: return ANT_OPUS45
    if "Sonnet 4.6" in m or "Sonnet 4.5" in m: return ANT_SONNET
    if "Haiku" in m: return ANT_HAIKU
    if "Composer" in m: return COMP
    if "Kimi" in m: return KIMI
    if "GLM" in m: return GLM
    return GRAY

DOT_R     = 16
label_gap = 16

# ── Family connector lines ────────────────────────────────────────────────────
FAMILIES = [
    (["GPT-5.4 Low", "GPT-5.4 Med", "GPT-5.4 High"], OAI_GPT54),
    (["GPT-5.2 Low", "GPT-5.2 Med", "GPT-5.2 High"], OAI_GPT52),
    (["GPT-5.3 Codex Low", "GPT-5.3 Codex Med", "GPT-5.3 Codex High"], OAI_CODEX),
    (["Opus 4.6 Low", "Opus 4.6 Med", "Opus 4.6 High"], ANT_OPUS46),
    (["Sonnet 4.6 Low", "Sonnet 4.6 Med", "Sonnet 4.6 High"], ANT_SONNET),
    (["Kimi K2.5 (cr=$0.20)", "Kimi K2.5 (cr=$0.25)"], KIMI),
]
pt_by_model = {pt["model"]: pt for pt in points}

# ── Draw ──────────────────────────────────────────────────────────────────────
newPage(w, h)

# Grid
for tv in y_ticks:
    py = y_to_py(tv)
    stroke(0.88, 0.88, 0.88)
    strokeWidth(2)
    lineDash(None)
    line((chart_x, py), (chart_x + chart_w, py))

for tv in x_ticks:
    px = x_to_px(tv)
    stroke(0.88, 0.88, 0.88)
    strokeWidth(2)
    lineDash(None)
    line((px, chart_y), (px, chart_y + chart_h))

# Family connector lines (sorted by cost: Low → Med → High)
for family_pts, fcolor in FAMILIES:
    pts = [pt_by_model[m] for m in family_pts if m in pt_by_model]
    pts.sort(key=lambda p: p["med_dollar"])
    if len(pts) < 2:
        continue
    stroke(*fcolor)
    strokeWidth(3)
    lineDash(None)
    fill(None)
    for i in range(len(pts) - 1):
        line((x_to_px(pts[i]["med_dollar"]), y_to_py(pts[i]["score"])),
             (x_to_px(pts[i+1]["med_dollar"]), y_to_py(pts[i+1]["score"])))

# Dots
for pt in points:
    px = x_to_px(pt["med_dollar"])
    py = y_to_py(pt["score"])
    stroke(1, 1, 1)
    strokeWidth(3)
    fill(*dot_color(pt))
    oval(px - DOT_R, py - DOT_R, DOT_R * 2, DOT_R * 2)

# Labels
if show_labels:
    stroke(None)
    font("Helvetica")
    fontSize(32)
    for pt in points:
        px = x_to_px(pt["med_dollar"])
        py = y_to_py(pt["score"])
        fill(*dot_color(pt))
        text(pt["model"], (px + DOT_R + label_gap, py - 12), align="left")

    # Axis labels: x = cost (reversed), y = score
    fill(0, 0, 0)
    fontSize(36)
    for tv in x_ticks:
        px = x_to_px(tv)
        lbl = f"${tv}" if tv == int(tv) else f"${tv:.1f}"
        text(lbl, (px, chart_y - label_gap - 36), align="center")
    font("Helvetica-Bold")
    fontSize(40)
    text("Med $", (chart_x + chart_w / 2, chart_y - label_gap - 36 - 52), align="center")

    font("Helvetica")
    fontSize(36)
    for tv in y_ticks:
        py = y_to_py(tv)
        text(f"{tv}", (margin_left, py + label_gap), align="left")

# ── Save ──────────────────────────────────────────────────────────────────────
if shouldSave:
    ts    = currentTime.strftime("%Y%m%d-%H%M%S")
    base  = os.path.join(EXPORTS, f"chart-composer-2-blog-scatter-{ts}")
    saveImage(base + ".png")
    saveImage(base + ".svg")
