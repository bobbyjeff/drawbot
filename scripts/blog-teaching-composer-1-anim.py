# Blog header — "Teaching Composer not to forget" (animated)
# Sequence: full stack → collapse into bottom → white→orange → pile up one by one → loop

# Flags
shouldSave = 1

# Imports
import os
import datetime
currentTime = datetime.datetime.now()

ROOT    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORTS = os.path.join(ROOT, "exports")

# Animation
num_frames     = 120
frame_duration = 1/30

# Artboard
w, h   = 2400, 1260
inset  = 96
cx, cy = w / 2, h / 2
inner_w = w - 2 * inset
inner_h = h - 2 * inset

# Colors
BG_COLOR = (0x1A/255, 0x1D/255, 0x21/255)   # #1A1D21
STROKE_COLOR = (1, 1, 1, 0.9)               # #ffffff at 90%
ORANGE = (0xF5/255, 0x4E/255, 0x00/255)     # #F54E00

# Rhombus stack
rhombus_width = inner_w
num_rhombuses = 8
rhombus_height = inner_h / 2
y_bottom = inset + rhombus_height / 2
y_top = h - inset - rhombus_height / 2
vertical_step = rhombus_height / (num_rhombuses - 1)
y_positions = [y_bottom + i * vertical_step for i in range(num_rhombuses)]

def ease_in_out(t):
    """Smooth ease in-out"""
    if t <= 0: return 0
    if t >= 1: return 1
    return t * t * (3 - 2 * t)

def cubic_bezier(t, p1x, p1y, p2x, p2y):
    """Cubic bezier B(t) with P0=(0,0), P1=(p1x,p1y), P2=(p2x,p2y), P3=(1,1)"""
    u = 1 - t
    x = 3*u*u*t*p1x + 3*u*t*t*p2x + t*t*t
    y = 3*u*u*t*p1y + 3*u*t*t*p2y + t*t*t
    return x, y

def ease_out_spring(t):
    """cubic-bezier(0.25, 1, 0.5, 1) — ease-out-spring"""
    if t <= 0: return 0
    if t >= 1: return 1
    lo, hi = 0.0, 1.0
    for _ in range(20):
        mid = (lo + hi) / 2
        x, _ = cubic_bezier(mid, 0.25, 1, 0.5, 1)
        if x < t:
            lo = mid
        else:
            hi = mid
    _, y = cubic_bezier((lo + hi) / 2, 0.25, 1, 0.5, 1)
    return y

def lerp(a, b, t):
    return a + (b - a) * t

for frame in range(num_frames):
    newPage(w, h)
    frameDuration(frame_duration)

    # Master phase 0→1 over the loop
    phase = frame / (num_frames - 1)

    # Phase boundaries
    # 0–0.05: hold full stack
    # 0.05–0.25: collapse
    # 0.25–0.45: white→orange transition
    # 0.45–0.75: pile up
    # 0.75–1: hold full stack
    hold1_end = 0.05
    collapse_end = 0.25
    transition_end = 0.45
    pileup_end = 0.75

    fill(*BG_COLOR)
    rect(0, 0, w, h)
    fill(None)
    strokeWidth(3)
    lineJoin("round")
    lineCap("round")

    if phase <= hold1_end or phase >= pileup_end:
        # Full stack, bottom orange
        for i in range(num_rhombuses):
            stroke(*ORANGE if i == 0 else STROKE_COLOR)
            y = y_positions[i]
            path = BezierPath()
            path.moveTo((cx - rhombus_width / 2, y))
            path.lineTo((cx, y + rhombus_height / 2))
            path.lineTo((cx + rhombus_width / 2, y))
            path.lineTo((cx, y - rhombus_height / 2))
            path.closePath()
            drawPath(path)

    elif phase < collapse_end:
        # Collapse: all layers move toward y_bottom at once
        # Bottom stays orange; white layers drawn on top so they cover it as they collapse
        t_collapse = (phase - hold1_end) / (collapse_end - hold1_end)
        t_collapse = ease_out_spring(t_collapse)
        for i in range(num_rhombuses):
            stroke(*ORANGE if i == 0 else STROKE_COLOR)
            y = lerp(y_positions[i], y_bottom, t_collapse)
            path = BezierPath()
            path.moveTo((cx - rhombus_width / 2, y))
            path.lineTo((cx, y + rhombus_height / 2))
            path.lineTo((cx + rhombus_width / 2, y))
            path.lineTo((cx, y - rhombus_height / 2))
            path.closePath()
            drawPath(path)

    elif phase < transition_end:
        # Single rhombus at bottom, white→orange (easeOutSpring)
        t_trans = (phase - collapse_end) / (transition_end - collapse_end)
        t_trans = ease_out_spring(t_trans)
        # Interpolate stroke color from white to orange
        r = lerp(1, ORANGE[0], t_trans)
        g = lerp(1, ORANGE[1], t_trans)
        b = lerp(1, ORANGE[2], t_trans)
        stroke(r, g, b)
        y = y_bottom
        path = BezierPath()
        path.moveTo((cx - rhombus_width / 2, y))
        path.lineTo((cx, y + rhombus_height / 2))
        path.lineTo((cx + rhombus_width / 2, y))
        path.lineTo((cx, y - rhombus_height / 2))
        path.closePath()
        drawPath(path)

    else:
        # Pile up: layers appear one by one
        # Draw white layers first, then orange on top so it's visible
        t_pile = (phase - transition_end) / (pileup_end - transition_end)
        n_visible = 1 + int(t_pile * num_rhombuses)
        n_visible = min(n_visible, num_rhombuses)
        # White layers first (1..n_visible-1)
        for i in range(1, n_visible):
            stroke(*STROKE_COLOR)
            y = y_positions[i]
            path = BezierPath()
            path.moveTo((cx - rhombus_width / 2, y))
            path.lineTo((cx, y + rhombus_height / 2))
            path.lineTo((cx + rhombus_width / 2, y))
            path.lineTo((cx, y - rhombus_height / 2))
            path.closePath()
            drawPath(path)
        # Orange bottom on top
        stroke(*ORANGE)
        y = y_positions[0]
        path = BezierPath()
        path.moveTo((cx - rhombus_width / 2, y))
        path.lineTo((cx, y + rhombus_height / 2))
        path.lineTo((cx + rhombus_width / 2, y))
        path.lineTo((cx, y - rhombus_height / 2))
        path.closePath()
        drawPath(path)

if shouldSave:
    import subprocess
    ts = currentTime.strftime("%Y%m%d-%H%M%S")
    src_gif = os.path.join(EXPORTS, f"blog-teaching-composer-1-anim-{ts}.gif")
    src_mp4 = os.path.join(EXPORTS, f"blog-teaching-composer-1-anim-{ts}.mp4")
    saveImage(src_gif)
    saveImage(src_mp4)

    FFMPEG = "/opt/homebrew/bin/ffmpeg"

    # Half-res GIF (1200px) — smaller filesize, decent quality
    out_gif = os.path.join(EXPORTS, f"blog-teaching-composer-1-anim-{ts}-1200.gif")
    palette = os.path.join(EXPORTS, f"_palette-tc1-{ts}.png")
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

    # Half-res MP4 (1200px) — smaller filesize, decent quality
    out_mp4 = os.path.join(EXPORTS, f"blog-teaching-composer-1-anim-{ts}-1200.mp4")
    subprocess.run([
        FFMPEG, "-y", "-i", src_mp4,
        "-vf", "scale=1200:-1:flags=lanczos",
        "-c:v", "libx264", "-crf", "23", "-preset", "slow",
        "-movflags", "+faststart",
        out_mp4
    ], check=True)

    print(f"Saved: {src_gif}, {out_gif}, {src_mp4}, {out_mp4}")
