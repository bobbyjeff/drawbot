# Artwork for paper "Enterprise Transformation Guide", 2026-01-27
# Progression: Hexagon → Cube → Icosahedron

# Flags
shouldSave = 1
isAnimated = 0  # 0 = still (png/svg), 1 = animation (gif/mp4)

# Animation settings (only used if isAnimated = 1)
num_frames = 12
frame_duration = 1/8

# Imports
import os
import datetime
import math
currentTime = datetime.datetime.now()

ROOT    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORTS = os.path.join(ROOT, "exports")

# Layout settings
stroke_width = 2

# Artboard width is fixed
w = 2400

# Account for stroke width (stroke is centered, so half extends beyond path)
stroke_inset = stroke_width / 2

# Calculate shape_size to fill the width, with stroke perfectly inside
# Available width = w - 2 * stroke_inset
# total_width = 2 * radius * (sqrt(3) + 1)
# So: radius = available_width / (2 * (sqrt(3) + 1))
available_width = w - 2 * stroke_inset
shape_size = available_width / (2 * (math.sqrt(3) + 1))

# Calculate height based on shape size
# 3 shapes diagonal: height = 4 * radius + stroke for top/bottom
offset_x = shape_size * math.sqrt(3)
offset_y = -shape_size
total_height = 4 * shape_size + 2 * stroke_inset

h = int(total_height)

# Colors
bg_color = (0.85, 0.84, 0.82)  # warm gray like reference
fg_color = (0.2, 0.2, 0.2)     # dark gray

# Helper: draw a regular hexagon (pointy top)
def draw_hexagon(cx, cy, radius):
    points = []
    for i in range(6):
        angle = math.radians(60 * i - 90)  # start at top
        px = cx + radius * math.cos(angle)
        py = cy + radius * math.sin(angle)
        points.append((px, py))
    polygon(*points)

# Helper: draw isometric cube (fits in hexagon, pointy top/bottom)
def draw_cube(cx, cy, radius):
    # Cube in isometric view fits in a hexagon
    # The hexagon radius determines the cube size
    angle = math.radians(30)
    
    # Scale so the cube fits within the same hexagon bounding box
    # In isometric, the height from top to bottom vertex = 2 * radius
    size = radius * 0.5
    dx = radius * math.cos(angle)
    dy = radius * math.sin(angle)
    
    # 6 vertices forming hexagonal silhouette
    top = (cx, cy + radius)           # top point
    top_right = (cx + dx, cy + dy)    # upper right
    top_left = (cx - dx, cy + dy)     # upper left
    bottom_right = (cx + dx, cy - dy) # lower right
    bottom_left = (cx - dx, cy - dy)  # lower left
    bottom = (cx, cy - radius)        # bottom point
    
    # Center vertex (front face center)
    center = (cx, cy)
    
    # Draw visible edges of cube
    # Top edges
    line(top, top_right)
    line(top, top_left)
    
    # Side edges
    line(top_right, bottom_right)
    line(top_left, bottom_left)
    
    # Bottom edges
    line(bottom_right, bottom)
    line(bottom_left, bottom)
    
    # Inner edges (the three going to center front vertex)
    line(top_right, center)
    line(top_left, center)
    line(bottom, center)

# Helper: draw icosahedron (2D projection, fits in hexagon, pointy top, front faces only)
def draw_icosahedron(cx, cy, radius):
    phi = (1 + math.sqrt(5)) / 2  # golden ratio
    
    # 3D vertices of icosahedron
    vertices_3d = [
        (0, 1, phi), (0, 1, -phi), (0, -1, phi), (0, -1, -phi),
        (1, phi, 0), (-1, phi, 0), (1, -phi, 0), (-1, -phi, 0),
        (phi, 0, 1), (-phi, 0, 1), (phi, 0, -1), (-phi, 0, -1)
    ]
    
    # 20 triangular faces of icosahedron (vertex indices, counterclockwise from outside)
    faces = [
        (0, 4, 8), (0, 8, 2), (0, 2, 9), (0, 9, 5), (0, 5, 4),
        (1, 5, 11), (1, 11, 3), (1, 3, 10), (1, 10, 4), (1, 4, 5),
        (2, 8, 6), (2, 6, 7), (2, 7, 9),
        (3, 11, 7), (3, 7, 6), (3, 6, 10),
        (4, 10, 8), (5, 9, 11), (6, 8, 10), (7, 11, 9)
    ]
    
    # Isometric projection
    iso_angle = math.radians(30)
    
    def project_3d_to_2d(v):
        x, y, z = v
        px = (x - z) * math.cos(iso_angle)
        py = y + (x + z) * math.sin(iso_angle)
        # Also return z-depth for visibility check
        pz = x + z  # depth in isometric view
        return (px, py, pz)
    
    # Project all vertices
    projected_3d = [project_3d_to_2d(v) for v in vertices_3d]
    projected_2d = [(p[0], p[1]) for p in projected_3d]
    
    # Find the topmost point to calculate rotation needed for pointy-top
    max_y_idx = max(range(len(projected_2d)), key=lambda i: projected_2d[i][1])
    top_point = projected_2d[max_y_idx]
    # Calculate angle to rotate this point to be straight up (90 degrees)
    # Add 180 degrees so central face triangle points up
    current_angle = math.atan2(top_point[1], top_point[0])
    rot_angle = math.radians(90) - current_angle + math.pi
    
    # First rotate, then find the max distance from center to scale properly
    def rotate_point(p):
        px, py = p
        rx = px * math.cos(rot_angle) - py * math.sin(rot_angle)
        ry = px * math.sin(rot_angle) + py * math.cos(rot_angle)
        return (rx, ry)
    
    rotated = [rotate_point(p) for p in projected_2d]
    
    # Find max distance from center (this should match the hexagon radius)
    max_dist = max(math.sqrt(p[0]**2 + p[1]**2) for p in rotated)
    scale = radius / max_dist
    
    # Scale the rotated points and translate to center
    vertices_2d = [(cx + p[0] * scale, cy + p[1] * scale) for p in rotated]
    
    # Determine visible faces (front-facing)
    # A face is visible if its normal points toward the viewer (positive z in our view)
    def cross_product_z(v1, v2):
        """Z component of cross product of 2D vectors (determines winding)"""
        return v1[0] * v2[1] - v1[1] * v2[0]
    
    def is_face_visible(face):
        p0 = vertices_2d[face[0]]
        p1 = vertices_2d[face[1]]
        p2 = vertices_2d[face[2]]
        # Vectors along two edges
        v1 = (p1[0] - p0[0], p1[1] - p0[1])
        v2 = (p2[0] - p0[0], p2[1] - p0[1])
        # Cross product z-component: positive = counterclockwise = facing us
        return cross_product_z(v1, v2) > 0
    
    # Collect edges from visible faces only
    visible_edges = set()
    for face in faces:
        if is_face_visible(face):
            for i in range(3):
                edge = tuple(sorted([face[i], face[(i + 1) % 3]]))
                visible_edges.add(edge)
    
    # Draw visible edges
    for e in visible_edges:
        line(vertices_2d[e[0]], vertices_2d[e[1]])

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
    stroke(*fg_color)
    strokeWidth(stroke_width)
    lineJoin("round")
    lineCap("round")
    fill(None)
    
    # Position shapes isometrically aligned
    # SE vertex of each shape touches NW vertex of next
    # Shapes fill the artboard with stroke perfectly inside
    
    # First shape center: radius + stroke_inset from left edge and top
    start_x = shape_size + stroke_inset
    start_y = h - shape_size - stroke_inset  # top shape
    
    # Hexagon
    draw_hexagon(start_x, start_y, shape_size)
    
    # Cube (offset from hexagon)
    draw_cube(start_x + offset_x, start_y + offset_y, shape_size)
    
    # Icosahedron (offset from cube)
    draw_icosahedron(start_x + 2 * offset_x, start_y + 2 * offset_y, shape_size)

# Save images
if shouldSave:
    filename = os.path.join(EXPORTS, "paper-enterprise-transformation-guide-8-" + currentTime.strftime("%Y%m%d-%H%M%S"))
    if isAnimated:
        saveImage(filename + ".gif")
        saveImage(filename + ".mp4")
    else:
        saveImage(filename + ".png")
        saveImage(filename + ".svg")
