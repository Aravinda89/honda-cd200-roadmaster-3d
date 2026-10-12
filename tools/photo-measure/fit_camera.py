"""Recover the camera position of a side photo of the bike from wheel landmarks.

Usage:
    python3 tools/photo-measure/fit_camera.py tools/photo-measure/data/wheels-set2-03.json
    python3 tools/photo-measure/fit_camera.py <landmarks.json> --focal 2700 --scan

The landmarks file lists known points on the bike (axles, tyre contact patches, rim edges),
in bike coordinates (metres; +x forward, +y up, +z rider's right, rear axle at x = 0),
paired with where they appear in the photo (pixels, full size). The wheelbase (1,280 mm)
sets the scale. The fit finds the camera position, orientation and focal length that best
project the bike points onto the pixels, and writes a camera file for points_to_bike.py
and overlay.mjs.

Phone photos carry no reliable focal length here, so focal length and camera distance trade
off against each other. Use --scan to see the error for a range of focal lengths; the earlier
measurements used a fixed focal of 2700 px (about a 30 degree vertical field of view on a
2576 x 1449 photo), which gave consistent results across two photos.

Requires numpy and scipy.
"""
import argparse
import json
import math

import numpy as np
from scipy.optimize import least_squares
from scipy.spatial.transform import Rotation as Rot


def project(params, pts, width, height):
    cx, cy, cz, rx, ry, rz, f = params
    cam = np.array([cx, cy, cz])
    rot = Rot.from_rotvec([rx, ry, rz]).as_matrix()          # camera -> world
    d = (pts - cam) @ rot                                       # world -> camera (x right, y up, z back)
    u = width / 2 + f * d[:, 0] / -d[:, 2]
    v = height / 2 - f * d[:, 1] / -d[:, 2]
    return np.stack([u, v], 1)


def fit(cfg, focal):
    width, height = cfg['size']
    pts = np.array([p[0] for p in cfg['points']], float)
    pix = np.array([p[1] for p in cfg['points']], float)
    wts = np.array([p[2] if len(p) > 2 else 1.0 for p in cfg['points']])
    side = cfg.get('side', 'left')
    base = Rot.from_euler('y', 180 if side == 'left' else 0, degrees=True)
    best = None
    for tilt in (10, 25, 40):
        guess_rot = (base * Rot.from_euler('x', -tilt, degrees=True)).as_rotvec()
        for dist in (2.0, 3.0, 4.5):
            z = -dist if side == 'left' else dist
            res = lambda x: ((project([*x, focal], pts, width, height) - pix) * wts[:, None]).ravel()
            r = least_squares(res, [0.64, 1.2, z, *guess_rot], loss='soft_l1', f_scale=8)
            rms = math.sqrt(((project([*r.x, focal], pts, width, height) - pix) ** 2).sum(1).mean())
            if best is None or rms < best[0]:
                best = (rms, r.x)
    return best


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('landmarks')
    ap.add_argument('--focal', type=float, default=2700, help='focal length in pixels (default 2700)')
    ap.add_argument('--scan', action='store_true', help='report the fit error for a range of focal lengths')
    ap.add_argument('--out', help='camera file to write (default: the "out" field of the landmarks file)')
    a = ap.parse_args()
    cfg = json.load(open(a.landmarks))
    width, height = cfg['size']

    if a.scan:
        for f in (1800, 2200, 2700, 3200, 4000):
            rms, x = fit(cfg, f)
            print(f'focal {f:5.0f}px  rms {rms:5.1f}px  camera at {np.round(x[:3], 2)}')
        return

    rms, x = fit(cfg, a.focal)
    rot = Rot.from_rotvec(x[3:6]).as_matrix()
    cam, fwd, up = x[:3], -rot[:, 2], rot[:, 1]
    pts = np.array([p[0] for p in cfg['points']], float)
    pix = np.array([p[1] for p in cfg['points']], float)
    err = project([*x, a.focal], pts, width, height) - pix
    for p, e in zip(cfg['points'], err):
        print(f'  {p[3] if len(p) > 3 else "":20s} error {e.round(1)} px')
    fov = 2 * math.degrees(math.atan(height / 2 / a.focal))
    print(f'rms {rms:.1f}px  camera {cam.round(3)}  vertical fov {fov:.1f} deg')
    out = a.out or cfg.get('out')
    json.dump({'pos': cam.tolist(), 'target': (cam + fwd * 3).tolist(), 'up': up.tolist(), 'fov': fov, 'size': [width, height], 'photo': cfg.get('photo')}, open(out, 'w'), indent=1)
    print('wrote', out)


if __name__ == '__main__':
    main()
