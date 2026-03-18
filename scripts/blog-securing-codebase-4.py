# Blog header — "Securing our codebase with autonomous agents"
# Concept: vertical lines + diagonals from vanishing point

# Flags
shouldSave = 0

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

# Vanishing point
vp = (cx, cy)

# Vertical lines
n_verticals = 11   # including left and right inset edges
xs = [inset + i * inner_w / (n_verticals - 1) for i in range(n_verticals)]

# Inner edge height at center (the "neck" of the trapezoid — not zero)
neck = inner_h / 3
vp_top = (cx, cy + neck / 2)
vp_bot = (cx, cy - neck / 2)

BG_COLOR = (0x2B/255, 0x23/255, 0x23/255)   # #2B2323
FG_COLOR = (1, 1, 1, 0.9)                    # white at 90%
ORANGE   = (245/255, 78/255, 0)
# Four outer verticals at 12.5, 37.5, 62.5, 87.5% (evenly spaced, inclusive of wraparound)
n_orange = 4
rand_xs = [inset + (i + 0.5) / n_orange * inner_w for i in range(n_orange)]

newPage(w, h)
fill(*BG_COLOR); rect(0, 0, w, h)

stroke(*FG_COLOR); strokeWidth(3); fill(None)
lineJoin("round")
lineCap("round")

# Main vertical lines
for xi in xs:
    line((xi, inset), (xi, h - inset))

# Diagonals: top diagonals from vp_top, bottom diagonals from vp_bot
for xi in xs:
    line(vp_top, (xi, h - inset))   # top diagonal
    line(vp_bot, (xi, inset))       # bottom diagonal

# Four orange trapezoid outlines: center vertical + outer verticals at 20/40/60/80%, connected
stroke(*ORANGE); strokeWidth(3); fill(None)
line((cx, cy - neck/2), (cx, cy + neck/2))  # shared center vertical
for rand_x in rand_xs:
    line((rand_x, inset), (rand_x, h - inset))
    line((cx, cy + neck/2), (rand_x, h - inset))
    line((cx, cy - neck/2), (rand_x, inset))

# Save
if shouldSave:
    filename = os.path.join(EXPORTS, "blog-securing-codebase-4-" + currentTime.strftime("%Y%m%d-%H%M%S"))
    saveImage(filename + ".png")
    saveImage(filename + ".svg")
