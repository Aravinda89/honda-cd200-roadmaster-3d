// Lights, instruments and horns.
import * as THREE from 'three';
import { DEG, MAT, TEX, V, addPart, dialFace, forkPt, lathe, mesh, qAlong, rbox, rod, sideGroup } from '../core.js';

/* =====================================================================
   Build: lights & instruments
   ===================================================================== */
const HL = forkPt(0.618, 0.138);
const SPEEDO = { lamps: { turn: false, neutral: false, high: false } };
/** Light or put out the TURN, NEUTRAL and HIGH BEAM lamps on the speedometer face (pass only the ones to change). */
function setDialLamps(lamps) {
  Object.assign(SPEEDO.lamps, lamps);
  const map = dialFace(SPEEDO.lamps);
  if (SPEEDO.face.map !== map) { SPEEDO.face.map = map; SPEEDO.face.needsUpdate = true; }
}
const setNeutralLamp = (on) => setDialLamps({ neutral: on });

// Lamp glows: additive meshes over the lenses, opacity 0 until a circuit lights them (stage 5).
const glowMat = (color) => {
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  m.userData.noGhost = true;
  return m;
};
const noPick = (m) => { m.raycast = () => {}; m.castShadow = false; return m; };
const GLOW = { head: glowMat(0xfff1cf), beam: glowMat(0xfff1cf), turnL: glowMat(0xffa526), turnR: glowMat(0xffa526), tail: glowMat(0xff2a1c) };
const HORNS = [];
function indicator(parent, center, dir, stalkFrom, chrome, amber, glow) {
  const d = dir.clone().normalize();
  lathe([[0, 0], [0.02, 0], [0.033, 0.022], [0.036, 0.032]], center.clone().addScaledVector(d, -0.032), d, chrome, parent, 24);
  const lens = mesh(new THREE.SphereGeometry(0.036, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), amber, parent);
  lens.position.copy(center); lens.quaternion.copy(qAlong(d)); lens.scale.set(1, 0.75, 1);
  const halo = noPick(mesh(new THREE.SphereGeometry(0.046, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), glow, parent, false));
  halo.position.copy(center); halo.quaternion.copy(qAlong(d)); halo.scale.set(1, 0.85, 1);
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
  // lamp glow over the lens, and a faint beam that dips on low beam
  const disc = noPick(mesh(new THREE.CircleGeometry(0.08, 40), GLOW.head, g, false)); disc.rotation.y = Math.PI / 2; disc.position.copy(HL).add(V(0.014, 0));
  const beam = new THREE.Group(); beam.position.copy(HL).add(V(0.015, 0)); g.add(beam);
  const cone = new THREE.ConeGeometry(0.3, 1.0, 32, 1, true); cone.translate(0, -0.5, 0); cone.rotateZ(Math.PI / 2);
  noPick(mesh(cone, GLOW.beam, beam, false));
  GLOW.beamGroup = beam;
}
{
  const g = addPart('speedo', 'lights', 'Speedometer', 'photo', 'Rectangular instrument in a black housing above the headlamp. The dial reads 0–160 km/h, with the odometer below the needle and a green band marking the speed range for each of the four gears. Beside the dial are the TURN, NEUTRAL and HIGH BEAM warning lamps.', [0.16, 0.28, 0]);
  const sp = new THREE.Group(); sp.position.copy(forkPt(0.755, 0.07)); sp.rotation.z = 0.5; g.add(sp);
  const blk = MAT.black();
  rbox(0.1, 0.06, 0.15, 0.012, blk, sp);
  rbox(0.104, 0.012, 0.154, 0.005, blk, sp, V(0, 0.026, 0));
  const face = new THREE.PlaneGeometry(0.13, 0.084); face.rotateX(-Math.PI / 2); face.rotateY(-Math.PI / 2);
  const faceMat = new THREE.MeshStandardMaterial({ map: dialFace(), roughness: 0.35, metalness: 0 });
  mesh(face, faceMat, sp, false).position.y = 0.0325;
  SPEEDO.face = faceMat;
  rod(forkPt(0.735, -0.01), forkPt(0.755, 0.055), 0.008, MAT.black(), g);
}
{
  const g = addPart('findic', 'lights', 'Front indicators', 'photo', 'Amber turn signals on stalks either side of the headlamp.');
  [-1, 1].forEach((s) => {
    const sg = sideGroup(g, [0.36, 0.06, 0.12 * s]);
    indicator(sg, V(1.1, 0.878, s * 0.158), V(1, 0), forkPt(0.638, 0.0, s * 0.115), MAT.chrome(), MAT.amber(), s < 0 ? GLOW.turnL : GLOW.turnR);
  });
}
{
  const g = addPart('rindic', 'lights', 'Rear indicators', 'photo', 'Amber turn signals on short stalks either side of the rear frame, below the carrier.');
  [-1, 1].forEach((s) => {
    const sg = sideGroup(g, [-0.5, 0.1, 0.1 * s]);
    indicator(sg, V(-0.2, 0.62, 0.15 * s), V(-1, 0), V(-0.17, 0.62, 0.085 * s), MAT.chrome(), MAT.amber(), s < 0 ? GLOW.turnL : GLOW.turnR);
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
  noPick(rbox(0.003, 0.104, 0.209, 0.002, GLOW.tail, g, V(-0.3893, 0.672, 0)));   // tail lamp (running) glow; the stop lamp glow is in brakes.js
}
{
  const g = addPart('horn', 'lights', 'Horns', 'photo', 'Two round horns, one at each end of the front number plate.', [0.36, -0.02, 0]);
  [-1, 1].forEach((s) => {
    const sg = sideGroup(g, [0, 0, 0.12 * s]);
    const c = V(1.182, 0.745, s * 0.172);
    HORNS.push(lathe([[0, 0], [0.03, 0], [0.03, 0.01], [0.026, 0.019], [0, 0.021]], c, V(Math.cos(12 * DEG), Math.sin(12 * DEG), 0), MAT.chrome(), sg, 36));
    rod(c, V(1.176, 0.742, s * 0.14), 0.006, MAT.black(), sg);
  });
}

/** Set the lamp glows (0..1 each) for stage 5: head, beam (main true / dip false), turnL, turnR, tail; horn 0..1 vibration. */
function poseLamps({ head = 0, main = true, turnL = 0, turnR = 0, tail = 0, horn = 0, t = 0 } = {}) {
  GLOW.head.opacity = head * (main ? 0.85 : 0.6);
  GLOW.beam.opacity = head * (main ? 0.05 : 0.035);
  GLOW.beamGroup.rotation.z = (main ? -2 : -9) * DEG;
  GLOW.turnL.opacity = turnL * 0.9; GLOW.turnR.opacity = turnR * 0.9;
  GLOW.tail.opacity = tail * 0.4;
  const k = 1 + horn * 0.06 * Math.sin(t * 90);
  HORNS.forEach((h) => h.scale.set(k, 1, k));
}

export { poseLamps, setDialLamps, setNeutralLamp };
