# Chart for self-summarization blog post
# Two rows (80k, 40k context), x = CursorBench Hard score, dots = self-summarization vs standard compaction.

# Flags
shouldSave  = 1
show_labels = 1

# Imports
import os
import csv
import datetime

currentTime = datetime.datetime.now()

ROOT    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORTS = os.path.join(ROOT, "exports")
DATA    = os.path.join(ROOT, "data")

# ── Load data ─────────────────────────────────────────────────────────────────
with open(os.path.join(DATA, "self-summarization.csv")) as f:
    rows = list(csv.DictReader(f))

bars = []
baseline = None
for r in rows:
    method = r.get("method", "").strip()
    try:
        hard_score = float(r["hard_score"])
        delta = float(r["delta_vs_self_summary_baseline_percent"])
    except (ValueError, TypeError):
        continue
    tokens = r.get("summary_tokens_group_value", "").strip()
    tokens = int(tokens) if tokens else None

    if "baseline" in method.lower():
        baseline = {"method": "Full context", "hard_score": hard_score, "delta": delta, "summary_tokens": None, "is_baseline": True}
        continue
    bars.append({
        "method": method,
        "delta": delta,
        "hard_score": hard_score,
        "summary_tokens": tokens,
        "is_self_summary": method.startswith("y "),
        "is_baseline": False,
        "context": "80k" if "80000" in method else "40k",
    })

for bar in bars:
    if bar["summary_tokens"] is None:
        same = [b for b in bars if b["is_self_summary"] == bar["is_self_summary"]]
        for b in same:
            if b["summary_tokens"] is not None:
                bar["summary_tokens"] = b["summary_tokens"]
                break

# ── Colours ───────────────────────────────────────────────────────────────────
def rgb(r, g, b): return r/255, g/255, b/255

C_BASELINE     = rgb(0x6B, 0x72, 0x80)   # slate — full context
C_SELF_SUMMARY = rgb(0x3B, 0x82, 0xF6)
C_BASIC        = rgb(0xF5, 0x73, 0x00)
# ── Artboard ──────────────────────────────────────────────────────────────────
w            = 2400
aspect_ratio = 10 / 16
h            = w * aspect_ratio

margin_left   = 96
margin_right  = 96
margin_top    = 120
margin_bottom = 140
left_label_w  = 528   # padding for "CursorBench Hard 80k" / "CursorBench Hard 40k"

chart_x = margin_left + left_label_w
chart_y = margin_top
chart_w = w - margin_left - left_label_w - margin_right - 80  # -80 for gray rect extension
chart_h = h - margin_top - margin_bottom

# ── Two rows (80k, 40k), x = CursorBench Hard score, dots = methods ───────────
def draw_page6():
    newPage(w, h)
    rows_data = [
        ("CursorBench Hard 80k", [b for b in bars if b["context"] == "80k"]),
        ("CursorBench Hard 40k", [b for b in bars if b["context"] == "40k"]),
    ]
    x_min, x_max = 44, 49
    dot_r = 24
    strip_h = dot_r * 2  # gray rect height = circle diameter
    axis_h = 50
    row_gap = 160

    def x_to_px(val):
        return chart_x + (val - x_min) / (x_max - x_min) * chart_w

    # Row positions: [0]=80k (top), [1]=40k (bottom)
    row_bottoms = [
        chart_y + axis_h + strip_h + row_gap + axis_h,  # 80k
        chart_y + axis_h,                                # 40k
    ]

    for i, (row_label, row_bars) in enumerate(rows_data):
        rect_bottom = row_bottoms[i]
        rect_top = rect_bottom + strip_h
        row_y = rect_bottom + dot_r

        # Gray rectangle (same thickness as circle diameter), extends 80px right
        fill(0.92, 0.92, 0.92)
        stroke(None)
        rect(chart_x, rect_bottom, chart_w + 80, strip_h)

        # Vertical gridlines for this row only
        stroke(0.88, 0.88, 0.88)
        strokeWidth(1)
        for xv in [45, 46, 47, 48]:
            px = x_to_px(xv)
            line((px, rect_bottom), (px, rect_top))

        # X-axis ticks only (no line)
        stroke(0, 0, 0)
        strokeWidth(2)
        tick_len = 8
        for xv in [45, 46, 47, 48]:
            px = x_to_px(xv)
            line((px, rect_bottom), (px, rect_bottom - tick_len))

        # Axis labels
        if show_labels:
            stroke(None)
            fill(0, 0, 0)
            font("Helvetica")
            fontSize(26)
            for xv in [45, 46, 47, 48]:
                px = x_to_px(xv)
                text(f"{xv}", (px, rect_bottom - tick_len - 24), align="center")
            text(row_label, (chart_x - 16, row_y), align="right")

        # Baseline reference (vertical dashed line for this row)
        if baseline:
            bx = x_to_px(baseline["hard_score"])
            stroke(*C_BASELINE)
            strokeWidth(2)
            lineDash(6, 4)
            line((bx, rect_bottom), (bx, rect_top))
            lineDash(None)
            if show_labels and i == 0:
                stroke(None)
                fill(*C_BASELINE)
                font("Helvetica")
                fontSize(24)
                text(f"{baseline['hard_score']:.1f}", (bx, rect_top + 6), align="center")

        # Dots and inline score labels
        for bar in row_bars:
            px = x_to_px(bar["hard_score"])
            color = C_SELF_SUMMARY if bar["is_self_summary"] else C_BASIC
            fill(*color)
            stroke(1, 1, 1)
            strokeWidth(2)
            oval(px - dot_r, row_y - dot_r, dot_r * 2, dot_r * 2)
            if show_labels:
                stroke(None)
                fill(0, 0, 0)
                font("Helvetica")
                fontSize(24)
                text(f"{bar['hard_score']:.1f}", (px, row_y + dot_r + 6), align="center")

    if show_labels:
        stroke(None)
        fill(0, 0, 0)
        font("Helvetica")
        fontSize(36)
        text("CursorBench Hard score by context and compaction method", (chart_x + chart_w / 2, chart_y + chart_h + 50), align="center")
        # Legend
        fill(*C_SELF_SUMMARY)
        rect(chart_x + chart_w - 200, chart_y + chart_h - 50, 24, 24)
        fill(0, 0, 0)
        text("Self-summarization", (chart_x + chart_w - 168, chart_y + chart_h - 38), align="left")
        fill(*C_BASIC)
        rect(chart_x + chart_w - 200, chart_y + chart_h - 90, 24, 24)
        fill(0, 0, 0)
        text("Standard compaction", (chart_x + chart_w - 168, chart_y + chart_h - 78), align="left")
        if baseline:
            fill(*C_BASELINE)
            rect(chart_x + chart_w - 200, chart_y + chart_h - 130, 24, 24)
            fill(0, 0, 0)
            text("Full context (ref)", (chart_x + chart_w - 168, chart_y + chart_h - 118), align="left")

# ── Draw ──────────────────────────────────────────────────────────────────────
draw_page6()

# ── Save ──────────────────────────────────────────────────────────────────────
if shouldSave:
    ts   = currentTime.strftime("%Y%m%d-%H%M%S")
    base = os.path.join(EXPORTS, f"chart-self-summarization-bars-{ts}")
    saveImage(base + ".png")
    saveImage(base + ".svg")
