# Blog header — "Teaching Composer not to forget"

# Flags
shouldSave = 1

# Imports
import os
import datetime
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
BG_COLOR = (0x1A/255, 0x1D/255, 0x21/255)   # #1A1D21
STROKE_COLOR = (1, 1, 1, 0.9)               # #ffffff at 90%
ORANGE = (0xF5/255, 0x4E/255, 0x00/255)    # #F54E00

# Rhombus stack — overlapping layers, top & bottom just touch
rhombus_width = inner_w
num_rhombuses = 8

# Depth: topmost bottom vertex = bottommost top vertex (just touch)
# So span from bottom center to top center = rhombus_height
# And bottom vertex at inset, top vertex at h - inset → inner_h - rhombus_height = rhombus_height
rhombus_height = inner_h / 2

# Bottommost: bottom vertex at inset; topmost: top vertex at h - inset
y_bottom = inset + rhombus_height / 2
y_top = h - inset - rhombus_height / 2
# Even spread — step < height so they overlap as 3D layers
vertical_step = rhombus_height / (num_rhombuses - 1)
y_positions = [y_bottom + i * vertical_step for i in range(num_rhombuses)]

newPage(w, h)
fill(*BG_COLOR)
rect(0, 0, w, h)

fill(None)
strokeWidth(2)
lineJoin("round")
lineCap("round")

for i in range(num_rhombuses):
    stroke(*ORANGE if i == 0 else STROKE_COLOR)
    y = y_positions[i]
    path = BezierPath()
    path.moveTo((cx - rhombus_width / 2, y))   # left
    path.lineTo((cx, y + rhombus_height / 2))  # top
    path.lineTo((cx + rhombus_width / 2, y))   # right
    path.lineTo((cx, y - rhombus_height / 2))  # bottom
    path.closePath()
    drawPath(path)

# Save
if shouldSave:
    filename = os.path.join(EXPORTS, "blog-teaching-composer-1-" + currentTime.strftime("%Y%m%d-%H%M%S"))
    saveImage(filename + ".png")
    saveImage(filename + ".svg")
