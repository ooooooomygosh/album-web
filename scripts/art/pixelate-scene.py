"""Pixel treatment used for the cabin scenes (see docs/art-direction.md).

Usage: python3 scripts/art/pixelate-scene.py <in.png> <out.png> [colours]
Input is a 1448x1086 render (vector scenes: screenshot the SVG at 1448x1086).
1/4-resolution box downscale -> median-cut palette without dithering ->
nearest-neighbour upscale, so every art pixel is a crisp 4x4 block.
"""
import sys
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
colours = int(sys.argv[3]) if len(sys.argv) > 3 else 40
im = Image.open(src).convert('RGB')
small = im.resize((362, 272), Image.BOX)
q = small.quantize(colors=colours, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
q.resize((1448, 1088), Image.NEAREST).crop((0, 0, 1448, 1086)).save(dst, optimize=True)
