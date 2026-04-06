# Chart: warp decode accuracy gain
# Grouped vertical bars for previous Triton path vs warp decode throughput.

# Flags
shouldSave = 1
show_labels = 1

import os
import csv
import datetime

currentTime = datetime.datetime.now()

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORTS = os.path.join(ROOT, "exports")
DATA = os.path.join(ROOT, "data")


def rgb(r, g, b):
    return r / 255, g / 255, b / 255


def fmt_axis_tps(value):
    return f"{round(value):.0f}"


def fmt_bar_tps(value):
    if value >= 100:
        return f"{value:.1f}"
    return f"{value:.1f}"


with open(os.path.join(DATA, "warp-decode-accuracy-gain.csv"), "r") as f:
    rows = list(csv.DictReader(f))


entries = []
for row in rows:
    entries.append(
        {
            "prompt_range": row["prompt_range"].lower().replace("-", "–") + " tokens",
            "previous_tps": float(row["base_tps"]),
            "warp_tps": float(row["mega_tps"]),
            "speedup": row["speedup"],
        }
    )


W = 2400
H = W * (9 / 24)

margin_left = 96
margin_right = 96
margin_top = 96
margin_bottom = 150
y_axis_left_extra = 180

chart_x = margin_left + y_axis_left_extra
chart_y = margin_bottom
chart_w = W - margin_left - margin_right - y_axis_left_extra
chart_h = H - margin_top - margin_bottom

C_GRID = rgb(0xE0, 0xE0, 0xE0)
C_TEXT = (0, 0, 0)
C_PREV = rgb(0xB4, 0xB4, 0xB4)
C_WARP = rgb(0xF5, 0x4E, 0x00)

y_max = 120.0
y_ticks = [0.0, 40.0, 80.0, 120.0]
label_y_ticks = y_ticks

n_groups = len(entries)
group_w = chart_w / n_groups
bar_w = group_w * 0.24
pair_gap = group_w * 0.08


def val_to_y(value):
    return chart_y + (value / y_max) * chart_h


def group_center(i):
    return chart_x + (i + 0.5) * group_w


def draw_axes():
    strokeWidth(3)
    for tick in y_ticks:
        py = val_to_y(tick)
        if tick == 0:
            stroke(0, 0, 0)
        else:
            stroke(*C_GRID)
        line((margin_left, py), (W - margin_right, py))

    tick_len = 10
    stroke(0, 0, 0)
    for i in range(n_groups):
        cx = group_center(i)
        line((cx, chart_y), (cx, chart_y - tick_len))


def draw_legend():
    if not show_labels:
        return

    legend_y = H - margin_top + 10
    swatch = 28
    gap = 14

    stroke(None)

    fill(*C_PREV)
    rect(chart_x, legend_y, swatch, swatch)
    fill(*C_TEXT)
    font("Helvetica")
    fontSize(30)
    text("Previous (Triton path)", (chart_x + swatch + gap, legend_y + 2), align="left")

    x2 = chart_x + 500
    fill(*C_WARP)
    rect(x2, legend_y, swatch, swatch)
    fill(*C_TEXT)
    text("Warp decode", (x2 + swatch + gap, legend_y + 2), align="left")


def draw_labels():
    if not show_labels:
        return

    stroke(None)
    fill(*C_TEXT)
    font("Helvetica")

    for tick in label_y_ticks:
        py = val_to_y(tick)
        fontSize(28)
        text(fmt_axis_tps(tick), (margin_left, py + 12), align="left")

    for i, entry in enumerate(entries):
        cx = group_center(i)
        fontSize(32)
        text(entry["prompt_range"], (cx, chart_y - 56), align="center")


def draw_bars():
    for i, entry in enumerate(entries):
        cx = group_center(i)
        prev_h = val_to_y(entry["previous_tps"]) - chart_y
        warp_h = val_to_y(entry["warp_tps"]) - chart_y

        prev_x = cx - pair_gap / 2 - bar_w
        warp_x = cx + pair_gap / 2

        stroke(None)
        fill(*C_PREV)
        rect(prev_x, chart_y, bar_w, prev_h)

        fill(*C_WARP)
        rect(warp_x, chart_y, bar_w, warp_h)

        if show_labels:
            fill(*C_TEXT)
            font("Helvetica")
            fontSize(24)
            text(fmt_bar_tps(entry["previous_tps"]), (prev_x + bar_w / 2, chart_y + prev_h + 14), align="center")
            text(fmt_bar_tps(entry["warp_tps"]), (warp_x + bar_w / 2, chart_y + warp_h + 14), align="center")

            fontSize(22)
            text(entry["speedup"], (cx, chart_y + max(prev_h, warp_h) + 50), align="center")


newPage(W, H)
draw_axes()
draw_bars()
draw_labels()
draw_legend()


if shouldSave:
    ts = currentTime.strftime("%Y%m%d-%H%M%S")
    base = os.path.join(EXPORTS, f"chart-warp-decode-accuracy-gain-{ts}")
    saveImage(base + ".png")
    saveImage(base + ".svg")
