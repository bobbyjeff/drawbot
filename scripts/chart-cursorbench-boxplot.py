# Chart: CursorBench vs SWE-Bench — two horizontal bar panels (linear scale)
# Left:  Mean Gold Patch Lines Changed
# Right: Mean Problem Description Length

# Flags
shouldSave = 0
show_labels = 1

# Imports
import os, datetime
currentTime = datetime.datetime.now()

ROOT    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORTS = os.path.join(ROOT, "exports")

# Groups bottom-to-top (index 0 = bottom in DrawBot)
# (display_name, loc_mean, desc_mean)
groups = [
    ("Cursor Bench v3",         352,  551),
    ("SWE-Bench\nPro",          170, 3450),
    ("SWE-Bench\nMultilingual",  24, 2198),
    ("SWE-Bench\nVerified",      14, 1700),
]

# ── Artboard ───────────────────────────────────────────────────────────────────
w = 2400
aspect_ratio = 11 / 24
h = w * aspect_ratio

margin      = 96
margin_right = 144
label_col_w = 492 - 96   # = 396
panel_gap   = 192
x_axis_h    = 120
top_margin  = margin

avail_w = w - margin - label_col_w - panel_gap - margin_right
panel_w = avail_w / 2
left_x  = margin + label_col_w
right_x = left_x + panel_w + panel_gap

chart_y = top_margin + x_axis_h   # bottom of chart area (above x-axis space)
chart_h = h - top_margin - x_axis_h - margin

n_groups = len(groups)
row_h    = chart_h / n_groups
box_th   = row_h * 0.38

# ── Scales ─────────────────────────────────────────────────────────────────────
loc_lin_max  = 400    # 0, 100, 200, 300, 400
desc_lin_max = 4000   # 0, 1000, 2000, 3000, 4000

def val_to_px_lin(val, val_max, px_left, px_right):
    return px_left + (val / val_max) * (px_right - px_left)

# ── Colors ─────────────────────────────────────────────────────────────────────
GRAY = (0.55, 0.55, 0.55)
RED  = (0xBC/255, 0x54/255, 0x47/255)

label_gap = 14
tick_len  = 10

# ── Draw helpers ───────────────────────────────────────────────────────────────
def draw_hbar_lin(mean_val, val_max, px_left, px_right, row_cy, color):
    px_med = val_to_px_lin(mean_val, val_max, px_left, px_right)
    by     = row_cy - box_th / 2
    stroke(None); fill(*color)
    rect(px_left, by, px_med - px_left, box_th)

def draw_x_axis_lin(val_max, px_left, px_right, axis_y, n_ticks, label):
    tick_step = val_max / n_ticks
    for i in range(n_ticks + 1):
        px = val_to_px_lin(tick_step * i, val_max, px_left, px_right)
        if i == 0:
            stroke(0, 0, 0); strokeWidth(3); lineDash(None)
        else:
            stroke(0.82, 0.82, 0.82); strokeWidth(3); lineDash(12, 8)
        line((px, axis_y), (px, chart_y + chart_h))
    lineDash(None)
    if show_labels:
        stroke(None); fill(0, 0, 0); font("Helvetica"); fontSize(34)
        for i in range(n_ticks + 1):
            val = tick_step * i
            px  = val_to_px_lin(val, val_max, px_left, px_right)
            text(str(int(round(val))), (px, axis_y - label_gap - 34), align="center")
        font("Helvetica"); fontSize(36)
        text(label, (px_left + (px_right - px_left) / 2,
                     axis_y - label_gap - 34 - 50), align="center")

def draw_row_labels(row_cy, display_name):
    stroke(None); fill(0, 0, 0)
    font("Helvetica"); fontSize(44)
    lbl_lines = display_name.split("\n")
    n_lines   = len(lbl_lines)
    for j, ln in enumerate(lbl_lines):
        ty = row_cy + (n_lines - 1) * 22 - j * 50
        text(ln, (margin + label_col_w - label_gap, ty), align="right")

# ── Pages ──────────────────────────────────────────────────────────────────────
axis_y = chart_y   # x-axes sit at the bottom edge of the chart area

# ── Draw ───────────────────────────────────────────────────────────────────────
newPage(w, h)
for i, (display_name, loc_mean, desc_mean) in enumerate(groups):
    row_cy = axis_y + (i + 0.5) * row_h
    color  = RED if "Cursor Bench" in display_name else GRAY
    if show_labels: draw_row_labels(row_cy, display_name)
    draw_hbar_lin(loc_mean,  loc_lin_max,  left_x,  left_x  + panel_w, row_cy, color)
    draw_hbar_lin(desc_mean, desc_lin_max, right_x, right_x + panel_w, row_cy, color)
draw_x_axis_lin(loc_lin_max,  left_x, left_x + panel_w, axis_y, 4,
                "Mean Gold Patch Lines Changed")
draw_x_axis_lin(desc_lin_max, right_x, right_x + panel_w, axis_y, 4,
                "Mean Problem Description Length")

# ── Save ───────────────────────────────────────────────────────────────────────
if shouldSave:
    filename = os.path.join(EXPORTS, "chart-cursorbench-boxplot-" + currentTime.strftime("%Y%m%d-%H%M%S"))
    saveImage(filename + ".png")
    saveImage(filename + ".svg")
