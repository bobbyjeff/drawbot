#!/usr/bin/env python3
# Blog header — "The future of software development is multi-model"
# Concept: a punch-card-like field of equally sized shapes on one shared grid.

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

# Colors
BG_COLOR = (1, 1, 1)
FG_COLOR = (0, 0, 0)
ORANGE = (0xF5 / 255, 0x4E / 255, 0x00 / 255)

STROKE_W = 2


def regular_polygon_points(cx, cy, radius, sides, rotation_deg=0):
    pts = []
    for i in range(sides):
        angle = math.radians(rotation_deg + i * (360 / sides))
        pts.append((cx + math.cos(angle) * radius, cy + math.sin(angle) * radius))
    return pts


def draw_polygon(points, fill_color=None, stroke_color=FG_COLOR):
    path = BezierPath()
    path.moveTo(points[0])
    for pt in points[1:]:
        path.lineTo(pt)
    path.closePath()

    if fill_color is None:
        fill(None)
    else:
        fill(*fill_color)

    if stroke_color is None:
        stroke(None)
    else:
        stroke(*stroke_color)
        strokeWidth(STROKE_W)

    drawPath(path)


def draw_square(cx, cy, size, fill_color=None, stroke_color=FG_COLOR):
    if fill_color is None:
        fill(None)
    else:
        fill(*fill_color)

    if stroke_color is None:
        stroke(None)
    else:
        stroke(*stroke_color)
        strokeWidth(STROKE_W)

    rect(cx - size / 2, cy - size / 2, size, size)


def draw_circle(cx, cy, size, fill_color=None, stroke_color=FG_COLOR):
    if fill_color is None:
        fill(None)
    else:
        fill(*fill_color)

    if stroke_color is None:
        stroke(None)
    else:
        stroke(*stroke_color)
        strokeWidth(STROKE_W)

    oval(cx - size / 2, cy - size / 2, size, size)


def draw_shape(kind, cx, cy, size, fill_color=None, stroke_color=FG_COLOR):
    if kind == "square":
        draw_square(cx, cy, size, fill_color, stroke_color)
    elif kind == "circle":
        draw_circle(cx, cy, size, fill_color, stroke_color)
    elif kind == "diamond":
        draw_polygon(
            regular_polygon_points(cx, cy, size / 2, 4, rotation_deg=45),
            fill_color,
            stroke_color,
        )
    elif kind == "triangle":
        draw_polygon(
            regular_polygon_points(cx, cy, size / 2, 3, rotation_deg=90),
            fill_color,
            stroke_color,
        )
    elif kind == "hex":
        draw_polygon(
            regular_polygon_points(cx, cy, size / 2, 6, rotation_deg=30),
            fill_color,
            stroke_color,
        )
    elif kind == "octagon":
        draw_polygon(
            regular_polygon_points(cx, cy, size / 2, 8, rotation_deg=22.5),
            fill_color,
            stroke_color,
        )


newPage(w, h)
fill(*BG_COLOR)
rect(0, 0, w, h)

cols = 40
rows = 18
cell_w = inner_w / cols
cell_h = inner_h / rows
shape_size = min(cell_w, cell_h) * 0.34

shape_cycle = ["square", "circle", "triangle", "diamond", "hex", "octagon"]

for row in range(rows):
    for col in range(cols):
        x = inset + col * cell_w
        y = inset + (rows - 1 - row) * cell_h
        cx = x + cell_w / 2
        cy = y + cell_h / 2

        kind = shape_cycle[(row * 5 + col * 3) % len(shape_cycle)]
        is_accent = (row * 11 + col * 7) % 53 == 0
        use_fill = (row * 2 + col) % 9 == 0

        fill_color = None
        stroke_color = FG_COLOR
        if use_fill and is_accent:
            fill_color = ORANGE
            stroke_color = None
        elif use_fill:
            fill_color = FG_COLOR
            stroke_color = None
        elif is_accent:
            stroke_color = ORANGE

        draw_shape(kind, cx, cy, shape_size, fill_color, stroke_color)

# Save
if shouldSave:
    filename = os.path.join(
        EXPORTS,
        "blog-future-software-development-is-multi-model-punch-card-"
        + currentTime.strftime("%Y%m%d-%H%M%S"),
    )
    saveImage(filename + ".png")
    saveImage(filename + ".svg")
