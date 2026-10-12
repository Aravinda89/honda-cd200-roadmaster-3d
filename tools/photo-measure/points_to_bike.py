"""Convert pixel positions in a side photo into bike coordinates, using a fitted camera.

Usage:
    python3 tools/photo-measure/points_to_bike.py data/cam-set2-03.json data/points-set2-03.json --scale 2

Each point in the points file is  "name": [u, v, z]  where (u, v) is the pixel position and z is
the side plane the point lies on (0 for the centre line, about -0.13 for the left face of the
tank, -0.215 for the left silencer, and so on; negative z is the bike's left side). The script
casts a ray from the camera through the pixel and reports where it crosses that plane, in metres.

--scale multiplies pixel positions first; the stored point files were picked on half-size images,
so they use --scale 2.

Accuracy in practice is about +/- 2-3 cm: measure every point on two different photos and compare.
"""
import argparse
import json
import math

import numpy as np


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('camera')
    ap.add_argument('points')
    ap.add_argument('--scale', type=float, default=1.0)
    a = ap.parse_args()
    cam = json.load(open(a.camera))
    width, height = cam['size']
    f = (height / 2) / math.tan(math.radians(cam['fov'] / 2))
    pos = np.array(cam['pos'])
    fwd = np.array(cam['target']) - pos
    fwd /= np.linalg.norm(fwd)
    up = np.array(cam['up'])
    up -= fwd * up.dot(fwd)
    up /= np.linalg.norm(up)
    right = np.cross(fwd, up)
    data = json.load(open(a.points))
    pts = data.get('points', data)
    for name, (u, v, z0) in pts.items():
        u, v = u * a.scale, v * a.scale
        ray = fwd + ((u - width / 2) / f) * right + (-(v - height / 2) / f) * up
        t = (z0 - pos[2]) / ray[2]
        p = pos + t * ray
        print(f'{name:28s} x = {p[0]:6.3f}  y = {p[1]:6.3f}  (plane z = {z0})')


if __name__ == '__main__':
    main()
