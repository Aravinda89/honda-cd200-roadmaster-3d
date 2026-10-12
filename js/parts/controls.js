// Handlebar, clutch lever, mirrors, gear and kick-start pedals, control cables.
import * as THREE from 'three';
import { MAT, V, addPart, forkPt, mesh, qAlong, rbox, rod, sideGroup, tube } from '../core.js';

/* =====================================================================
   Build: controls
   ===================================================================== */
const BAR_R = [[0.945, 0.975, 0.0], [0.945, 0.975, 0.05], [0.94, 1.03, 0.085], [0.91, 1.09, 0.13], [0.86, 1.105, 0.2], [0.8, 1.078, 0.27], [0.76, 1.052, 0.32], [0.712, 1.026, 0.405]];
{
  const g = addPart('bars', 'controls', 'Handlebar', 'photo', 'High-rise chrome handlebar clamped to the top yoke, with rubber grips. Bare alloy switch housings beside the grips carry the lighting, horn and turn signal switches. In this model the top of the bars matches the published 1,105 mm overall height.', [0.04, 0.3, 0]);
  const half = BAR_R.slice(1);
  tube([...half.map((p) => [p[0], p[1], -p[2]]).reverse(), ...half], 0.0112, MAT.chrome(), g, 200, 12);
  const rub = MAT.rubber(), blk = MAT.black(), al = MAT.alloy();
  [-1, 1].forEach((s) => {
    rod([0.765, 1.055, 0.315 * s], [0.708, 1.024, 0.412 * s], 0.0165, rub, g, 18);
    rbox(0.05, 0.042, 0.04, 0.01, al, g, V(0.78, 1.064, 0.295 * s));   // switch housing (photos set3-18, set3-19)
    rbox(0.03, 0.03, 0.05, 0.006, blk, g, V(0.945, 0.99, 0.045 * s));
  });
}
{
  const g = addPart('levers', 'controls', 'Clutch lever', 'manual', 'Left-hand lever. Free play at the lever end should be 10–20 mm. Set it with the adjuster at the crankcase end of the cable; the threaded adjuster at the lever gives fine adjustment.');
  [-1].forEach((s) => {
    const sg = sideGroup(g, [0.04, 0.3, 0.12 * s]);
    rbox(0.03, 0.026, 0.03, 0.006, MAT.alloy(), sg, V(0.8, 1.075, 0.275 * s));
    tube([[0.802, 1.071, 0.28 * s], [0.835, 1.06, 0.3 * s], [0.81, 1.046, 0.36 * s], [0.77, 1.034, 0.42 * s]], 0.0058, MAT.chrome(), sg, 32, 8);
  });
}
{
  const g = addPart('mirrors', 'controls', 'Mirrors', 'photo', 'Round chrome mirrors on tall stems.');
  [-1, 1].forEach((s) => {
    const sg = sideGroup(g, [0.04, 0.42, 0.14 * s]);
    const ch = MAT.chrome();
    tube([[0.8, 1.08, 0.27 * s], [0.796, 1.14, 0.31 * s], [0.792, 1.18, 0.338 * s]], 0.0055, ch, sg, 24, 8);
    const mc = V(0.792, 1.225, 0.35 * s), nd = V(-1, 0, -0.18 * s).normalize();
    const head = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.016, 40), ch, sg); head.position.copy(mc); head.quaternion.copy(qAlong(nd));
    const glass = mesh(new THREE.CircleGeometry(0.046, 40), MAT.glass(), sg); glass.position.copy(mc).addScaledVector(nd, 0.0085); glass.quaternion.setFromUnitVectors(V(0, 0, 1), nd);
  });
}
{
  const g = addPart('pedals', 'controls', 'Gear and kick-start pedals', 'est', 'Gear pedal on the left, kick-start lever on the right. The rear brake pedal is listed under Brakes.');
  const ch = MAT.chrome(), rub = MAT.rubber();
  const right = sideGroup(g, [0, 0, 0.2]), left = sideGroup(g, [0, 0, -0.2]);
  tube([[0.585, 0.38, 0.155], [0.53, 0.37, 0.19], [0.47, 0.355, 0.205]], 0.009, ch, right, 24, 8);
  rod([0.47, 0.355, 0.2], [0.47, 0.355, 0.25], 0.012, rub, right);
  tube([[0.56, 0.31, -0.15], [0.605, 0.29, -0.18], [0.65, 0.275, -0.19]], 0.008, ch, left, 24, 8);
  rod([0.65, 0.275, -0.18], [0.65, 0.275, -0.235], 0.011, rub, left);
}
{
  const g = addPart('cables', 'controls', 'Control cables', 'est', 'Clutch, throttle and speedometer cables. Routing is approximate. The front brake cable is listed under Brakes.', [0, 0.15, 0]);
  const blk = MAT.black();
  tube([[0.8, 1.068, -0.285], [0.86, 1.0, -0.17], [0.93, 0.88, -0.09], [0.94, 0.75, -0.07], [0.87, 0.62, -0.1], [0.72, 0.5, -0.14], [0.6, 0.43, -0.152]], 0.0032, blk, g, 72, 6);
  tube([[0.775, 1.05, 0.3], [0.85, 0.99, 0.17], [0.92, 0.87, 0.08], [0.88, 0.74, 0.05], [0.76, 0.66, 0.04], [0.68, 0.63, 0.04]], 0.0032, blk, g, 56, 6);
  tube([[1.27, 0.34, -0.085], [1.2, 0.5, -0.12], [1.11, 0.78, -0.11], [1.02, 0.95, -0.05], forkPt(0.755, 0.07).add(V(0.0, -0.03))], 0.003, blk, g, 48, 6);
}
