# Chart for "Long-running agents are out of Research Preview" blog post, 2026-02-11

# Flags
shouldSave = 0
isAnimated = 0  # 0 = still (png/svg), 1 = animation (gif/mp4)
show_labels = 0  # 0 = no axis labels, 1 = show axis labels

# Animation settings (only used if isAnimated = 1)
num_frames = 12
frame_duration = 1/8

# Imports
import os
import datetime
import math
import csv
currentTime = datetime.datetime.now()

ROOT    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORTS = os.path.join(ROOT, "exports")
DATA    = os.path.join(ROOT, "data")

# Load data (from lines_changed_all_users.csv)
with open(os.path.join(DATA, "lines_changed_all_users.csv"), "r") as f:
    reader = csv.DictReader(f)
    rows = list(reader)

# Data bounds: use actual min/max for bins (matches Hex np.logspace(all_data.min(), all_data.max()))
all_positive = [
    int(r["total_lines_changed"])
    for r in rows
    if r.get("total_lines_changed", "").isdigit() and int(r["total_lines_changed"]) > 0
]
data_min = min(all_positive) if all_positive else 1
data_max = max(all_positive) if all_positive else 1
x_min = data_min
x_max = data_max

# Filter Regular and Grind (Long-running) for histogram (match Hex: data > 0)
regular_values = [
    int(r["total_lines_changed"])
    for r in rows
    if r.get("composer_type") == "Regular"
    and r.get("total_lines_changed", "").isdigit()
    and int(r["total_lines_changed"]) > 0
]
grind_values = [
    int(r["total_lines_changed"])
    for r in rows
    if r.get("composer_type") == "Grind"
    and r.get("total_lines_changed", "").isdigit()
    and int(r["total_lines_changed"]) > 0
]
regular_total = len(regular_values)
grind_total = len(grind_values)

# Bins: 30 bins evenly spaced in log space (like np.logspace), matching Hex notebook
log_min = math.log10(x_min)
log_max = math.log10(x_max)
num_bins = 30
bin_edges = [10 ** (log_min + (log_max - log_min) * i / num_bins) for i in range(num_bins + 1)]

# Compute histogram for Regular agents (percentage of that group's total)
regular_hist = [0] * num_bins
for v in regular_values:
    if v <= 0 or v > x_max:
        continue
    for i in range(num_bins):
        if bin_edges[i] <= v < bin_edges[i + 1]:
            regular_hist[i] += 1
            break
regular_pcts = [100 * c / regular_total for c in regular_hist] if regular_total else [0] * num_bins

# Compute histogram for Grind (Long-running) agents
grind_hist = [0] * num_bins
for v in grind_values:
    if v <= 0 or v > x_max:
        continue
    for i in range(num_bins):
        if bin_edges[i] <= v < bin_edges[i + 1]:
            grind_hist[i] += 1
            break
grind_pcts = [100 * c / grind_total for c in grind_hist] if grind_total else [0] * num_bins

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
    
    # Transparent background (no fill)
    # Foreground: black
    fill(0, 0, 0)
    strokeWidth(3)
    
    # Chart area (margins)
    margin = 96
    x_axis_left_extra = 96  # extend horizontal lines to the left (offset chart content right)
    margin_left = margin_right = margin_top = margin_bottom = margin
    # Chart content offset right by x_axis_left_extra; axis lines start at margin
    chart_x = margin_left + x_axis_left_extra
    chart_w = w - margin_left - margin_right - x_axis_left_extra
    chart_y = margin_bottom
    chart_h = h - margin_top - margin_bottom
    
    # Y-axis: 0–10% (Percentage of PRs)
    y_ticks = [0, 2, 4, 6, 8, 10]
    
    for i, pct in enumerate(y_ticks):
        # Map percentage to chart y coordinate (0% = bottom, 10% = top)
        y = chart_y + (pct / 10) * chart_h
        
        if pct == 0:
            # X-axis: solid line (from margin to right edge)
            stroke(0, 0, 0)
            lineDash(None)
            line((margin_left, y), (chart_x + chart_w, y))
        else:
            # Horizontal grid lines: dashed
            stroke(0.5, 0.5, 0.5)  # light gray
            lineDash(12, 8)
            line((margin_left, y), (chart_x + chart_w, y))
    
    # Reset stroke for subsequent drawing
    stroke(0, 0, 0)
    lineDash(None)
    
    # X-axis: log-scale ticks
    tick_length = 10
    minor_ticks = [2, 3, 4, 5, 6, 7, 8, 9]  # per decade
    x_axis_y = chart_y  # baseline (0% line)
    
    def x_to_chart(value):
        t = (math.log10(value) - math.log10(x_min)) / (math.log10(x_max) - math.log10(x_min))
        return chart_x + t * chart_w
    
    # Full decades: 1–10, 10–100, ..., 10000–100000
    for power in range(5):
        for mult in minor_ticks:
            value = mult * (10**power)
            x_pos = x_to_chart(value)
            line((x_pos, x_axis_y), (x_pos, x_axis_y - tick_length))
    
    # Major ticks at decade boundaries (10^0, 10^1, ..., 10^5)
    for power in range(6):
        x_pos = x_to_chart(10**power)
        line((x_pos, x_axis_y), (x_pos, x_axis_y - tick_length))
    
    # Extended segment 10^5 to x_max: ticks at 2×10^5, 3×10^5, 4×10^5, 5×10^5 (if x_max >= 5×10^5)
    for mult in [2, 3, 4, 5]:
        value = mult * 10**5
        if value <= x_max:
            x_pos = x_to_chart(value)
            line((x_pos, x_axis_y), (x_pos, x_axis_y - tick_length))
    
    # Histogram bars: Regular (blue) then Grind/Long-running (green), shared bins, alpha 0.55
    bar_gap = 2  # total gap per bar (inset bar_gap/2 on each side)
    stroke(None)
    # Regular: #5470c6
    fill(84 / 255, 112 / 255, 198 / 255, 0.55)
    for i, pct in enumerate(regular_pcts):
        if i >= len(bin_edges) - 1:
            break
        x_left = x_to_chart(bin_edges[i])
        x_right = x_to_chart(bin_edges[i + 1])
        inset = bar_gap / 2
        bar_left = x_left + inset
        bar_width = max(0, (x_right - x_left) - bar_gap)
        bar_top = chart_y + (pct / 10) * chart_h
        rect(bar_left, x_axis_y, bar_width, bar_top - x_axis_y)
    # Grind (Long-running): #91cc75
    fill(145 / 255, 204 / 255, 117 / 255, 0.55)
    for i, pct in enumerate(grind_pcts):
        if i >= len(bin_edges) - 1:
            break
        x_left = x_to_chart(bin_edges[i])
        x_right = x_to_chart(bin_edges[i + 1])
        inset = bar_gap / 2
        bar_left = x_left + inset
        bar_width = max(0, (x_right - x_left) - bar_gap)
        bar_top = chart_y + (pct / 10) * chart_h
        rect(bar_left, x_axis_y, bar_width, bar_top - x_axis_y)
    
    # Restore stroke for ticks/lines (if we draw more after)
    stroke(0, 0, 0)
    strokeWidth(3)
    
    if show_labels:
        # Axis labels (no stroke on text)
        stroke(None)
        fill(0, 0, 0)  # black text
        font("Helvetica")
        fontSize(28)
        label_gap = 12  # gap between tick and label
        
        # Y-axis tick labels (0%, 2%, ..., 10%)
        for pct in y_ticks:
            y = chart_y + (pct / 10) * chart_h
            text(f"{pct}%", (chart_x - label_gap, y), align="right")
        
        # Y-axis title
        with savedState():
            translate(margin_left / 2, chart_y + chart_h / 2)
            rotate(-90)
            text("Percentage of PRs", (0, 0), align="center")
        
        # X-axis tick labels (10^0, 10^1, ..., 10^5)
        superscripts = "⁰¹²³⁴⁵"
        for power in range(6):
            x_pos = x_to_chart(10**power)
            text(f"10{superscripts[power]}", (x_pos, x_axis_y - tick_length - label_gap - 28), align="center")
        
        # X-axis extended labels (2×10^5, 3×10^5, 4×10^5, 5×10^5)
        for mult in [2, 3, 4, 5]:
            value = mult * 10**5
            if value <= x_max:
                x_pos = x_to_chart(value)
                text(f"{mult}×10⁵", (x_pos, x_axis_y - tick_length - label_gap - 28), align="center")
        
        # X-axis title
        text("Lines of Code Changed (log scale)", (chart_x + chart_w / 2, x_axis_y - tick_length - 28 - 28 - label_gap), align="center")

# Save images
if shouldSave:
    filename = os.path.join(EXPORTS, "chart-long-running-agents-" + currentTime.strftime("%Y%m%d-%H%M%S"))
    if isAnimated:
        saveImage(filename + ".gif")
        saveImage(filename + ".mp4")
    else:
        saveImage(filename + ".png")
        saveImage(filename + ".svg")
