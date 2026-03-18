# Cursor DrawBot scripts

A collection of [DrawBot](https://www.drawbot.com/) scripts and their exported outputs.

[DrawBot](https://www.drawbot.com/) is a free macOS application for generating two-dimensional graphics through Python scripting. It supports rectangles, ovals, bezier paths, text, and transparency, and can export to PDF, SVG, PNG, JPEG, TIFF, and video formats. You can check out [this website](https://dailydrawbot.tumblr.com/) for some inspiration.

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

## Examples

### Graphics

Use DrawBot scripts to generate Cursor header images and graphics for blogs, 
documents, and more.

![Self-driving codebases blog header image](https://github.com/user-attachments/assets/550f2463-9c5a-4835-a20b-d0daae1fa27c)

![Cursor ASCII](https://github.com/user-attachments/assets/6d5d84ed-9352-44f0-bab7-a5cbc2b33ff8)

DrawBot even supports exporting to animated GIFs and MP4 videos.

![Secure indexes blog multiple artboards](https://github.com/user-attachments/assets/12171314-eb5b-421e-86f1-e74657bdf512)

![Secure indexes blog GIF](https://github.com/user-attachments/assets/6c519f6f-b06d-4e82-ab2b-4945f889dfc3)

### Charts

Read data and generate complex charts and diagrams, export to SVG, and finalize in Figma.

![Cloud agents chart in DrawBot](https://github.com/user-attachments/assets/ef7d7b56-c757-4d88-b02b-301d5fc977b1)

![Cloud agents chart final](https://github.com/user-attachments/assets/1a8f33c7-334a-4ae7-9d1a-6b82a7673767)

## Using Cursor

Open this folder in [Cursor](https://www.cursor.com/) and use Agent to create and iterate on scripts directly. Some things to try:

- "Create a new script based on `_template.py` that draws …"
- "Iterate on this script to change the color scheme / layout / animation"
- "The export looks like [description] — adjust the script to fix it"

Agent can read existing scripts for context, write new ones, and update the `saveFile` flag to trigger exports.
