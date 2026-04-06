#!/usr/bin/env python3
# Blog header — "The future of software development is multi-model"
# Randomized 1:3 Lissajous study with differentiated line styles.

# Flags
shouldSave = 0

# Imports
import os
import math
import random
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
NUM_CURVES = 3
BASE_CURVE = (1, 3)
curve_styles = [
    {"name": "solid", "dash": None, "width": 3},
    {"name": "dash", "dash": (18, 10), "width": 3},
    {"name": "dot-dash", "dash": (2, 8, 14, 8), "width": 3},
]

# Set this to a list like [(1, 3, 0), (1, 3, math.pi / 2), ...] to reproduce a run.
fixed_curves = None

phase_options = [
    0,
    math.pi / 4,
    math.pi / 2,
    math.pi,
]


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

fill(None)
lineCap("round")
lineJoin("round")

if fixed_curves is None:
    chosen_phases = random.sample(phase_options, NUM_CURVES)
    curves = [
        (BASE_CURVE[0], BASE_CURVE[1], delta)
        for delta in chosen_phases
    ]
else:
    curves = fixed_curves

for i, (a, b, delta) in enumerate(curves):
    style = curve_styles[i % len(curve_styles)]
    stroke(*FG_COLOR)
    strokeWidth(style["width"])
    if style["dash"] is None:
        lineDash(None)
    else:
        lineDash(*style["dash"])
    drawPath(build_lissajous_path(cx, cy, curve_scale_x, curve_scale_y, a, b, delta))

lineDash(None)

print("Selected curves:")
for i, (a, b, delta) in enumerate(curves):
    style = curve_styles[i % len(curve_styles)]
    print(f"{style['name']}: ({a}, {b}, {repr(delta)})")

# Save
if shouldSave:
    curve_slug = "__".join(
        f"{a}-{b}-{str(round(delta, 4)).replace('.', 'p')}" for a, b, delta in curves
    )
    filename = os.path.join(
        EXPORTS,
        "blog-future-software-development-is-multi-model-lissajous-random-phases-"
        + currentTime.strftime("%Y%m%d-%H%M%S")
        + "-"
        + curve_slug,
    )
    saveImage(filename + ".png")
    saveImage(filename + ".svg")
