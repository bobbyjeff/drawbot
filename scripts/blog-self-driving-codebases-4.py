# Artwork for blog post "Self-Driving Codebases" (v3), 2026-01-19
# Lissajous curve (infinity symbol) with motion effect

# Flags
shouldSave = 1
isAnimated = 0  # 0 = still (png/svg), 1 = animation (gif/mp4)

# Animation settings (only used if isAnimated = 1)
num_frames = 60
frame_duration = 1/30

# Imports
import os
import datetime
import math
currentTime = datetime.datetime.now()

ROOT    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORTS = os.path.join(ROOT, "exports")

# Artboard setup
w, h = 2400, 1260

# Layout settings
inset = 96

# Lissajous settings
num_curves = 13  # number of curves at different scales
max_amplitude_x = (w - 2 * inset) / 2  # max horizontal amplitude (fits within inset)
max_amplitude_y = (h - 2 * inset) / 2  # max vertical amplitude (fits within inset)
freq_a = 1  # frequency for x
freq_b = 2  # frequency for y (2 creates horizontal figure-8)
phase_offset = 0 #math.pi / 4  # phase shift (0 to 2*pi) - rotates/skews the curve
stroke_width = 2

# Opacity settings (outer curve = max, inner curve = min)
max_opacity = 1.0  # opacity of outermost curve
min_opacity = 0.3  # opacity of innermost curve

# Colors
bg_color = (0.15, 0.15, 0.15)  # dark gray
fg_color = (1, 1, 1)  # white

# Center of canvas
cx = w / 2
cy = h / 2

def draw_lissajous(center_x, center_y, amp_x, amp_y, a, b, phase, steps=5000):
    """Draw a Lissajous curve"""
    path = BezierPath()
    for i in range(steps + 1):
        t = (i / steps) * 2 * math.pi
        x = center_x + amp_x * math.sin(a * t + phase)
        y = center_y + amp_y * math.sin(b * t)
        if i == 0:
            path.moveTo((x, y))
        else:
            path.lineTo((x, y))
    path.closePath()
    drawPath(path)

# Draw frames
frames_to_render = num_frames if isAnimated else 1

for frame in range(frames_to_render):
    newPage(w, h)
    if isAnimated:
        frameDuration(frame_duration)
    
    # Background
    fill(*bg_color)
    rect(0, 0, w, h)
    
    # Set up stroke
    fill(None)
    strokeWidth(stroke_width)
    lineCap("round")
    lineJoin("round")
    
    # Draw multiple curves scaling X only (creates rotation/turning effect)
    min_scale_x = 0.0  # 0 = vertical line, 1 = full width
    for i in range(num_curves):
        # Scale X from min to max, Y stays constant
        t = i / (num_curves - 1) if num_curves > 1 else 1
        scale_x = min_scale_x + (1 - min_scale_x) * t
        amp_x = max_amplitude_x * scale_x
        amp_y = max_amplitude_y  # Y stays constant
        
        # Opacity fades from min (inner) to max (outer)
        opacity = min_opacity + (max_opacity - min_opacity) * t
        stroke(*fg_color, opacity)
        draw_lissajous(cx, cy, amp_x, amp_y, freq_a, freq_b, phase=phase_offset)

# Save images
if shouldSave:
    filename = os.path.join(EXPORTS, "blog-self-driving-codebases-4-" + currentTime.strftime("%Y%m%d-%H%M%S"))
    if isAnimated:
        saveImage(filename + ".gif")
        saveImage(filename + ".mp4")
    else:
        saveImage(filename + ".png")
        saveImage(filename + ".svg")
