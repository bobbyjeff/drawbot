import os
import datetime

# Static companion for blog-securing-codebase-4-anim.py.
# Renders the loop boundary frame and exports PNG/SVG.

shouldSave = 1

currentTime = datetime.datetime.now()

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORTS = os.path.join(ROOT, "exports")

w, h = 2400, 1260
inset = 96
cx, cy = w / 2, h / 2

inner_w = w - 2 * inset
inner_h = h - 2 * inset

n_verticals = 11
xs = [inset + i * inner_w / (n_verticals - 1) for i in range(n_verticals)]

neck = inner_h / 3

BG_COLOR = (0x2B / 255, 0x23 / 255, 0x23 / 255)
FG_COLOR = (1, 1, 1, 0.9)
ORANGE = (245 / 255, 78 / 255, 0)

n_orange = 4
orange_xs = [inset + ((i + 0.5) / n_orange) * inner_w for i in range(n_orange)]

newPage(w, h)
fill(*BG_COLOR)
rect(0, 0, w, h)

stroke(*FG_COLOR)
strokeWidth(3)
fill(None)
lineJoin("round")
lineCap("round")

for xi in xs:
    line((xi, inset), (xi, h - inset))

for xi in xs:
    line((cx, cy + neck / 2), (xi, h - inset))
    line((cx, cy - neck / 2), (xi, inset))

stroke(*ORANGE)
strokeWidth(3)
line((cx, cy - neck / 2), (cx, cy + neck / 2))
for ox in orange_xs:
    line((ox, inset), (ox, h - inset))
    line((cx, cy + neck / 2), (ox, h - inset))
    line((cx, cy - neck / 2), (ox, inset))

if shouldSave:
    filename = os.path.join(
        EXPORTS,
        "blog-securing-codebase-4-anim-static-" + currentTime.strftime("%Y%m%d-%H%M%S"),
    )
    saveImage(filename + ".png")
    saveImage(filename + ".svg")
