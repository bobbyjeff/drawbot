# Image to ASCII for Cursor bus stop ad, 2026-01-22
# Fork of cursor-ad-4.py
# - 2D shape
# - themes
# - better filler distribution
# - add padding around shape
# - add small "Cursor works anywhere." text inside

# Flags
shouldSave    = 1
normalizeGray = 1
showTagline   = 0  # show "Cursor works everywhere." text inside

# Theme selection: "cursor_dark", "cursor_dark_hc", "cursor_light"
theme = "cursor_dark_hc"

# Theme definitions
themes = {
    "cursor_dark": {
        "isDark": True,
        "base_color": (1, 1, 1),
        "secondary_color": (170/255, 170/255, 170/255),  # #AAAAAA
        "colors": [
            (212/255, 212/255, 212/255),  # #D4D4D4
            (227/255, 148/255, 220/255),  # #E394DC
            (135/255, 195/255, 255/255),  # #87C3FF
            (218/255, 112/255, 214/255),  # #DA70D6
            (131/255, 210/255, 205/255),  # #83D2CD
            (170/255, 160/255, 250/255),  # #AAA0FA
            (99/255, 99/255, 99/255),     # #636363
            (255/255, 216/255, 0/255),    # #FFD800
            (238/255, 176/255, 127/255),  # #EEB07F
            (236/255, 201/255, 141/255)   # #ECC98D
        ]
    },
    "cursor_dark_hc": {
        "isDark": True,
        "base_color": (1, 1, 1),
        "secondary_color": (170/255, 170/255, 170/255),  # #AAAAAA
        "colors": [
            (216/255, 222/255, 233/255),  # #D8DEE9
            (98/255, 98/255, 98/255),     # #626262
            (255/255, 216/255, 0/255),    # #FFD800
            (227/255, 148/255, 220/255),  # #E394DC
            (131/255, 214/255, 198/255),  # #83D6C6
            (171/255, 161/255, 250/255),  # #ABA1FA
            (236/255, 201/255, 141/255),  # #ECC98D
            (218/255, 112/255, 214/255),  # #DA70D6
            (240/255, 176/255, 128/255),  # #F0B080
            (148/255, 193/255, 250/255)   # #94C1FA
        ]
    },
    "cursor_light": {
        "isDark": False,
        "base_color": (38/255, 38/255, 38/255),  # #262626
        "secondary_color": (149/255, 149/255, 149/255),  # #959595
        "colors": [
            (95/255, 73/255, 179/255),    # #5F49B3
            (179/255, 1/255, 63/255),     # #B3013F
            (33/255, 101/255, 149/255),   # #216595
            (219/255, 112/255, 75/255),   # #DB704B
            (158/255, 148/255, 213/255),  # #9E94D5
            (183/255, 68/255, 139/255),   # #B7448B
            (5/255, 81/255, 128/255),     # #055180
            (112/255, 155/255, 167/255),  # #709BA7
            (38/255, 38/255, 38/255),     # #262626
            (94/255, 94/255, 94/255)      # #5E5E5E
        ]
    }
}

# Apply theme
isDark = themes[theme]["isDark"]
colors = themes[theme]["colors"]
base_color = themes[theme]["base_color"]
secondary_color = themes[theme]["secondary_color"]

# Imports
import os
import datetime
import random
currentTime = datetime.datetime.now()

ROOT    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORTS = os.path.join(ROOT, "exports")
IMAGES  = os.path.join(ROOT, "images")

# Images
path = os.path.join(IMAGES, "APP_ICON_25D_DARK.png")
path = os.path.join(IMAGES, "APP_ICON_3D_LIGHT.png")
path = os.path.join(IMAGES, "APP_ICON_3D_DARK.png")
path = os.path.join(IMAGES, "APP_ICON_2D_LIGHT.png")
path = os.path.join(IMAGES, "APP_ICON_2D_DARK.png")

# Define names list
names = ["Sualeh", "Michael", "Aman", "Rishabh", "Ian", "Phillip", "Fausto", "Baltazar", "Federico", "Luke", "Aman", "Zack", "Jordan", "Oskar", "Jacob", "Vicent", "Michael", "Lukas", "Eric", "Lujing", "Dan", "Ravi", "Roman", "Henry", "Jonathan", "Adam", "Pavan", "Nicholas", "Bennett", "Ryo", "Jeremy", "Grace", "Dylan", "Stefan", "Alexander", "Connor", "Yuchen", "Emily", "Alex", "David", "Lee", "Yash", "Max", "Jon", "Tomer", "Charlie", "Shomil", "Jon", "Tahirih", "Kash", "Matt", "Rikki", "Shengtong", "Taylor", "Jediah", "Rachel", "Emma", "Justin", "Rohan", "Yury", "Eric", "Robbie", "Ricky", "Ali", "Michael", "Ben", "Marisa", "George", "Samantha", "Daniel", "Sujay", "Rachel", "Isaac", "Vibhav", "Leo", "Yurii", "Tony", "Kody", "Alex", "Zhiyuan", "David", "Will", "Alexander", "Ren", "Daniel", "Mia", "Max", "Andrew", "Jack", "Nate", "Brooke", "Jason", "Morgan", "Anatole", "Ryan", "Kevin", "Ryan", "Brookey", "Noor", "Rohan", "Mark", "Zach", "Kristina", "Peter", "Lee", "YuQin", "Nelson", "John", "Casey", "Alexey", "Noah", "David", "Travis", "Naman", "Henry", "Ahmed", "Emily", "Austin", "Wanqi", "Aaron", "Joshua", "Ben", "Beth", "Sam", "Hugo", "James", "Tido", "Tyler", "Matthew", "Tess", "Roshni", "Netto", "Jai", "Less", "Jesse", "Maya", "Rohan", "Al", "Omer", "Derek", "Jacob", "Danny", "Diggory", "Sasha", "Allegra", "Nick", "Michael", "Krista", "Kirill", "Tina", "Joel", "Joe", "Sabiha", "Hanpeng", "Jonathan", "Adam", "Matt", "Max", "Steph", "Katie", "Mathew", "Emily", "Ani", "Ashvin", "Jenna", "Haoyu", "Tom", "Andrew", "William", "Roy", "Nathan", "Audrey", "Allison", "Albert", "Dan", "Denzil", "Kevin", "Jack", "David", "Nini", "Daniel", "Sally", "Ryan", "Vincent", "Tommy", "Andrew", "Wilson", "Ella", "Jordan", "Jack", "Ben", "Karthik", "Cade", "David", "Alexander", "Jonas", "Jet", "Kevin", "Jason", "Jonathan", "Samantha", "Aaron", "Alex", "Mark", "Zoë", "Frances", "Jack", "Shivam", "Adam", "Katie", "Mateo", "Oleg", "Nate", "Adam", "Mike", "Parker", "Kelly", "Vivek", "Paul", "Will", "Dave", "Aidan", "Patty", "Dean", "Francisco", "Kenan", "Joe", "Michael", "Faisal", "Kevin", "Jon", "David", "Sally", "Jack", "Edwin", "Devang", "Will", "Nicholas", "Colin", "Patrick", "Josh", "Emily", "Michelle", "Jenn", "Brianna", "Sam", "Joanne", "Alison", "Adhvik", "Angus", "Lingxi", "Maddy", "Vish", "Larry", "Johnny", "Lauren", "Kevin", "Joey", "Fredrika", "Jiajun", "Hanna", "Chris", "Jennifer", "Dayna", "Rudy", "Jules", "Nicole", "Davesh", "Matt", "Talal", "Amrita", "Aaditya", "Anurag", "Jordan", "Jordan", "Matt", "Julius", "Stephanie", "Sam", "Jake", "Junyi", "Nathan", "Ryan", "Pranathi", "Holly", "Kenneth", "Paul", "Noah", "Alex", "Brian", "Ray", "Maude", "Michael", "Greg", "Tomas", "Merrill", "Paul", "JD", "Julia", "Justin", "Susan", "Jen", "Tyler", "Janet", "April", "Serena", "Alex", "Natalie", "Elijah", "Nathan", "Grace", "Katia", "Val", "Jared", "Amanda", "Matthew", "Tommy", "Kevin", "Tyler", "Alex", "Kristin", "Amina", "Sam", "Clint", "Geoffrey", "Carson", "Maureen", "Ahbishek", "Trevor", "Nikki", "Chris", "Maddie", "Victor", "Sahil", "Sriram", "Andy", "Michelle"]

# Setup
w, h = imageSize(path)  # ideally 1024x1024 image
s = int(w / 120)  # step size - extra dense grid
visibilityThreshold = 0.1  # opacity threshold to count as "visible"

newPage(w, h)

# Draw background for dark mode (skip if saving for transparent export)
if isDark and not shouldSave:
    fill(17/255, 17/255, 17/255)  # #111
    rect(0, 0, w, h)

# Set a font with a size
font("CursorMono260119-Regular")
fontSize(s * 14/16)  # slightly smaller font relative to cell

# Shift it up a bit
translate(s * -6/16, s * 10/16)

# Keep names in original order
name_queue = list(names)

# Horizontal step - wider spacing so characters don't butt up
hStep = int(s * 0.7)

# Step 1: Collect all visible positions organized by row
rows = {}  # y -> list of (x, opacity)
gray_values = []

# First pass: collect all gray values for normalization
all_positions = []
for y in range(0, h, s):
    for x in range(0, w, hStep):
        tx = x + hStep/2
        ty = y + s/2
        color = imagePixelColor(path, (tx, ty))
        if color:
            r, g, b, a = color
            gray = 0.299*r + 0.587*g + 0.114*b
            gray_values.append(gray)
            all_positions.append((x, y, gray))

gray_min = min(gray_values) if gray_values else 0
gray_max = max(gray_values) if gray_values else 1

# Second pass: organize visible positions by row
for x, y, gray in all_positions:
    if normalizeGray and gray_max != gray_min:
        normalized_gray = (gray - gray_min) / (gray_max - gray_min)
    else:
        normalized_gray = gray
    
    opacity = normalized_gray if isDark else (1 - normalized_gray)
    
    if opacity > visibilityThreshold:
        if y not in rows:
            rows[y] = []
        rows[y].append((x, opacity))

# Sort positions within each row by x
for y in rows:
    rows[y].sort(key=lambda p: p[0])

# Step 2: Calculate even distribution of names
# Flatten all visible positions into a single list (row by row, top to bottom for reading order)
all_visible = []
for y in sorted(rows.keys(), reverse=True):  # top to bottom in reading order
    for x, opacity in rows[y]:
        all_visible.append((x, y, opacity))

total_positions = len(all_visible)
total_name_chars = sum(len(name) for name in names)
total_filler = total_positions - total_name_chars

# Calculate filler per name to spread evenly
if len(names) > 0:
    filler_per_name = max(1, total_filler // len(names))
else:
    filler_per_name = total_filler

print(f"Total positions: {total_positions}, Name chars: {total_name_chars}, Filler per name: {filler_per_name}")

# Build the full character stream with even distribution
def get_filler(length):
    """Get filler of specific length"""
    filler_chars = [":", "+", "*", "/", "\\", "(", ")", "[", "]", "=", "{", "}", "~", "@", "#", "0", "1"]
    return "".join(random.choice(filler_chars) for _ in range(length))

char_stream = []
for i, name in enumerate(names):
    # Add filler before each name
    char_stream.extend(list(get_filler(filler_per_name)))
    char_stream.extend(list(name))

# If there's remaining space, add trailing filler
remaining = total_positions - len(char_stream)
if remaining > 0:
    char_stream.extend(list(get_filler(remaining)))

# Step 3: Place characters, but handle line breaks AND gaps within rows
# Split each row into continuous segments to avoid names breaking across gaps

def split_row_into_segments(row_positions, gap_threshold):
    """Split a row into continuous segments based on x-position gaps"""
    if not row_positions:
        return []
    
    segments = []
    current_segment = [row_positions[0]]
    
    for i in range(1, len(row_positions)):
        prev_x = row_positions[i-1][0]
        curr_x = row_positions[i][0]
        
        # If gap between positions is larger than threshold, start new segment
        if curr_x - prev_x > gap_threshold:
            segments.append(current_segment)
            current_segment = [row_positions[i]]
        else:
            current_segment.append(row_positions[i])
    
    if current_segment:
        segments.append(current_segment)
    
    return segments

# Gap threshold: if positions are more than 2x hStep apart, consider it a gap
gap_threshold = hStep * 2

# First pass: collect all segments and their sizes to calculate even distribution
sorted_rows = sorted(rows.keys(), reverse=True)  # top to bottom
all_segments = []  # list of (row_idx, y, segment)

for row_idx, y in enumerate(sorted_rows):
    row_positions = rows[y]
    segments = split_row_into_segments(row_positions, gap_threshold)
    for segment in segments:
        all_segments.append((row_idx, y, segment))

# Calculate total capacity (excluding first/last rows for names)
total_segment_positions = sum(len(seg) for row_idx, y, seg in all_segments 
                               if row_idx != 0 and row_idx != len(sorted_rows) - 1)

# Calculate even distribution: target position for each name
total_name_chars = sum(len(name) for name in names)
name_queue = list(names)

if len(name_queue) > 0 and total_segment_positions > 0:
    # Calculate target start position for each name (evenly spaced)
    spacing = total_segment_positions / len(name_queue)
    target_positions = [int(i * spacing) for i in range(len(name_queue))]
else:
    target_positions = []

print(f"Total positions: {total_segment_positions}, Names: {len(name_queue)}, Name chars: {total_name_chars}")
print(f"Spacing between names: {spacing if name_queue else 0:.1f}")

# Second pass: place characters with even distribution
char_stream_final = []
name_index = 0
global_pos = 0  # track position across all segments (excluding first/last rows)

for row_idx, y, segment in all_segments:
    seg_len = len(segment)
    seg_chars = []
    pos_in_seg = 0
    is_first_row = (row_idx == 0)
    is_last_row = (row_idx == len(sorted_rows) - 1)
    
    while pos_in_seg < seg_len:
        remaining_in_seg = seg_len - pos_in_seg
        
        # First row or last row: only filler, no names (padding around shape)
        if is_first_row or is_last_row:
            seg_chars.extend(list(get_filler(remaining_in_seg)))
            pos_in_seg += remaining_in_seg
        elif name_index < len(name_queue):
            next_name = name_queue[name_index]
            next_name_len = len(next_name)
            
            # Check if we've reached the target position for this name
            target = target_positions[name_index]
            
            # Name must have buffer on both sides
            # Need: at least 2 filler before AND 2 filler after
            not_at_start = pos_in_seg >= 2
            not_at_end = pos_in_seg + next_name_len <= seg_len - 2
            fits_with_padding = not_at_start and not_at_end
            
            # Place name if: we're at/past target AND it fits with padding
            if global_pos >= target and fits_with_padding:
                # Add the name
                seg_chars.extend(list(next_name))
                pos_in_seg += next_name_len
                global_pos += next_name_len
                name_index += 1
            else:
                # Add filler
                seg_chars.append(get_filler(1))
                pos_in_seg += 1
                global_pos += 1
        else:
            # No more names, fill with filler
            seg_chars.extend(list(get_filler(remaining_in_seg)))
            pos_in_seg += remaining_in_seg
            global_pos += remaining_in_seg
    
    char_stream_final.extend(seg_chars)

# Step 4: Draw all characters
for i, (x, y, opacity) in enumerate(all_visible):
    if i < len(char_stream_final):
        char = char_stream_final[i]
    else:
        char = random.choice([":", "+", "*", "/", "\\", "(", ")", "[", "]", "=", "{", "}", "~", "@", "#", "0", "1"])
    
    color_choices = [base_color] * 4 + list(colors)
    current_color = random.choice(color_choices)
    fill(*current_color, opacity)
    text(char, (x + hStep/2, y - s/2))

print(f"Names placed: {name_index} / {len(names)}")

# Step 5: Draw "Cursor works everywhere." text on the grid
if showTagline:
    tagline = "Cursor works everywhere."
    tagline_highlight = "everyw"  # this part uses secondary_color
    highlight_start = tagline.find(tagline_highlight)
    highlight_end = highlight_start + len(tagline_highlight)

    # Grid position for tagline (adjust these to move the text)
    # Row 0 is top, increases downward in grid terms
    # Calculate center row/col of the image in grid units
    total_rows = h // s
    total_cols = w // hStep
    tagline_row = total_rows // 2 - 16  # middle row, moved up 16 rows
    tagline_start_col = (total_cols - len(tagline)) // 2 + 33  # center + 33 columns right

    # Draw each character on the grid with appropriate color
    for i, char in enumerate(tagline):
        col = tagline_start_col + i
        # Calculate position same as ASCII art: uses the translate offset already applied
        x = col * hStep
        y = h - (tagline_row * s)  # convert row to y (DrawBot y increases upward)
        
        if highlight_start <= i < highlight_end:
            fill(*secondary_color)
        else:
            fill(*base_color)
        text(char, (x + hStep/2, y - s/2))

# Save images
if shouldSave:
    saveImage(os.path.join(EXPORTS, "cursor-ad-8-" + currentTime.strftime("%Y%m%d-%H%M%S") + ".svg"))
    saveImage(os.path.join(EXPORTS, "cursor-ad-8-" + currentTime.strftime("%Y%m%d-%H%M%S") + ".png"))
    pass
