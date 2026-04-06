#!/usr/bin/env python3
# Blog header — "The future of software development is multi-model"
# Fresh starting point for the next concept.

# Flags
shouldSave = 0

# Imports
import os
import datetime

currentTime = datetime.datetime.now()

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORTS = os.path.join(ROOT, "exports")

# Artboard
w, h = 2400, 1260

# Colors
BG_COLOR = (1, 1, 1)

newPage(w, h)
fill(*BG_COLOR)
rect(0, 0, w, h)

# Save
if shouldSave:
    filename = os.path.join(
        EXPORTS,
        "blog-future-software-development-is-multi-model-"
        + currentTime.strftime("%Y%m%d-%H%M%S"),
    )
    saveImage(filename + ".png")
    saveImage(filename + ".svg")
