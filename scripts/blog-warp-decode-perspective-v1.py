# ARCHIVED SNAPSHOT — “Warp Decode” header (perspective trapezoid + trap-matched VP rows).
# Frozen reference; active iteration lives in blog-warp-decode.py.

# Blog header — "Warp Decode"
# Perspective: mirrored trapezoids (2/3 height at outer x, full at mid). Left — vertical
# dashes with pitch + dash lengths scaled by column height. Right — rows are chords of the
# same pencil: VP = intersection of the trap’s top and bottom edges (exact taper); clipped to
# the trap so they read as parallel “horizontals” in perspective.

# Flags
shouldSave = 1

import os
import datetime
import random

currentTime = datetime.datetime.now()

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORTS = os.path.join(ROOT, "exports")

# Artboard (same as other blog headers — 1200×630 @2x)
w, h = 2400, 1260
inset = 96
inner_w = w - 2 * inset
inner_h = h - 2 * inset
mid_x = inset + inner_w / 2
width_l = mid_x - inset
width_r = w - inset - mid_x

cy = h / 2
y_short_bot = cy - inner_h / 3
y_short_top = cy + inner_h / 3

BG_COLOR = (1, 1, 1)
FG_COLOR = (0, 0, 0)

# Spacing / perspective
n_verticals = 32
n_horizontals = 38
stroke_w = 2.5
# >1 bunches columns toward the short (left) side so pitch scales with “depth”
persp_x_gamma = 1.18

# Right trapezoid spine endpoints (same labels as ray clipper)
P_rt_tl = (mid_x, h - inset)
P_rt_tr = (w - inset, y_short_top)
P_rt_bl = (mid_x, inset)
P_rt_br = (w - inset, y_short_bot)


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
    _vp = ((w - inset) + 3.0 * inner_w, cy)
right_vp_x, right_vp_y = _vp


def uneven_dash_pattern(line_index):
    """
    Irregular dash/gap stream per column: multi-modal lengths, variable period depth,
    biased toward long ink + short gaps (fewer visible breaks). Reproducible per index.
    """
    rng = random.Random(7919 + line_index * 97)
    parts = []
    n_pairs = rng.randint(5, 11)
    for _ in range(n_pairs):
        rc = rng.random()
        if rc < 0.14:
            dash = rng.uniform(105, 210)
        elif rc < 0.42:
            dash = rng.uniform(52, 112)
        elif rc < 0.72:
            dash = rng.uniform(28, 78)
        else:
            dash = rng.uniform(18, 48)

        rg = rng.random()
        if rg < 0.55:
            gap = rng.uniform(2.5, 14)
        elif rg < 0.78:
            gap = rng.uniform(8, 24)
        elif rg < 0.92:
            gap = rng.uniform(1.5, 6)
        else:
            gap = rng.uniform(22, 44)

        if rng.random() < 0.11:
            dash *= rng.uniform(1.15, 1.45)
        if rng.random() < 0.08:
            gap *= rng.uniform(0.35, 0.7)

        parts.append(max(6.0, dash))
        parts.append(max(1.5, gap))

    return parts


def _locate_phase_in_pattern(phase, parts):
    """Segment index, offset into that segment, remaining length in that segment."""
    period = sum(parts)
    phase = phase % period
    acc = 0.0
    for i, seg in enumerate(parts):
        nxt = acc + float(seg)
        if phase < nxt - 1e-9:
            pos_in_seg = phase - acc
            return i, pos_in_seg, float(seg) - pos_in_seg
        if abs(phase - nxt) < 1e-9:
            ni = (i + 1) % len(parts)
            return ni, 0.0, float(parts[ni])
        acc = nxt
    return 0, 0.0, float(parts[0])


def dash_stroke_intervals(parts, line_length, pattern_phase=0.0):
    """
    Stroke spans along path distance [0, line_length] (bottom → top), matching DrawBot
    dash semantics: even 0-based indices in `parts` are ink.
    """
    idx, _pos_in_seg, remaining = _locate_phase_in_pattern(pattern_phase, parts)
    t = 0.0
    intervals = []
    guard = 0
    while t < line_length - 1e-9:
        guard += 1
        if guard > 50000:
            break
        is_stroke = (idx % 2) == 0
        chunk = min(remaining, line_length - t)
        if is_stroke:
            intervals.append((t, t + chunk))
        t += chunk
        remaining -= chunk
        if remaining < 1e-9:
            idx = (idx + 1) % len(parts)
            remaining = float(parts[idx])
    return intervals


def clamp_vertical_endcaps(intervals, line_length):
    """Extend first/last dash to cover both endpoints of a vertical span."""
    if not intervals:
        return [(0.0, float(line_length))]
    out = [(float(a), float(b)) for a, b in intervals]
    if out[0][0] > 1e-6:
        out[0] = (0.0, out[0][1])
    if out[-1][1] < line_length - 1e-6:
        out[-1] = (out[-1][0], float(line_length))
    return out


def left_trapezoid_y_bounds(x):
    """Bottom / top y for the left trapezoid at x ∈ [inset, mid_x]."""
    t = (x - inset) / width_l
    y0 = y_short_bot + t * (inset - y_short_bot)
    y1 = y_short_top + t * ((h - inset) - y_short_top)
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
    """Convex right trapezoid; ray from A along d into interior; return smallest exit t > 0."""
    mid, ins, W = mid_x, inset, w - inset
    edges = (
        ((mid, ins), (W, y_short_bot)),
        ((W, y_short_bot), (W, y_short_top)),
        ((W, y_short_top), (mid, h - ins)),
    )
    ts = []
    for E0, E1 in edges:
        t = ray_segment_intersect_t(A, d, E0, E1)
        if t is not None:
            ts.append(t)
    return min(ts) if ts else None


def right_persp_row(y_spine):
    """Row through trap taper VP and (mid_x, y_spine); clipped to the right trapezoid."""
    A = (mid_x, y_spine)
    d = (right_vp_x - mid_x, right_vp_y - y_spine)
    t_exit = ray_exit_trapezoid_right(A, d)
    if t_exit is None or t_exit < 1e-6:
        return
    B = (A[0] + t_exit * d[0], A[1] + t_exit * d[1])
    line(A, B)


newPage(w, h)
fill(*BG_COLOR)
rect(0, 0, w, h)

fill(None)
stroke(*FG_COLOR)
strokeWidth(stroke_w)
lineCap("butt")
lineJoin("miter")
lineDash(None)

# Left — verticals: perspective x (power law), y from trapezoid, dashes scaled by span/inner_h
n = n_verticals
pitch_ref = (mid_x - inset - stroke_w / 2) * 2 / (2 * n + 1)
x_max_c = mid_x - stroke_w / 2 - pitch_ref
t_last = ((n - 0.5) / n) ** persp_x_gamma
for i in range(n):
    t = (i + 0.5) / n
    x = inset + (x_max_c - inset) * (t**persp_x_gamma) / t_last
    y_lo, y_hi = left_trapezoid_y_bounds(x)
    span = y_hi - y_lo
    scale = span / inner_h
    parts = scale_parts(uneven_dash_pattern(i), scale)
    segs = clamp_vertical_endcaps(dash_stroke_intervals(parts, span, 0.0), span)
    for t0, t1 in segs:
        line((x, y_lo + t0), (x, y_lo + t1))

# Right — perspective rows (VP = top ∩ bottom trap edges), clipped to trapezoid
if n_horizontals <= 1:
    horiz_ys = [inset + inner_h / 2]
else:
    horiz_ys = [
        inset + j * inner_h / (n_horizontals - 1) for j in range(n_horizontals)
    ]
for y in horiz_ys:
    right_persp_row(y)

if shouldSave:
    base = os.path.join(
        EXPORTS,
        "blog-warp-decode-" + currentTime.strftime("%Y%m%d-%H%M%S"),
    )
    saveImage(base + ".png")
    saveImage(base + ".svg")
