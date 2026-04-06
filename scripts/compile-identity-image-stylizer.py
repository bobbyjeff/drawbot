#!/usr/bin/env python3
# Image to ASCII study for Compile / OOH exploration.

import datetime
import os
import random


# Flags
isDark = 0
shouldSave = 0
normalizeGray = 1
showFullCellDemo = 0
showLineExtremesDemo = 0
showCellBorders = 0

currentTime = datetime.datetime.now()

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORTS = os.path.join(ROOT, "exports")
IMAGES = os.path.join(ROOT, "images")

# Image selection
IMAGE_NAME = "sam-whitmore.jpg"
path = os.path.join(IMAGES, IMAGE_NAME)

# Sampling / line rendering
GRID_DIVISOR = 64
X_STEP_RATIO = 1.0
MAX_LINES_PER_CELL = 14
CELL_GAP_IN_STROKES = 1.0
STROKE_WIDTH_RATIO = 1 / 14
GRAY_LO_PERCENTILE = 0.05
GRAY_HI_PERCENTILE = 0.95
DEMO_COLOR = (1.0, 0.35, 0.68)
BORDER_COLOR = (0.55, 0.55, 0.55)
BORDER_WIDTH = 1.5


def luminance(r, g, b):
    return 0.299 * r + 0.587 * g + 0.114 * b


def darkness_from_gray(normalized_gray):
    return normalized_gray if isDark else 1 - normalized_gray


def line_count_for_darkness(darkness):
    # Keep the mapping simple and legible: equal darkness steps add equal lines.
    count = int(round(darkness * MAX_LINES_PER_CELL))
    if darkness > 0 and count == 0:
        return 1
    return count


def draw_cell_lines(x, y, cell_w, cell_h, normalized_gray, stroke_width):
    darkness = darkness_from_gray(normalized_gray)
    line_count = line_count_for_darkness(darkness)
    if showFullCellDemo:
        line_count = MAX_LINES_PER_CELL
    elif showLineExtremesDemo:
        cell_index = int(x / max(cell_w, 1))
        total_cols = max(1, int(imageSize(path)[0] / max(cell_w, 1)))
        line_count = 1 if cell_index < total_cols / 2 else MAX_LINES_PER_CELL
    if line_count <= 0:
        return

    inset_x = (stroke_width * CELL_GAP_IN_STROKES) / 2
    line_x0 = x + inset_x
    line_x1 = x + cell_w - inset_x

    if line_count == 1:
        ys = [y + cell_h / 2]
    else:
        gap = stroke_width
        packed_height = line_count * stroke_width + (line_count - 1) * gap
        top_padding = max(0, (cell_h - packed_height) / 2)
        first_center = y + top_padding + stroke_width / 2
        step = stroke_width + gap
        ys = [first_center + i * step for i in range(line_count)]

    if showFullCellDemo or showLineExtremesDemo:
        stroke(*DEMO_COLOR)
    elif isDark:
        stroke(1, 1, 1)
    else:
        stroke(0, 0, 0)
    for line_y in ys:
        line((line_x0, line_y), (line_x1, line_y))


def draw_cell_border(x, y, cell_w, cell_h):
    if not showCellBorders:
        return

    fill(None)
    stroke(*BORDER_COLOR)
    strokeWidth(BORDER_WIDTH)
    rect(x, y, cell_w, cell_h)


def collect_gray_bounds(path, w, h, s, x_step):
    gray_values = []
    for y in range(0, h, s):
        for x in range(0, w, x_step):
            tx = x + x_step / 2
            ty = y + s / 2
            color = imagePixelColor(path, (tx, ty))
            if not color:
                continue
            r, g, b, a = color
            gray_values.append(luminance(r, g, b))

    if not gray_values:
        return 0, 1

    gray_values.sort()
    lo_idx = int((len(gray_values) - 1) * GRAY_LO_PERCENTILE)
    hi_idx = int((len(gray_values) - 1) * GRAY_HI_PERCENTILE)
    gray_min = gray_values[lo_idx]
    gray_max = gray_values[hi_idx]
    if gray_max <= gray_min:
        return min(gray_values), max(gray_values)
    return gray_min, gray_max


def draw_line_image():
    w, h = imageSize(path)
    s = max(1, int(w / GRID_DIVISOR))
    x_step = max(1, int(s * X_STEP_RATIO))
    # For the densest cell, make stroke thickness equal the interior gap, with
    # half a stroke of padding on top and bottom.
    stroke_width = max(0.8, s / (2 * MAX_LINES_PER_CELL))

    newPage(w, h)
    fill(0 if isDark else 1)
    stroke(None)
    rect(0, 0, w, h)
    fill(None)
    strokeWidth(stroke_width)
    lineCap("butt")

    if normalizeGray:
        gray_min, gray_max = collect_gray_bounds(path, w, h, s, x_step)
    else:
        gray_min, gray_max = 0, 1

    for y in range(0, h, s):
        for x in range(0, w, x_step):
            draw_cell_border(x, y, x_step, s)

    strokeWidth(stroke_width)
    lineCap("butt")

    for y in range(0, h, s):
        for x in range(0, w, x_step):
            tx = x + x_step / 2
            ty = y + s / 2
            color = imagePixelColor(path, (tx, ty))
            if not color:
                continue

            r, g, b, a = color
            gray = luminance(r, g, b)

            if normalizeGray and gray_max != gray_min:
                normalized_gray = (gray - gray_min) / (gray_max - gray_min)
            else:
                normalized_gray = gray

            draw_cell_lines(x, y, x_step, s, normalized_gray, stroke_width)


draw_line_image()


if shouldSave:
    os.makedirs(EXPORTS, exist_ok=True)
    base = os.path.join(
        EXPORTS,
        "compile-identity-ascii-" + currentTime.strftime("%Y%m%d-%H%M%S"),
    )
    saveImage(base + ".svg")
    saveImage(base + ".png")
