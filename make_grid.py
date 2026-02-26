from PIL import Image, ImageDraw, ImageFont

img = Image.open("/Users/rcfox31/.openclaw/workspace/dashboard/screen-grid.png")
draw = ImageDraw.Draw(img)
w, h = img.size

for x in range(0, w, 50):
    color = "red" if x % 100 == 0 else "yellow"
    draw.line([(x, 0), (x, h)], fill=color, width=1)
    if x % 100 == 0:
        draw.text((x + 2, 2), str(x), fill="red")

for y in range(0, h, 50):
    color = "red" if y % 100 == 0 else "yellow"
    draw.line([(0, y), (w, y)], fill=color, width=1)
    if y % 100 == 0:
        draw.text((2, y + 2), str(y), fill="red")

img.save("/Users/rcfox31/.openclaw/workspace/dashboard/screen-grid-overlay.png")
print(f"Done: {w}x{h}")
