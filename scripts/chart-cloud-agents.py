# Chart for "Cloud Agents" blog post

# Flags
shouldSave = 1
isAnimated = 0  # 0 = still (png/svg), 1 = animation (gif/mp4)
show_labels = 0  # 0 = no axis labels, 1 = show axis labels

# Animation settings (only used if isAnimated = 1)
num_frames = 12
frame_duration = 1/8

# Imports
import os
import datetime
import csv
currentTime = datetime.datetime.now()

ROOT    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORTS = os.path.join(ROOT, "exports")
DATA    = os.path.join(ROOT, "data")

# Load data
with open(os.path.join(DATA, "merged-prs-from-cloud-agents-2.csv"), "r") as f:
    reader = csv.DictReader(f)
    rows = list(reader)

# Parse rows
def parse_date(s):
    return datetime.datetime.fromisoformat(s)

rows = sorted(rows, key=lambda r: parse_date(r["utc_date"]))

end_date = datetime.datetime(2026, 1, 14)
rows = [r for r in rows if parse_date(r["utc_date"]) <= end_date]

dates     = [parse_date(r["utc_date"]) for r in rows]
pct_cloud = [float(r["percent_cloud"].strip("%")) / 100 for r in rows]

# EMA smoothing helper
def compute_ema(values, period):
    alpha = 2 / (period + 1)
    result = []
    for i, v in enumerate(values):
        if i == 0:
            result.append(v)
        else:
            result.append(alpha * v + (1 - alpha) * result[-1])
    return result

pct_ema2  = compute_ema(pct_cloud, 2)
pct_ema3  = compute_ema(pct_cloud, 3)
pct_ema7  = compute_ema(pct_cloud, 7)
pct_ema14 = compute_ema(pct_cloud, 14)

# 7-day rolling average
def compute_rolling_avg(values, window):
    result = []
    for i in range(len(values)):
        start = max(0, i - window + 1)
        result.append(sum(values[start:i+1]) / (i - start + 1))
    return result

pct_weekly_avg = compute_rolling_avg(pct_cloud, 7)

# X domain
x_date_min = dates[0]
x_date_max = dates[-1]
total_seconds = (x_date_max - x_date_min).total_seconds()

# Y domain: 0–30%
y_min = 0.0
y_max = 0.3

# Artboard setup
w = 2400
aspect_ratio = 10 / 24  # height / width
h = w * aspect_ratio

# Shared layout constants
margin = 96
x_axis_left_extra = margin * 2

def make_layout():
    margin_left = margin_right = margin_top = margin_bottom = margin
    chart_x = margin_left + x_axis_left_extra
    chart_w = w - margin_left - margin_right - x_axis_left_extra
    chart_y = margin_bottom
    chart_h = h - margin_top - margin_bottom
    return chart_x, chart_w, chart_y, chart_h

def date_to_chart(dt, chart_x, chart_w):
    t = (dt - x_date_min).total_seconds() / total_seconds
    return chart_x + t * chart_w

def pct_to_chart(p, chart_y, chart_h):
    t = (p - y_min) / (y_max - y_min)
    return chart_y + t * chart_h

def draw_axes(chart_x, chart_w, chart_y, chart_h):
    y_ticks = [0.0, 0.1, 0.2, 0.3]
    for pct in y_ticks:
        y = pct_to_chart(pct, chart_y, chart_h)
        if pct == 0.0:
            stroke(0, 0, 0)
            line((margin, y), (chart_x + chart_w, y))
        else:
            stroke(0.85, 0.85, 0.85)
            line((margin, y), (chart_x + chart_w, y))

    if show_labels:
        tick_length = 10
        major_ticks = [
            datetime.datetime(2025, 11, 1),
            datetime.datetime(2025, 12, 1),
            datetime.datetime(2026, 1, 1),
            datetime.datetime(2026, 2, 1),
        ]
        stroke(0, 0, 0)
        cur = datetime.datetime(x_date_min.year, x_date_min.month, 1)
        while cur <= x_date_max:
            x_pos = date_to_chart(cur, chart_x, chart_w)
            line((x_pos, chart_y), (x_pos, chart_y - tick_length))
            if cur.month == 12:
                cur = datetime.datetime(cur.year + 1, 1, 1)
            else:
                cur = datetime.datetime(cur.year, cur.month + 1, 1)

        stroke(None)
        fill(0, 0, 0)
        font("Helvetica")
        fontSize(28)
        label_gap = 12
        for pct in y_ticks:
            y = pct_to_chart(pct, chart_y, chart_h)
            text(f"{round(pct * 100)}%", (chart_x - label_gap, y), align="right")
        with savedState():
            translate(margin / 2, chart_y + chart_h / 2)
            rotate(-90)
            text("% of merged PRs", (0, 0), align="center")
        for dt in major_ticks:
            if dt <= x_date_max:
                x_pos = date_to_chart(dt, chart_x, chart_w)
                label = dt.strftime("%b %Y") if dt.month == 1 else dt.strftime("%b '%y")
                text(label, (x_pos, chart_y - tick_length - label_gap - 28), align="center")

def draw_dashed_30(chart_x, chart_w, chart_y, chart_h):
    jan1_x = date_to_chart(datetime.datetime(2026, 1, 1), chart_x, chart_w)
    ref_y = pct_to_chart(0.3, chart_y, chart_h)
    fill(None)
    stroke(0, 0, 0)
    strokeWidth(3)
    lineDash(16, 12)
    line((jan1_x, ref_y), (chart_x + chart_w, ref_y))
    lineDash(None)


def draw_line_page(series):
    newPage(w, h)
    fill(0, 0, 0)
    strokeWidth(3)
    chart_x, chart_w, chart_y, chart_h = make_layout()
    draw_axes(chart_x, chart_w, chart_y, chart_h)
    fill(None)
    strokeWidth(6)
    lineJoin("round")
    lineCap("round")
    stroke(0xF5/255, 0x4E/255, 0x00/255)
    newPath()
    for i, (dt, pct) in enumerate(zip(dates, series)):
        px = date_to_chart(dt, chart_x, chart_w)
        py = pct_to_chart(pct, chart_y, chart_h)
        if i == 0:
            moveTo((px, py))
        else:
            lineTo((px, py))
    drawPath()
    stroke(0, 0, 0)
    strokeWidth(3)

# ── EMA 14-day ───────────────────────────────────────────────────────────────
draw_line_page(pct_ema14)


# ── Save ──────────────────────────────────────────────────────────────────────
if shouldSave:
    filename = os.path.join(EXPORTS, "chart-cloud-agents-" + currentTime.strftime("%Y%m%d-%H%M%S"))
    if isAnimated:
        saveImage(filename + ".gif")
        saveImage(filename + ".mp4")
    else:
        saveImage(filename + ".png")
        saveImage(filename + ".svg")
