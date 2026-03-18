# Blog header — "Introducing Composer 2"
# Horizontal lines: narrow + tight at top → full width + spaced at bottom
# Sine-based rhythm for vanishing-horizon / walking-up-a-curve effect

# Flags
shouldSave = 1

# Imports
import os
import datetime
import math
currentTime = datetime.datetime.now()

ROOT    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORTS = os.path.join(ROOT, "exports")

# Artboard
w, h   = 2400, 1260
inset  = 96
cx, cy = w / 2, h / 2
inner_w = w - 2 * inset
inner_h = h - 2 * inset

# Colors
BG_COLOR = (0xF7/255, 0xF0/255, 0xEB/255)  # #F7F0EB
LINE_COLOR = (0, 0, 0)
ORANGE = (0xF5/255, 0x4E/255, 0x00/255)     # #F54E00

# Line layout
num_lines = 18
stroke_w = 3

# ── Width: t^0.75 ────────────────────────────────────────────────────────────
def width_ease(t):
    return (t ** 0.75) if t > 0 else 0

# ── Spacing ──────────────────────────────────────────────────────────────────
# Floor so bottom gap = 4× top gap (for anim seamless cycle)
SPACING_POWER = 2
SPACING_BOTTOM_MULTIPLE = 4
a = (1 / (num_lines - 1)) ** SPACING_POWER
SPACING_FLOOR = (1 / SPACING_BOTTOM_MULTIPLE - a) / (1 - a)
SPACING_FLOOR = max(0.05, min(0.5, SPACING_FLOOR))

def spacing_weight(t):
    return SPACING_FLOOR + (1 - SPACING_FLOOR) * (t ** SPACING_POWER)

gaps = [spacing_weight((i + 1) / (num_lines - 1)) for i in range(num_lines - 1)]
gap_sum = sum(gaps)
gaps = [g * inner_h / gap_sum for g in gaps]

y_positions = [h - inset]
for g in gaps:
    y_positions.append(y_positions[-1] - g)

y_min = min(y_positions)
y_max = max(y_positions)
y_range = y_max - y_min

newPage(w, h)
fill(*BG_COLOR)
rect(0, 0, w, h)

fill(None)
stroke(*LINE_COLOR)
strokeWidth(stroke_w)
lineCap("round")

for i, y in enumerate(y_positions):
    t = (y_max - y) / y_range if y_range > 0 else 0
    t = max(0, min(1, t))
    line_w = inner_w * (0.55 + 0.45 * width_ease(t))
    x_left = cx - line_w / 2
    x_right = cx + line_w / 2
    line((x_left, y), (x_right, y))

# Orange accent bar at top — same width as top line, drawn on top
y_top = y_positions[0]
t_top = 0
line_w_top = inner_w * (0.55 + 0.45 * width_ease(t_top))
x_left_top = cx - line_w_top / 2
x_right_top = cx + line_w_top / 2
stroke(*ORANGE)
line((x_left_top, y_top), (x_right_top, y_top))

# Save
if shouldSave:
    filename = os.path.join(EXPORTS, "blog-introducing-composer-2-" + currentTime.strftime("%Y%m%d-%H%M%S"))
    saveImage(filename + ".png")
    saveImage(filename + ".svg")
