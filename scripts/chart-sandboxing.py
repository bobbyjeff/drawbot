# Chart for "Implementing a secure sandbox for local agents" blog post, 2026-02-18

# Flags
shouldSave = 1
isAnimated = 0  # 0 = still (png/svg), 1 = animation (gif/mp4)

# Animation settings (only used if isAnimated = 1)
num_frames = 12
frame_duration = 1 / 8

# Imports
import os
import datetime
currentTime = datetime.datetime.now()

ROOT    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORTS = os.path.join(ROOT, "exports")
DATA    = os.path.join(ROOT, "data")

# Data
data_path = os.path.join(DATA, "sandboxing-1.csv")
with open(data_path, "r") as f:
    rows = [line.strip() for line in f if line.strip()]

# Expected columns: mode, p50, p75, p90
labels = ["p50 (Median)", "p75", "p90"]
keys = ["p50", "p75", "p90"]
series_names = ["Not Sandboxed", "Sandboxed"]
series = {name: {} for name in series_names}

for row_text in rows[1:]:
    parts = row_text.split()
    if len(parts) < 4:
        continue
    mode = " ".join(parts[:-3])
    values = parts[-3:]
    if mode in series:
        for key, value in zip(keys, values):
            series[mode][key] = float(value)

# Artboard setup
w = 2400
aspect_ratio = 11 / 24  # height / width
h = w * aspect_ratio

# Draw frames (1 frame for stills, num_frames for animation)
frames_to_render = num_frames if isAnimated else 1

for frame in range(frames_to_render):
    newPage(w, h)
    if isAnimated:
        frameDuration(frame_duration)

    # Clean white background
    fill(1, 1, 1)
    rect(0, 0, w, h)

    # Base styling for upcoming bar chart drawing
    fill(0, 0, 0)
    stroke(0, 0, 0)
    strokeWidth(3)
    lineJoin("round")
    lineCap("round")

    # Chart area
    margin = 96
    y_label_gutter = 110  # reserved space for future y-axis number labels
    grid_x = margin
    bars_x = margin + y_label_gutter
    chart_y = margin
    grid_w = w - margin * 2
    bars_w = w - margin * 2 - y_label_gutter
    chart_h = h - margin * 2

    # Y scale (minutes)
    y_max = 9
    y_ticks = [2, 4, 6, 8]

    def y_to_chart(value):
        return chart_y + (value / y_max) * chart_h

    # Axes
    stroke(0, 0, 0)
    lineDash(None)
    line((grid_x, chart_y), (grid_x + grid_w, chart_y))  # x-axis

    # Y grid lines
    font("Helvetica")
    fontSize(34)
    for tick in y_ticks:
        y = y_to_chart(tick)
        stroke(0.85, 0.85, 0.85)
        lineDash(None)
        line((grid_x, y), (grid_x + grid_w, y))

    # Grouped bars (uniform rhythmic spacing per group slot)
    slot_w = bars_w / len(keys)
    group_pad = slot_w * 0.06
    bar_gap = slot_w * 0.02
    bar_w = (slot_w - 2 * group_pad - bar_gap) / 2
    colors = {
        "Not Sandboxed": (231 / 255, 76 / 255, 60 / 255),
        "Sandboxed": (39 / 255, 174 / 255, 96 / 255),
    }

    stroke(None)
    for i, key in enumerate(keys):
        group_start = bars_x + slot_w * i
        x_not = group_start + group_pad
        x_sbx = x_not + bar_w + bar_gap

        v_not = series["Not Sandboxed"].get(key, 0)
        v_sbx = series["Sandboxed"].get(key, 0)

        fill(*colors["Not Sandboxed"])
        rect(x_not, chart_y, bar_w, (v_not / y_max) * chart_h)

        fill(*colors["Sandboxed"])
        rect(x_sbx, chart_y, bar_w, (v_sbx / y_max) * chart_h)

    # X-axis labels
    fill(0, 0, 0)
    fontSize(36)
    for i, label in enumerate(labels):
        cx = bars_x + slot_w * (i + 0.5)
        text(label, (cx, chart_y - 52), align="center")

# Save images
if shouldSave:
    filename = os.path.join(EXPORTS, "chart-sandboxing-" + currentTime.strftime("%Y%m%d-%H%M%S"))
    if isAnimated:
        saveImage(filename + ".gif")
        saveImage(filename + ".mp4")
    else:
        saveImage(filename + ".png")
        saveImage(filename + ".svg")
