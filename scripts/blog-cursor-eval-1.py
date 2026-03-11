# Artwork for blog post: Cursor Eval (v1), 2026-03-04
# VU meter inspired: uniform radiating lines fanned across 120°, spanning full inset area

# Flags
shouldSave = 1

# Imports
import os
import datetime
import math
currentTime = datetime.datetime.now()

ROOT    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORTS = os.path.join(ROOT, "exports")

# ── Artboard ─────────────────────────────────────────────────────────────────
w, h   = 2400, 1260
inset  = 96
cx, cy = w / 2, h / 2

# ── Colors ────────────────────────────────────────────────────────────────────
BG = (0x16/255, 0x1D/255, 0x1E/255)
FG = (1, 1, 1)

# ── Meter parameters ──────────────────────────────────────────────────────────
# Sweep: 120 degrees centered on straight up (90°)
sweep_deg = 45
start_deg = 90 + sweep_deg / 2
end_deg   = 90 - sweep_deg / 2

half_rad = math.radians(sweep_deg / 2)

r_tip          = (cx - inset) / math.sin(half_rad)
line_len_minor = r_tip * 0.045
line_len_major = r_tip * 0.062

# Origin: top tick tip lands at top inset line
origin_x = cx
origin_y = (h - inset) - r_tip

num_majors     = 11
minors_per_gap = 9
stroke_w       = 3.0

needle_t      = 0.98
trail_start_t = 1.0 - needle_t
trail_count   = 18
lowest_angle_deg = start_deg + trail_start_t * (end_deg - start_deg)
lowest_angle_rad = math.radians(lowest_angle_deg)

# Build tick positions as t-values in [0, 1] directly — no integer index rounding
tick_positions = []  # list of (t, is_major)
for k in range(num_majors):
    t_major = k / (num_majors - 1)
    tick_positions.append((t_major, True))
    if k < num_majors - 1:
        t_next = (k + 1) / (num_majors - 1)
        for m in range(1, minors_per_gap + 1):
            t_minor = t_major + m * (t_next - t_major) / (minors_per_gap + 1)
            tick_positions.append((t_minor, False))

# ── Tick length variants × needle intersection variants ──────────────────────
minor_frac = 0.025
major_frac = 0.0333

line_len_minor = r_tip * minor_frac
line_len_major = r_tip * major_frac
needle_base    = (inset - origin_y) / math.sin(lowest_angle_rad)

# needle_len as fraction of r_tip: below ticks → flush → through → beyond
needle_variants = [
    r_tip - (line_len_minor + line_len_major) / 2,   # trail tip: midpoint of major-only zone
]

for needle_len in needle_variants:
    newPage(w, h)
    fill(*BG); rect(0, 0, w, h)
    fill(None); lineCap("round")

    for t, is_major in tick_positions:
        angle_deg = start_deg + t * (end_deg - start_deg)
        angle_rad = math.radians(angle_deg)
        tick_len = line_len_major if is_major else line_len_minor
        r_base_i = r_tip - tick_len
        stroke(*FG); strokeWidth(stroke_w)
        x0 = origin_x + r_base_i * math.cos(angle_rad)
        y0 = origin_y + r_base_i * math.sin(angle_rad)
        x1 = origin_x + r_tip    * math.cos(angle_rad)
        y1 = origin_y + r_tip    * math.sin(angle_rad)
        line((x0, y0), (x1, y1))

    for i in range(trail_count + 1):
        t_norm  = i / trail_count
        t_eased = t_norm ** 0.7
        t_pos   = trail_start_t + t_eased * (needle_t - trail_start_t)
        angle_deg = start_deg + t_pos * (end_deg - start_deg)
        angle_rad = math.radians(angle_deg)
        tip_x  = origin_x + needle_len  * math.cos(angle_rad)
        tip_y  = origin_y + needle_len  * math.sin(angle_rad)
        base_x = origin_x + needle_base * math.cos(angle_rad)
        base_y = origin_y + needle_base * math.sin(angle_rad)
        is_needle = (i == trail_count)
        # Needle tip extends into minor tick zone; trail tips stop at major-only zone
        if is_needle:
            tip_x = origin_x + (r_tip - line_len_minor * 0.4) * math.cos(angle_rad)
            tip_y = origin_y + (r_tip - line_len_minor * 0.4) * math.sin(angle_rad)
        opacity = 0.05 + 0.95 * (t_norm ** 1.8)
        strokeWidth(stroke_w * 2.5 if is_needle else stroke_w * 1.2)
        stroke(*FG, opacity)
        line((base_x, base_y), (tip_x, tip_y))

# ── Save ─────────────────────────────────────────────────────────────────────
if shouldSave:
    filename = os.path.join(EXPORTS, "blog-cursor-eval-1-" + currentTime.strftime("%Y%m%d-%H%M%S"))
    saveImage(filename + ".png")
    saveImage(filename + ".svg")
