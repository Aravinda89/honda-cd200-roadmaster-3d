// Handlebar, clutch lever, mirrors, gear and kick-start pedals, control cables.
import * as THREE from 'three';
import { MAT, V, addPart, forkPt, mesh, qAlong, rbox, rod, sideGroup, tube } from '../core.js';
import { CHANGE_SHAFT, CLUTCH_ARM } from './gearbox.js';

const CONTROLS = {};

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
  const g = addPart('levers', 'controls', 'Clutch lever', 'manual', 'Left-hand lever. Free play at the lever end should be 10–20 mm. Set it with the adjuster at the lower end of the cable, at the operating arm on the right-hand crankcase cover; the threaded adjuster and lockring at the lever give fine adjustment.');
  const sg = sideGroup(g, [0.04, 0.3, -0.12]);
  rbox(0.03, 0.026, 0.03, 0.006, MAT.alloy(), sg, V(0.8, 1.075, -0.275));
  const piv = V(0.802, 1.071, -0.28), lg = new THREE.Group(); lg.position.copy(piv); sg.add(lg);
  tube([[0, 0, 0], [0.033, -0.011, -0.02], [0.008, -0.025, -0.08], [-0.032, -0.037, -0.14]], 0.0058, MAT.chrome(), lg, 32, 8);
  CONTROLS.clutchLever = { group: lg, reach: Math.hypot(0.032, 0.14) };
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
  const g = addPart('pedals', 'controls', 'Gear and kick-start pedals', 'est', 'Gear pedal on the left, on the end of the gearchange shaft; kick-start lever on the right. Shift pattern: press down from neutral for 1st, lift for 2nd, 3rd and 4th; neutral is half a step between 1st and 2nd. A return spring brings the pedal back after each shift. The rear brake pedal is listed under Brakes.');
  const ch = MAT.chrome(), rub = MAT.rubber();
  const right = sideGroup(g, [0, 0, 0.2]), left = sideGroup(g, [0, 0, -0.2]);
  tube([[0.585, 0.38, 0.155], [0.53, 0.37, 0.19], [0.47, 0.355, 0.205]], 0.009, ch, right, 24, 8);
  rod([0.47, 0.355, 0.2], [0.47, 0.355, 0.25], 0.012, rub, right);
  const pg = new THREE.Group(); pg.position.set(CHANGE_SHAFT.x, CHANGE_SHAFT.y, -0.15); left.add(pg);
  const boss = mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.02, 16), ch, pg); boss.rotation.x = Math.PI / 2;
  tube([[0, 0, 0], [0.045, 0.008, -0.03], [0.088, 0.016, -0.04]], 0.008, ch, pg, 24, 8);
  rod([0.088, 0.016, -0.03], [0.088, 0.016, -0.085], 0.011, rub, pg);
  CONTROLS.gearPedal = { group: pg };
}
{
  const g = addPart('ccable', 'controls', 'Clutch cable', 'manual', 'From the clutch lever on the left of the handlebar, round to the operating arm on top of the right-hand crankcase cover. Main adjustment is at the lower end: slacken the locknut and turn the adjuster nut until the lever end has 10–20 mm of free play, then tighten the locknut. Fine adjustment is the threaded adjuster and lockring at the lever. A damaged, trapped or frayed cable makes the clutch stiff: check the routing and lubricate it. The routing between the ends is approximate.', [0, 0.15, 0]);
  const blk = MAT.black(), A = CLUTCH_ARM;
  tube([[0.8, 1.068, -0.285], [0.86, 1.0, -0.17], [0.95, 0.86, -0.03], [0.9, 0.7, 0.09], [0.78, 0.55, 0.165], [A.x + 0.035, A.y + 0.04, A.z], [A.x + 0.012, A.y + 0.006, A.z]], 0.0032, blk, g, 80, 6);
  rod([A.x + 0.022, A.y + 0.017, A.z], [A.x + 0.012, A.y + 0.006, A.z], 0.0045, MAT.chrome(), g, 10);   // lower adjuster
  rod([A.x + 0.012, A.y + 0.006, A.z], A, 0.001, MAT.chrome(), g, 6);                                  // inner cable to the arm
}
{
  const g = addPart('cables', 'controls', 'Control cables', 'est', 'Throttle and speedometer cables. Routing is approximate. The clutch cable is listed separately; the front brake cable is under Brakes.', [0, 0.15, 0]);
  const blk = MAT.black();
  tube([[0.775, 1.05, 0.3], [0.85, 0.99, 0.17], [0.92, 0.87, 0.08], [0.88, 0.74, 0.05], [0.76, 0.66, 0.04], [0.68, 0.63, 0.04]], 0.0032, blk, g, 56, 6);
  tube([[1.27, 0.34, -0.085], [1.2, 0.5, -0.12], [1.11, 0.78, -0.11], [1.02, 0.95, -0.05], forkPt(0.755, 0.07).add(V(0.0, -0.03))], 0.003, blk, g, 48, 6);
}

export { CONTROLS };
