#!/usr/bin/env python3
# Blog header — "The future of software development is multi-model"
# Concept: mirrored horizontal line fields tapering into the center.

# Flags
shouldSave = 0

# Imports
import os
import math
import datetime

currentTime = datetime.datetime.now()

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORTS = os.path.join(ROOT, "exports")

# Artboard
w, h = 2400, 1260
inset = 96
inner_w = w - 2 * inset
inner_h = h - 2 * inset
cx, cy = w / 2, h / 2

# Colors
BG_COLOR = (1, 1, 1)
FG_COLOR = (0, 0, 0)

STROKE_W = 3
CONNECTOR_START_W = STROKE_W
CONNECTOR_END_W = 0


def draw_tapered_segment(x1, y1, x2, y2, start_width, end_width):
    dx = x2 - x1
    dy = y2 - y1
    length = math.hypot(dx, dy)
    if length == 0:
        return

    nx = -dy / length
    ny = dx / length

    p1a = (x1 + nx * start_width / 2, y1 + ny * start_width / 2)
    p1b = (x1 - nx * start_width / 2, y1 - ny * start_width / 2)
    p2a = (x2 + nx * end_width / 2, y2 + ny * end_width / 2)
    p2b = (x2 - nx * end_width / 2, y2 - ny * end_width / 2)

    path = BezierPath()
    path.moveTo(p1a)
    path.lineTo(p2a)
    path.lineTo(p2b)
    path.lineTo(p1b)
    path.closePath()

    fill(*FG_COLOR)
    stroke(None)
    drawPath(path)


newPage(w, h)
fill(*BG_COLOR)
rect(0, 0, w, h)

left_block_x = inset
left_block_y = inset
left_block_w = inner_w / 4
left_block_h = inner_h
right_block_x = w - inset - left_block_w

num_lines = 28
line_gap = left_block_h / (num_lines - 1)

for i in range(num_lines):
    y = left_block_y + i * line_gap
    draw_tapered_segment(
        left_block_x + left_block_w,
        y,
        cx,
        cy,
        CONNECTOR_START_W,
        CONNECTOR_END_W,
    )
    draw_tapered_segment(
        right_block_x,
        y,
        cx,
        cy,
        CONNECTOR_START_W,
        CONNECTOR_END_W,
    )

stroke(*FG_COLOR)
strokeWidth(STROKE_W)
fill(None)
lineCap("round")

for i in range(num_lines):
    y = left_block_y + i * line_gap
    line((left_block_x, y), (left_block_x + left_block_w, y))
    line((right_block_x, y), (right_block_x + left_block_w, y))

# Save
if shouldSave:
    filename = os.path.join(
        EXPORTS,
        "blog-future-software-development-is-multi-model-radial-line-fields-"
        + currentTime.strftime("%Y%m%d-%H%M%S"),
    )
    saveImage(filename + ".png")
    saveImage(filename + ".svg")
