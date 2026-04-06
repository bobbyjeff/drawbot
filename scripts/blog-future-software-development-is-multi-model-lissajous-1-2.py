#!/usr/bin/env python3
# Blog header — "The future of software development is multi-model"
# Lissajous candidate: 1:2 with pi/2 phase shift.

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
cx, cy = w / 2, h / 2
inner_w = w - 2 * inset
inner_h = h - 2 * inset

# Colors
BG_COLOR = (1, 1, 1)
FG_COLOR = (0, 0, 0, 0.8)

STROKE_W = 3


def build_lissajous_path(cx, cy, scale_x, scale_y, a, b, delta, steps=1400):
    path = BezierPath()

    for i in range(steps + 1):
        t = 2 * math.pi * i / steps
        x = cx + scale_x * math.sin(a * t + delta)
        y = cy + scale_y * math.sin(b * t)

        if i == 0:
            path.moveTo((x, y))
        else:
            path.lineTo((x, y))

    return path


newPage(w, h)
fill(*BG_COLOR)
rect(0, 0, w, h)

curve_scale_x = inner_w / 2 - 36
curve_scale_y = inner_h / 2 - 36

stroke(*FG_COLOR)
strokeWidth(STROKE_W)
fill(None)
lineCap("round")
lineJoin("round")

drawPath(build_lissajous_path(cx, cy, curve_scale_x, curve_scale_y, 1, 2, math.pi / 2))

# Save
if shouldSave:
    filename = os.path.join(
        EXPORTS,
        "blog-future-software-development-is-multi-model-lissajous-1-2-"
        + currentTime.strftime("%Y%m%d-%H%M%S"),
    )
    saveImage(filename + ".png")
    saveImage(filename + ".svg")
