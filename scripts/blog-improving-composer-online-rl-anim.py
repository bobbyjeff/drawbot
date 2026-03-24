# Blog header — "Improving Composer through online RL" (animated)
# Abstract radial gears rotating with a seamless loop.

# Flags
shouldSave = 1

# Imports
import os
import datetime
import math
currentTime = datetime.datetime.now()

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORTS = os.path.join(ROOT, "exports")

# Artboard
w, h = 2400, 1260
cx, cy = w / 2, h / 2

# Colors
BG_COLOR = (0xDD/255, 0xDD/255, 0xDD/255)  # #DDDDDD
FG_COLOR = (0x22/255, 0x22/255, 0x22/255)  # #222222
ORANGE = (0xA1/255, 0x69/255, 0x00/255)    # #A16900
STROKE_W = 3
RIGHT_FADE_BAND = 45

def polar_point(x, y, radius, angle_deg):
    angle_rad = math.radians(angle_deg)
    return (
        x + math.cos(angle_rad) * radius,
        y + math.sin(angle_rad) * radius,
    )

def segment_distance_to_point(p1, p2, point):
    px, py = point
    x1, y1 = p1
    x2, y2 = p2
    dx = x2 - x1
    dy = y2 - y1

    if dx == 0 and dy == 0:
        return math.sqrt((x1 - px) ** 2 + (y1 - py) ** 2)

    t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)
    t = max(0, min(1, t))
    nearest_x = x1 + t * dx
    nearest_y = y1 + t * dy

    return math.sqrt((nearest_x - px) ** 2 + (nearest_y - py) ** 2)

def segment_intersects_circle(p1, p2, circle):
    cx, cy, radius = circle
    return segment_distance_to_point(p1, p2, (cx, cy)) <= radius

def draw_radial_ring(x, y, inner_radius, outer_radius, spoke_count, rotation=0, occluders=None, fade_circle=None, color=None):
    occluders = occluders or []
    for i in range(spoke_count):
        angle = rotation + i * (360 / spoke_count)
        p1 = polar_point(x, y, inner_radius, angle)
        p2 = polar_point(x, y, outer_radius, angle)

        if any(segment_intersects_circle(p1, p2, circle) for circle in occluders):
            continue

        alpha = 1
        if fade_circle:
            fade_x, fade_y, fade_inner_radius, fade_outer_radius = fade_circle
            dist = segment_distance_to_point(p1, p2, (fade_x, fade_y))
            if dist <= fade_inner_radius:
                continue
            if dist < fade_outer_radius:
                t = (dist - fade_inner_radius) / (fade_outer_radius - fade_inner_radius)
                alpha = t * t * (3 - 2 * t)

        if color:
            stroke(color[0], color[1], color[2], alpha)

        line(p1, p2)

def band_thickness(ring):
    return ring["outer_radius"] - ring["inner_radius"]

def optical_radius(ring):
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

def ring_instance(x, y, ring, rotation_offset=0):
    return {
        "x": x,
        "y": y,
        "inner_radius": ring["inner_radius"],
        "outer_radius": ring["outer_radius"],
        "spokes": ring["spokes"],
        "rotation": ring["rotation"] + rotation_offset,
    }

# Geometry matches the static version.
left_ring = {"inner_radius": 125, "outer_radius": 265}
middle_small_ring = {"inner_radius": 162.5, "outer_radius": 307.5}
middle_large_ring = {"inner_radius": 307.5, "outer_radius": 437.5}
right_ring = {"inner_radius": 380, "outer_radius": 534}

# Snap to loop-friendly spoke counts while staying close to the optical-density targets.
left_ring["spokes"] = 24
middle_small_ring["spokes"] = 32
middle_large_ring["spokes"] = 48
right_ring["spokes"] = 64

# Meshing phase: one ring presents a spoke while its neighbor presents a gap.
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

right_mask_radius = right_ring["outer_radius"] + STROKE_W
right_cull_circle = (right_x, cy, right_mask_radius)
right_fade_circle = (
    right_x,
    cy,
    right_mask_radius,
    right_mask_radius + RIGHT_FADE_BAND,
)

# Animation
# Shortest seamless cycle:
# the middle compound gear must return both inner and outer spoke patterns to alignment.
# With 32 and 48 spokes, that happens after a 22.5-degree shaft rotation.
num_frames = 60
frame_duration = 1 / 20

# Use spoke counts as abstract tooth counts:
# meshed gears rotate in opposite directions, and a full loop lands on the same spoke pattern.
middle_cycle_degrees = 360 / math.gcd(middle_small_ring["spokes"], middle_large_ring["spokes"])
left_cycle_degrees = -middle_cycle_degrees * middle_large_ring["spokes"] / left_ring["spokes"]
right_cycle_degrees = -middle_cycle_degrees * middle_small_ring["spokes"] / right_ring["spokes"]

for frame in range(num_frames):
    phase = frame / num_frames

    newPage(w, h)
    frameDuration(frame_duration)
    fill(*BG_COLOR)
    rect(0, 0, w, h)

    stroke(*FG_COLOR)
    strokeWidth(STROKE_W)
    fill(None)
    lineCap("round")
    lineJoin("round")

    middle_rotation_offset = phase * middle_cycle_degrees
    left_rotation_offset = phase * left_cycle_degrees
    right_rotation_offset = phase * right_cycle_degrees

    left_ring_instance = ring_instance(left_x, cy, left_ring, left_rotation_offset)
    middle_small_instance = ring_instance(middle_x, cy, middle_small_ring, middle_rotation_offset)
    middle_large_instance = ring_instance(middle_x, cy, middle_large_ring, middle_rotation_offset)
    right_ring_instance = ring_instance(right_x, cy, right_ring, right_rotation_offset)

    draw_radial_ring(
        middle_large_instance["x"],
        middle_large_instance["y"],
        middle_large_instance["inner_radius"],
        middle_large_instance["outer_radius"],
        middle_large_instance["spokes"],
        rotation=middle_large_instance["rotation"],
        occluders=[right_cull_circle],
        fade_circle=right_fade_circle,
        color=FG_COLOR,
    )

    fill(*BG_COLOR)
    stroke(None)
    oval(
        right_x - right_mask_radius,
        cy - right_mask_radius,
        right_mask_radius * 2,
        right_mask_radius * 2,
    )

    fill(None)
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
    import subprocess
    ts = currentTime.strftime("%Y%m%d-%H%M%S")
    src_gif = os.path.join(EXPORTS, f"blog-improving-composer-online-rl-anim-{ts}.gif")
    src_mp4 = os.path.join(EXPORTS, f"blog-improving-composer-online-rl-anim-{ts}.mp4")
    saveImage(src_gif)
    saveImage(src_mp4)

    FFMPEG = "/opt/homebrew/bin/ffmpeg"

    out_gif = os.path.join(EXPORTS, f"blog-improving-composer-online-rl-anim-{ts}-1200.gif")
    palette = os.path.join(EXPORTS, f"_palette-online-rl-{ts}.png")
    subprocess.run([
        FFMPEG, "-y", "-i", src_gif,
        "-vf", "scale=1200:-1:flags=lanczos,palettegen=stats_mode=diff:max_colors=64",
        palette
    ], check=True)
    subprocess.run([
        FFMPEG, "-y", "-i", src_gif, "-i", palette,
        "-lavfi", "scale=1200:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5",
        out_gif
    ], check=True)
    os.remove(palette)

    out_mp4 = os.path.join(EXPORTS, f"blog-improving-composer-online-rl-anim-{ts}-1200.mp4")
    subprocess.run([
        FFMPEG, "-y", "-i", src_mp4,
        "-vf", "scale=1200:-1:flags=lanczos",
        "-c:v", "libx264", "-crf", "23", "-preset", "slow",
        "-movflags", "+faststart",
        out_mp4
    ], check=True)

    print(f"Saved: {src_gif}, {out_gif}, {src_mp4}, {out_mp4}")
