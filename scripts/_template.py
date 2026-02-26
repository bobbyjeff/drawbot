import os

# ── Paths ──────────────────────────────────────────────────────────────────────
ROOT    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORTS = os.path.join(ROOT, "exports")
IMAGES  = os.path.join(ROOT, "images")
DATA    = os.path.join(ROOT, "data")

saveFile = False

# ── Settings ───────────────────────────────────────────────────────────────────
W, H = 2400, 1260  # OG (1200×630 @2x); use 2400, 1350 for 16:9

# ── Draw ───────────────────────────────────────────────────────────────────────
newPage(W, H)



# ── Export ─────────────────────────────────────────────────────────────────────
if saveFile:
    filename = "output.pdf"
    saveImage(os.path.join(EXPORTS, filename))
