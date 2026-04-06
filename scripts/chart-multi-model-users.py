# Chart: multi-model usage across paid plans
# Single-page horizontal bar chart with table-like row separators

# Flags
shouldSave  = 1
show_labels = 1

import os
import csv
import datetime

currentTime = datetime.datetime.now()

ROOT    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORTS = os.path.join(ROOT, "exports")
DATA    = os.path.join(ROOT, "data")


def rgb(r, g, b):
    return r / 255, g / 255, b / 255


DISPLAY_NAMES = {
    "pro": "Casual",
    "pro_plus": "Regular",
    "ultra": "Power",
}

TARGET_TIERS = ["pro", "pro_plus", "ultra"]


def load_entries():
    with open(os.path.join(DATA, "multi-model-users.csv")) as f:
        rows = list(csv.DictReader(f))

    latest_week = max(r["week_start"] for r in rows)
    latest_rows = [r for r in rows if r["week_start"] == latest_week]

    entries = []
    for tier in TARGET_TIERS:
        row = next((r for r in latest_rows if r["membership_tier"] == tier), None)
        if not row:
            continue
        entries.append({
            "tier": tier,
            "label": DISPLAY_NAMES[tier],
            "pct": float(row["pct_wau_using_multiple_families"]),
        })

    return sorted(entries, key=lambda x: x["pct"], reverse=True)


entries = load_entries()

W = 2400
H = W * (11 / 24)

C_TEXT = (0, 0, 0)
C_BAR  = (0, 0, 0)
C_GRID = rgb(0xE0, 0xE0, 0xE0)

X_MIN   = 0
X_MAX   = 100
X_TICKS = [0, 25, 50, 75, 100]


def pct_label(value):
    return f"{value:.1f}%"


def draw_hbar_page():
    margin_left   = 96
    margin_right  = 96
    margin_top    = 96
    margin_bottom = 120

    label_col_w = 520
    pct_col_w   = 180
    label_x     = margin_left
    divider_x   = margin_left + label_col_w
    pct_right_x = divider_x + pct_col_w - 18
    bar_start_x = divider_x + pct_col_w + 24
    bar_end_x   = W - margin_right
    chart_w     = bar_end_x - bar_start_x

    header_h   = 120
    bar_height = 72
    row_gap    = 96
    row_height = bar_height + row_gap
    chart_yb   = margin_bottom
    chart_h    = len(entries) * row_height
    header_rule_y = chart_yb + chart_h + 12
    header_y   = chart_yb + chart_h + 58

    def val_to_px(val):
        return bar_start_x + (val - X_MIN) / (X_MAX - X_MIN) * chart_w

    def row_cy(i):
        return chart_yb + chart_h - (i + 0.5) * row_height

    newPage(W, H)

    if show_labels:
        stroke(None)
        fill(*C_TEXT)
        font("Helvetica")
        fontSize(48)
        text("User type", (label_x, header_y), align="left")
        text(
            "Weekly active users using multiple model families",
            (bar_start_x, header_y),
            align="left",
        )

    stroke(*C_GRID)
    strokeWidth(2)
    line((margin_left, header_rule_y), (bar_end_x, header_rule_y))
    for i in range(1, len(entries)):
        y = chart_yb + i * row_height
        line((margin_left, y), (bar_end_x, y))

    for i, entry in enumerate(entries):
        cy = row_cy(i)
        by = cy - bar_height / 2
        bw = val_to_px(entry["pct"]) - bar_start_x

        stroke(None)
        fill(*C_BAR)
        rect(bar_start_x, by, bw, bar_height)

        if show_labels:
            fill(*C_TEXT)
            font("Helvetica")
            fontSize(48)
            text(entry["label"], (label_x, cy - 12), align="left")

            text(pct_label(entry["pct"]), (pct_right_x, cy - 12), align="right")


# ── Draw ───────────────────────────────────────────────────────────────────────
draw_hbar_page()


# ── Save ───────────────────────────────────────────────────────────────────────
if shouldSave:
    ts = currentTime.strftime("%Y%m%d-%H%M%S")
    base = os.path.join(EXPORTS, f"chart-multi-model-users-{ts}")
    saveImage(base + ".png")
    saveImage(base + ".svg")
