# Artwork for blog post: Cursor Eval — animated version (v3)
# Needle sweeps L→R with spring easing, leaving accumulated ghost marks.
# First frame = end state (needle on right). Loops seamlessly.

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
BG     = (0x16/255, 0x1D/255, 0x1E/255)
FG     = (1, 1, 1)
NEEDLE = (0xF5/255, 0x4E/255, 0x00/255)

# ── Meter parameters ──────────────────────────────────────────────────────────
sweep_deg = 45
start_deg = 90 + sweep_deg / 2
end_deg   = 90 - sweep_deg / 2

half_rad = math.radians(sweep_deg / 2)
r_tip    = (cx - inset) / math.sin(half_rad)

minor_frac     = 0.025
major_frac     = 0.0333
line_len_minor = r_tip * minor_frac
line_len_major = r_tip * major_frac

origin_x = cx
origin_y = (h - inset) - r_tip

num_majors     = 11
minors_per_gap = 9
stroke_w       = 3.0

needle_t_final  = 0.98

lowest_angle_rad = math.radians(start_deg + (1.0 - needle_t_final) * (end_deg - start_deg))
needle_base      = (inset - origin_y) / math.sin(lowest_angle_rad)
needle_len       = r_tip - (line_len_minor + line_len_major) / 2
needle_len_tip   = r_tip - line_len_minor * 0.4

# Build tick positions
tick_positions = []
for k in range(num_majors):
    t_major = k / (num_majors - 1)
    tick_positions.append((t_major, True))
    if k < num_majors - 1:
        t_next = (k + 1) / (num_majors - 1)
        for m in range(1, minors_per_gap + 1):
            t_minor = t_major + m * (t_next - t_major) / (minors_per_gap + 1)
            tick_positions.append((t_minor, False))

# ── Ghost positions ───────────────────────────────────────────────────────────
# Fixed spatial markers evenly distributed across the sweep range.
# Each becomes visible once the needle passes it, then fades with distance.
ghost_count = 32
ghost_ts    = [i / (ghost_count - 1) * needle_t_final for i in range(ghost_count)]
fade_span   = needle_t_final * 0.55   # ghosts fade to 0 over this much travel

# ── Easing — cubic-bezier(0.25, 1, 0.5, 1) ───────────────────────────────────
def cubic_bezier_y(p1x, p1y, p2x, p2y, t):
    def x_at(s):
        return 3*p1x*s*(1-s)**2 + 3*p2x*s**2*(1-s) + s**3
    def y_at(s):
        return 3*p1y*s*(1-s)**2 + 3*p2y*s**2*(1-s) + s**3
    lo, hi = 0.0, 1.0
    for _ in range(40):
        mid = (lo + hi) / 2
        (lo, hi) = (mid, hi) if x_at(mid) < t else (lo, mid)
    return y_at((lo + hi) / 2)

def ease_spring(t):
    return cubic_bezier_y(0.25, 1, 0.5, 1, t)

# ── Animation ─────────────────────────────────────────────────────────────────
num_sweep_frames = 48
num_hold_frames  = 16
frame_dur        = 1 / 24

def draw_needle_line(t_pos, tip_r, color, width):
    angle_rad = math.radians(start_deg + t_pos * (end_deg - start_deg))
    tip_x  = origin_x + tip_r       * math.cos(angle_rad)
    tip_y  = origin_y + tip_r       * math.sin(angle_rad)
    base_x = origin_x + needle_base * math.cos(angle_rad)
    base_y = origin_y + needle_base * math.sin(angle_rad)
    stroke(*color); strokeWidth(width)
    line((base_x, base_y), (tip_x, tip_y))

def draw_frame(needle_t):
    newPage(w, h)
    frameDuration(frame_dur)
    fill(*BG); rect(0, 0, w, h)
    fill(None); lineCap("round")

    # Ticks
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

    # Ghost needles — fixed positions, each activated once needle passes, then fades
    for g_t in ghost_ts:
        if needle_t < g_t:
            continue   # needle hasn't reached this ghost yet
        delta   = needle_t - g_t
        opacity = max(0.0, 1.0 - delta / fade_span)
        opacity = max(0.04, opacity)   # floor so they don't fully vanish
        color   = (*FG, opacity)
        draw_needle_line(g_t, needle_len, color, stroke_w * 1.2)

    # Main needle — orange
    draw_needle_line(needle_t, needle_len_tip, NEEDLE, stroke_w * 2.5)

# ── Sequence: hold right → cut to left → spring sweep L→R ────────────────────
# Hold at final position (first frames, and also last frames → seamless loop)
for _ in range(num_hold_frames):
    draw_frame(needle_t_final)

# One reset frame: needle at left, no ghosts visible
draw_frame(0.0)

# Sweep left → right with spring easing
for f in range(num_sweep_frames):
    t        = f / (num_sweep_frames - 1)
    needle_t = ease_spring(t) * needle_t_final
    draw_frame(needle_t)

# ── Save ─────────────────────────────────────────────────────────────────────
if shouldSave:
    import subprocess
    ts = currentTime.strftime("%Y%m%d-%H%M%S")
    src_gif = os.path.join(EXPORTS, f"blog-cursor-eval-anim-{ts}.gif")
    src_mp4 = os.path.join(EXPORTS, f"blog-cursor-eval-anim-{ts}.mp4")
    saveImage(src_gif)
    saveImage(src_mp4)

    out_gif = os.path.join(EXPORTS, f"blog-cursor-eval-anim-{ts}-1200.gif")
    out_mp4 = os.path.join(EXPORTS, f"blog-cursor-eval-anim-{ts}-1200.mp4")

    FFMPEG = "/opt/homebrew/bin/ffmpeg"
    palette = os.path.join(EXPORTS, f"_palette-{ts}.png")
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
    subprocess.run([
        FFMPEG, "-y", "-i", src_mp4,
        "-vf", "scale=1200:-2:flags=lanczos",
        "-crf", "23", "-preset", "slow",
        out_mp4
    ], check=True)
    print(f"Saved: {out_gif}")
    print(f"Saved: {out_mp4}")
