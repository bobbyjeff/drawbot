#!/usr/bin/env python3
# Compile artwork — generic graphics
# Vertical line fields arranged across a small set of horizontal rows.

# Flags
shouldSave = 1
isAnimated = 1  # 0 = still (png/svg), 1 = animation (gif/mp4)

# Animation settings
NUM_FRAMES = 60
FRAME_DURATION = 1 / 30  # 30 fps

# Imports
import os
import math
import datetime

currentTime = datetime.datetime.now()

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORTS = os.path.join(ROOT, "exports")

# Artboard
W, H = 2400, 1800

# Layout
INSET = 96
ROW_GAP = 48
NUM_ROWS = 5
STROKE_WIDTH = 4

# Colors
BG_COLOR = (0, 0, 0)
FG_COLOR = (1, 1, 1)

# Line spacing
MIN_SPACING = 12
MAX_SPACING = 64

AVAILABLE_HEIGHT = H - (2 * INSET) - ((NUM_ROWS - 1) * ROW_GAP)
ROW_HEIGHT = AVAILABLE_HEIGHT / NUM_ROWS

CONTENT_LEFT = INSET
CONTENT_RIGHT = W - INSET


def draw_row(row, frame, frames_to_render):
    y_bottom = INSET + row * (ROW_HEIGHT + ROW_GAP)
    y_top = y_bottom + ROW_HEIGHT

    center = (NUM_ROWS - 1) / 2
    distance_from_center = abs(row - center)
    spatial_phase = distance_from_center * (math.pi / center)

    direction = 1 if row >= center else -1
    time_phase = direction * (frame / frames_to_render) * 2 * math.pi
    phase = spatial_phase + time_phase + 0.6

    line((CONTENT_LEFT, y_bottom), (CONTENT_LEFT, y_top))

    x = CONTENT_LEFT
    while x < CONTENT_RIGHT:
        t = (x - CONTENT_LEFT) / (CONTENT_RIGHT - CONTENT_LEFT)
        wave = math.cos(t * 5 * math.pi + phase)
        spacing = MIN_SPACING + ((wave + 1) / 2) * (MAX_SPACING - MIN_SPACING)
        x += spacing

        if x < CONTENT_RIGHT - STROKE_WIDTH:
            line_x = round(x)
            line((line_x, y_bottom), (line_x, y_top))

    line((CONTENT_RIGHT, y_bottom), (CONTENT_RIGHT, y_top))

def draw_frame(frame, frames_to_render):
    newPage(W, H)
    if isAnimated:
        frameDuration(FRAME_DURATION)

    fill(*BG_COLOR)
    rect(0, 0, W, H)

    stroke(*FG_COLOR)
    strokeWidth(STROKE_WIDTH)
    fill(None)

    for row in range(NUM_ROWS):
        draw_row(row, frame, frames_to_render)


frames_to_render = NUM_FRAMES if isAnimated else 1

for frame in range(frames_to_render):
    draw_frame(frame, frames_to_render)


if shouldSave:
    os.makedirs(EXPORTS, exist_ok=True)
    base = os.path.join(
        EXPORTS,
        "compile-generic-graphics-" + currentTime.strftime("%Y%m%d-%H%M%S"),
    )
    if isAnimated:
        saveImage(base + ".gif")
        saveImage(base + ".mp4")
    else:
        saveImage(base + ".png")
        saveImage(base + ".svg")
