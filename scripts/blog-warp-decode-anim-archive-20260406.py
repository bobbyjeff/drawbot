# Blog header — "Warp Decode" (animated)
# render_mode: "start" | "kf12" | "kf23" | "kf34" | "kf41" | "anim" (KF1→2→3→4→1).
#
# Column bunching: strongest with spine mid-board → exponent →1 toward xl/xr. kf12: left end on spine, right on xr.

# Flags
shouldSave = 1
# "kf12" = animated KF1→KF2, "kf23" = animated KF2→KF3, "kf34" = animated KF3→KF4,
# "kf41" = isolated KF4→KF1 closure test, "start" = single KF1 still, "anim" = KF1→2→3→4→1.
render_mode = "anim"

# KF1→KF2 spine endpoints (None = mid_x and xr - 2*half_sw).
spine_x_kf1 = None
spine_x_kf2 = None
kf12_spine_smoothstep = True
show_phantom_guides = False
phantom_guide_hide_u = 0.99
phantom_stroke_w = 1.35
spine_bunch_exponent = 1.0

import math
import os
import datetime
import random
from types import SimpleNamespace

currentTime = datetime.datetime.now()

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORTS = os.path.join(ROOT, "exports")

# Animated clips: more frames ⇒ smoother; shorter frame_duration ⇒ faster wall-clock without stair-stepping.
_nominal_timeline_fps = 120.0
animation_playback_speed = 4.0  # Faster without reducing num_frames (least jumpy option).
num_frames = 1 if render_mode == "start" else 120  # kf12 + anim
frame_duration = (1.0 / _nominal_timeline_fps) / max(1e-9, animation_playback_speed)

# Artboard 1200×630 @2x — full bleed horizontally; top/bottom inset optional (stroke half-width always)
w, h = 2400, 1260
inset_x = 0
inset_y = 96
inner_w = w - 2 * inset_x
mid_x = w / 2  # Artboard center; default spine only.

# Distance (px) from xl or xr at which pinch height blends to full drawable → rectangular perspective.
spine_edge_rect_margin = 64.0


def spine_x_default():
    """Spine when not animating kf12 (start / two-phase anim): fixed center."""
    return mid_x


def kf12_progress(frame_index):
    """Shared u∈[0,1] for spine travel, vertical morph, and horizontal spine→xr in kf12 mode."""
    raw = frame_index / max(1, num_frames - 1)
    if kf12_spine_smoothstep:
        return raw * raw * (3.0 - 2.0 * raw)
    return raw


def ease01(raw):
    """Shared eased 0→1 progress for all keyed phases."""
    raw = max(0.0, min(1.0, raw))
    if kf12_spine_smoothstep:
        return raw * raw * (3.0 - 2.0 * raw)
    return raw


def timeline_uvwx(frame_index):
    """Four equal segments: KF1→2, KF2→3, KF3→4, KF4→1."""
    denom = max(1, num_frames - 1)
    v = frame_index / denom
    if v <= 0.25:
        return ease01(v * 4.0), 0.0, 0.0, 0.0
    if v <= 0.5:
        return 1.0, ease01((v - 0.25) * 4.0), 0.0, 0.0
    if v <= 0.75:
        return 1.0, 1.0, ease01((v - 0.5) * 4.0), 0.0
    return 1.0, 1.0, 1.0, ease01((v - 0.75) * 4.0)


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


def _spine_x_kf1_value():
    return mid_x if spine_x_kf1 is None else spine_x_kf1


def _spine_x_kf2_value():
    return xr - 2.0 * half_sw if spine_x_kf2 is None else spine_x_kf2


def _spine_x_kf23_start_value():
    """KF2→3 preview starts from the left edge and moves back to center."""
    return xl + 2.0 * half_sw


yb = inset_y + half_sw
yt = h - inset_y - half_sw
inner_h_draw = yt - yb
cy = (yb + yt) / 2
# Spine band height = 2 * (inner_h_draw / persp_spine_divisor). Larger divisor → shorter band → tighter column bunch.
persp_spine_divisor = 4.0
_half_spine = inner_h_draw / persp_spine_divisor
y_short_bot = cy - _half_spine
y_short_top = cy + _half_spine
short_h = y_short_top - y_short_bot
# Nominal (full) bow-tie band / γ: combined with edge proximity inside build_warp_geometry.
_spine_frac = short_h / inner_h_draw if inner_h_draw > 1e-9 else 1.0
persp_x_gamma_tight = 0.58
persp_x_gamma_loose = 0.98
# Left dashed columns: True ≈ uniform Δx with a whisper of γ (left_verticals_soft_gamma); False = spine-linked γ above.
left_verticals_even_x = True
# Exponent when even_x: 1.0 = perfectly linear; slightly <1 bunches a little toward the spine.
left_verticals_soft_gamma = 0.9
# Shrink how far the right fan slides vs virtual inner column n−1 (reduces KF1↔KF2 channel gap).
kf12_right_fan_slide_scale = 0.78
# Spine→xr horizontals — right endpoint Y (xr):
# - fixed_height: right Ys start at KF1 VP→xr hits (taller outer-trap fan), can grow around cy during KF1→2, then lerp to flat by t12.
# - else if progressive_spread: VP fan at xr ramps with t12.
# - else: full VP at xr for all t12.
kf12_right_anchor_fixed_height = True
kf12_right_anchor_growth = 4.0
kf12_right_fan_progressive_spread = True
# Larger exponent = calmer early, much stronger fan growth as spine nears the right edge.
# KF3→4 right side: separate controls so the compressed vertical comb can be tuned independently.
# spacing_mix: 0 = linear spacing in [spine, xr], 1 = full gamma bunching from g_col.
kf34_right_anchor_growth = 4.0
kf34_right_spacing_mix = 0.15
# KF2→3 vertical x: True = no strand crossings. Strand i lerps to right_x_start[n−2−i] for w<1 (order-statistics
# pairing); at w>=1 snap to canonical right_x_start[i] so the last frame matches static mirror layout (see docstring).
kf23_vertical_nocross = True
# Right-panel rays: None = uniform y along spine (even density on the outer edge).
# Set to persp_x_gamma to bunch samples toward the band center (denser line ends mid-height).
right_spine_y_bunch_gamma = None
# Tiny manual tweak on the last column only
rightmost_vertical_nudge = 2.0
# Left vertical fragments: three discrete run lengths (reference space), scaled & tiled with no gaps
DASH_LENS_REF = (40.0, 85.0, 160.0)


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


def left_trapezoid_y_bounds(x, spine_x, ys_bot, ys_top):
    """Left trap: full height at x=xl → pinch band at spine_x (xs use live ys_bot/ys_top)."""
    wl = spine_x - xl
    if wl < 1e-9:
        return yb, yt
    t = (x - xl) / wl
    t = max(0.0, min(1.0, t))
    y0 = yb + t * (ys_bot - yb)
    y1 = yt + t * (ys_top - yt)
    return y0, y1


def right_trapezoid_y_bounds(x, spine_x, ys_bot, ys_top):
    """Right trap: full height at x=xr → pinch at spine_x."""
    wr = xr - spine_x
    if wr < 1e-9:
        return yb, yt
    t = (xr - x) / wr
    t = max(0.0, min(1.0, t))
    y0 = yb + t * (ys_bot - yb)
    y1 = yt + t * (ys_top - yt)
    return y0, y1


def right_trapezoid_y_bounds_clamped(x, spine_x, ys_bot, ys_top):
    """Same as right_trapezoid_y_bounds with t clamped."""
    wr = xr - spine_x
    if wr < 1e-9:
        return yb, yt
    t = (xr - x) / wr
    t = max(0.0, min(1.0, t))
    y0 = yb + t * (ys_bot - yb)
    y1 = yt + t * (ys_top - yt)
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


def ray_exit_trapezoid_right(A, d, spine_x, ys_bot, ys_top):
    """Convex right trapezoid (narrow at spine_x); ray from A along d into interior; exit t > 0."""
    mid, W = spine_x, xr
    edges = (
        ((mid, ys_bot), (W, yb)),
        ((W, yb), (W, yt)),
        ((W, yt), (mid, ys_top)),
    )
    ts = []
    for E0, E1 in edges:
        t = ray_segment_intersect_t(A, d, E0, E1)
        if t is not None:
            ts.append(t)
    return min(ts) if ts else None


def ray_exit_trapezoid_left(A, d, spine_x, ys_bot, ys_top):
    """Convex left trapezoid (narrow at spine_x); ray from A along d into interior; exit t > 0."""
    mid, W = spine_x, xl
    edges = (
        ((mid, ys_bot), (W, yb)),
        ((W, yb), (W, yt)),
        ((W, yt), (mid, ys_top)),
    )
    ts = []
    for E0, E1 in edges:
        t = ray_segment_intersect_t(A, d, E0, E1)
        if t is not None:
            ts.append(t)
    return min(ts) if ts else None


def ray_exit_axis_aligned_rect(px, py, ex, ey, x_min, x_max, y_min, y_max):
    """Smallest t > 0 where (px,py) + t*(ex,ey) hits the rectangle edge; ex,ey unit-ish."""
    lo_x, hi_x = (x_min, x_max) if x_min < x_max else (x_max, x_min)
    lo_y, hi_y = (y_min, y_max) if y_min < y_max else (y_max, y_min)
    ts = []
    if abs(ex) > 1e-12:
        for xb in (lo_x, hi_x):
            t = (xb - px) / ex
            if t > 1e-6:
                yy = py + t * ey
                if lo_y - 1e-5 <= yy <= hi_y + 1e-5:
                    ts.append(t)
    if abs(ey) > 1e-12:
        for yb in (lo_y, hi_y):
            t = (yb - py) / ey
            if t > 1e-6:
                xx = px + t * ex
                if lo_x - 1e-5 <= xx <= hi_x + 1e-5:
                    ts.append(t)
    return min(ts) if ts else None


def ray_len_to_x_right(px, ex, x_right):
    """t ≥ 0 along (ex,·) from px until x = x_right (full bleed right)."""
    if ex <= 1e-12:
        return None
    t = (x_right - px) / ex
    return t if t > 1e-6 else None


def ray_len_to_x_left(px, ex, x_left):
    """t ≥ 0 until x = x_left (full bleed left); need ex < 0."""
    if ex >= -1e-12:
        return None
    t = (x_left - px) / ex
    return t if t > 1e-6 else None


n = n_verticals
nh = n_horizontals

# KF1→2 vertical morph uses fixed endpoint layouts only — avoids compounding build(sx) drift with u (columns “racing” the spine).
_kf12_endpoint_cache_key = None
_kf12_geom_g0 = None
_kf12_geom_g1 = None


def horiz_ys_samples(ys_bot, ys_top):
    """Horizontal sample ys in the pinch band (same rule as build_warp_geometry)."""
    sh_live = ys_top - ys_bot
    if nh <= 1:
        return [cy]
    if right_spine_y_bunch_gamma is None:
        return [ys_bot + j * sh_live / (nh - 1) for j in range(nh)]
    g = right_spine_y_bunch_gamma
    invg = 1.0 / g
    out = []
    for j in range(nh):
        t = j / (nh - 1)
        if abs(t - 0.5) < 1e-15:
            out.append(cy)
            continue
        uu = abs(2.0 * t - 1.0) ** invg
        out.append(cy + 0.5 * sh_live * math.copysign(uu, t - 0.5))
    return out


_kf1_right_anchor_yr_cache_key = None
_kf1_right_anchor_yr_ladder = None


def horiz_ys_fixed_right_anchor():
    """KF1 right endpoints: VP ray from (s_kf1, horiz_ys[j]) to xr — same span as first-frame trapezoid fan."""
    global _kf1_right_anchor_yr_cache_key, _kf1_right_anchor_yr_ladder
    key = (_spine_x_kf1_value(), _spine_x_kf2_value())
    if _kf1_right_anchor_yr_cache_key != key:
        _kf1_right_anchor_yr_cache_key = key
        G0, _ = endpoint_geoms_kf12()
        rvx, rvy = G0.right_vp_x, G0.right_vp_y
        sx0 = G0.spine_x
        _kf1_right_anchor_yr_ladder = tuple(
            y_on_ray_to_x(rvx, rvy, sx0, G0.horiz_ys[j], xr) for j in range(nh)
        )
    return _kf1_right_anchor_yr_ladder


def endpoint_geoms_kf12():
    """Cached build(s_kf1), build(s_kf2) for spine-linked vertical/horizontal timing."""
    global _kf12_endpoint_cache_key, _kf12_geom_g0, _kf12_geom_g1
    key = (_spine_x_kf1_value(), _spine_x_kf2_value())
    if _kf12_endpoint_cache_key != key:
        _kf12_endpoint_cache_key = key
        _kf12_geom_g0 = build_warp_geometry(_spine_x_kf1_value())
        _kf12_geom_g1 = build_warp_geometry(_spine_x_kf2_value())
    return _kf12_geom_g0, _kf12_geom_g1


def build_warp_geometry(spine_x):
    """All x layouts, VPs, and traps for one spine position. pinch→rectangle as spine hits xl or xr."""
    sx = max(xl + 2.0 * half_sw, min(xr - 2.0 * half_sw, float(spine_x)))
    d_edge = min(sx - xl, xr - sx)
    m = spine_edge_rect_margin
    pinch_rect = min(1.0, d_edge / m) if m > 1e-9 else 1.0
    ys_bot = yb + pinch_rect * (y_short_bot - yb)
    ys_top = yt + pinch_rect * (y_short_top - yt)
    sh_live = ys_top - ys_bot

    max_clear = max(1e-9, 0.5 * (xr - xl))
    bunch_w = max(0.0, min(1.0, d_edge / max_clear)) ** spine_bunch_exponent

    sf = _spine_frac * pinch_rect
    pxg = persp_x_gamma_tight + (persp_x_gamma_loose - persp_x_gamma_tight) * sf
    g_target = left_verticals_soft_gamma if left_verticals_even_x else pxg
    g_col = 1.0 + (g_target - 1.0) * bunch_w

    P_rt_tl = (sx, ys_top)
    P_rt_tr = (xr, yt)
    P_rt_bl = (sx, ys_bot)
    P_rt_br = (xr, yb)
    vp = line_line_intersection_infinite(P_rt_tl, P_rt_tr, P_rt_bl, P_rt_br)
    if vp is None:
        vp = (inset_x - 3.0 * inner_w, cy)
    rvx, rvy = vp[0], vp[1]
    lvx = 2.0 * sx - rvx

    x_max_c = sx - half_sw - 0.5
    x_cap = x_max_c
    L_full = x_max_c - xl
    x_cap_full = xr - 0.5
    span_full = x_cap_full - xl

    left_x_start = []
    left_x_end = []
    if n <= 1:
        te = 0.5**g_col
        x0 = xl + L_full * te
        x1 = xl + span_full * te
        left_x_start.append(x0)
        left_x_end.append(x1)
    else:
        for i in range(n):
            if i < n - 1:
                tk = (i + 1) / n
                te = tk**g_col
                x0 = xl + L_full * te
                x1 = xl + span_full * te
            else:
                x0 = xl + L_full
                x1 = xl + span_full
            if n > 1 and i == n - 1:
                x0 = min(x0 + rightmost_vertical_nudge, x_cap)
                x1 = min(x1 + rightmost_vertical_nudge, x_cap_full)
            left_x_start.append(x0)
            left_x_end.append(x1)

    _last = max(0, n - 1)
    horizontal_slideoff_x = left_x_end[_last] - left_x_start[_last]

    left_y_lo0 = []
    left_y_hi0 = []
    for i in range(n):
        y_lo0, y_hi0 = left_trapezoid_y_bounds(left_x_start[i], sx, ys_bot, ys_top)
        left_y_lo0.append(y_lo0)
        left_y_hi0.append(y_hi0)

    right_x_start = [2.0 * sx - left_x_start[i] for i in range(n)]
    right_y_lo0 = []
    right_y_hi0 = []
    for i in range(n):
        rlo, rhi = right_trapezoid_y_bounds_clamped(right_x_start[i], sx, ys_bot, ys_top)
        right_y_lo0.append(rlo)
        right_y_hi0.append(rhi)

    horiz_ys = horiz_ys_samples(ys_bot, ys_top)

    if nh <= 1:
        horiz_ys_full = [cy]
    else:
        horiz_ys_full = [yb + j * (yt - yb) / (nh - 1) for j in range(nh)]

    return SimpleNamespace(
        spine_x=sx,
        pinch_rect_factor=pinch_rect,
        g_col=g_col,
        ys_bot=ys_bot,
        ys_top=ys_top,
        short_h_live=sh_live,
        right_vp_x=rvx,
        right_vp_y=rvy,
        left_vp_x=lvx,
        left_vp_y=rvy,
        x_max_c=x_max_c,
        x_cap=x_cap,
        L_full=L_full,
        x_cap_full=x_cap_full,
        span_full=span_full,
        left_x_start=left_x_start,
        left_x_end=left_x_end,
        horizontal_slideoff_x=horizontal_slideoff_x,
        left_y_lo0=left_y_lo0,
        left_y_hi0=left_y_hi0,
        right_x_start=right_x_start,
        right_y_lo0=right_y_lo0,
        right_y_hi0=right_y_hi0,
        horiz_ys=horiz_ys,
        horiz_ys_full=horiz_ys_full,
    )


def y_on_ray_to_x(vx, vy, px, py, x_tgt):
    """Y where the infinite line VP→(px,py) reaches x = x_tgt."""
    dx = px - vx
    if abs(dx) < 1e-12:
        return py
    t = (x_tgt - vx) / dx
    return vy + t * (py - vy)


def right_column_xs(sx, g_col, spacing_mix=1.0):
    """Column x rails on the right side, packed into [sx, xr].
    spacing_mix: 0 = linear tk, 1 = full tk**g_col, values in-between interpolate the spacing law."""
    x_min_c = sx + half_sw + 0.5
    W = max(0.0, xr - x_min_c)
    out = []
    if n <= 1:
        te = (1.0 - spacing_mix) * 0.5 + spacing_mix * (0.5**g_col)
        out.append(x_min_c + W * te)
        return out
    for i in range(n):
        if i < n - 1:
            tk = (i + 1) / n
            te = (1.0 - spacing_mix) * tk + spacing_mix * (tk**g_col)
            x = x_min_c + W * te
        else:
            x = xr
        out.append(x)
    return out


def draw_warp_art_morph(u, geom, use_spine_xr_horizontals=None):
    """u=0 KF1 bow; u=1 KF2 full-height columns + rect horizontals.
    KF1→2 vertical x/y and horizontal band use only lerp(build(s_kf1), build(s_kf2), u)—same u as spine lerp—so column spacing cannot outrun the spine.
    use_spine_xr_horizontals: True = spine→xr horizontals; False = right VP fan. Default: True only if render_mode == "kf12"."""
    if use_spine_xr_horizontals is None:
        use_spine_xr_horizontals = render_mode == "kf12"
    sx = geom.spine_x

    if show_phantom_guides:
        ph = tuple(0.72 * f + 0.28 * b for f, b in zip(FG_COLOR, BG_COLOR))
        stroke(*ph)
        strokeWidth(phantom_stroke_w)
        lineCap("butt")
        lineDash(6, 10)
        line((xl, yb), (xl, yt))
        line((sx, yb), (sx, yt))
        lineDash(None)

    stroke(*FG_COLOR)
    strokeWidth(stroke_w)
    lineCap("round")
    lineJoin("round")
    lineDash(None)

    G0 = G1 = None
    ys_bot_m = ys_top_m = None
    horiz_ys_m = None
    t12 = u
    if use_spine_xr_horizontals:
        G0, G1 = endpoint_geoms_kf12()
        ys_bot_m = (1.0 - t12) * G0.ys_bot + t12 * G1.ys_bot
        ys_top_m = (1.0 - t12) * G0.ys_top + t12 * G1.ys_top
        horiz_ys_m = horiz_ys_samples(ys_bot_m, ys_top_m)

    for i in range(n):
        # Omit center-adjacent spine column (inner-left); KF2→3 omits inner-right (same index n−1).
        if i == n - 1:
            continue
        if use_spine_xr_horizontals:
            x = (1.0 - t12) * G0.left_x_start[i] + t12 * G1.left_x_end[i]
            y_lo0, y_hi0 = left_trapezoid_y_bounds(x, sx, ys_bot_m, ys_top_m)
            y_lo = (1.0 - t12) * y_lo0 + t12 * yb
            y_hi = (1.0 - t12) * y_hi0 + t12 * yt
        else:
            x = geom.left_x_start[i] + u * (geom.left_x_end[i] - geom.left_x_start[i])
            y_lo = geom.left_y_lo0[i] + u * (yb - geom.left_y_lo0[i])
            y_hi = geom.left_y_hi0[i] + u * (yt - geom.left_y_hi0[i])
        span = y_hi - y_lo
        if span < 1e-6:
            continue
        scale = span / inner_h_draw
        lengths = scale_parts(uneven_fragment_lengths(i), scale)
        min_run = max(stroke_w * 2.0, 0.35 * scale * min(DASH_LENS_REF))
        segs = best_contiguous_fragments(span, lengths, min_run)
        for si, (t0, t1) in enumerate(segs):
            col = FG_COLOR if (si + i) % 2 == 0 else ACCENT_COLOR
            stroke(*col)
            line((x, y_lo + t0), (x, y_lo + t1))

    lineCap("round")
    lineJoin("round")
    stroke(*FG_COLOR)
    rvx, rvy = geom.right_vp_x, geom.right_vp_y

    if use_spine_xr_horizontals:
        y_r_fixed_ladder = horiz_ys_fixed_right_anchor()
        for j in range(nh):
            y_flat = geom.horiz_ys_full[j]
            y_l0 = horiz_ys_m[j]
            y_l = (1.0 - t12) * y_l0 + t12 * y_flat
            if kf12_right_anchor_fixed_height:
                growth = 1.0 + t12 * (kf12_right_anchor_growth - 1.0)
                y_r_fixed = cy + (y_r_fixed_ladder[j] - cy) * growth
                y_r = (1.0 - t12) * y_r_fixed + t12 * y_flat
            else:
                y_r_ray = y_on_ray_to_x(rvx, rvy, sx, y_l0, xr)
                if kf12_right_fan_progressive_spread:
                    y_r_persp = y_l0 + t12 * (y_r_ray - y_l0)
                    y_r = (1.0 - t12) * y_r_persp + t12 * y_flat
                else:
                    y_r = (1.0 - t12) * y_r_ray + t12 * y_flat
            line((sx, y_l), (xr, y_r))
    else:
        slide = u * geom.horizontal_slideoff_x * kf12_right_fan_slide_scale
        _len_fallback = 2.0 * max(inner_w, yt - yb)
        for j in range(nh):
            y0 = geom.horiz_ys[j]
            y_spine = (1.0 - u) * y0 + u * geom.horiz_ys_full[j]
            y_tgt = geom.horiz_ys_full[j]
            A = (sx, y_spine)
            dx = sx - rvx
            dy = y_spine - rvy
            d = (dx, dy)
            len_d = math.hypot(dx, dy)
            if len_d < 1e-12:
                continue
            epx, epy = dx / len_d, dy / len_d
            bx = (1.0 - u) * epx + u * 1.0
            by = (1.0 - u) * epy + u * 0.0
            len_b = math.hypot(bx, by)
            if len_b < 1e-12:
                ex, ey = epx, epy
            else:
                ex, ey = bx / len_b, by / len_b
            t_trap = ray_exit_trapezoid_right(A, d, sx, geom.ys_bot, geom.ys_top)
            if t_trap is not None and t_trap > 1e-6:
                L_persp = t_trap * len_d
            else:
                t_fb = ray_exit_axis_aligned_rect(sx, y_spine, epx, epy, sx, xr, yb, yt)
                L_persp = t_fb if t_fb is not None else _len_fallback
            t_rect = ray_exit_axis_aligned_rect(sx, y_spine, ex, ey, sx, xr, yb, yt)
            L_rect = t_rect if t_rect is not None else _len_fallback
            t_xr_blend = ray_len_to_x_right(sx, ex, xr - 0.5)
            if t_xr_blend is not None and t_xr_blend > L_rect:
                L_rect = t_xr_blend
            seg_len = (1.0 - u) * L_persp + u * L_rect
            A_s = (sx + slide, y_spine)
            if u > 1e-9 and ex > 1e-12:
                t_to_edge = ray_len_to_x_right(A_s[0], ex, xr - 0.5)
                if t_to_edge is not None and t_to_edge > seg_len:
                    seg_len = t_to_edge
            B_s = (A_s[0] + seg_len * ex, A_s[1] + seg_len * ey)
            by_out = B_s[1] + u * (y_tgt - B_s[1])
            by_out = max(yb, min(yt, by_out))
            B_s = (B_s[0], by_out)
            line(A_s, B_s)


def draw_kf2_to_kf3(w, geom):
    """KF2→3 with mirrored logic:
    spine moves left→center, right-side verticals compress into the mirrored bowtie,
    and left-side horizontals grow out from xl while the left edge stays at the normal inset height."""
    sx = geom.spine_x
    G0, G1 = endpoint_geoms_kf12()  # G0 = KF1(center), G1 = KF2(right)
    G2 = G1
    G3 = G0

    ys_bot_m = (1.0 - w) * G2.ys_bot + w * G3.ys_bot
    ys_top_m = (1.0 - w) * G2.ys_top + w * G3.ys_top
    horiz_ys_m = horiz_ys_samples(ys_bot_m, ys_top_m)

    if show_phantom_guides:
        ph = tuple(0.72 * f + 0.28 * b for f, b in zip(FG_COLOR, BG_COLOR))
        stroke(*ph)
        strokeWidth(phantom_stroke_w)
        lineCap("butt")
        lineDash(6, 10)
        line((xl, yb), (xl, yt))
        line((sx, yb), (sx, yt))
        lineDash(None)

    stroke(*FG_COLOR)
    strokeWidth(stroke_w)
    lineCap("round")
    lineJoin("round")
    lineDash(None)

    for j in range(nh):
        y_flat = geom.horiz_ys_full[j]
        y_band = horiz_ys_m[j]
        x_end = sx
        # KF2→3 keeps the left anchor on the regular inset-height ladder; no KF1 3x-style growth here.
        y_left = y_flat
        y_right = (1.0 - w) * y_flat + w * y_band
        line((xl, y_left), (x_end, y_right))

    for i in range(n):
        if i == n - 1:
            continue
        if kf23_vertical_nocross and w < 1.0:
            x_pair = (n - 2) - i
            x_tgt = G3.right_x_start[x_pair]
        else:
            x_tgt = G3.right_x_start[i]
        x_c = (1.0 - w) * G2.left_x_end[i] + w * x_tgt
        y_lo0, y_hi0 = right_trapezoid_y_bounds_clamped(x_c, sx, ys_bot_m, ys_top_m)
        y_lo = (1.0 - w) * yb + w * y_lo0
        y_hi = (1.0 - w) * yt + w * y_hi0
        span = y_hi - y_lo
        if span < 1e-6:
            continue
        scale = span / inner_h_draw
        lengths = scale_parts(uneven_fragment_lengths(i), scale)
        min_run = max(stroke_w * 2.0, 0.35 * scale * min(DASH_LENS_REF))
        segs = best_contiguous_fragments(span, lengths, min_run)
        for si, (t0, t1) in enumerate(segs):
            col = FG_COLOR if (si + i) % 2 == 0 else ACCENT_COLOR
            stroke(*col)
            line((x_c, y_lo + t0), (x_c, y_lo + t1))


def draw_kf3_to_kf4(u, geom):
    """KF3→4:
    spine moves center→right, left horizontals stay attached to the spine and flatten into a rectangle,
    while right verticals compress toward the right edge and their bow height grows with the same 3x control."""
    sx = geom.spine_x
    G3 = build_warp_geometry(_spine_x_kf1_value())
    G4 = build_warp_geometry(_spine_x_kf2_value())

    ys_bot_m = (1.0 - u) * G3.ys_bot + u * G4.ys_bot
    ys_top_m = (1.0 - u) * G3.ys_top + u * G4.ys_top
    horiz_ys_m = horiz_ys_samples(ys_bot_m, ys_top_m)

    if show_phantom_guides:
        ph = tuple(0.72 * f + 0.28 * b for f, b in zip(FG_COLOR, BG_COLOR))
        stroke(*ph)
        strokeWidth(phantom_stroke_w)
        lineCap("butt")
        lineDash(6, 10)
        line((xl, yb), (xl, yt))
        line((sx, yb), (sx, yt))
        lineDash(None)

    stroke(*FG_COLOR)
    strokeWidth(stroke_w)
    lineCap("round")
    lineJoin("round")
    lineDash(None)

    for j in range(nh):
        y_flat = geom.horiz_ys_full[j]
        y_band = horiz_ys_m[j]
        line((xl, y_flat), (sx, (1.0 - u) * y_band + u * y_flat))

    right_xs = right_column_xs(sx, geom.g_col, spacing_mix=kf34_right_spacing_mix)
    for i in range(n):
        x_c = right_xs[i]
        growth = 1.0 + u * (kf34_right_anchor_growth - 1.0)
        # Only the anchored outer edge grows. The inner side stays tied to the same spine band as the horizontals.
        outer_y_lo = cy + (yb - cy) * growth
        outer_y_hi = cy + (yt - cy) * growth
        wr = max(1e-9, xr - sx)
        t = max(0.0, min(1.0, (xr - x_c) / wr))
        y_lo_trap = outer_y_lo + t * (ys_bot_m - outer_y_lo)
        y_hi_trap = outer_y_hi + t * (ys_top_m - outer_y_hi)
        y_lo = (1.0 - u) * y_lo_trap + u * yb
        y_hi = (1.0 - u) * y_hi_trap + u * yt
        span = y_hi - y_lo
        if span < 1e-6:
            continue
        scale = span / inner_h_draw
        lengths = scale_parts(uneven_fragment_lengths(i), scale)
        min_run = max(stroke_w * 2.0, 0.35 * scale * min(DASH_LENS_REF))
        segs = best_contiguous_fragments(span, lengths, min_run)
        for si, (t0, t1) in enumerate(segs):
            col = FG_COLOR if (si + i) % 2 == 0 else ACCENT_COLOR
            stroke(*col)
            line((x_c, y_lo + t0), (x_c, y_lo + t1))


def draw_kf4_to_kf1(w, geom):
    """KF4→1:
    spine moves left→center, full-width horizontals collapse into the right KF1 fan,
    and left verticals enter from xl at full inset height and bow inward toward the spine band."""
    sx = geom.spine_x
    G1 = build_warp_geometry(_spine_x_kf1_value())

    # Exact closure: the final frame of KF4→1 must be identical to the original KF1 renderer.
    if w >= 1.0 - 1e-12:
        draw_warp_art_morph(0.0, G1, use_spine_xr_horizontals=False)
        return

    ys_bot_m = (1.0 - w) * yb + w * G1.ys_bot
    ys_top_m = (1.0 - w) * yt + w * G1.ys_top
    horiz_ys_m = horiz_ys_samples(ys_bot_m, ys_top_m)

    if show_phantom_guides:
        ph = tuple(0.72 * f + 0.28 * b for f, b in zip(FG_COLOR, BG_COLOR))
        stroke(*ph)
        strokeWidth(phantom_stroke_w)
        lineCap("butt")
        lineDash(6, 10)
        line((xl, yb), (xl, yt))
        line((sx, yb), (sx, yt))
        lineDash(None)

    stroke(*FG_COLOR)
    strokeWidth(stroke_w)
    lineCap("round")
    lineJoin("round")
    lineDash(None)

    for i in range(n):
        if i == n - 1:
            continue
        x = (1.0 - w) * xl + w * G1.left_x_start[i]
        y_lo0, y_hi0 = left_trapezoid_y_bounds(x, sx, ys_bot_m, ys_top_m)
        y_lo = (1.0 - w) * yb + w * y_lo0
        y_hi = (1.0 - w) * yt + w * y_hi0
        span = y_hi - y_lo
        if span < 1e-6:
            continue
        scale = span / inner_h_draw
        lengths = scale_parts(uneven_fragment_lengths(i), scale)
        min_run = max(stroke_w * 2.0, 0.35 * scale * min(DASH_LENS_REF))
        segs = best_contiguous_fragments(span, lengths, min_run)
        for si, (t0, t1) in enumerate(segs):
            col = FG_COLOR if (si + i) % 2 == 0 else ACCENT_COLOR
            stroke(*col)
            line((x, y_lo + t0), (x, y_lo + t1))

    y_r_fixed_ladder = horiz_ys_fixed_right_anchor()
    stroke(*FG_COLOR)
    for j in range(nh):
        y_flat = geom.horiz_ys_full[j]
        x_l = sx
        y_l = (1.0 - w) * y_flat + w * horiz_ys_m[j]
        y_r = (1.0 - w) * y_flat + w * y_r_fixed_ladder[j]
        line((x_l, y_l), (xr, y_r))


for frame in range(num_frames):
    newPage(w, h)
    frameDuration(frame_duration)

    fill(*BG_COLOR)
    rect(0, 0, w, h)

    fill(None)
    if render_mode == "start":
        geom = build_warp_geometry(spine_x_default())
        draw_warp_art_morph(0.0, geom)
    elif render_mode == "kf12":
        u = kf12_progress(frame)
        s0, s1 = _spine_x_kf1_value(), _spine_x_kf2_value()
        geom = build_warp_geometry(s0 + (s1 - s0) * u)
        draw_warp_art_morph(u, geom)
    elif render_mode == "kf23":
        w_key = kf12_progress(frame)
        s0 = _spine_x_kf23_start_value()
        s1 = _spine_x_kf1_value()
        geom = build_warp_geometry(s0 + (s1 - s0) * w_key)
        draw_kf2_to_kf3(w_key, geom)
    elif render_mode == "kf34":
        u = kf12_progress(frame)
        s0, s1 = _spine_x_kf1_value(), _spine_x_kf2_value()
        geom = build_warp_geometry(s0 + (s1 - s0) * u)
        draw_kf3_to_kf4(u, geom)
    elif render_mode == "kf41":
        w41 = kf12_progress(frame)
        s0 = _spine_x_kf23_start_value()
        s1 = _spine_x_kf1_value()
        geom = build_warp_geometry(s0 + (s1 - s0) * w41)
        draw_kf4_to_kf1(w41, geom)
    else:
        u12, w23, u34, w41 = timeline_uvwx(frame)
        s0, s1 = _spine_x_kf1_value(), _spine_x_kf2_value()
        if w23 <= 1e-12 and u34 <= 1e-12 and w41 <= 1e-12:
            geom = build_warp_geometry(s0 + (s1 - s0) * u12)
            draw_warp_art_morph(u12, geom, use_spine_xr_horizontals=True)
        elif u34 <= 1e-12 and w41 <= 1e-12:
            s2 = _spine_x_kf23_start_value()
            geom = build_warp_geometry(s2 + (s0 - s2) * w23)
            draw_kf2_to_kf3(w23, geom)
        elif w41 <= 1e-12:
            geom = build_warp_geometry(s0 + (s1 - s0) * u34)
            draw_kf3_to_kf4(u34, geom)
        else:
            s2 = _spine_x_kf23_start_value()
            geom = build_warp_geometry(s2 + (s0 - s2) * w41)
            draw_kf4_to_kf1(w41, geom)

if shouldSave:
    import subprocess

    ts = currentTime.strftime("%Y%m%d-%H%M%S")
    src_gif = os.path.join(EXPORTS, f"blog-warp-decode-anim-{ts}.gif")
    src_mp4 = os.path.join(EXPORTS, f"blog-warp-decode-anim-{ts}.mp4")
    saveImage(src_gif)
    saveImage(src_mp4)

    FFMPEG = "/opt/homebrew/bin/ffmpeg"

    out_gif = os.path.join(EXPORTS, f"blog-warp-decode-anim-{ts}-1200.gif")
    palette = os.path.join(EXPORTS, f"_palette-warp-decode-anim-{ts}.png")
    subprocess.run(
        [
            FFMPEG,
            "-y",
            "-i",
            src_gif,
            "-vf",
            "scale=1200:-1:flags=lanczos,palettegen=stats_mode=diff:max_colors=64",
            palette,
        ],
        check=True,
    )
    subprocess.run(
        [
            FFMPEG,
            "-y",
            "-i",
            src_gif,
            "-i",
            palette,
            "-lavfi",
            "scale=1200:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5",
            out_gif,
        ],
        check=True,
    )
    os.remove(palette)

    out_mp4 = os.path.join(EXPORTS, f"blog-warp-decode-anim-{ts}-1200.mp4")
    subprocess.run(
        [
            FFMPEG,
            "-y",
            "-i",
            src_mp4,
            "-vf",
            "scale=1200:-1:flags=lanczos",
            "-c:v",
            "libx264",
            "-crf",
            "23",
            "-preset",
            "slow",
            "-movflags",
            "+faststart",
            out_mp4,
        ],
        check=True,
    )

    print(f"Saved: {src_gif}, {out_gif}, {src_mp4}, {out_mp4}")
