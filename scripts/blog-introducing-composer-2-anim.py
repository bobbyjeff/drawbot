# Blog header — "Introducing Composer 2" (animated)
# Lines scroll up, disappear under orange at top, repopulate at bottom — walking backwards

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
# Floor chosen so bottom gap = SPACING_BOTTOM_MULTIPLE * top gap (seamless cycle)
SPACING_POWER = 2
SPACING_BOTTOM_MULTIPLE = 4   # bottom/2nd-bottom gap = 4× top gap
a = (1 / (num_lines - 1)) ** SPACING_POWER
SPACING_FLOOR = (1 / SPACING_BOTTOM_MULTIPLE - a) / (1 - a)
SPACING_FLOOR = max(0.05, min(0.5, SPACING_FLOOR))   # clamp

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

# Animation — each line moves toward the line above it, at different rates (gap above)
# When top line reaches orange it disappears; new line appears at bottom. Loop when done.
num_frames = 36
frame_duration = 1/15

for frame in range(num_frames):
    newPage(w, h)
    frameDuration(frame_duration)

    phase = frame / (num_frames - 1) if num_frames > 1 else 0

    fill(*BG_COLOR)
    rect(0, 0, w, h)

    fill(None)
    strokeWidth(stroke_w)
    lineCap("round")

    # Line i moves toward line above by phase * (gap above it); different rates per line
    # Top line (0) disappears when past y_max; reappears at bottom when loop restarts (phase 0)
    stroke(*LINE_COLOR)
    for i in range(num_lines):
        gap_above = gaps[i - 1] if i > 0 else gaps[0]
        move = phase * gap_above
        y_anim = y_positions[i] + move
        if y_anim > y_max:
            continue   # disappeared at top; don't draw until next cycle
        if y_min <= y_anim <= y_max:
            t = (y_max - y_anim) / y_range if y_range > 0 else 0
            t = max(0, min(1, t))
            line_w = inner_w * (0.55 + 0.45 * width_ease(t))
            x_left = cx - line_w / 2
            x_right = cx + line_w / 2
            line((x_left, y_anim), (x_right, y_anim))

    # Orange accent bar at top — covers lines as they scroll up and disappear
    y_top = y_max
    line_w_top = inner_w * (0.55 + 0.45 * width_ease(0))
    x_left_top = cx - line_w_top / 2
    x_right_top = cx + line_w_top / 2
    stroke(*ORANGE)
    line((x_left_top, y_top), (x_right_top, y_top))

if shouldSave:
    import subprocess
    ts = currentTime.strftime("%Y%m%d-%H%M%S")
    src_gif = os.path.join(EXPORTS, f"blog-introducing-composer-2-anim-{ts}.gif")
    src_mp4 = os.path.join(EXPORTS, f"blog-introducing-composer-2-anim-{ts}.mp4")
    saveImage(src_gif)
    saveImage(src_mp4)

    FFMPEG = "/opt/homebrew/bin/ffmpeg"

    out_gif = os.path.join(EXPORTS, f"blog-introducing-composer-2-anim-{ts}-1200.gif")
    palette = os.path.join(EXPORTS, f"_palette-c2-{ts}.png")
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

    out_mp4 = os.path.join(EXPORTS, f"blog-introducing-composer-2-anim-{ts}-1200.mp4")
    subprocess.run([
        FFMPEG, "-y", "-i", src_mp4,
        "-vf", "scale=1200:-1:flags=lanczos",
        "-c:v", "libx264", "-crf", "23", "-preset", "slow",
        "-movflags", "+faststart",
        out_mp4
    ], check=True)

    print(f"Saved: {src_gif}, {out_gif}, {src_mp4}, {out_mp4}")
