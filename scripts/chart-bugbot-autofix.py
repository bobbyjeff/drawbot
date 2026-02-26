# Chart for "Bugbot Autofix" — multiple visualization pages

# Flags
shouldSave = 1
show_labels = 0  # 0 = no axis labels, 1 = show axis labels

# Imports
import os
import datetime
import csv
currentTime = datetime.datetime.now()

ROOT    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORTS = os.path.join(ROOT, "exports")
DATA    = os.path.join(ROOT, "data")

# Load data
with open(os.path.join(DATA, "bugbot-evals.csv"), "r") as f:
    reader = csv.DictReader(f)
    rows = list(reader)

def parse_date(s):
    if not s:
        return None
    return datetime.datetime.fromisoformat(s)

all_points = [
    (r["label"], parse_date(r["date"]), float(r["avg_bugs_per_run"]), float(r["resolution_rate"]))
    for r in rows
]
dated_points = sorted(
    [p for p in all_points if p[1] is not None],
    key=lambda p: p[1],
)

# ── Artboard & layout ──────────────────────────────────────────────────────────
w = 2400
aspect_ratio = 14 / 24
h = w * aspect_ratio

margin = 96
x_axis_left_extra = margin * 1.75
margin_left = margin_right = margin_top = margin_bottom = margin

def make_chart_area(right_extra=0):
    cx = margin_left + x_axis_left_extra
    cw = w - margin_left - margin_right - x_axis_left_extra - right_extra
    cy = margin_bottom
    ch = h - margin_top - margin_bottom
    return cx, cw, cy, ch

# ── Data domains ───────────────────────────────────────────────────────────────
sx_min, sx_max = 0.4, 0.9    # avg bugs per run
sy_min, sy_max = 0.4, 0.8    # resolution rate (scatter)
shared_min, shared_max = 0.4, 0.9  # shared scale for dual/slope

time_min = dated_points[0][1]
time_max = dated_points[-1][1]
total_secs = (time_max - time_min).total_seconds()

# ── Helpers ────────────────────────────────────────────────────────────────────
def lerp(v, v_min, v_max, p_min, p_max):
    t = (v - v_min) / (v_max - v_min)
    return p_min + t * (p_max - p_min)

def dt_to_x(dt, cx, cw):
    t = (dt - time_min).total_seconds() / total_secs
    return cx + t * cw

def idx_to_x(i, n, cx, cw):
    return cx + i * cw / (n - 1) if n > 1 else cx + cw / 2

def draw_index_x_ticks(n, cx, cw, cy):
    strokeWidth(3)
    stroke(0, 0, 0)
    for i in range(n):
        px = idx_to_x(i, n, cx, cw)
        line((px, cy), (px, cy - tick_length))

def compute_ema(values, period):
    alpha = 2 / (period + 1)
    result = []
    for i, v in enumerate(values):
        result.append(v if i == 0 else alpha * v + (1 - alpha) * result[-1])
    return result

def compute_rolling(values, window):
    result = []
    for i in range(len(values)):
        start = max(0, i - window + 1)
        result.append(sum(values[start:i+1]) / (i - start + 1))
    return result

ORANGE = (0xF5/255, 0x4E/255, 0x00/255)
tick_length = 10
label_gap = 12
dot_r = 24
circle_sw = 3  # white inside stroke width

def draw_page_label(lbl):
    stroke(None)
    fill(0, 0, 0, 0.35)
    font("Helvetica")
    fontSize(22)
    text(lbl, (margin_left, margin_bottom / 2), align="left")

def draw_y_gridlines(ticks, y_min, y_max, cy, ch, x_left, x_right):
    strokeWidth(3)
    for val in ticks:
        py = lerp(val, y_min, y_max, cy, cy + ch)
        stroke(0.85, 0.85, 0.85)
        line((x_left, py), (x_right, py))

def draw_time_x_ticks(cx, cw, cy):
    strokeWidth(3)
    stroke(0, 0, 0)
    cur = datetime.datetime(time_min.year, time_min.month, 1)
    while cur <= time_max:
        px = dt_to_x(cur, cx, cw)
        line((px, cy), (px, cy - tick_length))
        cur = (
            datetime.datetime(cur.year + 1, 1, 1)
            if cur.month == 12
            else datetime.datetime(cur.year, cur.month + 1, 1)
        )

major_months = [
    datetime.datetime(2025, 8, 1),
    datetime.datetime(2025, 10, 1),
    datetime.datetime(2025, 12, 1),
    datetime.datetime(2026, 2, 1),
]

def draw_time_x_labels(cx, cw, cy):
    stroke(None)
    fill(0, 0, 0)
    font("Helvetica")
    fontSize(28)
    for dt in major_months:
        if time_min <= dt <= time_max:
            px = dt_to_x(dt, cx, cw)
            lbl = dt.strftime("%b %Y") if dt.month == 1 else dt.strftime("%b '%y")
            text(lbl, (px, cy - tick_length - label_gap - 28), align="center")

# ── Shared scatter helpers ─────────────────────────────────────────────────────
y_ticks = [0.4, 0.5, 0.6, 0.7, 0.8]
x_ticks = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9]

def draw_scatter_grid():
    cx, cw, cy, ch = make_chart_area()
    draw_y_gridlines(y_ticks, sy_min, sy_max, cy, ch, margin_left, cx + cw)
    strokeWidth(3)
    for val in x_ticks:
        pxv = lerp(val, sx_min, sx_max, cx, cx + cw)
        stroke(0.85, 0.85, 0.85)
        line((pxv, cy), (pxv, cy + ch))
    if show_labels:
        stroke(None); fill(0, 0, 0); font("Helvetica"); fontSize(28)
        for val in y_ticks:
            pyv = lerp(val, sy_min, sy_max, cy, cy + ch)
            text(f"{round(val * 100)}%", (cx - label_gap, pyv), align="right")
        with savedState():
            translate(margin_left / 2, cy + ch / 2)
            rotate(-90)
            text("Resolution rate", (0, 0), align="center")
        for val in x_ticks:
            pxv = lerp(val, sx_min, sx_max, cx, cx + cw)
            text(f"{val:.1f}", (pxv, cy - tick_length - label_gap - 28), align="center")
        text("Avg bugs per run", (cx + cw / 2, margin_bottom / 4), align="center")
    return cx, cw, cy, ch

def dot_xy(xv, yv, cx, cw, cy, ch):
    return lerp(xv, sx_min, sx_max, cx, cx + cw), lerp(yv, sy_min, sy_max, cy, cy + ch)

n_dated = len(dated_points)

# Build a date→index lookup for all_points
date_index = {id(p): i for i, p in enumerate(dated_points)}

def time_color(i):
    t = i / (n_dated - 1) if n_dated > 1 else 1
    return (
        lerp(t, 0, 1, 0.78, ORANGE[0]),
        lerp(t, 0, 1, 0.78, ORANGE[1]),
        lerp(t, 0, 1, 0.78, ORANGE[2]),
    )

# ── Page 1: Connected scatter ──────────────────────────────────────────────────
import math

newPage(w, h)
cx, cw, cy, ch = draw_scatter_grid()

# Gray dashed segments, edge-to-edge (no arrowheads)
pts = [dot_xy(bugs, res, cx, cw, cy, ch) for lbl, d, bugs, res in dated_points]

for i in range(len(pts) - 1):
    x1, y1 = pts[i]
    x2, y2 = pts[i + 1]
    angle = math.atan2(y2 - y1, x2 - x1)
    sx = x1 + dot_r * math.cos(angle)
    sy = y1 + dot_r * math.sin(angle)
    ex = x2 - dot_r * math.cos(angle)
    ey = y2 - dot_r * math.sin(angle)
    fill(None); stroke(0.6, 0.6, 0.6); strokeWidth(3)
    lineDash(12, 8)
    newPath(); moveTo((sx, sy)); lineTo((ex, ey)); drawPath()
    lineDash(None)

# Circles with inside white stroke
for lbl, date, xv, yv in all_points:
    px, py = dot_xy(xv, yv, cx, cw, cy, ch)
    fc = ORANGE if date else (*ORANGE, 0.3)
    ir = dot_r - circle_sw / 2  # inset radius for inside-aligned stroke
    stroke(None); fill(*fc)
    oval(px - dot_r, py - dot_r, dot_r * 2, dot_r * 2)
    fill(None); stroke(1, 1, 1); strokeWidth(circle_sw)
    oval(px - ir, py - ir, ir * 2, ir * 2)

stroke(0, 0, 0); strokeWidth(3)

# ── Save ───────────────────────────────────────────────────────────────────────
if shouldSave:
    filename = os.path.join(EXPORTS, "chart-bugbot-autofix-" + currentTime.strftime("%Y%m%d-%H%M%S"))
    saveImage(filename + ".png")
    saveImage(filename + ".svg")
