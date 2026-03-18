# Different take on secure index grid, 2026-01-26
# Add motion

# Flags
shouldSave = 0
isAnimated = 0  # 0 = still (png/svg), 1 = animation (gif/mp4)
showRandomFill = 1  # 0 = no fill, 1 = fill random cell per panel

# Animation settings (only used if isAnimated = 1)
num_frames = 12
frame_duration = 1/8

# Colors
bg_color = (1, 1, 1)        # white
fg_color = (0, 0, 0)        # black
# accent_color = (245/255, 78/255, 0/255)  # #F54E00
accent_color = (0, 0, 0, 0.5)   # black at 50% opacity

# Imports
import os
import datetime
import random
currentTime = datetime.datetime.now()

ROOT    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORTS = os.path.join(ROOT, "exports")

# Artboard setup
w, h = 2400, 1260

# Settings
inset = 96
stroke_width = 1.5
num_panels = 10
panel_gap = 48

# Grid settings per panel
grid_cols = 14
grid_rows = 10

# Perspective settings
inner_height_inset = 280  # all inner edges have same compression (larger = shorter inner edge)

# Available width for all panels
available_width = w - (2 * inset) - ((num_panels - 1) * panel_gap)

# Panel width ratio (outer vs inner)
width_ratio = 8.0  # outer panels are 8x wider than inner panels

panel_height = h - (2 * inset)

def get_cell_corners(bl, tl, br, tr, col, row):
    """Get the 4 corners of a specific grid cell."""
    # Interpolation factors
    t_left = col / grid_cols
    t_right = (col + 1) / grid_cols
    t_bottom = row / grid_rows
    t_top = (row + 1) / grid_rows
    
    # Bottom edge points
    b_left = (bl[0] + t_left * (br[0] - bl[0]), bl[1] + t_left * (br[1] - bl[1]))
    b_right = (bl[0] + t_right * (br[0] - bl[0]), bl[1] + t_right * (br[1] - bl[1]))
    
    # Top edge points
    t_left_pt = (tl[0] + t_left * (tr[0] - tl[0]), tl[1] + t_left * (tr[1] - tl[1]))
    t_right_pt = (tl[0] + t_right * (tr[0] - tl[0]), tl[1] + t_right * (tr[1] - tl[1]))
    
    # Interpolate vertically for each column
    cell_bl = (b_left[0] + t_bottom * (t_left_pt[0] - b_left[0]), 
               b_left[1] + t_bottom * (t_left_pt[1] - b_left[1]))
    cell_tl = (b_left[0] + t_top * (t_left_pt[0] - b_left[0]), 
               b_left[1] + t_top * (t_left_pt[1] - b_left[1]))
    cell_br = (b_right[0] + t_bottom * (t_right_pt[0] - b_right[0]), 
               b_right[1] + t_bottom * (t_right_pt[1] - b_right[1]))
    cell_tr = (b_right[0] + t_top * (t_right_pt[0] - b_right[0]), 
               b_right[1] + t_top * (t_right_pt[1] - b_right[1]))
    
    return cell_bl, cell_tl, cell_br, cell_tr

def draw_panel(bl, tl, br, tr):
    """Draw a trapezoidal panel with grid."""
    # First: fill one random cell (so grid lines draw on top)
    if showRandomFill:
        rand_col = random.randint(0, grid_cols - 1)
        rand_row = random.randint(0, grid_rows - 1)
        cell_bl, cell_tl, cell_br, cell_tr = get_cell_corners(bl, tl, br, tr, rand_col, rand_row)
        
        fill(*accent_color)
        stroke(None)
        polygon(cell_bl, cell_br, cell_tr, cell_tl)
        
        # Restore stroke for grid
        stroke(*fg_color)
        strokeWidth(stroke_width)
        fill(None)
    
    # Draw outline
    line(bl, tl)
    line(tl, tr)
    line(tr, br)
    line(br, bl)
    
    # Draw vertical grid lines
    for i in range(1, grid_cols):
        t = i / grid_cols
        bx = bl[0] + t * (br[0] - bl[0])
        by = bl[1] + t * (br[1] - bl[1])
        tx = tl[0] + t * (tr[0] - tl[0])
        ty = tl[1] + t * (tr[1] - tl[1])
        line((bx, by), (tx, ty))
    
    # Draw horizontal grid lines
    for j in range(1, grid_rows):
        t = j / grid_rows
        lx = bl[0] + t * (tl[0] - bl[0])
        ly = bl[1] + t * (tl[1] - bl[1])
        rx = br[0] + t * (tr[0] - br[0])
        ry = br[1] + t * (tr[1] - br[1])
        line((lx, ly), (rx, ry))

# Calculate panel widths (exponential interpolation between outer and inner)
def get_relative_width(i):
    """Get relative width factor for panel i. Outer=width_ratio, inner=1.0"""
    center = (num_panels - 1) / 2
    distance_from_center = abs(i - center)
    max_distance = center
    # t: 0 = center, 1 = outer
    t = distance_from_center / max_distance
    # Golden ratio exponent for aesthetic curve
    t_curved = t ** 1
    return 1.0 + t_curved * (width_ratio - 1.0)

# Calculate relative widths and scale to fit available width
relative_widths = [get_relative_width(i) for i in range(num_panels)]
total_relative = sum(relative_widths)
panel_widths = [(rw / total_relative) * available_width for rw in relative_widths]

# Start at left inset
start_x = inset

# Draw frames (1 frame for stills, num_frames for animation)
frames_to_render = num_frames if isAnimated else 1

for frame in range(frames_to_render):
    newPage(w, h)
    if isAnimated:
        frameDuration(frame_duration)
    
    # Background
    fill(*bg_color)
    rect(0, 0, w, h)
    
    # Reset stroke style
    stroke(*fg_color)
    strokeWidth(stroke_width)
    lineJoin("round")  # prevent spiky miter joins on sharp angles
    lineCap("round")   # round the ends of lines
    fill(None)
    
    # Draw all panels
    x_cursor = start_x
    for i in range(num_panels):
        panel_width = panel_widths[i]
        x_left = x_cursor
        x_right = x_cursor + panel_width
        
        # All inner edges have the same height (same compression)
        # Left half panels (0, 1, 2): left edge full, right edge compressed
        # Right half panels (3, 4, 5): right edge full, left edge compressed
        if i < num_panels / 2:
            # Left side - right edge is inner (compressed)
            bl = (x_left, inset)
            tl = (x_left, inset + panel_height)
            br = (x_right, inset + inner_height_inset)
            tr = (x_right, inset + panel_height - inner_height_inset)
        else:
            # Right side - left edge is inner (compressed)
            bl = (x_left, inset + inner_height_inset)
            tl = (x_left, inset + panel_height - inner_height_inset)
            br = (x_right, inset)
            tr = (x_right, inset + panel_height)
        
        draw_panel(bl, tl, br, tr)
        x_cursor = x_right + panel_gap

# Save images
if shouldSave:
    filename = os.path.join(EXPORTS, "blog-secure-index-6-" + currentTime.strftime("%Y%m%d-%H%M%S"))
    if isAnimated:
        saveImage(filename + ".gif")
        saveImage(filename + ".mp4")
    else:
        saveImage(filename + ".png")
        saveImage(filename + ".svg")
