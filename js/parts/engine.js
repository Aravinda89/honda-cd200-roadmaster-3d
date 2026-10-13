// Engine exterior. The internals (stage 3) are in internals.js and share this cylinder frame.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CRANK, CYL_BASE, CYL_TILT, MAINSHAFT, MAT, V, addPart, extrude, hullOfCircles, lathe, mesh, rbox, rod, tube } from '../core.js';

/* =====================================================================
   Build: engine (outside)
   ===================================================================== */
const CYL_A = V(Math.sin(CYL_TILT), Math.cos(CYL_TILT)), CYL_P = V(Math.cos(CYL_TILT), -Math.sin(CYL_TILT));
const cylWorld = (lx, ly, z = 0) => CYL_BASE.clone().addScaledVector(CYL_A, ly).addScaledVector(CYL_P, lx).setZ(z);
{
  const g = addPart('cylinders', 'engine', 'Cylinders and head', 'photo', '194 cc air-cooled four-stroke OHC parallel twin, bore and stroke 53 × 44 mm. Finned barrel and head, leaning forward.', [0.04, 0.03, 0]);
  const cast = MAT.casting(), pol = MAT.alloy(), blk = MAT.black();
  const cyl = new THREE.Group(); cyl.position.copy(CYL_BASE); cyl.rotation.z = -CYL_TILT; g.add(cyl);
  mesh(new RoundedBoxGeometry(0.095, 0.1, 0.215, 2, 0.01), cast, cyl).position.y = 0.05;
  for (let k = 0; k < 8; k++) { const f = mesh(new THREE.BoxGeometry(0.135, 0.0042, 0.238), cast, cyl); f.position.y = 0.008 + k * 0.0118; }
  mesh(new RoundedBoxGeometry(0.11, 0.07, 0.228, 2, 0.01), cast, cyl).position.y = 0.137;
  for (let k = 0; k < 6; k++) { const f = mesh(new THREE.BoxGeometry(0.175, 0.0042, 0.262), cast, cyl); f.position.y = 0.106 + k * 0.0108; }
  mesh(new RoundedBoxGeometry(0.14, 0.03, 0.245, 3, 0.012), pol, cyl).position.y = 0.183;
  [-1, 1].forEach((s) => {
    const c = mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.012, 24), pol, cyl); c.rotation.x = Math.PI / 2; c.position.set(0, 0.17, s * 0.128);
    rod(V(0.07, 0.135, s * 0.07), V(0.11, 0.155, s * 0.076), 0.011, blk, cyl);
    tube([V(0.11, 0.155, s * 0.076), V(0.125, 0.2, s * 0.07), V(0.05, 0.24, s * 0.06)], 0.0035, blk, cyl, 16, 6);
    rod(V(0.07, 0.12, s * 0.065), V(0.1, 0.12, s * 0.065), 0.025, pol, cyl, 20);
  });
}
{
  const g = addPart('crankcase', 'engine', 'Crankcase and covers', 'photo', 'Holds the crankshaft and the 4-speed constant-mesh gearbox. Round alternator cover on the left; on the right, the primary drive cover with the clutch dome and the clutch operating arm. The right-hand cover is placed over the clutch and primary gears as the gearbox is laid out, not yet checked against a photo of the right side.', [0, -0.12, 0]);
  const cast = MAT.casting(), pol = MAT.alloy();
  const pts = [[0.505, 0.39], [0.545, 0.425], [0.64, 0.432], [0.76, 0.434], [0.83, 0.425], [0.86, 0.385], [0.866, 0.33], [0.848, 0.27], [0.8, 0.232], [0.7, 0.22], [0.58, 0.222], [0.522, 0.248], [0.5, 0.32]];
  const shape = new THREE.Shape(); shape.moveTo(0.5, 0.32);
  shape.splineThru([...pts.map(([x, y]) => new THREE.Vector2(x, y))]);
  extrude(shape, 0.22, 0.012, cast, g, -0.11);
  lathe([[0, 0], [0.084, 0], [0.084, 0.008], [0.077, 0.022], [0.06, 0.028], [0, 0.03]], V(0.655, 0.35, -0.12), V(0, 0, -1), pol, g, 48);
  // right-hand (primary drive) cover over the crankshaft gear and the clutch, with the clutch dome
  const rc = MAT.alloy();
  extrude(new THREE.Shape(hullOfCircles([[CRANK.x, CRANK.y, 0.05], [MAINSHAFT.x, MAINSHAFT.y, 0.068]]).map(([x, y]) => new THREE.Vector2(x, y))), 0.028, 0.008, rc, g, 0.114);
  lathe([[0, 0], [0.062, 0], [0.062, 0.01], [0.055, 0.021], [0.036, 0.026], [0, 0.027]], V(MAINSHAFT.x, MAINSHAFT.y, 0.148), V(0, 0, 1), rc, g, 48);
  rbox(0.1, 0.12, 0.03, 0.012, cast, g, V(0.545, 0.33, -0.134));
  rod([0.585, 0.38, 0.12], [0.585, 0.38, 0.152], 0.016, pol, g);
  rod([0.62, 0.425, 0.11], [0.62, 0.455, 0.11], 0.012, MAT.black(), g);
}

export { CYL_P, cylWorld };
