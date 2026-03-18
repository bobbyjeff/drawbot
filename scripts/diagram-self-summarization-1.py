# Diagram for self-summarization blog post
# Iterative process: Request → Agent → (if over trigger) Summary Prompt → Self Summary → next iteration

# Flags
shouldSave = 1

# Imports
import os
import math
import datetime

currentTime = datetime.datetime.now()

ROOT    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORTS = os.path.join(ROOT, "exports")
DATA    = os.path.join(ROOT, "data")

def rgb(r, g, b): return r/255, g/255, b/255

# ── Colours ─────────────────────────────────────────────────────────────────
C_BG            = rgb(0xFA, 0xFA, 0xFA)
C_AGENT         = rgb(0x1E, 0x55, 0x63)   # reward-trained
C_SELF_SUMMARY  = rgb(0x1E, 0x55, 0x63)   # reward-trained
C_SUMMARY_PROMPT= rgb(0xF5, 0x4E, 0x00)   # orange
C_REQUEST       = rgb(0x94, 0x9C, 0xA8)   # gray
C_STATE_INPUT   = rgb(0x94, 0x9C, 0xA8)   # gray
C_STROKE        = rgb(0xE5, 0xE7, 0xEB)
C_TRIGGER       = rgb(0x6B, 0x72, 0x80)
C_HARD_CAP      = rgb(0x37, 0x41, 0x51)

# ── Artboard ─────────────────────────────────────────────────────────────────
w, h = 2400, 1260
inset = 96

# Column layout: 96 + small_gap + w + 3/4w + w + 3/4w + w + large_gap + 96
# large_gap holds Trigger and Hard cap labels
small_gap = 48
large_gap = 280
block_w = int((w - 2 * inset - small_gap - large_gap) / 4.5)
gap_between_cols = int(block_w * 0.75)
col_cx = [
    inset + small_gap + block_w / 2,
    inset + small_gap + block_w + gap_between_cols + block_w / 2,
    inset + small_gap + 2 * block_w + 2 * gap_between_cols + block_w / 2,
]
# Right edge of blocks (where large_gap starts)
blocks_right = inset + small_gap + 3 * block_w + 2 * gap_between_cols

# Vertical zones — all columns start at top inset 96
hard_cap_y = 120
hard_cap_clearance = 80
trigger_y = h / 3
content_top = h - inset   # top of content area at y = h - 96

# Block dimensions (prescribed heights)
gap = 24
# Column 1
block_h_request = 162
block_h_agent_1 = 576
block_h_summary_prompt = 72
block_h_ss1 = 108
# Column 2
block_h_ss1_state = 108
block_h_agent_2 = 612
block_h_ss2 = 144
# Column 3
block_h_ss2_state = 144
block_h_agent_3 = 288

newPage(w, h)
fill(*C_BG)
rect(0, 0, w, h)

stroke(None)
lineJoin("round")
lineCap("round")

# ── Helpers ──────────────────────────────────────────────────────────────────
FONT_SIZE = 48

def draw_block(x_center, y_bottom, bw, block_h, color, label, text_color=(1, 1, 1)):
    x = x_center - bw / 2
    fill(*color)
    stroke(*C_STROKE)
    strokeWidth(2)
    rect(x, y_bottom, bw, block_h)
    stroke(None)
    fill(*text_color)
    font("Helvetica")
    fontSize(FONT_SIZE)
    textBox(label, (x + 12, y_bottom + 12, bw - 24, block_h - 24), align="center")

def draw_summary_prompt_block(x_center, y_bottom, bw, block_h, label):
    """Summary prompt block."""
    x = x_center - bw / 2
    fill(*C_SUMMARY_PROMPT)
    stroke(*C_STROKE)
    strokeWidth(2)
    rect(x, y_bottom, bw, block_h)
    stroke(None)
    fill(1, 1, 1)
    font("Helvetica")
    fontSize(36 if block_h <= 72 else FONT_SIZE)
    textBox(label, (x + 12, y_bottom + 12, bw - 24, block_h - 24), align="center")

def draw_arrow(x1, y1, x2, y2, color=None):
    if color is None:
        color = (0.5, 0.5, 0.5)
    stroke(*color)
    strokeWidth(2)
    line((x1, y1), (x2, y2))

def draw_orthogonal_path(x1, y1, x2, y2, color=None):
    """Right, up, right — stroke only, no fill."""
    if color is None:
        color = (0.5, 0.5, 0.5)
    x_mid = (x1 + x2) / 2
    fill(None)
    stroke(*color)
    strokeWidth(3)
    line((x1, y1), (x_mid, y1))
    line((x_mid, y1), (x_mid, y2))
    line((x_mid, y2), (x2, y2))

# ── Iteration 1 ──────────────────────────────────────────────────────────────
x1 = col_cx[0]

# Compute layout — all 3 columns start at content_top (h - 96)
req_y = content_top - block_h_request
agent1_bottom = req_y - gap - block_h_agent_1
sp1_y = agent1_bottom - gap - block_h_summary_prompt
ss1_y = sp1_y - gap - block_h_ss1
ss1s_y = content_top - block_h_ss1_state
agent2_bottom = ss1s_y - gap - block_h_agent_2
sp2_y = agent2_bottom - gap - block_h_summary_prompt
ss2_y = sp2_y - gap - block_h_ss2
ss2s_y = content_top - block_h_ss2_state
agent3_bottom = ss2s_y - gap - block_h_agent_3
content_floor = hard_cap_y + hard_cap_clearance
shift_up = max(0, content_floor - min(ss2_y, agent3_bottom))
req_y += shift_up
agent1_bottom += shift_up
sp1_y += shift_up
ss1_y += shift_up
ss1s_y += shift_up
ss2s_y += shift_up
agent2_bottom += shift_up
sp2_y += shift_up
ss2_y += shift_up
agent3_bottom += shift_up

# User request
draw_block(x1, req_y, block_w, block_h_request, C_REQUEST, "User request", (0, 0, 0))

# Agent
draw_block(x1, agent1_bottom, block_w, block_h_agent_1, C_AGENT, "Agent")

draw_arrow(x1, req_y, x1, agent1_bottom + block_h_agent_1)

# Summary prompt
draw_summary_prompt_block(x1, sp1_y, block_w, block_h_summary_prompt, "Summary prompt")

# Self-summary 1
draw_block(x1, ss1_y, block_w, block_h_ss1, C_SELF_SUMMARY, "Self-summary 1")

draw_arrow(x1, agent1_bottom, x1, sp1_y + block_h_summary_prompt)
draw_arrow(x1, sp1_y, x1, ss1_y + block_h_ss1)

# ── Iteration 2 ──────────────────────────────────────────────────────────────
x2 = col_cx[1]

draw_block(x2, ss1s_y, block_w, block_h_ss1_state, C_STATE_INPUT, "Self-summary 1\n+ state", (0, 0, 0))

draw_orthogonal_path(x1 + block_w/2 + 30, ss1_y + block_h_ss1/2, x2 - block_w/2 - 30, ss1s_y + block_h_ss1_state/2)

draw_block(x2, agent2_bottom, block_w, block_h_agent_2, C_AGENT, "Agent")

draw_arrow(x2, ss1s_y, x2, agent2_bottom + block_h_agent_2)

draw_summary_prompt_block(x2, sp2_y, block_w, block_h_summary_prompt, "Summary prompt")

draw_block(x2, ss2_y, block_w, block_h_ss2, C_SELF_SUMMARY, "Self-summary 2")

draw_arrow(x2, agent2_bottom, x2, sp2_y + block_h_summary_prompt)
draw_arrow(x2, sp2_y, x2, ss2_y + block_h_ss2)

# ── Iteration 3 ──────────────────────────────────────────────────────────────
x3 = col_cx[2]

draw_block(x3, ss2s_y, block_w, block_h_ss2_state, C_STATE_INPUT, "Self-summary 2\n+ state", (0, 0, 0))

draw_orthogonal_path(x2 + block_w/2 + 30, ss2_y + block_h_ss2/2, x3 - block_w/2 - 30, ss2s_y + block_h_ss2_state/2)

draw_block(x3, agent3_bottom, block_w, block_h_agent_3, C_AGENT, "Agent")

draw_arrow(x3, ss2s_y, x3, agent3_bottom + block_h_agent_3)

# ── Horizontal lines (full inset) ───────────────────────────────────────────
stroke(*C_TRIGGER)
strokeWidth(2)
lineDash(8, 6)
line((inset, trigger_y), (w - inset, trigger_y))
lineDash(None)

stroke(*C_HARD_CAP)
strokeWidth(3)
line((inset, hard_cap_y), (w - inset, hard_cap_y))

# Trigger and Hard cap labels on top of (above) the lines
label_offset = 24
fill(*C_TRIGGER)
font("Helvetica")
fontSize(FONT_SIZE)
text("Trigger", (inset + 8, trigger_y + label_offset), align="left")
fill(*C_HARD_CAP)
text("Hard cap", (inset + 8, hard_cap_y + label_offset), align="left")

# ── Legend ──────────────────────────────────────────────────────────────────
legend_x = w - inset - 280
legend_y = hard_cap_y + 40
legend_r = 14
fill(*C_AGENT)
oval(legend_x, legend_y, legend_r * 2, legend_r * 2)
fill(0, 0, 0)
fontSize(FONT_SIZE)
text("Trained as reward", (legend_x + legend_r * 2 + 16, legend_y + legend_r - FONT_SIZE/3), align="left")

# ── Save ────────────────────────────────────────────────────────────────────
if shouldSave:
    ts = currentTime.strftime("%Y%m%d-%H%M%S")
    base = os.path.join(EXPORTS, f"diagram-self-summarization-1-{ts}")
    saveImage(base + ".png")
    saveImage(base + ".svg")
