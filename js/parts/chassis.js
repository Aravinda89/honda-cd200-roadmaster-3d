// Frame and suspension: frame, fork, swingarm, rear shocks, stands, footrests.
import * as THREE from 'three';
import { FD, MAT, R, V, Y_UP, addPart, forkPt, lathe, mesh, qAlong, rbox, rod, sideGroup, tube } from '../core.js';

/* =====================================================================
   Build: frame & suspension
   ===================================================================== */
{
  const g = addPart('frame', 'chassis', 'Frame', 'spec', 'Open-diamond tubular steel frame. There is no cradle under the engine: the engine itself is a stressed member that completes the structure.');
  const blk = MAT.black();
  rod(forkPt(0.47, -0.035), forkPt(0.76, -0.035), 0.027, blk, g, 24);
  tube([forkPt(0.64, -0.035), V(0.86, 0.735), V(0.7, 0.705), V(0.56, 0.68), V(0.5, 0.62), V(0.47, 0.5), V(0.462, 0.37)], 0.026, blk, g, 64, 14);
  tube([forkPt(0.49, -0.035), V(0.965, 0.585), V(0.905, 0.47), V(0.865, 0.425)], 0.018, blk, g, 32, 12);
  const rail = (s) => [[0.52, 0.655, 0.1 * s], [0.4, 0.632, 0.1 * s], [0.2, 0.628, 0.1 * s], [0.0, 0.628, 0.1 * s], [-0.14, 0.62, 0.1 * s]];
  tube([...rail(-1), [-0.18, 0.615, -0.06], [-0.19, 0.613, 0], [-0.18, 0.615, 0.06], ...rail(1).reverse()], 0.0135, blk, g, 200, 10);
  rod([0.52, 0.655, -0.1], [0.52, 0.655, 0.1], 0.014, blk, g);
  [-1, 1].forEach((s) => {
    tube([[0.468, 0.42, 0.1 * s], [0.3, 0.53, 0.1 * s], [0.14, 0.627, 0.1 * s]], 0.013, blk, g, 24, 10);
    rod([0.135, 0.645, 0.09 * s], [0.135, 0.645, 0.19 * s], 0.0075, MAT.chrome(), g);
    rbox(0.07, 0.1, 0.006, 0.004, blk, g, V(0.48, 0.4, 0.112 * s));
    rbox(0.05, 0.06, 0.006, 0.004, blk, g, V(0.865, 0.425, 0.06 * s));
  });
  rod([0.455, 0.355, -0.118], [0.455, 0.355, 0.118], 0.011, MAT.chrome(), g);
}
{
  const g = addPart('fork', 'chassis', 'Front fork', 'photo', 'Oil-damped telescopic fork with 31 mm chrome stanchions, painted upper covers and alloy lower sliders. Travel is 115 mm; each leg takes 135–140 cc of automatic transmission fluid. The rake of about 25 degrees was measured from photos.', [0.16, 0, 0]);
  const alloy = MAT.alloy(), chrome = MAT.chrome(), paint = MAT.paint(), blk = MAT.black();
  [-1, 1].forEach((s) => {
    const z = s * 0.09;
    lathe([[0, 0], [0.026, 0], [0.028, 0.025], [0.026, 0.07], [0.0255, 0.255], [0.022, 0.27], [0, 0.27]], forkPt(-0.035, 0, z), FD, alloy, g, 28);
    rod(forkPt(0.225, 0, z), forkPt(0.295, 0, z), 0.0155, chrome, g, 20);
    lathe([[0, 0], [0.029, 0], [0.031, 0.012], [0.031, 0.43], [0.027, 0.44], [0, 0.44]], forkPt(0.28, 0, z), FD, paint, g, 28);
    rod(forkPt(0.738, 0, z), forkPt(0.758, 0, z), 0.02, chrome, g, 20);
  });
  rbox(0.07, 0.022, 0.24, 0.01, blk, g, forkPt(0.735, -0.012), qAlong(FD));
  rbox(0.07, 0.03, 0.24, 0.01, blk, g, forkPt(0.5, -0.012), qAlong(FD));
  rod(forkPt(0, 0, -0.12), forkPt(0, 0, 0.12), 0.009, MAT.chrome(), g);
}
{
  const g = addPart('swingarm', 'chassis', 'Swingarm', 'est', 'Swinging arm fork that pivots just behind the engine and carries the rear axle. Chain tension is set by sliding the axle along the arm ends. Pivot bolt torque 4.0–5.0 kgf m.', [-0.1, -0.08, 0]);
  const blk = MAT.black();
  [-1, 1].forEach((s) => {
    const a = V(0.455, 0.355, 0.095 * s), b = V(-0.02, R - 0.002, 0.095 * s), d = b.clone().sub(a);
    rbox(0.034, d.length(), 0.022, 0.007, blk, g, a.clone().addScaledVector(d, 0.5), qAlong(d));
    rbox(0.05, 0.03, 0.026, 0.006, MAT.chrome(), g, V(0.0, R, 0.097 * s));
  });
  rod([0.4, 0.349, -0.095], [0.4, 0.349, 0.095], 0.013, blk, g);
  rod([0.455, 0.355, -0.108], [0.455, 0.355, 0.108], 0.021, blk, g, 20);
}
function shock(parent, lower, upper, paint, chrome, blk) {
  const d = upper.clone().sub(lower), L = d.length();
  const g = new THREE.Group(); g.position.copy(lower); g.quaternion.copy(qAlong(d)); parent.add(g);
  [0, L].forEach((y) => { const e = mesh(new THREE.TorusGeometry(0.013, 0.0055, 8, 20), blk, g); e.position.y = y; });
  lathe([[0, 0.012], [0.019, 0.012], [0.02, 0.03], [0.02, 0.12], [0.029, 0.125], [0.029, 0.14], [0, 0.14]], V(0, 0, 0), Y_UP, chrome, g, 28);
  const helix = new (class extends THREE.Curve {
    getPoint(t, tgt = new THREE.Vector3()) { const a = t * Math.PI * 2 * 4.5; return tgt.set(0.025 * Math.cos(a), 0.14 + t * 0.09, 0.025 * Math.sin(a)); }
  })();
  mesh(new THREE.TubeGeometry(helix, 160, 0.0042, 6, false), chrome, g);
  lathe([[0, 0.205], [0.034, 0.205], [0.036, 0.215], [0.036, L - 0.022], [0.03, L - 0.012], [0, L - 0.012]], V(0, 0, 0), Y_UP, paint, g, 32);
}
{
  const g = addPart('shocks', 'chassis', 'Rear shocks', 'photo', 'Twin oil-filled shock absorbers with painted upper covers and chrome lower bodies. Rear wheel travel is 64 mm; spring free length is 182.6 mm new, 180 mm service limit.');
  [-1, 1].forEach((s) => {
    const sg = sideGroup(g, [0, 0, 0.22 * s]);
    shock(sg, V(0.035, 0.335, 0.2 * s), V(0.135, 0.645, 0.185 * s), MAT.paint(), MAT.chrome(), MAT.black());
    rod([0.035, 0.335, 0.105 * s], [0.035, 0.335, 0.19 * s], 0.008, MAT.black(), sg);
  });
}
{
  const g = addPart('stands', 'chassis', 'Stands', 'photo', 'Centre stand shown down, with the side stand folded.');
  const blk = MAT.black();
  [-1, 1].forEach((s) => {
    rod([0.47, 0.3, 0.11 * s], [0.415, 0.02, 0.135 * s], 0.012, blk, g);
    rod([0.392, 0.012, 0.135 * s], [0.452, 0.012, 0.135 * s], 0.012, blk, g);
  });
  rod([0.47, 0.3, -0.118], [0.47, 0.3, 0.118], 0.012, blk, g);
  rod([0.432, 0.12, -0.13], [0.432, 0.12, 0.13], 0.01, blk, g);
  rod([0.43, 0.08, -0.13], [0.35, 0.065, -0.2], 0.009, blk, g);
  rod([0.56, 0.24, -0.128], [0.33, 0.212, -0.155], 0.011, blk, g);
}
{
  const g = addPart('pegs', 'chassis', 'Footrests', 'photo', 'Ribbed rubber rider footrests on a bar under the engine, and pillion footrests on brackets just above the silencers.');
  const blk = MAT.black(), rub = MAT.rubber();
  rod([0.5, 0.262, -0.165], [0.5, 0.262, 0.165], 0.012, blk, g);
  [-1, 1].forEach((s) => {
    const sg = sideGroup(g, [0, 0, 0.16 * s]);
    rod([0.5, 0.262, 0.16 * s], [0.5, 0.262, 0.275 * s], 0.02, rub, sg, 18);
    for (let i = 0; i < 5; i++) { const t = mesh(new THREE.TorusGeometry(0.0205, 0.0035, 6, 18), rub, sg); t.position.set(0.5, 0.262, (0.175 + i * 0.022) * s); }
    rod([0.26, 0.56, 0.1 * s], [0.19, 0.33, 0.19 * s], 0.01, blk, sg);
    rod([0.19, 0.33, 0.185 * s], [0.19, 0.33, 0.27 * s], 0.017, rub, sg, 16);
    for (let i = 0; i < 4; i++) { const t = mesh(new THREE.TorusGeometry(0.0175, 0.003, 6, 16), rub, sg); t.position.set(0.19, 0.33, (0.2 + i * 0.02) * s); }
  });
}
