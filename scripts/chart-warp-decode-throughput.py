# Chart: warp decode throughput
# Single-series vertical bars for achieved throughput by batch, plus optimal line.

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


def fmt_tbps(value):
    if abs(value - round(value)) < 1e-9:
        return str(int(round(value)))
    return f"{value:.1f}"


def fmt_pct_of_optimal(value):
    return f"{round(value / OPTIMAL_TBPS * 100)}%"


with open(os.path.join(DATA, "warp-decode-throughput.csv"), "r") as f:
    rows = list(csv.DictReader(f))


entries = []
for row in rows:
    entries.append(
        {
            "batch": int(row["batch"]),
            "throughput_tbps": float(row["bandwidth_TBps"]),
        }
    )


W = 2400
H = W * (11 / 24)

margin_left = 96
margin_right = 96
margin_top = 96
margin_bottom = 140
y_axis_left_extra = 160

chart_x = margin_left + y_axis_left_extra
chart_y = margin_bottom
chart_w = W - margin_left - margin_right - y_axis_left_extra
chart_h = H - margin_top - margin_bottom

C_GRID = rgb(0xE0, 0xE0, 0xE0)
C_TEXT = (0, 0, 0)
C_BAR = rgb(0xF5, 0x4E, 0x00)
C_LINE = rgb(0x60, 0x60, 0x60)

OPTIMAL_TBPS = 6.8
y_max = 7.0
y_ticks = [float(i) for i in range(int(y_max) + 1)]
label_y_ticks = [float(i) for i in range(1, int(y_max) + 1)]

n_groups = len(entries)
group_w = chart_w / n_groups
bar_w = group_w * 0.42


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
    for i in range(n_groups):
        cx = group_center(i)
        line((cx, chart_y), (cx, chart_y - tick_len))


def draw_optimal_line():
    py = val_to_y(OPTIMAL_TBPS)

    stroke(*C_LINE)
    strokeWidth(3)
    lineDash(16, 10)
    line((margin_left, py), (W - margin_right, py))
    lineDash(None)

    if show_labels:
        stroke(None)
        fill(*C_LINE)
        font("Helvetica")
        fontSize(28)
        text(f"{OPTIMAL_TBPS:.1f} TB/s peak", (W - margin_right, py + 12), align="right")


def draw_labels():
    if not show_labels:
        return

    stroke(None)
    fill(*C_TEXT)
    font("Helvetica")

    for tick in label_y_ticks:
        py = val_to_y(tick)
        fontSize(28)
        text(fmt_tbps(tick), (margin_left, py + 12), align="left")

    for i, entry in enumerate(entries):
        cx = group_center(i)
        fontSize(32)
        text(f"B={entry['batch']}", (cx, chart_y - 54), align="center")


def draw_bars():
    for i, entry in enumerate(entries):
        cx = group_center(i)
        bar_h = val_to_y(entry["throughput_tbps"]) - chart_y
        bar_x = cx - bar_w / 2

        stroke(None)
        fill(*C_BAR)
        rect(bar_x, chart_y, bar_w, bar_h)

        if show_labels:
            fill(*C_TEXT)
            font("Helvetica")
            fontSize(24)
            text(
                fmt_pct_of_optimal(entry["throughput_tbps"]),
                (cx, chart_y + bar_h + 14),
                align="center",
            )


newPage(W, H)
draw_axes()
draw_optimal_line()
draw_bars()
draw_labels()


if shouldSave:
    ts = currentTime.strftime("%Y%m%d-%H%M%S")
    base = os.path.join(EXPORTS, f"chart-warp-decode-throughput-{ts}")
    saveImage(base + ".png")
    saveImage(base + ".svg")
