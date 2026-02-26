# Artwork for blog post: sandboxing (v6), 2026-02-17

# Flags
shouldSave = 1
isAnimated = 0  # 0 = still (png/svg), 1 = animation (gif/mp4)
showCornerDiagonals = 0  # 0 = off, 1 = on
numRectangles = 3
curveMargin = 16  # distance from innermost rectangle to Lissajous bounds

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

# Artboard setup
w, h = 2400, 1260
inset = 96  # padding from edges

# Interior bounds (inside the frame)
left, bottom = inset, inset
right, top = w - inset, h - inset

# Draw frames (1 frame for stills, num_frames for animation)
frames_to_render = num_frames if isAnimated else 1

for frame in range(frames_to_render):
    newPage(w, h)
    if isAnimated:
        frameDuration(frame_duration)
    
    # Light background (slightly warm)
    fill(0.98, 0.97, 0.95)
    rect(0, 0, w, h)
    
    # Nested rectangles
    fill(None)
    stroke(0)
    strokeWidth(2)
    lineJoin("round")
    lineCap("round")
    rectSpacing = 24
    innerInset = 0
    for i in range(numRectangles):
        insetAmount = rectSpacing * i
        innerInset = insetAmount
        x0 = left + insetAmount
        y0 = bottom + insetAmount
        rw = (right - left) - insetAmount * 2
        rh = (top - bottom) - insetAmount * 2
        x1 = x0 + rw
        y1 = y0 + rh
        rect(x0, y0, rw, rh)

    # Corner diagonals from outermost to innermost rectangle
    if showCornerDiagonals:
        innerLeft = left + innerInset
        innerBottom = bottom + innerInset
        innerRight = right - innerInset
        innerTop = top - innerInset
        line((left, bottom), (innerLeft, innerBottom))
        line((right, bottom), (innerRight, innerBottom))
        line((left, top), (innerLeft, innerTop))
        line((right, top), (innerRight, innerTop))

    # Lissajous curve inside the innermost rectangle
    curveInset = innerInset + curveMargin
    cx = left + curveInset
    cy = bottom + curveInset
    cw = (right - left) - curveInset * 2
    ch = (top - bottom) - curveInset * 2

    a, b = 5, 3
    delta = math.pi / 2
    numPoints = 900

    path = BezierPath()
    centerX = cx + cw / 2
    centerY = cy + ch / 2
    for i in range(numPoints + 1):
        t = i / numPoints * 2 * math.pi
        baseX = math.sin(a * t + delta)
        baseY = math.sin(b * t)
        # Rotate 90 degrees: (x, y) -> (-y, x)
        rotX = -baseY
        rotY = baseX
        x = centerX + cw / 2 * rotX
        y = centerY + ch / 2 * rotY
        if i == 0:
            path.moveTo((x, y))
        else:
            path.lineTo((x, y))
    path.closePath()

    fill(None)
    stroke(0)
    strokeWidth(2)
    lineDash(16, 10)
    drawPath(path)
    lineDash(None)

# Save images
if shouldSave:
    filename = os.path.join(EXPORTS, "blog-sandboxing-6-" + currentTime.strftime("%Y%m%d-%H%M%S"))
    if isAnimated:
        saveImage(filename + ".gif")
        saveImage(filename + ".mp4")
    else:
        saveImage(filename + ".png")
        saveImage(filename + ".svg")
