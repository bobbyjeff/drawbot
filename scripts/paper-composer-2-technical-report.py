#!/usr/bin/env python3
# Paper graphic — "Composer 2 Technical Report"
# Two overlapping infinity curves with knot-style over/under crossings.

# Flags
shouldSave = 1

# Imports
import os
import math
import itertools
import datetime

currentTime = datetime.datetime.now()

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORTS = os.path.join(ROOT, "exports")

# Artboard
w, h = 2400, 1260
inset = 96
cx, cy = w / 2, h / 2
inner_w = w - 2 * inset
inner_h = h - 2 * inset

# Colors
BG_COLOR = (0xF0 / 255, 0xF0 / 255, 0xF2 / 255)
FG_COLOR = (0, 0, 0)

STROKE_W = 3
X_SCALE_RATIO = 0.38
Y_MARGIN = 12
SIDE_MARGIN = 8
SAMPLE_STEPS = 1800
UNDER_GAP_WINDOW = 3


def build_normalized_parametric_points(cx, cy, scale_x, scale_y, sampler, steps=1400):
    raw_points = []
    max_abs_x = 0.0
    max_abs_y = 0.0

    for i in range(steps + 1):
        t = 2 * math.pi * i / steps
        raw_x, raw_y = sampler(t)
        raw_points.append((raw_x, raw_y))
        max_abs_x = max(max_abs_x, abs(raw_x))
        max_abs_y = max(max_abs_y, abs(raw_y))

    max_abs_x = max(max_abs_x, 1e-6)
    max_abs_y = max(max_abs_y, 1e-6)

    return [
        (
            cx + scale_x * raw_x / max_abs_x,
            cy + scale_y * raw_y / max_abs_y,
        )
        for raw_x, raw_y in raw_points
    ]


def build_lissajous_points(cx, cy, scale_x, scale_y, a, b, delta, steps=1400):
    return build_normalized_parametric_points(
        cx,
        cy,
        scale_x,
        scale_y,
        lambda t: (
            math.sin(a * t + delta),
            math.sin(b * t),
        ),
        steps=steps,
    )


def draw_polyline(points):
    path = BezierPath()
    path.moveTo(points[0])
    for pt in points[1:]:
        path.lineTo(pt)
    drawPath(path)


def apply_curve_style(curve_name):
    stroke(*FG_COLOR)
    strokeWidth(STROKE_W)
    fill(None)
    lineCap("round")
    lineJoin("round")
    if curve_name == "right":
        lineDash(16, 10)
    else:
        lineDash(None)


def add_hidden_interval(intervals, center_idx, half_window, period):
    start_idx = center_idx - half_window
    end_idx = center_idx + half_window

    if start_idx < 0:
        intervals.append((start_idx + period, period - 1))
        intervals.append((0, end_idx))
    elif end_idx >= period:
        intervals.append((start_idx, period - 1))
        intervals.append((0, end_idx - period))
    else:
        intervals.append((start_idx, end_idx))


def merge_intervals(intervals):
    if not intervals:
        return []

    intervals = sorted(intervals)
    merged = [intervals[0]]

    for start_idx, end_idx in intervals[1:]:
        last_start, last_end = merged[-1]
        if start_idx <= last_end + 1:
            merged[-1] = (last_start, max(last_end, end_idx))
        else:
            merged.append((start_idx, end_idx))

    return merged


def visible_intervals(period, hidden_intervals):
    if not hidden_intervals:
        return [(0, period - 1)]

    merged = merge_intervals(hidden_intervals)
    visible = []
    cursor = 0

    for start_idx, end_idx in merged:
        if cursor < start_idx:
            visible.append((cursor, start_idx - 1))
        cursor = end_idx + 1

    if cursor <= period - 1:
        visible.append((cursor, period - 1))

    return visible


def draw_visible_segments(points, hidden_intervals):
    period = len(points) - 1
    for start_idx, end_idx in visible_intervals(period, hidden_intervals):
        if end_idx - start_idx < 1:
            continue

        path = BezierPath()
        path.moveTo(points[start_idx])
        for idx in range(start_idx + 1, end_idx + 1):
            path.lineTo(points[idx])
        drawPath(path)


def segment_intersection(a1, a2, b1, b2):
    x1, y1 = a1
    x2, y2 = a2
    x3, y3 = b1
    x4, y4 = b2

    denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    if abs(denom) < 1e-9:
        return None

    det_a = x1 * y2 - y1 * x2
    det_b = x3 * y4 - y3 * x4
    px = (det_a * (x3 - x4) - (x1 - x2) * det_b) / denom
    py = (det_a * (y3 - y4) - (y1 - y2) * det_b) / denom

    def within(p, q1, q2):
        return (
            min(q1[0], q2[0]) - 1e-6 <= p[0] <= max(q1[0], q2[0]) + 1e-6
            and min(q1[1], q2[1]) - 1e-6 <= p[1] <= max(q1[1], q2[1]) + 1e-6
        )

    point = (px, py)
    if within(point, a1, a2) and within(point, b1, b2):
        return point
    return None


def find_intersections(points_a, points_b):
    intersections = []
    for i in range(len(points_a) - 1):
        a1 = points_a[i]
        a2 = points_a[i + 1]
        for j in range(len(points_b) - 1):
            b1 = points_b[j]
            b2 = points_b[j + 1]
            point = segment_intersection(a1, a2, b1, b2)
            if point is None:
                continue

            duplicate = False
            for existing in intersections:
                if math.hypot(point[0] - existing["point"][0], point[1] - existing["point"][1]) < 6:
                    duplicate = True
                    break
            if duplicate:
                continue

            intersections.append({"point": point, "idx_a": i, "idx_b": j})

    intersections.sort(key=lambda item: item["point"][1])
    return intersections


def find_self_intersections(points):
    intersections = []
    period = len(points) - 1

    for i in range(period):
        a1 = points[i]
        a2 = points[(i + 1) % period]
        for j in range(i + 2, period):
            # Skip adjacent segments and the wraparound neighbor pair.
            if j == i or (j + 1) % period == i or i == (j + 1) % period:
                continue

            b1 = points[j]
            b2 = points[(j + 1) % period]
            point = segment_intersection(a1, a2, b1, b2)
            if point is None:
                continue

            duplicate = False
            for existing in intersections:
                if math.hypot(point[0] - existing["point"][0], point[1] - existing["point"][1]) < 6:
                    duplicate = True
                    break
            if duplicate:
                continue

            intersections.append({"point": point, "idx_a": i, "idx_b": j})

    intersections.sort(key=lambda item: item["point"][1])
    return intersections


def sort_appearances(appearances):
    return sorted(appearances, key=lambda item: item["idx"])


def count_alternation_violations(appearances, assignment_bits):
    if len(appearances) < 2:
        return 0

    hidden_states = [item["hidden_if"][assignment_bits[item["var_id"]]] for item in appearances]
    return sum(
        1
        for prev_hidden, next_hidden in zip(hidden_states, hidden_states[1:])
        if prev_hidden == next_hidden
    )


def solve_crossing_assignment(cross_intersections, left_self_intersections, right_self_intersections):
    variables = []
    left_appearances = []
    right_appearances = []

    for intersection in cross_intersections:
        var_id = len(variables)
        variables.append(("cross", intersection))
        left_appearances.append(
            {"idx": intersection["idx_a"], "var_id": var_id, "hidden_if": (False, True)}
        )
        right_appearances.append(
            {"idx": intersection["idx_b"], "var_id": var_id, "hidden_if": (True, False)}
        )

    for intersection in left_self_intersections:
        var_id = len(variables)
        variables.append(("left_self", intersection))
        left_appearances.append(
            {"idx": intersection["idx_a"], "var_id": var_id, "hidden_if": (True, False)}
        )
        left_appearances.append(
            {"idx": intersection["idx_b"], "var_id": var_id, "hidden_if": (False, True)}
        )

    for intersection in right_self_intersections:
        var_id = len(variables)
        variables.append(("right_self", intersection))
        right_appearances.append(
            {"idx": intersection["idx_a"], "var_id": var_id, "hidden_if": (True, False)}
        )
        right_appearances.append(
            {"idx": intersection["idx_b"], "var_id": var_id, "hidden_if": (False, True)}
        )

    left_appearances = sort_appearances(left_appearances)
    right_appearances = sort_appearances(right_appearances)

    best_assignment = [0] * len(variables)
    best_score = None

    for bits in itertools.product((0, 1), repeat=len(variables)):
        score = (
            count_alternation_violations(left_appearances, bits)
            + count_alternation_violations(right_appearances, bits)
        )
        if best_score is None or score < best_score:
            best_score = score
            best_assignment = bits

    return variables, best_assignment


newPage(w, h)
fill(*BG_COLOR)
rect(0, 0, w, h)

curve_scale_x = inner_w * X_SCALE_RATIO
curve_scale_y = inner_h / 2 - Y_MARGIN
x_offset = inner_w / 2 - curve_scale_x - SIDE_MARGIN

left_cx = cx - x_offset
right_cx = cx + x_offset

left_points = build_lissajous_points(left_cx, cy, curve_scale_x, curve_scale_y, 1, 2, 0, steps=SAMPLE_STEPS)
right_points = build_lissajous_points(right_cx, cy, curve_scale_x, curve_scale_y, 1, 2, 0, steps=SAMPLE_STEPS)
cross_intersections = find_intersections(left_points, right_points)
left_self_intersections = find_self_intersections(left_points)
right_self_intersections = find_self_intersections(right_points)
variables, best_assignment = solve_crossing_assignment(
    cross_intersections,
    left_self_intersections,
    right_self_intersections,
)

left_hidden = []
right_hidden = []

for (kind, intersection), bit in zip(variables, best_assignment):
    if kind == "cross":
        if bit == 0:
            add_hidden_interval(right_hidden, intersection["idx_b"], UNDER_GAP_WINDOW, len(right_points) - 1)
        else:
            add_hidden_interval(left_hidden, intersection["idx_a"], UNDER_GAP_WINDOW, len(left_points) - 1)
    elif kind == "left_self":
        under_idx = intersection["idx_a"] if bit == 0 else intersection["idx_b"]
        add_hidden_interval(left_hidden, under_idx, UNDER_GAP_WINDOW, len(left_points) - 1)
    elif kind == "right_self":
        under_idx = intersection["idx_a"] if bit == 0 else intersection["idx_b"]
        add_hidden_interval(right_hidden, under_idx, UNDER_GAP_WINDOW, len(right_points) - 1)

apply_curve_style("left")
draw_visible_segments(left_points, left_hidden)
apply_curve_style("right")
draw_visible_segments(right_points, right_hidden)
lineDash(None)

# Save
if shouldSave:
    filename = os.path.join(
        EXPORTS,
        "paper-composer-2-technical-report-"
        + currentTime.strftime("%Y%m%d-%H%M%S"),
    )
    saveImage(filename + ".png")
    saveImage(filename + ".svg")
