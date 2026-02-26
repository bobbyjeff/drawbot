# Chart 2 for "Industrial Era" blog post

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
with open(os.path.join(DATA, "agent-per-tab-weekly.csv"), "r") as f:
    reader = csv.DictReader(f)
    rows = list(reader)

# Parse and sort; filter to Jan 2025+
def parse_date(s):
    return datetime.datetime.fromisoformat(s.replace(" ", "T").split("+")[0])

rows = sorted(rows, key=lambda r: parse_date(r["month_start"]))
rows = [r for r in rows if parse_date(r["month_start"]) >= datetime.datetime(2025, 1, 1)]

dates  = [parse_date(r["month_start"]) for r in rows]
ratios = [float(r["agent_requests_per_tab_accept"]) for r in rows]

smoothed = ratios

# X domain
x_date_min = dates[0]
x_date_max = dates[-1]
total_seconds = (x_date_max - x_date_min).total_seconds()

# Y domain
y_min = 0.0
y_max = 1.5

# Artboard setup
w = 2400
aspect_ratio = 10.5 / 24
h = w * aspect_ratio

frames_to_render = num_frames if isAnimated else 1

for frame in range(frames_to_render):
    newPage(w, h)
    if isAnimated:
        frameDuration(frame_duration)

    fill(0, 0, 0)
    strokeWidth(3)

    # Chart area (inset bounds — same as other charts)
    margin = 96
    x_axis_left_extra = margin * 1.75
    margin_left = margin_right = margin_top = margin_bottom = margin
    chart_x = margin_left + x_axis_left_extra
    chart_w = w - margin_left - margin_right - x_axis_left_extra
    chart_y = margin_bottom
    chart_h = h - margin_top - margin_bottom

    def date_to_chart(dt):
        t = (dt - x_date_min).total_seconds() / total_seconds
        return chart_x + t * chart_w

    def ratio_to_chart(v):
        t = (v - y_min) / (y_max - y_min)
        return chart_y + t * chart_h

    # Annotation bands — drawn first so they sit behind everything
    show_annotations = 1

    # Band definitions: (start_date, end_date, label_line1, label_line2)
    annotation_bands = [
        (
            datetime.datetime(2025, 1, 1),
            datetime.datetime(2025, 5, 1),
            "Good enough to try",
            "Agents become viable, early adoption begins",
        ),
        (
            datetime.datetime(2025, 10, 1),
            datetime.datetime(2026, 3, 1),
            "Good enough to trust",
            "Agents replace hand-written code as the first draft",
        ),
    ]

    if show_annotations:
        for band_start, band_end, line1, line2 in annotation_bands:
            bx1 = date_to_chart(max(band_start, x_date_min))
            bx2 = min(date_to_chart(band_end), chart_x + chart_w)
            by1 = chart_y
            by2 = chart_y + chart_h

            # Shaded band
            stroke(None)
            fill(0, 0, 0, 0.04)
            rect(bx1, by1, bx2 - bx1, by2 - by1)

    # Y-axis grid lines
    y_ticks = [0.0, 0.5, 1.0, 1.5]
    for val in y_ticks:
        y = ratio_to_chart(val)
        if val == 0.0:
            stroke(0, 0, 0)
            line((margin_left, y), (chart_x + chart_w, y))
        else:
            stroke(0.85, 0.85, 0.85)
            line((margin_left, y), (chart_x + chart_w, y))

    stroke(0, 0, 0)

    # X-axis monthly ticks
    tick_length = 10
    x_axis_y = chart_y
    major_ticks = [
        datetime.datetime(2025, 1, 1),
        datetime.datetime(2025, 7, 1),
        datetime.datetime(2026, 1, 1),
    ]
    cur = datetime.datetime(x_date_min.year, x_date_min.month, 1)
    while cur <= x_date_max:
        x_pos = date_to_chart(cur)
        line((x_pos, x_axis_y), (x_pos, x_axis_y - tick_length))
        if cur.month == 12:
            cur = datetime.datetime(cur.year + 1, 1, 1)
        else:
            cur = datetime.datetime(cur.year, cur.month + 1, 1)

    # Data line: EMA α=0.6, #F54E00
    fill(None)
    strokeWidth(6)
    lineJoin("round")
    lineCap("round")
    stroke(0xF5/255, 0x4E/255, 0x00/255)
    newPath()
    for i, (dt, v) in enumerate(zip(dates, smoothed)):
        px = date_to_chart(dt)
        py = ratio_to_chart(v)
        if i == 0:
            moveTo((px, py))
        else:
            lineTo((px, py))
    drawPath()

    # Reset stroke
    stroke(0, 0, 0)
    strokeWidth(3)

    if show_labels:
        stroke(None)
        fill(0, 0, 0)
        font("Helvetica")
        fontSize(28)
        label_gap = 12

        for val in y_ticks:
            y = ratio_to_chart(val)
            text(f"{val:.1f}×", (chart_x - label_gap, y), align="right")

        with savedState():
            translate(margin_left / 2, chart_y + chart_h / 2)
            rotate(-90)
            text("Agent requests per Tab accept", (0, 0), align="center")

        for dt in major_ticks:
            if x_date_min <= dt <= x_date_max:
                x_pos = date_to_chart(dt)
                lbl = dt.strftime("%b %Y") if dt.month == 1 else dt.strftime("%b '%y")
                text(lbl, (x_pos, x_axis_y - tick_length - label_gap - 28), align="center")

# Save images
if shouldSave:
    filename = os.path.join(EXPORTS, "chart-industrial-era-2-" + currentTime.strftime("%Y%m%d-%H%M%S"))
    if isAnimated:
        saveImage(filename + ".gif")
        saveImage(filename + ".mp4")
    else:
        saveImage(filename + ".png")
        saveImage(filename + ".svg")
