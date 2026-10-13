"""Join the turntable frames into a looping GIF for the README.

    python tools/make_gif.py tools/out/turntable docs/screenshots/turntable.gif [ms_per_frame]

One palette is built from a sample of all the frames and shared by every frame, without dithering,
so the background stays flat and the file stays small. Needs Pillow.
"""
import glob
import os
import sys

from PIL import Image

src, out = sys.argv[1], sys.argv[2]
ms = int(sys.argv[3]) if len(sys.argv) > 3 else 70
files = sorted(glob.glob(os.path.join(src, 'f*.png')))
if not files:
    sys.exit(f'no frames in {src}')
frames = [Image.open(f).convert('RGB') for f in files]

# shared palette from a strip of every fourth frame
w, h = frames[0].size
sample = Image.new('RGB', (w, h * len(frames[::4])))
for i, f in enumerate(frames[::4]):
    sample.paste(f, (0, i * h))
pal = sample.quantize(colors=128, method=Image.Quantize.MEDIANCUT)

q = [f.quantize(palette=pal, dither=Image.Dither.NONE) for f in frames]
q[0].save(out, save_all=True, append_images=q[1:], duration=ms, loop=0, optimize=True, disposal=1)
print(f'{out}: {len(q)} frames, {os.path.getsize(out) / 1e6:.2f} MB')
