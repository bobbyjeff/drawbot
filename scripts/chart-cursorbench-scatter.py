# Chart: Model comparison scatter — CursorBench score (y) vs tokens (x)
# Data source: cursorbench-scores-2.csv
# Only models with ScatterPlot == "yes" are shown.

# Flags
shouldSave  = 1
show_labels = 1

# Imports
import os, datetime, csv
currentTime = datetime.datetime.now()

ROOT    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORTS = os.path.join(ROOT, "exports")
DATA    = os.path.join(ROOT, "data")

# ── Load data ─────────────────────────────────────────────────────────────────
with open(os.path.join(DATA, "cursorbench-scores-2.csv")) as f:
    rows = list(csv.DictReader(f))

DISPLAY_NAMES = {
    "GPT52-High":           "GPT-5.2 (high)",
    "GPT54-High":           "GPT-5.4 (high)",
    "Opus46-High":          "Opus 4.6 (high)",
    "Opus45-High":          "Opus 4.5 (high)",
    "Gemini31-Pro":         "Gemini 3.1 Pro",
    "Composer15":           "Composer 1.5",
    "GLM5":                 "GLM-5",
    "Sonnet45":             "Sonnet 4.5",
    "Haiku45":              "Haiku 4.5",
    "GPT-5-High":           "GPT-5 (high)",
    "GPT53-Codex-XHigh":    "GPT-5.3 Codex (xhigh)",
    "GPT53-Codex-High":     "GPT-5.3 Codex (high)",
    "GPT53-Codex-Medium":   "GPT-5.3 Codex (medium)",
    "GPT53-Codex-Low":      "GPT-5.3 Codex (low)",
    "Opus46-Low":           "Opus 4.6 (low)",
    "Opus46-Medium":        "Opus 4.6 (medium)",
}

points = []
for r in rows:
    if r.get("ScatterPlot", "").strip().lower() != "yes":
        continue
    tokens = r.get("Tokens (Median)", "").strip()
    cb     = r.get("CursorBench", "").strip()
    if not tokens or not cb:
        continue
    try:
        tokens_f = float(tokens)
        cb_f     = float(cb)
    except ValueError:
        continue
    points.append({
        "model":  r["Model"].strip(),
        "label":  DISPLAY_NAMES.get(r["Model"].strip(), r["Model"].strip()),
        "tokens": tokens_f,
        "cb":     cb_f,
    })

# ── Artboard ──────────────────────────────────────────────────────────────────
w = 2400
h = w * (10 / 16)

margin_left   = 96
margin_right  = 144
margin_top    = 144
margin_bottom = 192

# X-axis: chart_x is where x_min lands; push it right for breathing room on the left.
# Y gridlines extend all the way back to margin_left (96px inset).
chart_x      = 280          # extra left breathing room before first data point
chart_y      = margin_bottom
chart_w      = w - chart_x - margin_right
chart_h      = h - margin_bottom - margin_top
grid_x_left  = margin_left  # y-gridlines extend back to here

# ── Scales ────────────────────────────────────────────────────────────────────
x_min, x_max = 4, 24
y_min, y_max = 25, 70

x_ticks = [4, 8, 12, 16, 20, 24]
y_ticks  = [30, 40, 50, 60, 70]

def x_to_px(val):
    return chart_x + (val - x_min) / (x_max - x_min) * chart_w

def y_to_py(val):
    return chart_y + (val - y_min) / (y_max - y_min) * chart_h

# ── Colors ────────────────────────────────────────────────────────────────────
# OpenAI: blues
OAI_CODEX  = (0x3B/255, 0x82/255, 0xF6/255)   # blue       — GPT-5.3 Codex family
OAI_GPT5   = (0x1D/255, 0x6F/255, 0xEB/255)   # strong blue — GPT-5
OAI_GPT52  = (0x1D/255, 0x6F/255, 0xEB/255)   # strong blue — GPT-5.2
OAI_GPT54  = (0x1E/255, 0x40/255, 0xAF/255)   # deep navy  — GPT-5.4

# Anthropic: gold → bronze → rust per model line
ANT_HAIKU   = (0xF5/255, 0xC8/255, 0x42/255)  # pale gold  — Haiku
ANT_SONNET  = (0xE0/255, 0x9B/255, 0x3D/255)  # amber      — Sonnet
ANT_OPUS45  = (0xCB/255, 0x7C/255, 0x3A/255)  # bronze     — Opus 4.5 family
ANT_OPUS46  = (0xA0/255, 0x3A/255, 0x0A/255)  # deep rust  — Opus 4.6 family

# Others
GEM   = (0x0D/255, 0x9D/255, 0x8B/255)        # teal       — Gemini
COMP  = (0x7C/255, 0x3A/255, 0xED/255)        # purple     — Composer
GLM   = (0x6B/255, 0x7B/255, 0x8A/255)        # slate      — GLM-5

MODEL_COLORS = {
    "GPT53-Codex-Low":    OAI_CODEX,
    "GPT53-Codex-Medium": OAI_CODEX,
    "GPT53-Codex-High":   OAI_CODEX,
    "GPT53-Codex-XHigh":  OAI_CODEX,
    "GPT-5-High":         OAI_GPT5,
    "GPT52-High":         OAI_GPT52,
    "GPT54-High":         OAI_GPT54,
    "Haiku45":            ANT_HAIKU,
    "Sonnet45":           ANT_SONNET,
    "Opus45-High":        ANT_OPUS45,
    "Opus46-Low":         ANT_OPUS46,
    "Opus46-Medium":      ANT_OPUS46,
    "Opus46-High":        ANT_OPUS46,
    "Gemini31-Pro":       GEM,
    "Composer15":         COMP,
    "GLM5":               GLM,
}

FAMILY_LINE_COLORS = {
    "Opus 4.6":      ANT_OPUS46,
    "GPT-5.3 Codex": OAI_CODEX,
}

def dot_color(pt):
    return MODEL_COLORS.get(pt["model"], (0.5, 0.5, 0.5))

DOT_R     = 16
label_gap = 16

# ── Draw ──────────────────────────────────────────────────────────────────────
newPage(w, h)

# Y gridlines — extend all the way to left inset (96)
for tv in y_ticks:
    py = y_to_py(tv)
    stroke(0.88, 0.88, 0.88); strokeWidth(2); lineDash(None)
    line((grid_x_left, py), (chart_x + chart_w, py))

# X gridlines — from chart_x (10k) rightward only
for tv in x_ticks:
    px = x_to_px(tv)
    stroke(0.88, 0.88, 0.88); strokeWidth(2); lineDash(None)
    line((px, chart_y), (px, chart_y + chart_h))

# ── Family connector lines (solid, colored) ──────────────────────────────────
FAMILIES = {
    "Opus 4.6":      (ANT_OPUS46, ["Opus46-Low", "Opus46-Medium", "Opus46-High"]),
    "GPT-5.3 Codex": (OAI_CODEX,  ["GPT53-Codex-Low", "GPT53-Codex-Medium", "GPT53-Codex-High", "GPT53-Codex-XHigh"]),
}
pt_by_model = {pt["model"]: pt for pt in points}

for _family, (fcolor, members) in FAMILIES.items():
    family_pts = [pt_by_model[m] for m in members if m in pt_by_model]
    family_pts.sort(key=lambda p: p["tokens"])
    if len(family_pts) < 2:
        continue
    stroke(*fcolor); strokeWidth(3); lineDash(None); fill(None)
    for i in range(len(family_pts) - 1):
        px0 = x_to_px(family_pts[i]["tokens"])
        py0 = y_to_py(family_pts[i]["cb"])
        px1 = x_to_px(family_pts[i+1]["tokens"])
        py1 = y_to_py(family_pts[i+1]["cb"])
        line((px0, py0), (px1, py1))

# Label in top-left corner (ideal direction annotation)
if show_labels:
    stroke(None); fill(0.5, 0.5, 0.5, 0.55)
    font("Helvetica"); fontSize(34)
    text("← Token efficiency frontier", (grid_x_left, chart_y + chart_h - label_gap - 34), align="left")

# Dots
for pt in points:
    px = x_to_px(pt["tokens"])
    py = y_to_py(pt["cb"])
    stroke(1, 1, 1); strokeWidth(3); fill(*dot_color(pt))
    oval(px - DOT_R, py - DOT_R, DOT_R * 2, DOT_R * 2)

# Labels that go above the dot instead of to the right (near right edge)
LABEL_ABOVE = {"GPT53-Codex-XHigh"}

# Labels
if show_labels:
    stroke(None); font("Helvetica"); fontSize(36)
    for pt in points:
        px = x_to_px(pt["tokens"])
        py = y_to_py(pt["cb"])
        fill(*dot_color(pt))
        if pt["model"] in LABEL_ABOVE:
            text(pt["label"], (px, py + DOT_R + label_gap), align="center")
        else:
            text(pt["label"], (px + DOT_R + label_gap, py - 14), align="left")

    # X-axis tick labels + title
    fill(0, 0, 0); font("Helvetica"); fontSize(36)
    for tv in x_ticks:
        px = x_to_px(tv)
        text(f"{tv}k", (px, chart_y - label_gap - 36), align="center")
    font("Helvetica"); fontSize(40)
    text("Median Tokens", (chart_x + chart_w / 2, chart_y - label_gap - 36 - 52), align="center")

    # Y-axis tick labels — at left inset (96), floating above each gridline
    font("Helvetica"); fontSize(36)
    for tv in y_ticks:
        py = y_to_py(tv)
        lbl = f"{tv}%  CursorBench score" if tv == max(y_ticks) else f"{tv}%"
        text(lbl, (margin_left, py + label_gap), align="left")

# ── Save ──────────────────────────────────────────────────────────────────────
if shouldSave:
    filename = os.path.join(EXPORTS, "chart-cursorbench-scatter-" + currentTime.strftime("%Y%m%d-%H%M%S"))
    saveImage(filename + ".png")
    saveImage(filename + ".svg")
