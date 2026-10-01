#!/usr/bin/env python3
# © 2026 QunX · qunx-motion 1.0.0-beta · QX-MGH-7F3A
# needs: pip install vtracer pillow numpy
# logo image (png/jpg/webp) -> clean SVG, one <g id="partN" class="lp"> per separate piece
# usage: python3 vectorize.py logo.png 3 logo.svg     (3 = number of colours in the logo, not counting the background)
import sys, re, vtracer, numpy as np
from PIL import Image, ImageFilter
src, k, out = sys.argv[1], int(sys.argv[2]), sys.argv[3]
im = Image.open(src).convert('RGBA')
flat = Image.new('RGBA', im.size, (255, 255, 255, 255)); flat.alpha_composite(im)        # transparent -> white
im = flat.convert('RGB'); s = 1600 / max(im.size)
im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)               # work at ~1600px
px = np.asarray(im, dtype=np.float32).reshape(-1, 3)
q = (px // 16).astype(np.int32); keys, counts = np.unique(q[:, 0] * 256 + q[:, 1] * 16 + q[:, 2], return_counts=True)
common = np.stack([keys // 256, (keys // 16) % 16, keys % 16], 1)[counts > len(px) * 0.002] * 16 + 8    # colours covering >0.2% of the image
C = [common[np.argmax(counts[counts > len(px) * 0.002])].astype(np.float32)]
while len(C) < k + 1:                                                                     # farthest-point start: logos are few flat colours
    dist = np.min([((common - c) ** 2).sum(1) for c in C], 0); C.append(common[np.argmax(dist)].astype(np.float32))
C = np.array(C)
for _ in range(20):                                                                       # k-means: logo colours + background
    lab = np.argmin(((px[:, None] - C[None]) ** 2).sum(2), 1)
    C = np.array([px[lab == j].mean(0) if (lab == j).any() else C[j] for j in range(k + 1)])
lab = lab.reshape(im.height, im.width)
corners = [lab[0, 0], lab[0, -1], lab[-1, 0], lab[-1, -1]]; bg = max(set(corners), key=corners.count)
parts, n = [], 0
for j in range(k + 1):
    if j == bg: continue
    mask = Image.fromarray(np.where(lab == j, 0, 255).astype(np.uint8)).filter(ImageFilter.ModeFilter(5))
    mask.convert('RGB').save('_mask.png')
    vtracer.convert_image_to_svg_py('_mask.png', '_mask.svg', colormode='binary', mode='spline', filter_speckle=24,
        corner_threshold=60, length_threshold=4.0, splice_threshold=45, path_precision=2)
    col = '#%02x%02x%02x' % tuple(int(v) for v in C[j])
    for p in re.findall(r'<path[^>]*/>', open('_mask.svg').read()):
        n += 1
        d = re.search(r'd="([^"]+)"', p).group(1); tr = re.search(r'transform="([^"]+)"', p)
        inner = f'<path fill="{col}" d="{d}"' + (f' transform="{tr.group(1)}"' if tr else '') + '/>'
        parts.append(f'<g id="part{n}" class="lp">{inner}</g>')   # animate the <g>; the path keeps its own position
svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {im.width} {im.height}">\n' + '\n'.join(parts) + '\n</svg>\n'
open(out, 'w').write(svg)
print(n, 'parts ->', out)
