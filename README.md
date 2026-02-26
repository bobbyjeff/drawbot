# Cursor DrawBot scripts

A collection of [DrawBot](https://www.drawbot.com/) scripts and their exported outputs.

[DrawBot](https://www.drawbot.com/) is a free macOS application for generating two-dimensional graphics through Python scripting. It supports rectangles, ovals, bezier paths, text, and transparency, and can export to PDF, SVG, PNG, JPEG, TIFF, and video formats.

## Structure

```
cursor-drawbot/
├── scripts/       # DrawBot .py scripts
├── exports/       # Generated output files (PDF, PNG, SVG, etc.)
├── images/        # Source images used by scripts
└── data/          # Input data used by scripts
```

## Running Scripts

1. Download [DrawBot](https://www.drawbot.com/) for macOS
2. Duplicate `scripts/_template.py` as a starting point
3. Set `saveFile = True` when ready to export
4. Press **Run** (⌘R) to execute — exports are saved to `exports/` automatically
