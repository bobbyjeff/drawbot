# Chart: warp decode cosine similarity vs FP32 reference
# Grouped vertical bars for Legacy vs Warp decode at B=1 and B=2.

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


def fmt_axis_cos(value):
    return f"{value:.3f}"


def fmt_bar_cos(value):
    return f"{value:.6f}"


with open(os.path.join(DATA, "warp-decode-fp32-distance.csv"), "r") as f:
    rows = list(csv.DictReader(f))


entries = []
for row in rows:
    entries.append(
        {
            "batch": int(row["b"]),
            "legacy_cos": float(row["legacy_cos"]),
            "warp_cos": float(row["mega_cos"]),
            "gain": row["gain"],
        }
    )


W = 2400
H = W * (10 / 24)

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
C_LEGACY = rgb(0xB4, 0xB4, 0xB4)
C_WARP = rgb(0xF5, 0x4E, 0x00)
C_GUIDE = rgb(0x9A, 0x9A, 0x9A)

y_min = 0.996
y_max = 1.000
y_ticks = [0.996, 0.997, 0.998, 0.999, 1.000]
label_y_ticks = y_ticks

n_groups = len(entries)
group_w = chart_w / n_groups
bar_w = group_w * 0.24
pair_gap = group_w * 0.08


def val_to_y(value):
    return chart_y + ((value - y_min) / (y_max - y_min)) * chart_h


def group_center(i):
    return chart_x + (i + 0.5) * group_w


def draw_axes():
    strokeWidth(3)
    for tick in y_ticks:
        py = val_to_y(tick)
        if abs(tick - y_min) < 1e-9:
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

    fill(*C_LEGACY)
    rect(chart_x, legend_y, swatch, swatch)
    fill(*C_TEXT)
    font("Helvetica")
    fontSize(30)
    text("Legacy", (chart_x + swatch + gap, legend_y + 2), align="left")

    x2 = chart_x + 260
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
        text(fmt_axis_cos(tick), (margin_left, py + 12), align="left")

    for i, entry in enumerate(entries):
        cx = group_center(i)
        fontSize(32)
        text(f"B={entry['batch']}", (cx, chart_y - 56), align="center")


def draw_bars():
    top_y = val_to_y(y_max)

    for i, entry in enumerate(entries):
        cx = group_center(i)
        legacy_h = val_to_y(entry["legacy_cos"]) - chart_y
        warp_h = val_to_y(entry["warp_cos"]) - chart_y

        legacy_x = cx - pair_gap / 2 - bar_w
        warp_x = cx + pair_gap / 2

        stroke(None)
        fill(*C_LEGACY)
        rect(legacy_x, chart_y, bar_w, legacy_h)

        fill(*C_WARP)
        rect(warp_x, chart_y, bar_w, warp_h)

        if show_labels:
            legacy_top = chart_y + legacy_h
            warp_top = chart_y + warp_h

            stroke(*C_GUIDE)
            strokeWidth(2)
            lineDash(8, 8)
            line((legacy_x + bar_w / 2, legacy_top), (legacy_x + bar_w / 2, top_y))
            line((warp_x + bar_w / 2, warp_top), (warp_x + bar_w / 2, top_y))
            lineDash(None)

            fill(*C_TEXT)
            stroke(None)
            font("Helvetica")
            fontSize(24)
            text(fmt_bar_cos(entry["legacy_cos"]), (legacy_x + bar_w / 2, legacy_top + 14), align="center")
            text(fmt_bar_cos(entry["warp_cos"]), (warp_x + bar_w / 2, warp_top + 14), align="center")

            fontSize(22)
            gap_label_y = top_y - 34
            text(f"{entry['gain']} accuracy gain", (cx, gap_label_y), align="center")


newPage(W, H)
draw_axes()
draw_bars()
draw_labels()
draw_legend()


if shouldSave:
    ts = currentTime.strftime("%Y%m%d-%H%M%S")
    base = os.path.join(EXPORTS, f"chart-warp-decode-fp32-distance-{ts}")
    saveImage(base + ".png")
    saveImage(base + ".svg")
