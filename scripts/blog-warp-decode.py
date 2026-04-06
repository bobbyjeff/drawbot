# Blog header — "Warp Decode" (working copy — iterate here)
# Animated fork: scripts/blog-warp-decode-anim.py
# Frozen perspective build: scripts/blog-warp-decode-perspective-v1.py
# Bow-tie trapezoids, horizontal full bleed; optional vertical inset. xl/xr/yb/yt include half stroke.
# Spine gap from γ spacing + nudge. (Older 96px margin build: blog-warp-decode-perspective-v1.py)

# Flags
shouldSave = 1

import math
import os
import datetime
import random

currentTime = datetime.datetime.now()

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORTS = os.path.join(ROOT, "exports")

# Artboard 1200×630 @2x — full bleed horizontally; top/bottom inset optional (stroke half-width always)
w, h = 2400, 1260
inset_x = 0
inset_y = 96
inner_w = w - 2 * inset_x
mid_x = w / 2

# #F0EFEB / #F54E00 / #544701
BG_COLOR = (0xF0 / 255, 0xEF / 255, 0xEB / 255)
FG_COLOR = (0xF5 / 255, 0x4E / 255, 0x00 / 255)
ACCENT_COLOR = (0x54 / 255, 0x47 / 255, 0x01 / 255)

# Spacing / perspective
n_verticals = 32
# Right-side rays vs columns; <1.0 thins perspective lines (uniform spine y).
horizontal_vs_vertical = 0.8
n_horizontals = max(2, round(n_verticals * horizontal_vs_vertical))
stroke_w = 2.5
half_sw = stroke_w / 2
xl = inset_x + half_sw
xr = w - inset_x - half_sw
yb = inset_y + half_sw
yt = h - inset_y - half_sw
inner_h_draw = yt - yb
cy = (yb + yt) / 2
# Spine band height = 2 * (inner_h_draw / persp_spine_divisor). Larger divisor → stronger vertical pinch.
persp_spine_divisor = 4.0
_half_spine = inner_h_draw / persp_spine_divisor
y_short_bot = cy - _half_spine
y_short_top = cy + _half_spine
width_l = mid_x - xl
width_r = xr - mid_x
# γ = 1 → uniform spacing; slight <1 = very mild bunching toward the spine
persp_x_gamma = 0.92
# Right-panel rays: None = uniform y along spine (even density on the outer edge).
# Set to persp_x_gamma to bunch samples toward the band center (denser line ends mid-height).
right_spine_y_bunch_gamma = None
# Tiny manual tweak on the last column only
rightmost_vertical_nudge = 2.0
# Left vertical fragments: three discrete run lengths (reference space), scaled & tiled with no gaps
DASH_LENS_REF = (40.0, 85.0, 160.0)

# Right trapezoid — short vertical at mid_x, full height at outer x (for VP + ray clip)
P_rt_tl = (mid_x, y_short_top)
P_rt_tr = (xr, yt)
P_rt_bl = (mid_x, y_short_bot)
P_rt_br = (xr, yb)


def line_line_intersection_infinite(p0, p1, q0, q1):
    """Intersection of infinite lines p0→p1 and q0→q1; None if parallel."""
    x0, y0 = p0
    x1, y1 = p1
    x2, y2 = q0
    x3, y3 = q1
    den = (x0 - x1) * (y2 - y3) - (y0 - y1) * (x2 - x3)
    if abs(den) < 1e-12:
        return None
    t = ((x0 - x2) * (y2 - y3) - (y0 - y2) * (x2 - x3)) / den
    return (x0 + t * (x1 - x0), y0 + t * (y1 - y0))


_vp = line_line_intersection_infinite(P_rt_tl, P_rt_tr, P_rt_bl, P_rt_br)
if _vp is None:
    _vp = (inset_x - 3.0 * inner_w, cy)
right_vp_x, right_vp_y = _vp


def uneven_fragment_lengths(line_index):
    """Per column: run lengths, each one of three sizes (reference space). Reproducible per index."""
    rng = random.Random(7919 + line_index * 97)
    out = []
    n_runs = rng.randint(6, 12)
    for _ in range(n_runs):
        dash = float(rng.choice(DASH_LENS_REF))
        out.append(max(6.0, dash))
    return out


def tile_contiguous_segments(line_length, lengths_cycle):
    """Abutting (t0,t1) spans covering [0, line_length], cycling lengths_cycle."""
    if line_length < 1e-9:
        return []
    lens = [float(x) for x in lengths_cycle if x > 1e-9]
    if not lens:
        return [(0.0, float(line_length))]
    segs = []
    t = 0.0
    li = 0
    guard = 0
    while t < line_length - 1e-9:
        guard += 1
        if guard > 100000:
            break
        L = lens[li % len(lens)]
        chunk = min(L, line_length - t)
        if chunk > 1e-9:
            segs.append((t, t + chunk))
            t += chunk
        li += 1
    return segs


def absorb_tiny_end_fragments(segs, line_length, min_run):
    """Merge sub-min_run end fragments into neighbors so colors stay continuous."""
    if not segs or min_run <= 1e-9:
        return segs
    out = [(float(a), float(b)) for a, b in segs]
    while len(out) >= 2 and (out[-1][1] - out[-1][0]) < min_run - 1e-6:
        a0 = out[-2][0]
        out[-2] = (a0, float(line_length))
        out.pop()
    while len(out) >= 2 and (out[0][1] - out[0][0]) < min_run - 1e-6:
        out[1] = (0.0, out[1][1])
        out.pop(0)
    if len(out) == 1 and (out[0][1] - out[0][0]) < min_run - 1e-6:
        out[0] = (0.0, float(line_length))
    return out


def best_contiguous_fragments(line_length, lengths, min_run=0.0):
    """Rotate the length cycle to balance end runs; absorb tiny tails without leaving holes."""
    if line_length < 1e-9:
        return []
    base = [float(x) for x in lengths if x > 1e-9]
    if not base:
        return [(0.0, float(line_length))]
    nc = len(base)
    best_segs = None
    best_score = -1.0
    for rot in range(nc):
        cyc = base[rot:] + base[:rot]
        segs = absorb_tiny_end_fragments(
            tile_contiguous_segments(line_length, cyc), line_length, min_run
        )
        if not segs:
            continue
        fl = segs[0][1] - segs[0][0]
        ll = segs[-1][1] - segs[-1][0]
        score = min(fl, ll)
        if score > best_score:
            best_score = score
            best_segs = segs
    if best_segs is not None:
        return best_segs
    return absorb_tiny_end_fragments(
        tile_contiguous_segments(line_length, base), line_length, min_run
    )


def left_trapezoid_y_bounds(x):
    """Left trap: full drawable height at x=xl → compressed band at x=mid_x."""
    t = (x - xl) / width_l
    y0 = yb + t * (y_short_bot - yb)
    y1 = yt + t * (y_short_top - yt)
    return y0, y1


def scale_parts(parts, factor):
    return [float(p) * factor for p in parts]


def cross(ax, ay, bx, by):
    return ax * by - ay * bx


def ray_segment_intersect_t(A, d, E0, E1):
    """Smallest t > 0 where A + t*d meets segment E0→E1 (excludes t ≈ 0)."""
    ex, ey = E1[0] - E0[0], E1[1] - E0[1]
    wx, wy = E0[0] - A[0], E0[1] - A[1]
    det = cross(d[0], d[1], ex, ey)
    if abs(det) < 1e-12:
        return None
    t = cross(wx, wy, ex, ey) / det
    u = cross(wx, wy, d[0], d[1]) / det
    if t > 1e-5 and -1e-6 <= u <= 1 + 1e-6:
        return t
    return None


def ray_exit_trapezoid_right(A, d):
    """Convex right trapezoid (narrow at mid_x); ray from A along d into interior; exit t > 0."""
    mid, W = mid_x, xr
    edges = (
        ((mid, y_short_bot), (W, yb)),
        ((W, yb), (W, yt)),
        ((W, yt), (mid, y_short_top)),
    )
    ts = []
    for E0, E1 in edges:
        t = ray_segment_intersect_t(A, d, E0, E1)
        if t is not None:
            ts.append(t)
    return min(ts) if ts else None


def right_persp_row(y_spine):
    """Row: direction VP → spine, extend into right trap (works if VP is left or right of mid_x)."""
    A = (mid_x, y_spine)
    d = (mid_x - right_vp_x, y_spine - right_vp_y)
    t_exit = ray_exit_trapezoid_right(A, d)
    if t_exit is None or t_exit < 1e-6:
        return
    B = (A[0] + t_exit * d[0], A[1] + t_exit * d[1])
    line(A, B)


newPage(w, h)
fill(*BG_COLOR)
rect(0, 0, w, h)

fill(None)
stroke(*ACCENT_COLOR)
strokeWidth(stroke_w)
# Match the current animation styling: simple solid secondary-color verticals.
lineCap("round")
lineJoin("round")
lineDash(None)

# Left — verticals: perspective x, solid secondary-color strokes
n = n_verticals
usable_x = mid_x - half_sw - xl
if n <= 1:
    x_max_c = mid_x - half_sw - usable_x * 2 / 3
else:
    # Spine gap = pitch between last two column centers (matches local density at center)
    k = ((n - 2) / (n - 1)) ** persp_x_gamma
    denom = 2 - k
    pitch_ref = usable_x * (1 - k) / denom if denom > 1e-9 else usable_x * 2 / (2 * n + 1)
    x_max_c = mid_x - half_sw - pitch_ref

# Leading gap ≈ Δx from column 0→1 on the old xl→x_max_c γ curve (n=2: use half-step)
L_full = x_max_c - xl
if n > 1:
    t_step = 1.0 / (n - 1)
    if n == 2:
        first_gap = L_full * (0.5**persp_x_gamma)
    else:
        first_gap = L_full * (t_step**persp_x_gamma)
    first_gap = min(first_gap, L_full * 0.45)
    x_lo = xl + first_gap
    span_L = x_max_c - x_lo
else:
    first_gap = L_full * 0.12
    x_lo = xl + first_gap
    span_L = x_max_c - x_lo

x_cap = mid_x - half_sw - 0.5
for i in range(n):
    t = 0.5 if n <= 1 else i / (n - 1)
    x = x_lo + span_L * (t**persp_x_gamma)
    if n > 1 and i == n - 1:
        x = min(x + rightmost_vertical_nudge, x_cap)
    y_lo, y_hi = left_trapezoid_y_bounds(x)
    line((x, y_lo), (x, y_hi))

# Right — perspective rows (round caps)
short_h = y_short_top - y_short_bot
nh = n_horizontals
if nh <= 1:
    horiz_ys = [cy]
elif right_spine_y_bunch_gamma is None:
    horiz_ys = [y_short_bot + j * short_h / (nh - 1) for j in range(nh)]
else:
    g = right_spine_y_bunch_gamma
    invg = 1.0 / g
    horiz_ys = []
    for j in range(nh):
        t = j / (nh - 1)
        if abs(t - 0.5) < 1e-15:
            horiz_ys.append(cy)
            continue
        u = abs(2.0 * t - 1.0) ** invg
        horiz_ys.append(cy + 0.5 * short_h * math.copysign(u, t - 0.5))
stroke(*FG_COLOR)
lineCap("round")
lineJoin("round")
for y in horiz_ys:
    right_persp_row(y)

if shouldSave:
    base = os.path.join(
        EXPORTS,
        "blog-warp-decode-" + currentTime.strftime("%Y%m%d-%H%M%S"),
    )
    saveImage(base + ".png")
    saveImage(base + ".svg")
