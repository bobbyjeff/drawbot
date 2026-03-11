# Chart: CursorBench Edit Distribution Over Time
# Horizontal grouped bars, per-series scale, no x-axis — bar labels only

# Flags
shouldSave = 1
show_labels = 1

# Imports
import os
import datetime
import csv
currentTime = datetime.datetime.now()

ROOT    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORTS = os.path.join(ROOT, "exports")
DATA    = os.path.join(ROOT, "data")

# Load data
with open(os.path.join(DATA, "cursorbench-edit-distribution.csv"), "r") as f:
    reader = csv.DictReader(f)
    rows = list(reader)

versions   = [r["version"] for r in rows]
lines_data = [int(r["lines_of_code"]) for r in rows]
files_data = [int(r["files"]) for r in rows]

# ── Artboard & layout ──────────────────────────────────────────────────────────
w = 2400
aspect_ratio = 11 / 24
h = w * aspect_ratio

margin = 96

# ── Colors ─────────────────────────────────────────────────────────────────────
RED  = (0xBC/255, 0x54/255, 0x47/255)
BLUE = (0x5B/255, 0x7F/255, 0xA8/255)

tick_length = 10
label_gap   = 12

# ── Draw ───────────────────────────────────────────────────────────────────────
# Layout: generous left margin for "CursorBench v0" labels
label_col_w = 280          # space reserved for row labels on the left
h2_margin   = margin
h2_chart_x  = h2_margin + label_col_w
h2_chart_w  = w - h2_margin - label_col_w - margin
h2_chart_y  = margin       # top of chart area (bars flow downward)
h2_chart_h  = h - margin * 2

lines_max_h = max(lines_data) * 1.15
files_max_h = max(files_data) * 1.15

def val_to_bar_w_lines(val):
    return (val / lines_max_h) * h2_chart_w

def val_to_bar_w_files(val):
    return (val / files_max_h) * h2_chart_w

n_h          = len(versions)
row_h        = h2_chart_h / n_h       # height per version group
bar_th       = row_h * 0.28           # thickness of each bar
gap_h        = row_h * 0.04           # gap between the two bars in a group

newPage(w, h)

# Vertical baseline (left edge of bars)
stroke(0, 0, 0); strokeWidth(3); lineDash(None)
line((h2_chart_x, h2_chart_y), (h2_chart_x, h2_chart_y + h2_chart_h))

for i, (ver, loc, files) in enumerate(zip(reversed(versions), reversed(lines_data), reversed(files_data))):
    # Row center: rows run top-to-bottom (v3 at top, v0 at bottom)
    row_center = h2_chart_y + (i + 0.5) * row_h
    # Lines of Code bar sits above center, Files bar below
    lines_y = row_center + gap_h / 2
    files_y = row_center - gap_h / 2 - bar_th

    lines_bw = val_to_bar_w_lines(loc)
    files_bw = val_to_bar_w_files(files)

    stroke(None)
    fill(*RED);  rect(h2_chart_x, lines_y, lines_bw, bar_th)
    fill(*BLUE); rect(h2_chart_x, files_y, files_bw, bar_th)

    if show_labels:
        # Value labels at right end of each bar
        stroke(None); font("Helvetica-Bold"); fontSize(46)
        fill(*RED)
        loc_label = f"{loc} lines of code" if ver == "v0" else str(loc)
        text(loc_label, (h2_chart_x + lines_bw + 16, lines_y + bar_th * 0.18), align="left")
        fill(*BLUE)
        files_label = f"{files} files" if ver == "v0" else str(files)
        text(files_label, (h2_chart_x + files_bw + 16, files_y + bar_th * 0.18), align="left")

        # Row label on the left: "CursorBench v0" etc.
        stroke(None); fill(0, 0, 0)
        font("Helvetica"); fontSize(48)
        text(f"CursorBench {ver}",
             (h2_chart_x - label_gap, row_center - 2), align="right")

# ── Save ───────────────────────────────────────────────────────────────────────
if shouldSave:
    filename = os.path.join(EXPORTS, "chart-cursorbench-edit-dist-" + currentTime.strftime("%Y%m%d-%H%M%S"))
    saveImage(filename + ".png")
    saveImage(filename + ".svg")
