# Blog header — "Securing our codebase with autonomous agents" (animated)
# Orange trapezoids scan across the screen and wrap around

# Flags
shouldSave = 1

# Imports
import os
import datetime
currentTime = datetime.datetime.now()

ROOT    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORTS = os.path.join(ROOT, "exports")

# Animation — only animate 1/n_orange of the span (pattern repeats)
num_frames     = 90
frame_duration = 1/30   # 30 fps

# Artboard
w, h   = 2400, 1260
inset  = 96
cx, cy = w / 2, h / 2

inner_w = w - 2 * inset
inner_h = h - 2 * inset

# Vanishing point
vp = (cx, cy)

# Vertical lines
n_verticals = 11
xs = [inset + i * inner_w / (n_verticals - 1) for i in range(n_verticals)]

neck = inner_h / 3
vp_top = (cx, cy + neck / 2)
vp_bot = (cx, cy - neck / 2)

BG_COLOR = (0x2B/255, 0x23/255, 0x23/255)
FG_COLOR = (1, 1, 1, 0.9)
ORANGE   = (245/255, 78/255, 0)

n_orange  = 4
phase_end = 1 / n_orange   # 0.25 — stop when first crosses into second's start

for frame in range(num_frames):
    newPage(w, h)
    frameDuration(frame_duration)

    # Phase 0→phase_end, linear (constant speed, seamless loop)
    phase = frame / (num_frames - 1) * phase_end

    # Orange positions: evenly spaced, offset by phase, wrap at 1
    orange_xs = [inset + ((i + 0.5) / n_orange + phase) % 1.0 * inner_w for i in range(n_orange)]

    fill(*BG_COLOR); rect(0, 0, w, h)

    stroke(*FG_COLOR); strokeWidth(3); fill(None)
    lineJoin("round")
    lineCap("round")

    # Static foreground trapezoids
    for xi in xs:
        line((xi, inset), (xi, h - inset))
    for xi in xs:
        line(vp_top, (xi, h - inset))
        line(vp_bot, (xi, inset))

    # Animated orange trapezoids
    stroke(*ORANGE); strokeWidth(3); fill(None)
    line((cx, cy - neck/2), (cx, cy + neck/2))
    for ox in orange_xs:
        line((ox, inset), (ox, h - inset))
        line((cx, cy + neck/2), (ox, h - inset))
        line((cx, cy - neck/2), (ox, inset))

if shouldSave:
    import subprocess
    ts = currentTime.strftime("%Y%m%d-%H%M%S")
    src_gif = os.path.join(EXPORTS, f"blog-securing-codebase-4-anim-{ts}.gif")
    src_mp4 = os.path.join(EXPORTS, f"blog-securing-codebase-4-anim-{ts}.mp4")
    saveImage(src_gif)
    saveImage(src_mp4)

    FFMPEG = "/opt/homebrew/bin/ffmpeg"

    # Half-res GIF (1200px)
    out_gif = os.path.join(EXPORTS, f"blog-securing-codebase-4-anim-{ts}-1200.gif")
    palette = os.path.join(EXPORTS, f"_palette-sec4-{ts}.png")
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

    # Re-encode full-res MP4 for better compression (keep 2400px)
    tmp_mp4 = os.path.join(EXPORTS, f"_tmp-sec4-{ts}.mp4")
    subprocess.run([
        FFMPEG, "-y", "-i", src_mp4,
        "-c:v", "libx264", "-crf", "25", "-preset", "slow",
        "-movflags", "+faststart",
        tmp_mp4
    ], check=True)
    os.replace(tmp_mp4, src_mp4)

    print(f"Saved: {src_gif}, {out_gif}, {src_mp4} (optimized)")
