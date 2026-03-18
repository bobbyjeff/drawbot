# Chart for "Securing our codebase with autonomous agents" blog post
# Area chart: EMA α=0.3 smoothed weekly PRs, split by agent review status,
# red top-slice = PRs with vulns (proportional within area). y_max 3k.

# Flags
shouldSave  = 1
show_labels = 1

# Imports
import os
import json
import datetime
from collections import defaultdict

currentTime = datetime.datetime.now()

ROOT    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORTS = os.path.join(ROOT, "exports")
DATA    = os.path.join(ROOT, "data")

# ── Load PR daily data ────────────────────────────────────────────────────────
with open(os.path.join(DATA, "pr_daily_stats.json"), "r") as f:
    raw_daily = json.load(f)

all_dates  = sorted(raw_daily.keys())
all_dates  = [datetime.datetime.strptime(d, "%Y-%m-%d") for d in all_dates]
all_values = [raw_daily[d.strftime("%Y-%m-%d")]["created"] for d in all_dates]

week_map  = defaultdict(int)
day_count = defaultdict(int)
for d, v in zip(all_dates, all_values):
    monday = d - datetime.timedelta(days=d.weekday())
    week_map[monday]  += v
    day_count[monday] += 1

dates  = sorted(k for k in week_map if day_count[k] >= 5)  # allow partial first week
values = [week_map[d] for d in dates]

# ── EMA smoothing ─────────────────────────────────────────────────────────────
def ema(data, alpha):
    result = []
    s = data[0]
    for v in data:
        s = alpha * v + (1 - alpha) * s
        result.append(s)
    return result

smoothed = ema(values, alpha=0.3)

# ── Load security data ────────────────────────────────────────────────────────
with open(os.path.join(DATA, "pr_weekly_security.json"), "r") as f:
    sec = json.load(f)

agent_start = datetime.datetime.strptime(sec["agent_start_date"], "%Y-%m-%d")
sec_weeks   = {datetime.datetime.strptime(k, "%Y-%m-%d"): v
               for k, v in sec["weekly_findings"].items()}

def lookup_security(bucket_start):
    bucket_end = bucket_start + datetime.timedelta(days=7)
    for sw, sv in sec_weeks.items():
        if sw < bucket_end and (sw + datetime.timedelta(days=7)) > bucket_start:
            return sv["prs_with_findings"], sv["findings"]
    return 0, 0

weeks = []
for dt, total, sv in zip(dates, values, smoothed):
    agent_reviewed = dt >= datetime.datetime(2026, 2, 2)  # first week with findings data
    prs_vulns, findings = lookup_security(dt) if agent_reviewed else (0, 0)
    weeks.append({"date": dt, "total": total, "smoothed": sv,
                  "agent_reviewed": agent_reviewed,
                  "prs_vulns": prs_vulns, "findings": findings})

# ── Colours ───────────────────────────────────────────────────────────────────
def rgb(r, g, b): return r/255, g/255, b/255

C_NO_AGENT = rgb(0x6A, 0x9C, 0xD0)
C_AGENT    = rgb(0xF5, 0x4E, 0x00)
C_VULN     = rgb(0xCC, 0x22, 0x00)

# ── Domain ────────────────────────────────────────────────────────────────────
x_date_min    = dates[0]
x_date_max    = dates[-1]
total_seconds = (x_date_max - x_date_min).total_seconds()
y_min         = 0
y_max         = 3000
y_ticks       = [0, 1000, 2000, 3000]

# ── Artboard ──────────────────────────────────────────────────────────────────
w            = 2400
aspect_ratio = 10 / 24
h            = w * aspect_ratio

margin            = 96
x_axis_left_extra = margin * 1.75
margin_left = margin_right = margin_top = margin_bottom = margin
grid_x  = margin_left
grid_w  = w - margin_left - margin_right
chart_x = margin_left + x_axis_left_extra
chart_w = w - margin_left - margin_right - x_axis_left_extra
chart_y = margin_bottom
chart_h = h - margin_top - margin_bottom

def date_to_chart(dt):
    t = (dt - x_date_min).total_seconds() / total_seconds
    return chart_x + t * chart_w

def val_to_chart(v):
    t = (v - y_min) / (y_max - y_min)
    return chart_y + t * chart_h

def fmt(n):
    return f"{n//1000}k" if n >= 1000 else str(n)

def draw_axes():
    fill(0, 0, 0)
    strokeWidth(3)
    for val in y_ticks:
        y = val_to_chart(val)
        if val == 0:
            stroke(0, 0, 0)
            line((grid_x, y), (grid_x + grid_w, y))
        else:
            stroke(0.85, 0.85, 0.85)
            line((grid_x, y), (grid_x + grid_w, y))
    stroke(0, 0, 0)
    tick_length = 10
    cur = datetime.datetime(x_date_min.year, x_date_min.month, 1)
    while cur <= x_date_max:
        x_pos = date_to_chart(cur)
        line((x_pos, chart_y), (x_pos, chart_y - tick_length))
        if cur.month == 12:
            cur = datetime.datetime(cur.year + 1, 1, 1)
        else:
            cur = datetime.datetime(cur.year, cur.month + 1, 1)

def draw_labels():
    if not show_labels:
        return
    stroke(None)
    fill(0, 0, 0)
    font("Helvetica")
    fontSize(28)
    label_gap = 10
    for val in y_ticks:
        y = val_to_chart(val)
        lbl = f"{fmt(val)} weekly PRs created" if val == y_ticks[-1] else fmt(val)
        text(lbl, (grid_x, y + label_gap), align="left")
    major_ticks = []
    cur = datetime.datetime(x_date_min.year, x_date_min.month, 1)
    while cur <= x_date_max:
        if cur.month in (1, 7) or cur == datetime.datetime(x_date_min.year, x_date_min.month, 1):
            major_ticks.append(cur)
        if cur.month == 12:
            cur = datetime.datetime(cur.year + 1, 1, 1)
        else:
            cur = datetime.datetime(cur.year, cur.month + 1, 1)
    for dt in major_ticks:
        if x_date_min <= dt <= x_date_max:
            x_pos = date_to_chart(dt)
            lbl = dt.strftime("%b %Y") if dt.month == 1 else dt.strftime("%b '%y")
            text(lbl, (x_pos, chart_y - 10 - label_gap - 28), align="center")

# ── Area helpers ──────────────────────────────────────────────────────────────
pre   = [(wk, wk["smoothed"]) for wk in weeks if not wk["agent_reviewed"]]
agent = [(wk, wk["smoothed"]) for wk in weeks if     wk["agent_reviewed"]]

last_pre_x = date_to_chart(pre[-1][0]["date"])
first_ag_x = date_to_chart(agent[0][0]["date"])
split_x    = (last_pre_x + first_ag_x) / 2
t_interp   = (split_x - last_pre_x) / (first_ag_x - last_pre_x)
interp_v   = pre[-1][1] + t_interp * (agent[0][1] - pre[-1][1])
interp_y   = val_to_chart(interp_v)

def area_polygon(pairs, bottom_fn=None, cap_right=None, cap_left=None):
    pts_top = [(date_to_chart(wk["date"]), val_to_chart(v)) for wk, v in pairs]
    if bottom_fn:
        pts_bot = [(date_to_chart(wk["date"]), bottom_fn(wk, v)) for wk, v in pairs]
    else:
        pts_bot = [(px, chart_y) for px, _ in pts_top]
    newPath()
    start_x = cap_left[0] if cap_left else pts_top[0][0]
    moveTo((start_x, chart_y))
    if cap_left:
        lineTo((cap_left[0], cap_left[1]))
    for px, py in pts_top:
        lineTo((px, py))
    if cap_right:
        lineTo((cap_right[0], cap_right[1]))
        lineTo((cap_right[0], cap_right[2]))
    else:
        lineTo((pts_top[-1][0], chart_y))
    if bottom_fn:
        for px, py in reversed(pts_bot):
            lineTo((px, py))
        if cap_left:
            lineTo((cap_left[0], cap_left[2]))
    closePath()
    drawPath()

# ── Draw ──────────────────────────────────────────────────────────────────────
newPage(w, h)
draw_axes()

stroke(None)

# Blue: pre-agent
fill(*C_NO_AGENT, 0.25)
area_polygon(pre, cap_right=(split_x, interp_y, chart_y))

# Orange: agent-reviewed
fill(*C_AGENT, 0.2)
area_polygon(agent, cap_left=(split_x, interp_y, chart_y))

# Red: vuln top-slice (proportional to smoothed value)
vuln_pairs = [(wk, wk["smoothed"]) for wk in weeks if wk["agent_reviewed"]]
if vuln_pairs:
    fill(*C_VULN, 0.75)
    def vuln_bottom(wk, v):
        frac = wk["prs_vulns"] / wk["total"] if wk["total"] > 0 else 0
        return val_to_chart(v * (1 - frac))
    area_polygon(vuln_pairs, bottom_fn=vuln_bottom,
                 cap_left=(split_x, interp_y, interp_y))

# Continuous line over all weeks (smoothed values)
fill(None)
strokeWidth(5)
lineJoin("round")
lineCap("round")
stroke(0, 0, 0, 0.45)
newPath()
for i, wk in enumerate(weeks):
    px, py = date_to_chart(wk["date"]), val_to_chart(wk["smoothed"])
    if i == 0: moveTo((px, py))
    else:      lineTo((px, py))
drawPath()

draw_labels()

# ── Save ──────────────────────────────────────────────────────────────────────
if shouldSave:
    ts   = currentTime.strftime("%Y%m%d-%H%M%S")
    base = os.path.join(EXPORTS, f"chart-securing-codebase-area-ema-{ts}")
    saveImage(base + ".png")
    saveImage(base + ".svg")
