"""Draw a labelled pixel grid over a photo, to read off pixel positions of parts.

Usage:
    python3 tools/photo-measure/grid.py reference/photos/set2-03.jpg tools/out/grid.jpg [step] [crop x0,y0,x1,y1]

Labels are in full-size pixel coordinates even when cropping, so values can go straight into a
landmarks or points file (use --scale 1 for points read from a full-size grid).
"""
import sys

from PIL import Image, ImageDraw, ImageFont

src, out = sys.argv[1], sys.argv[2]
step = int(sys.argv[3]) if len(sys.argv) > 3 else 100
crop = tuple(map(int, sys.argv[4].split(','))) if len(sys.argv) > 4 else None
im = Image.open(src).convert('RGB')
if crop:
    im = im.crop(crop)
ox, oy = (crop[0], crop[1]) if crop else (0, 0)
d = ImageDraw.Draw(im)
try:
    font = ImageFont.truetype('DejaVuSans-Bold.ttf', 16)
except OSError:
    font = ImageFont.load_default()
w, h = im.size
for x in range((ox // step + 1) * step - ox, w, step):
    d.line([(x, 0), (x, h)], fill=(255, 0, 255), width=1)
    d.text((x + 2, 2), str(x + ox), fill=(255, 255, 0), font=font, stroke_width=2, stroke_fill=(0, 0, 0))
for y in range((oy // step + 1) * step - oy, h, step):
    d.line([(0, y), (w, y)], fill=(0, 255, 255), width=1)
    d.text((2, y + 2), str(y + oy), fill=(255, 255, 0), font=font, stroke_width=2, stroke_fill=(0, 0, 0))
im.save(out, quality=90)
print('wrote', out)
