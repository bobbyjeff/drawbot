import os
import datetime
import math

# Static companion for blog-third-era-5a.py.
# Renders the full layered composition and exports PNG/SVG.

shouldSave = 1

currentTime = datetime.datetime.now()

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORTS = os.path.join(ROOT, "exports")

w, h = 2400, 1260
inset = 96
cx, cy = w / 2, h / 2
hw = (w - 2 * inset) / 2
hh = (h - 2 * inset) / 2

A_S = -22
A_E = 22
STEPS = 12

BG = (75 / 255, 73 / 255, 66 / 255)
FG = (1, 1, 1, 0.9)


def max_a_for_b(b, angle_deg):
    r = math.radians(angle_deg)
    cos_r, sin_r = abs(math.cos(r)), abs(math.sin(r))
    a_w = a_h = float("inf")
    if cos_r > 1e-9:
        v = hw**2 - (b * sin_r) ** 2
        if v > 0:
            a_w = math.sqrt(v) / cos_r
    if sin_r > 1e-9:
        v = hh**2 - (b * cos_r) ** 2
        if v > 0:
            a_h = math.sqrt(v) / sin_r
    a = min(a_w, a_h)
    return a if a != float("inf") else hw


B_START = hh * 0.55
B_END = 1.5

ellipses = []
for step in range(STEPS):
    t = step / (STEPS - 1)
    b = B_START + t * (B_END - B_START)
    angle_t = A_S + t * (A_E - A_S)
    a = max_a_for_b(b, angle_t)
    ellipses.append((angle_t, a, b))

newPage(w, h)
fill(*BG)
rect(0, 0, w, h)

for angle_t, a, b in ellipses:
    with savedState():
        rotate(angle_t, center=(cx, cy))
        fill(None)
        stroke(*FG)
        strokeWidth(4)
        if b < 2:
            line((cx - a, cy), (cx + a, cy))
        else:
            oval(cx - a, cy - b, 2 * a, 2 * b)

if shouldSave:
    filename = os.path.join(
        EXPORTS, "blog-third-era-5a-static-" + currentTime.strftime("%Y%m%d-%H%M%S")
    )
    saveImage(filename + ".png")
    saveImage(filename + ".svg")
