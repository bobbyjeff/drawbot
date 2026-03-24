# Blog header — "Improving Composer through online RL"
# Abstract gear study using radial strokes instead of literal gear outlines.

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
cx, cy = w / 2, h / 2

# Colors
BG_COLOR = (0xDD/255, 0xDD/255, 0xDD/255)  # #DDDDDD
FG_COLOR = (0x22/255, 0x22/255, 0x22/255)  # #222222
ORANGE = (0xA1/255, 0x69/255, 0x00/255)    # #A16900
STROKE_W = 3
RIGHT_CULL_PADDING = 18

newPage(w, h)
fill(*BG_COLOR)
rect(0, 0, w, h)

stroke(*FG_COLOR)
strokeWidth(STROKE_W)
fill(None)
lineCap("round")
lineJoin("round")

def polar_point(x, y, radius, angle_deg):
    angle_rad = math.radians(angle_deg)
    return (
        x + math.cos(angle_rad) * radius,
        y + math.sin(angle_rad) * radius,
    )

def segment_intersects_circle(p1, p2, circle):
    cx, cy, radius = circle
    x1, y1 = p1
    x2, y2 = p2
    dx = x2 - x1
    dy = y2 - y1

    if dx == 0 and dy == 0:
        return ((x1 - cx) ** 2 + (y1 - cy) ** 2) <= radius ** 2

    t = ((cx - x1) * dx + (cy - y1) * dy) / (dx * dx + dy * dy)
    t = max(0, min(1, t))
    nearest_x = x1 + t * dx
    nearest_y = y1 + t * dy

    return ((nearest_x - cx) ** 2 + (nearest_y - cy) ** 2) <= radius ** 2

def draw_radial_ring(x, y, inner_radius, outer_radius, spoke_count, rotation=0, occluders=None):
    occluders = occluders or []
    for i in range(spoke_count):
        angle = rotation + i * (360 / spoke_count)
        p1 = polar_point(x, y, inner_radius, angle)
        p2 = polar_point(x, y, outer_radius, angle)

        if any(segment_intersects_circle(p1, p2, circle) for circle in occluders):
            continue

        line(p1, p2)

def band_thickness(ring):
    return ring["outer_radius"] - ring["inner_radius"]

def optical_radius(ring):
    # Geometric mean gives a good representative radius for the visible band.
    return math.sqrt(ring["inner_radius"] * ring["outer_radius"])

def optical_spoke_count(ring, target_arc_gap=44):
    circumference = 2 * math.pi * optical_radius(ring)
    return max(12, int(round(circumference / target_arc_gap)))

def spoke_step(ring):
    return 360 / ring["spokes"]

def spoke_at(ring, angle_deg):
    return angle_deg

def gap_at(ring, angle_deg):
    return angle_deg + spoke_step(ring) / 2

def mesh_overlap(ring_a, ring_b):
    # In this abstract system, two gears overlap by half the shorter line length.
    return min(band_thickness(ring_a), band_thickness(ring_b)) * 0.5

# Composition rule:
# Meshing is defined by a fixed overlap depth rather than by touching edges.
# The overlap depth is half the shorter band's thickness.
left_ring = {"inner_radius": 125, "outer_radius": 265}
middle_small_ring = {"inner_radius": 162.5, "outer_radius": 307.5}
middle_large_ring = {"inner_radius": 307.5, "outer_radius": 437.5}
right_ring = {"inner_radius": 380, "outer_radius": 534}

# Snap to loop-friendly spoke counts while staying close to the optical-density targets.
left_ring["spokes"] = 24
middle_small_ring["spokes"] = 32
middle_large_ring["spokes"] = 48
right_ring["spokes"] = 64

# At each mesh point, one ring presents a spoke and the other presents a gap.
# Left gear meshes with the outer middle ring; right gear meshes with the inner middle ring.
left_ring["rotation"] = spoke_at(left_ring, 0)
middle_large_ring["rotation"] = gap_at(middle_large_ring, 180)
middle_small_ring["rotation"] = gap_at(middle_small_ring, 0)
right_ring["rotation"] = spoke_at(right_ring, 180)

right_x = w - 96 - right_ring["outer_radius"]

right_overlap = mesh_overlap(middle_small_ring, right_ring)
right_intersection_x = right_x - right_ring["outer_radius"] + right_overlap / 2
middle_x = right_intersection_x - middle_small_ring["outer_radius"] + right_overlap / 2

left_overlap = mesh_overlap(left_ring, middle_large_ring)
left_intersection_x = middle_x - middle_large_ring["outer_radius"] + left_overlap / 2
left_x = left_intersection_x - left_ring["outer_radius"] + left_overlap / 2

left_ring_instance = {"x": left_x, "y": cy, **left_ring}
middle_small_instance = {"x": middle_x, "y": cy, **middle_small_ring}
middle_large_instance = {"x": middle_x, "y": cy, **middle_large_ring}
right_ring_instance = {"x": right_x, "y": cy, **right_ring}

# Layer order:
# 1. Background outer middle gear
# 2. White mask over the right gear footprint to hide the rear large gear
# 3. Foreground gears that should read on top
right_mask_radius = right_ring_instance["outer_radius"] + STROKE_W
right_cull_circle = (
    right_ring_instance["x"],
    right_ring_instance["y"],
    right_mask_radius + RIGHT_CULL_PADDING,
)

for ring in [middle_large_instance]:
    draw_radial_ring(
        ring["x"],
        ring["y"],
        ring["inner_radius"],
        ring["outer_radius"],
        ring["spokes"],
        rotation=ring["rotation"],
        occluders=[right_cull_circle],
    )

fill(*BG_COLOR)
stroke(None)
oval(
    right_ring_instance["x"] - right_mask_radius,
    right_ring_instance["y"] - right_mask_radius,
    right_mask_radius * 2,
    right_mask_radius * 2,
)

fill(None)
stroke(*FG_COLOR)
strokeWidth(STROKE_W)

for ring, color in [
    (middle_small_instance, ORANGE),
    (left_ring_instance, ORANGE),
    (right_ring_instance, FG_COLOR),
]:
    stroke(*color)
    draw_radial_ring(
        ring["x"],
        ring["y"],
        ring["inner_radius"],
        ring["outer_radius"],
        ring["spokes"],
        rotation=ring["rotation"],
    )

# Save
if shouldSave:
    filename = os.path.join(EXPORTS, "blog-improving-composer-online-rl-" + currentTime.strftime("%Y%m%d-%H%M%S"))
    saveImage(filename + ".png")
    saveImage(filename + ".svg")
