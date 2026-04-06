import os
import datetime
import math

# Static companion for blog-cursor-eval-1-anim.py.
# Renders the animation's settled end state and exports PNG/SVG.

shouldSave = 1

currentTime = datetime.datetime.now()

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORTS = os.path.join(ROOT, "exports")

w, h = 2400, 1260
inset = 96
cx, cy = w / 2, h / 2

BG = (0x16 / 255, 0x1D / 255, 0x1E / 255)
FG = (1, 1, 1)
NEEDLE = (0xF5 / 255, 0x4E / 255, 0x00 / 255)

sweep_deg = 45
start_deg = 90 + sweep_deg / 2
end_deg = 90 - sweep_deg / 2

half_rad = math.radians(sweep_deg / 2)
r_tip = (cx - inset) / math.sin(half_rad)

minor_frac = 0.025
major_frac = 0.0333
line_len_minor = r_tip * minor_frac
line_len_major = r_tip * major_frac

origin_x = cx
origin_y = (h - inset) - r_tip

num_majors = 11
minors_per_gap = 9
stroke_w = 3.0

needle_t_final = 0.98

lowest_angle_rad = math.radians(
    start_deg + (1.0 - needle_t_final) * (end_deg - start_deg)
)
needle_base = (inset - origin_y) / math.sin(lowest_angle_rad)
needle_len = r_tip - (line_len_minor + line_len_major) / 2
needle_len_tip = r_tip - line_len_minor * 0.4

tick_positions = []
for k in range(num_majors):
    t_major = k / (num_majors - 1)
    tick_positions.append((t_major, True))
    if k < num_majors - 1:
        t_next = (k + 1) / (num_majors - 1)
        for m in range(1, minors_per_gap + 1):
            t_minor = t_major + m * (t_next - t_major) / (minors_per_gap + 1)
            tick_positions.append((t_minor, False))

ghost_count = 32
ghost_ts = [i / (ghost_count - 1) * needle_t_final for i in range(ghost_count)]
fade_span = needle_t_final * 0.55


def draw_needle_line(t_pos, tip_r, color, width):
    angle_rad = math.radians(start_deg + t_pos * (end_deg - start_deg))
    tip_x = origin_x + tip_r * math.cos(angle_rad)
    tip_y = origin_y + tip_r * math.sin(angle_rad)
    base_x = origin_x + needle_base * math.cos(angle_rad)
    base_y = origin_y + needle_base * math.sin(angle_rad)
    stroke(*color)
    strokeWidth(width)
    line((base_x, base_y), (tip_x, tip_y))


newPage(w, h)
fill(*BG)
rect(0, 0, w, h)
fill(None)
lineCap("round")

for t, is_major in tick_positions:
    angle_deg = start_deg + t * (end_deg - start_deg)
    angle_rad = math.radians(angle_deg)
    tick_len = line_len_major if is_major else line_len_minor
    r_base_i = r_tip - tick_len
    stroke(*FG)
    strokeWidth(stroke_w)
    x0 = origin_x + r_base_i * math.cos(angle_rad)
    y0 = origin_y + r_base_i * math.sin(angle_rad)
    x1 = origin_x + r_tip * math.cos(angle_rad)
    y1 = origin_y + r_tip * math.sin(angle_rad)
    line((x0, y0), (x1, y1))

for g_t in ghost_ts:
    delta = needle_t_final - g_t
    opacity = max(0.0, 1.0 - delta / fade_span)
    opacity = max(0.04, opacity)
    draw_needle_line(g_t, needle_len, (*FG, opacity), stroke_w * 1.2)

draw_needle_line(needle_t_final, needle_len_tip, NEEDLE, stroke_w * 2.5)

if shouldSave:
    filename = os.path.join(
        EXPORTS, "blog-cursor-eval-anim-static-" + currentTime.strftime("%Y%m%d-%H%M%S")
    )
    saveImage(filename + ".png")
    saveImage(filename + ".svg")
