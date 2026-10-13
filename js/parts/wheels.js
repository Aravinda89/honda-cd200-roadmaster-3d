// Wheels and final drive. Drum brakes are in brakes.js.
import * as THREE from 'three';
import { FA, LAYSHAFT, MAT, R, RA, RIM, V, Y_UP, addPart, beltPath, chainLinks, extrude, gearShape, lathe, mesh, rod } from '../core.js';

/* =====================================================================
   Build: wheels, brakes & drive
   ===================================================================== */
function wheel(parent, brakeSide) {
  const chrome = MAT.chrome(), rub = MAT.rubber(), alloy = MAT.alloy();
  mesh(new THREE.TorusGeometry(R - 0.036, 0.036, 28, 128), rub, parent);
  [-0.013, 0, 0.013].forEach((z) => { const t = mesh(new THREE.TorusGeometry(R - 0.0005, 0.0018, 4, 128), MAT.black(), parent, false); t.position.z = z; });
  const band = new THREE.CylinderGeometry(RIM, RIM, 0.046, 96, 1, true); band.rotateX(Math.PI / 2);
  mesh(band, MAT.chrome(THREE.DoubleSide), parent);
  [-0.023, 0.023].forEach((z) => { const t = mesh(new THREE.TorusGeometry(RIM + 0.0045, 0.0045, 8, 128), chrome, parent); t.position.z = z; });
  const s = brakeSide;
  lathe([[0.012, 0], [0.05, 0], [0.085, 0.005], [0.088, 0.02], [0.06, 0.023], [0.058, 0.03], [0.044, 0.035], [0.044, 0.077], [0.056, 0.081], [0.056, 0.088], [0.03, 0.1], [0.012, 0.105]], V(0, 0, s * 0.055), V(0, 0, -s), alloy, parent, 40);
  const inst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0019, 0.0019, 1, 5), MAT.chrome(), 36);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  for (let i = 0; i < 36; i++) {
    const fl = i % 2, k = Math.floor(i / 2);
    const hz = fl ? s * 0.0285 : -s * 0.0295, hr = fl ? 0.057 : 0.055;
    const ha = k * (2 * Math.PI / 18) + (fl ? Math.PI / 18 : 0), ra = ha + (k % 2 ? 0.95 : -0.95);
    const a = V(hr * Math.cos(ha), hr * Math.sin(ha), hz), b = V((RIM - 0.004) * Math.cos(ra), (RIM - 0.004) * Math.sin(ra), Math.sign(hz) * 0.007);
    const d = b.clone().sub(a);
    q.setFromUnitVectors(Y_UP, d.clone().normalize()); sc.set(1, d.length(), 1);
    m4.compose(a.clone().addScaledVector(d, 0.5), q, sc); inst.setMatrixAt(i, m4);
  }
  inst.castShadow = false; parent.add(inst);
  rod([0, 0, -0.1], [0, 0, 0.1], 0.008, chrome, parent);
  [-1, 1].forEach((z) => { const n = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 6), chrome, parent); n.rotation.x = Math.PI / 2; n.position.z = z * 0.106; });
}
{
  const g = addPart('fwheel', 'wheels', 'Front wheel', 'spec', '17-inch chromed steel rim with steel spokes and a 3.00-17 4-ply ribbed tyre. Pressure 25 psi cold.', [0.34, 0, 0]);
  const grp = new THREE.Group(); grp.position.copy(FA); g.add(grp); wheel(grp, -1);
}
{
  const g = addPart('rwheel', 'wheels', 'Rear wheel', 'spec', '17-inch chromed steel rim with steel spokes and a 3.00-17 6-ply tyre. Pressure 32 psi cold, or 40 psi when carrying over 90 kg.', [-0.36, 0, 0]);
  const grp = new THREE.Group(); grp.position.copy(RA); g.add(grp); wheel(grp, 1);
}
// Final drive: the manual gives the reduction (2.333 : 1) but not the tooth counts or chain size.
// Drawn as 15T and 35T sprockets on 1/2-inch pitch chain, which gives exactly 2.333 : 1. The front
// sprocket itself belongs to the gearbox (gearbox.js); this part is the chain and rear sprocket.
const CHAIN_Z = -0.112, FRONT_R = 0.0305, REAR_T = 35, REAR_R = FRONT_R * REAR_T / 15;
const FINAL = {};
{
  const g = addPart('drive', 'wheels', 'Chain and rear sprocket', 'est', 'Final drive chain from the gearbox sprocket to the rear wheel sprocket, fully enclosed in the chain case: final reduction 2.333 : 1. Check the play at the middle of the lower run through the inspection hole in the case: about 20 mm. Adjust by slackening the spindle and sleeve nuts and turning the two adjuster bolts the same amount, so the index marks match on both sides; tighten the sleeve nut to 6.0–7.0 kgf m and the spindle nut to 4.0–5.0 kgf m with a new split pin. The tooth counts are not in the manual: the sprockets are drawn 15T and 35T, which gives 2.333 : 1.', [-0.05, 0, -0.22]);
  const rear = new THREE.Group(); rear.position.set(RA.x, RA.y, CHAIN_Z); g.add(rear);
  extrude(gearShape(REAR_R - 0.002, REAR_T, 0.004), 0.004, 0.0004, MAT.black(), rear, -0.002);
  const path = beltPath(LAYSHAFT, FRONT_R, V(RA.x, RA.y), REAR_R);
  const chain = chainLinks(path, 0.0127, MAT.chain(), g, { thick: 0.005, width: 0.009, z: CHAIN_Z });
  Object.assign(FINAL, { rear, chain });
}
/** Pose the chain and rear sprocket from the layshaft and wheel rotations (rad about +z). */
function poseFinalDrive(layRho, wheelRho) {
  FINAL.rear.rotation.z = wheelRho;
  FINAL.chain.update(-layRho * FRONT_R);
}

export { FRONT_R, REAR_R, poseFinalDrive };
