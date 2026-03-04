# Ellipse sweep — animated, fat → line
# Starts with the last ellipse (line), builds up one ellipse per frame,
# holds at full, then reverses back to the line.

# Flags
shouldSave = 1

# Imports
import os
import datetime
import math
currentTime = datetime.datetime.now()

ROOT    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORTS = os.path.join(ROOT, "exports")

# Artboard — 2400×1260 for quality, ffmpeg will downscale to 1200×630
w, h = 2400, 1260
inset = 96
cx, cy = w / 2, h / 2
hw = (w - 2 * inset) / 2
hh = (h - 2 * inset) / 2

A_S     = -22
A_E     =  22
STEPS   =  12
FRAME_DUR = 1 / 7   # seconds per frame (~7fps)
HOLD    =  6    # frames to hold at start and end

# Colors
BG = (75/255, 73/255, 66/255)   # #4B4942
FG = (1, 1, 1, 0.9)             # #FFFFFF at 90%

def max_a_for_b(b, angle_deg):
    r = math.radians(angle_deg)
    cos_r, sin_r = abs(math.cos(r)), abs(math.sin(r))
    a_w = a_h = float('inf')
    if cos_r > 1e-9:
        v = hw**2 - (b * sin_r)**2
        if v > 0: a_w = math.sqrt(v) / cos_r
    if sin_r > 1e-9:
        v = hh**2 - (b * cos_r)**2
        if v > 0: a_h = math.sqrt(v) / sin_r
    a = min(a_w, a_h)
    return a if a != float('inf') else hw

B_START = hh * 0.55
B_END   = 1.5

# Precompute all ellipse params (index 0 = fattest, index STEPS-1 = line)
ellipses = []
for step in range(STEPS):
    t = step / (STEPS - 1)
    b = B_START + t * (B_END - B_START)
    angle_t = A_S + t * (A_E - A_S)
    a = max_a_for_b(b, angle_t)
    ellipses.append((angle_t, a, b))

def draw_frame(visible_count):
    """Draw a frame showing the last `visible_count` ellipses.
    Ellipses are drawn from last (line) up to the fattest visible one,
    so the line is always present and fatter ones build on top."""
    newPage(w, h)
    frameDuration(FRAME_DUR)
    fill(*BG); rect(0, 0, w, h)
    for i in range(STEPS - visible_count, STEPS):
        angle_t, a, b = ellipses[i]
        with savedState():
            rotate(angle_t, center=(cx, cy))
            fill(None); stroke(*FG); strokeWidth(4)
            if b < 2: line((cx - a, cy), (cx + a, cy))
            else:      oval(cx - a, cy - b, 2*a, 2*b)

# Build sequence: hold full, tear down to line (no pause), build back up
sequence = (
    [STEPS] * HOLD +                        # hold full
    list(range(STEPS, 0, -1)) +             # tear down 12→1
    list(range(1, STEPS + 1))               # immediately build back up 1→12
)

for visible_count in sequence:
    draw_frame(visible_count)

if shouldSave:
    import subprocess
    ts = currentTime.strftime("%Y%m%d-%H%M%S")
    src_gif = os.path.join(EXPORTS, f"blog-third-era-5a-{ts}.gif")
    src_mp4 = os.path.join(EXPORTS, f"blog-third-era-5a-{ts}.mp4")
    saveImage(src_gif)
    saveImage(src_mp4)

    # Downscale to 1200×630 and optimize with ffmpeg
    out_gif = os.path.join(EXPORTS, f"blog-third-era-5a-{ts}-1200.gif")
    out_mp4 = os.path.join(EXPORTS, f"blog-third-era-5a-{ts}-1200.mp4")

    FFMPEG = "/opt/homebrew/bin/ffmpeg"

    # GIF: generate palette first for best quality, then encode
    palette = os.path.join(EXPORTS, f"_palette-{ts}.png")
    subprocess.run([
        FFMPEG, "-y", "-i", src_gif,
        "-vf", "scale=1200:-1:flags=lanczos,palettegen=stats_mode=diff",
        palette
    ], check=True)
    subprocess.run([
        FFMPEG, "-y", "-i", src_gif, "-i", palette,
        "-lavfi", "scale=1200:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5",
        out_gif
    ], check=True)
    os.remove(palette)

    # MP4: scale + compress
    subprocess.run([
        FFMPEG, "-y", "-i", src_mp4,
        "-vf", "scale=1200:-2:flags=lanczos",
        "-crf", "23", "-preset", "slow",
        out_mp4
    ], check=True)

    print(f"Saved: {out_gif}")
    print(f"Saved: {out_mp4}")
