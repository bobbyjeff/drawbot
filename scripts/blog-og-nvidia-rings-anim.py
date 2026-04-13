# OG animation — concentric rings from images/public/blog_og_nvidia_04.svg
# Colors match scripts/blog-third-era-5a.py
# Sequence: seed (left) → rings emerge 0..N-1 → hold → collapse N-1..0 → seed → loop

shouldSave = 0

import math
import os
import datetime

currentTime = datetime.datetime.now()
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORTS = os.path.join(ROOT, "exports")

# 2× SVG viewBox 1200×630 (same as other blog OGs)
W, H = 2400, 1260
S = 2.0
CY = 315 * S

# From blog_og_nvidia_04.svg (cx = M x-coordinate; rOut = horizontal semi-axis)
# rIn = Bezier cp1 offset from outer sub-path (used for annulus hole ratio)
RINGS = [
    {"cx": 315 * S,     "rOut": 260.99 * S, "rIn": 144.14 * S},
    {"cx": 475.69 * S,  "rOut": 213.35 * S, "rIn": 117.83 * S},
    {"cx": 636.37 * S,  "rOut": 165.71 * S, "rIn": 91.52 * S},
    {"cx": 797.06 * S,  "rOut": 118.07 * S, "rIn": 65.21 * S},
    {"cx": 957.74 * S,  "rOut": 70.43 * S,  "rIn": 38.9 * S},
    {"cx": 1118.43 * S, "rOut": 22.8 * S,   "rIn": 12.59 * S},
]

N = len(RINGS)
SEED_X = 280 * S
SEED_R = 14 * S
SEED_HOLD = 8
EMERGE_FR = 10
HOLD_FULL = 18
COLLAPSE_FR = 10
FRAME_DUR = 1 / 12

BG = (75 / 255, 73 / 255, 66 / 255)
# Layered rings: screen blend + low alpha per pass (matches reference overlap glow)
RING_LAYER_ALPHA = 0.24
SEED_ALPHA = 0.85


def ease_out_cubic(t):
    return 1 - (1 - t) ** 3


def ease_in_cubic(t):
    return t * t * t


def lerp(a, b, t):
    return a + (b - a) * t


def draw_annulus_screen(cx, cy, r_out, r_in):
    """Annulus with hole; each pass uses screen so overlaps brighten (see SVG reference)."""
    if r_out <= r_in + 0.5:
        return
    with savedState():
        blendMode("screen")
        fill(1, 1, 1, RING_LAYER_ALPHA)
        stroke(None)
        oval(cx - r_out, cy - r_out, 2 * r_out, 2 * r_out)
        blendMode("destinationOut")
        fill(1, 1, 1, 1)
        oval(cx - r_in, cy - r_in, 2 * r_in, 2 * r_in)


def draw_seed():
    fill(1, 1, 1, SEED_ALPHA)
    stroke(None)
    oval(SEED_X - SEED_R, CY - SEED_R, 2 * SEED_R, 2 * SEED_R)


def ring_at_seed(k, u):
    """u in [0,1]: ring k from seed disk to final annulus."""
    g = RINGS[k]
    ratio = g["rIn"] / g["rOut"]
    cx = lerp(SEED_X, g["cx"], u)
    r_out = lerp(SEED_R, g["rOut"], u)
    r_in = r_out * ratio
    return cx, r_out, r_in


def ring_collapsing(k, u):
    """u in [0,1]: ring k from final back toward seed."""
    g = RINGS[k]
    ratio = g["rIn"] / g["rOut"]
    cx = lerp(g["cx"], SEED_X, u)
    r_out = lerp(g["rOut"], SEED_R, u)
    r_in = r_out * ratio
    return cx, r_out, r_in


def draw_frame_global(frame_index):
    newPage(W, H)
    frameDuration(FRAME_DUR)
    fill(*BG)
    rect(0, 0, W, H)

    total = SEED_HOLD + N * EMERGE_FR + HOLD_FULL + N * COLLAPSE_FR + SEED_HOLD
    f = frame_index % total
    t = f

    if t < SEED_HOLD:
        draw_seed()
        return
    t -= SEED_HOLD

    emerge_len = N * EMERGE_FR
    if t < emerge_len:
        idx = int(t // EMERGE_FR)
        u = ease_out_cubic((t - idx * EMERGE_FR) / EMERGE_FR)
        for i in range(idx):
            g = RINGS[i]
            draw_annulus_screen(g["cx"], CY, g["rOut"], g["rIn"])
        cx, ro, ri = ring_at_seed(idx, u)
        draw_annulus_screen(cx, CY, ro, ri)
        return
    t -= emerge_len

    if t < HOLD_FULL:
        # Same order as SVG paths (largest first → smallest on top)
        for g in RINGS:
            draw_annulus_screen(g["cx"], CY, g["rOut"], g["rIn"])
        return
    t -= HOLD_FULL

    collapse_len = N * COLLAPSE_FR
    if t < collapse_len:
        j = int(t // COLLAPSE_FR)
        u = ease_in_cubic((t - j * COLLAPSE_FR) / COLLAPSE_FR)
        k = N - 1 - j
        for i in range(k):
            g = RINGS[i]
            draw_annulus_screen(g["cx"], CY, g["rOut"], g["rIn"])
        cx, ro, ri = ring_collapsing(k, u)
        draw_annulus_screen(cx, CY, ro, ri)
        return

    draw_seed()


total_frames = SEED_HOLD + N * EMERGE_FR + HOLD_FULL + N * COLLAPSE_FR + SEED_HOLD
for fi in range(total_frames):
    draw_frame_global(fi)

if shouldSave:
    import subprocess

    ts = currentTime.strftime("%Y%m%d-%H%M%S")
    src_gif = os.path.join(EXPORTS, f"blog-og-nvidia-rings-{ts}.gif")
    src_mp4 = os.path.join(EXPORTS, f"blog-og-nvidia-rings-{ts}.mp4")
    saveImage(src_gif)
    saveImage(src_mp4)
    out_mp4 = os.path.join(EXPORTS, f"blog-og-nvidia-rings-{ts}-1200.mp4")
    FFMPEG = "/opt/homebrew/bin/ffmpeg"
    subprocess.run(
        [
            FFMPEG,
            "-y",
            "-i",
            src_mp4,
            "-vf",
            "scale=1200:-2:flags=lanczos",
            "-crf",
            "23",
            "-preset",
            "slow",
            out_mp4,
        ],
        check=True,
    )
    print(f"Saved: {out_mp4}")
