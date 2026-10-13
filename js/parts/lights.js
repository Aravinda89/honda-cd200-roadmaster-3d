// Lights, instruments and horns.
import * as THREE from 'three';
import { DEG, MAT, TEX, V, addPart, forkPt, lathe, mesh, qAlong, rbox, rod, sideGroup } from '../core.js';

/* =====================================================================
   Build: lights & instruments
   ===================================================================== */
const HL = forkPt(0.618, 0.138);
const SPEEDO = {};
/** Light or put out the green neutral lamp on the speedometer face. */
function setNeutralLamp(on) {
  const map = on ? TEX.dialN : TEX.dial;
  if (SPEEDO.face.map !== map) { SPEEDO.face.map = map; SPEEDO.face.needsUpdate = true; }
}
function indicator(parent, center, dir, stalkFrom, chrome, amber) {
  const d = dir.clone().normalize();
  lathe([[0, 0], [0.02, 0], [0.033, 0.022], [0.036, 0.032]], center.clone().addScaledVector(d, -0.032), d, chrome, parent, 24);
  const lens = mesh(new THREE.SphereGeometry(0.036, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), amber, parent);
  lens.position.copy(center); lens.quaternion.copy(qAlong(d)); lens.scale.set(1, 0.75, 1);
  rod(stalkFrom, center.clone().addScaledVector(d, -0.028), 0.0065, chrome, parent);
}
{
  const g = addPart('headlamp', 'lights', 'Headlamp', 'photo', 'Round headlamp with a fluted lens and chrome rim, in a painted shell carried between the fork covers.', [0.36, 0.06, 0]);
  lathe([[0, 0], [0.046, 0], [0.068, 0.033], [0.081, 0.075], [0.086, 0.108], [0.086, 0.118]], HL.clone().add(V(-0.118, 0)), V(1, 0), MAT.paint(), g, 48);
  const rim = mesh(new THREE.TorusGeometry(0.083, 0.0075, 12, 64), MAT.chrome(), g); rim.rotation.y = Math.PI / 2; rim.position.copy(HL).add(V(0.002, 0));
  const lg = new THREE.CircleGeometry(0.079, 48), pa = lg.attributes.position;
  for (let i = 0; i < pa.count; i++) { const r = Math.hypot(pa.getX(i), pa.getY(i)) / 0.079; pa.setZ(i, 0.011 * (1 - r * r)); }
  lg.computeVertexNormals(); lg.rotateY(Math.PI / 2);
  const lens = mesh(lg, new THREE.MeshPhysicalMaterial({ map: TEX.lens, roughness: 0.12, metalness: 0.15, clearcoat: 1 }), g); lens.position.copy(HL).add(V(0.001, 0));
  [-1, 1].forEach((s) => rod(forkPt(0.618, 0.0, s * 0.09), HL.clone().add(V(-0.06, 0, s * 0.075)), 0.009, MAT.paint(), g));
}
{
  const g = addPart('speedo', 'lights', 'Speedometer', 'photo', 'Rectangular instrument in a black housing above the headlamp. The dial reads 0–160 km/h, with the odometer below the needle and a green band marking the speed range for each of the four gears. Beside the dial are the TURN, NEUTRAL and HIGH BEAM warning lamps.', [0.16, 0.28, 0]);
  const sp = new THREE.Group(); sp.position.copy(forkPt(0.755, 0.07)); sp.rotation.z = 0.5; g.add(sp);
  const blk = MAT.black();
  rbox(0.1, 0.06, 0.15, 0.012, blk, sp);
  rbox(0.104, 0.012, 0.154, 0.005, blk, sp, V(0, 0.026, 0));
  const face = new THREE.PlaneGeometry(0.13, 0.084); face.rotateX(-Math.PI / 2); face.rotateY(-Math.PI / 2);
  const faceMat = new THREE.MeshStandardMaterial({ map: TEX.dial, roughness: 0.35, metalness: 0 });
  mesh(face, faceMat, sp, false).position.y = 0.0325;
  SPEEDO.face = faceMat;
  rod(forkPt(0.735, -0.01), forkPt(0.755, 0.055), 0.008, MAT.black(), g);
}
{
  const g = addPart('findic', 'lights', 'Front indicators', 'photo', 'Amber turn signals on stalks either side of the headlamp.');
  [-1, 1].forEach((s) => {
    const sg = sideGroup(g, [0.36, 0.06, 0.12 * s]);
    indicator(sg, V(1.1, 0.878, s * 0.158), V(1, 0), forkPt(0.638, 0.0, s * 0.115), MAT.chrome(), MAT.amber());
  });
}
{
  const g = addPart('rindic', 'lights', 'Rear indicators', 'photo', 'Amber turn signals on short stalks either side of the rear frame, below the carrier.');
  [-1, 1].forEach((s) => {
    const sg = sideGroup(g, [-0.5, 0.1, 0.1 * s]);
    indicator(sg, V(-0.2, 0.62, 0.15 * s), V(-1, 0), V(-0.17, 0.62, 0.085 * s), MAT.chrome(), MAT.amber());
  });
}
{
  const g = addPart('tail', 'lights', 'Tail light', 'photo', 'Large red tail and stop lamp, hung under the back of the carrier above the number plate. The one-piece lens is held by two screws; its round centre boss carries the rear reflector.', [-0.5, 0.12, 0]);
  // shape from photo set3-15: rectangular red lens on a dark base, with a large round boss low in the centre
  const red = MAT.red();
  rbox(0.03, 0.1, 0.19, 0.01, MAT.black(), g, V(-0.343, 0.672, 0));
  rbox(0.032, 0.1, 0.205, 0.014, red, g, V(-0.372, 0.672, 0));
  lathe([[0, 0], [0.05, 0], [0.05, 0.012], [0.044, 0.023], [0.036, 0.028], [0, 0.028]], V(-0.38, 0.655, 0), V(-1, 0), red, g, 40);
  const refl = MAT.red(); refl.color.set(0x8f0f15); refl.roughness = 0.4;
  const rd = mesh(new THREE.CircleGeometry(0.029, 36), refl, g, false); rd.rotation.y = -Math.PI / 2; rd.position.set(-0.4085, 0.655, 0);
  [-1, 1].forEach((s) => rod([-0.374, 0.66, 0.085 * s], [-0.39, 0.66, 0.085 * s], 0.004, MAT.chrome(), g));   // lens screws
  [-1, 1].forEach((s) => rod([-0.39, 0.748, 0.07 * s], [-0.35, 0.732, 0.07 * s], 0.006, MAT.chrome(), g));
}
{
  const g = addPart('horn', 'lights', 'Horns', 'photo', 'Two round horns, one at each end of the front number plate.', [0.36, -0.02, 0]);
  [-1, 1].forEach((s) => {
    const sg = sideGroup(g, [0, 0, 0.12 * s]);
    const c = V(1.182, 0.745, s * 0.172);
    lathe([[0, 0], [0.03, 0], [0.03, 0.01], [0.026, 0.019], [0, 0.021]], c, V(Math.cos(12 * DEG), Math.sin(12 * DEG), 0), MAT.chrome(), sg, 36);
    rod(c, V(1.176, 0.742, s * 0.14), 0.006, MAT.black(), sg);
  });
}

export { setNeutralLamp };
