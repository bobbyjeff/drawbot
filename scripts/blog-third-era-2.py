# Ellipse sweep — styles 1 & 2 across scale reductions

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
w, h = 2400, 1260
inset = 96
cx, cy = w / 2, h / 2
hw = (w - 2 * inset) / 2
hh = (h - 2 * inset) / 2

def flush_axes(angle_deg, hw, hh):
    r = math.radians(angle_deg)
    c2, s2 = math.cos(r)**2, math.sin(r)**2
    denom = c2**2 - s2**2
    if abs(denom) < 1e-9: return hw, hh
    a_sq = (c2*hw**2 - s2*hh**2) / denom
    b_sq = (c2*hh**2 - s2*hw**2) / denom
    if a_sq <= 0 or b_sq <= 0: return hw, hh
    return math.sqrt(a_sq), math.sqrt(b_sq)

def max_a_for_b(b, angle_deg, hw, hh):
    r = math.radians(angle_deg)
    cos_r, sin_r = abs(math.cos(r)), abs(math.sin(r))
    a_w = a_h = float('inf')
    if cos_r > 1e-9:
        v = hw**2 - (b*sin_r)**2
        if v > 0: a_w = math.sqrt(v) / cos_r
    if sin_r > 1e-9:
        v = hh**2 - (b*cos_r)**2
        if v > 0: a_h = math.sqrt(v) / sin_r
    a = min(a_w, a_h)
    return (a if a != float('inf') else hw), (a_w <= a_h)

angle_start = -15
angle_end   = math.degrees(math.atan2(hh, hw))

def find_t_max(b_s, compress):
    """Binary search for the largest t where the ellipse is still width-binding."""
    lo, hi = 0.0, 1.0 - 1e-9
    for _ in range(60):
        mid = (lo + hi) / 2
        angle_t = angle_start + mid * (angle_end - angle_start)
        b_t = b_s * (1 - mid * (1 - compress))
        _, wib = max_a_for_b(b_t, angle_t, hw, hh)
        if wib: lo = mid
        else:   hi = mid
    return lo

def sweep(compress=0, steps=8, easing=None):
    a_s, b_s = flush_axes(angle_start, hw, hh)
    t_max = find_t_max(b_s, compress)  # last valid t, flush on both axes

    newPage(w, h)
    fill(0); rect(0, 0, w, h)

    for step in range(steps):
        t_norm = step / (steps - 1)
        t = (easing(t_norm) if easing else t_norm) * t_max
        angle_t = angle_start + t * (angle_end - angle_start)
        b_t = b_s * (1 - t * (1 - compress))
        a_t, _ = max_a_for_b(b_t, angle_t, hw, hh)
        with savedState():
            rotate(angle_t, center=(cx, cy))
            fill(None); stroke(1); strokeWidth(4)
            if b_t < 2: line((cx - a_t, cy), (cx + a_t, cy))
            else:        oval(cx - a_t, cy - b_t, 2*a_t, 2*b_t)

sweep(compress=0.5)

# Save
if shouldSave:
    filename = os.path.join(EXPORTS, "blog-third-era-2-" + currentTime.strftime("%Y%m%d-%H%M%S"))
    saveImage(filename + ".png")
    saveImage(filename + ".svg")
