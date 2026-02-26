# Artwork template for paper: legacy codebase migrations, 2026-01-24

# Flags
shouldSave = 1
isAnimated = 0  # 0 = still (png/svg), 1 = animation (gif/mp4)

# Animation settings (only used if isAnimated = 1)
num_frames = 12
frame_duration = 1/8

# Imports
import os
import datetime
import random
currentTime = datetime.datetime.now()

ROOT    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORTS = os.path.join(ROOT, "exports")

# Artboard setup: full width, 4/5 aspect ratio at widest (right edge), padding for jitter + warp overflow
w = 2346
base_padding = 96
warp_factor = 2  # used for height calc; must match value in draw loop
right_edge_height = 1 * w  # aspect ratio at widest point
content_height = right_edge_height / warp_factor  # narrow center/left
warp_overflow = int(content_height / 2 * (warp_factor - 1))  # extra for right bulge
h = int(content_height + 2 * (base_padding + warp_overflow))

# Draw frames (1 frame for stills, num_frames for animation)
frames_to_render = num_frames if isAnimated else 1

for frame in range(frames_to_render):
    newPage(w, h)
    if isAnimated:
        frameDuration(frame_duration)
    
    # White background
    fill(1, 1, 1)
    rect(0, 0, w, h)
    
    # --- Your drawing code here ---
    
    # Full width horizontally; padding for jitter + warp overflow
    left_edge = 0
    right_edge = w
    bottom_edge = base_padding + warp_overflow
    top_edge = h - (base_padding + warp_overflow)
    
    # Line settings: black lines on white
    line_spacing = 36  # denser lines
    strokeWidth(4)
    fill(None)
    
    mid_x = w // 2  # 1200
    # warp_factor defined above for height calc; >1 = tighter at edges, looser in middle
    y_mid = (bottom_edge + top_edge) / 2
    
    segment_width = 80
    offset_max_base = line_spacing / 2 - 1  # base clamp for no overlap
    offset_max_scale = 1.2  # >1 allows more variance (may cause slight overlap)
    offset_max = offset_max_base * offset_max_scale
    jitter_intensity = 1.2  # how much of offset_max to use (can exceed 1.0 if offset_max_scale allows)
    jitter_row_variance = 0.33  # line-to-line variance (lower = more consistent)
    jitter_favor_extremes = 0.92  # bias toward max offset (0.85–1.0) for stronger zig-zag
    carry_min, carry_max = 0.92, 1.04  # carry-over range (tighter = less row variance)
    
    # Right half: straight lines warp out to taller height at right edge
    stroke(0, 0, 0, 0.9)
    y = bottom_edge + line_spacing
    while y < top_edge:
        y_right = y_mid + (y - y_mid) * warp_factor  # looser at right
        path = BezierPath()
        path.moveTo((mid_x, y))
        path.lineTo((right_edge, y_right))
        drawPath(path)
        y += line_spacing
    
    # Left half: zig-zaggy lines (50% opacity), skew propagates down with variance
    stroke(0, 0, 0, 0.4)
    seg_xs = list(range(left_edge, mid_x + 1, segment_width))
    if seg_xs[-1] != mid_x:
        seg_xs.append(mid_x)
    num_segments = len(seg_xs)
    
    base_seed = int(currentTime.timestamp() * 1000)  # different pattern each run
    random.seed(base_seed)
    prev_offsets = [0.0] * num_segments
    
    y = bottom_edge + line_spacing
    first_line = True
    while y < top_edge:
        # Left half: no warp, consistent narrow height throughout
        random.seed(base_seed + int(y))
        jitter_add = offset_max * jitter_intensity if first_line else offset_max * jitter_row_variance
        first_line = False
        offsets = []
        for i in range(num_segments):
            if i == num_segments - 1:
                offset = 0  # connect seamlessly at mid_x
            else:
                sign = random.choice([-1, 1])
                rand_add = sign * random.uniform(jitter_add * jitter_favor_extremes, jitter_add)
                offset = prev_offsets[i] * random.uniform(carry_min, carry_max) + rand_add
                offset = max(-offset_max, min(offset_max, offset))
            offsets.append(offset)
        prev_offsets = offsets
        
        path = BezierPath()
        # Draw in reverse order to mirror zig-zag while keeping connection at mid_x
        for i in reversed(range(len(seg_xs))):
            x = seg_xs[i]
            if i == len(seg_xs) - 1:
                path.moveTo((x, y + offsets[i]))
            else:
                path.lineTo((x, y + offsets[i]))
        drawPath(path)
        y += line_spacing

# Save images
if shouldSave:
    filename = os.path.join(EXPORTS, "paper-legacy-codebase-migrations-5-" + currentTime.strftime("%Y%m%d-%H%M%S"))
    if isAnimated:
        saveImage(filename + ".gif")
        saveImage(filename + ".mp4")
    else:
        saveImage(filename + ".png")
        saveImage(filename + ".svg")
