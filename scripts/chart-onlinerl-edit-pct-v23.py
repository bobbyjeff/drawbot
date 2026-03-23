import os
import json
import math
import datetime


# Flags
shouldSave = 1
show_labels = 1


currentTime = datetime.datetime.now()

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORTS = os.path.join(ROOT, "exports")
DATA = os.path.join(ROOT, "data")


def rgb(r, g, b):
    return r / 255, g / 255, b / 255


BLACK = rgb(0x11, 0x11, 0x11)
PRIMARY = rgb(0xF5, 0x4E, 0x00)
BASELINE_GRAY = rgb(0xB8, 0xB8, 0xB3)
LIGHT_GRAY = rgb(0xE3, 0xE3, 0xE0)


def load_json(filename):
    with open(os.path.join(DATA, filename), "r") as f:
        return json.load(f)


def truncate_through_step(rows, step_limit):
    return [row for row in rows if row["step"] <= step_limit]


rows = truncate_through_step(load_json("onlinerl_v23_edit_pct_series.json")["edit_pct_by_step"], 35)
current_series = [(row["step"], row["current_model_edit_pct"]) for row in rows]
baseline_series = [(row["step"], row["baseline_edit_pct"]) for row in rows]


W = 2400
aspect_ratio = 10.5 / 24
H = W * aspect_ratio

margin = 96
x_axis_left_extra = margin * 1.5
grid_x = margin
grid_w = W - margin * 2
chart_x = margin + x_axis_left_extra
chart_w = W - margin * 2 - x_axis_left_extra
chart_y = margin
chart_h = H - margin * 2


def data_bounds(series_list):
    xs = []
    ys = []
    for series in series_list:
        for x, y in series:
            if x is not None:
                xs.append(x)
            if y is not None:
                ys.append(y)
    return min(xs), max(xs), min(ys), max(ys)


def padded_range(vmin, vmax, pad_ratio=0.08):
    if vmin == vmax:
        pad = abs(vmin) * 0.1 if vmin != 0 else 1.0
        return vmin - pad, vmax + pad
    span = vmax - vmin
    return vmin - span * pad_ratio, vmax + span * pad_ratio


def nice_step(span, target_ticks=5):
    if span <= 0:
        return 1
    raw = span / max(target_ticks - 1, 1)
    magnitude = 10 ** math.floor(math.log10(raw))
    residual = raw / magnitude
    if residual <= 1:
        nice = 1
    elif residual <= 2:
        nice = 2
    elif residual <= 5:
        nice = 5
    else:
        nice = 10
    return nice * magnitude


def make_ticks(vmin, vmax, target_ticks=5):
    step = nice_step(vmax - vmin, target_ticks)
    start = math.floor(vmin / step) * step
    end = math.ceil(vmax / step) * step
    ticks = []
    current = start
    while current <= end + step * 0.5:
        ticks.append(current)
        current += step
    return ticks


def make_ticks_within(vmin, vmax, target_ticks=5):
    step = max(1, int(math.ceil(nice_step(vmax - vmin, target_ticks))))
    ticks = [vmin]
    current = math.ceil(vmin / step) * step
    while current < vmax:
        if current > vmin:
            ticks.append(current)
        current += step
    if vmax > vmin:
        ticks.append(vmax)
    result = []
    for tick in ticks:
        if not result or abs(result[-1] - tick) > 1e-9:
            result.append(tick)
    return result


def ema_series(series, alpha=0.30):
    result = []
    prev = None
    for x, y in series:
        if y is None:
            result.append((x, None))
            prev = None
            continue
        prev = y if prev is None else alpha * y + (1 - alpha) * prev
        result.append((x, prev))
    return result


def x_to_px(x, x_min, x_max, left_pad=44, right_pad=0):
    if x_max == x_min:
        return chart_x + chart_w / 2
    t = (x - x_min) / (x_max - x_min)
    return chart_x + left_pad + t * (chart_w - left_pad - right_pad)


def y_to_py(y, y_min, y_max):
    if y_max == y_min:
        return chart_y + chart_h / 2
    t = (y - y_min) / (y_max - y_min)
    return chart_y + t * chart_h


def draw_line_series(series, color, x_min, x_max, y_min, y_max, width=6):
    stroke(*color)
    strokeWidth(width)
    lineJoin("round")
    lineCap("round")
    fill(None)

    newPath()
    for i, (x, y) in enumerate(series):
        px = x_to_px(x, x_min, x_max)
        py = y_to_py(y, y_min, y_max)
        if i == 0:
            moveTo((px, py))
        else:
            lineTo((px, py))
    drawPath()


def draw_legend(items, x, y):
    swatch_w = 42
    gap = 18
    cursor_x = x
    for label, color in items:
        stroke(None)
        fill(*color)
        rect(cursor_x, y - 10, swatch_w, 8)
        fill(*BLACK)
        font("Helvetica")
        fontSize(24)
        text(label, (cursor_x + swatch_w + 10, y - 18), align="left")
        cursor_x += swatch_w + 10 + textSize(label)[0] + gap


smoothed_series = [
    ("edit %", PRIMARY, ema_series(current_series, 0.30)),
    ("baseline", BASELINE_GRAY, ema_series(baseline_series, 0.30)),
]

x_min, x_max, y_min_raw, y_max_raw = data_bounds([series for _, _, series in smoothed_series])
x_ticks = make_ticks_within(x_min, x_max, 6)
y_min, y_max = padded_range(y_min_raw, y_max_raw, 0.1)
y_ticks = [tick for tick in make_ticks(y_min, y_max, 5) if y_min <= tick <= y_max]


newPage(W, H)

strokeWidth(3)
for y_tick in y_ticks:
    py = y_to_py(y_tick, y_min, y_max)
    stroke(*LIGHT_GRAY)
    lineDash(None)
    line((grid_x, py), (grid_x + grid_w, py))

for _, color, series in sorted(smoothed_series, key=lambda item: ("baseline" not in item[0].lower(),)):
    draw_line_series(series, color, x_min, x_max, y_min, y_max)

stroke(*BLACK)
strokeWidth(3)
line((grid_x, chart_y), (grid_x + grid_w, chart_y))

tick_length = 10
for x_tick in x_ticks:
    px = x_to_px(x_tick, x_min, x_max)
    line((px, chart_y), (px, chart_y - tick_length))

if show_labels:
    stroke(None)
    fill(*BLACK)
    font("Helvetica-Bold")
    fontSize(34)
    text("Online RL edit % v23", (chart_x, chart_y + chart_h + 28), align="left")
    font("Helvetica")
    fontSize(24)
    text("EMA 0.30", (chart_x + chart_w, chart_y + chart_h + 34), align="right")

    label_gap = 16
    for y_tick in y_ticks:
        py = y_to_py(y_tick, y_min, y_max)
        text(f"{y_tick:.0f}%", (grid_x, py + 8), align="left")

    for x_tick in x_ticks:
        px = x_to_px(x_tick, x_min, x_max)
        text(f"{int(round(x_tick))}", (px, chart_y - tick_length - label_gap - 28), align="center")

    text("steps", (chart_x + chart_w / 2, chart_y - tick_length - label_gap - 28 - 36), align="center")

    with savedState():
        translate(margin / 2, chart_y + chart_h / 2)
        rotate(90)
        text("edit %", (0, 0), align="center")

    draw_legend(
        [("edit %", PRIMARY), ("baseline", BASELINE_GRAY)],
        chart_x + chart_w - 360,
        chart_y + chart_h + 26,
    )


if shouldSave:
    base = os.path.join(EXPORTS, "chart-onlinerl-edit-pct-v23-" + currentTime.strftime("%Y%m%d-%H%M%S"))
    saveImage(base + ".png")
    saveImage(base + ".svg")
