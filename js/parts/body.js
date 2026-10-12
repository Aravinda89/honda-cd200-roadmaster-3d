// Bodywork: tank, seats, rack, side covers, chain case, mudguards, engine guard, number plates.
import * as THREE from 'three';
import { DEG, FA, FD, MAT, R, RA, TEX, V, addPart, arcPts, extrude, fenderGeometry, forkPt, hullOfCircles, loftGeometry, mesh, qAlong, rbox, rod, roundRectShape, sideGroup, smooth, superLoft, surfPatch, tube } from '../core.js';

/* =====================================================================
   Build: bodywork
   ===================================================================== */
const tankS = superLoft({
  x0: 0.485, x1: 0.925, capR: 3.0, capF: 4.5,
  yTop: (u) => 0.865 - 0.11 * Math.pow(1 - u, 4),
  yBot: (u) => 0.66 + 0.012 * u,
  w: (u) => 0.092 + 0.045 * Math.pow(Math.sin(Math.PI * Math.pow(u, 1.6)), 0.6),
  nTop: 2.5, nBot: 3.4, nSide: 2.5,
});
{
  const g = addPart('tank', 'body', 'Fuel tank', 'photo', 'Painted steel tank with chrome side panels, ribbed rubber knee pads and side badges. It sits on the frame backbone, just above the cylinder head.', [0, 0.32, 0]);
  const paint = MAT.paint(), chrome = MAT.chrome();
  const elev = (phi) => (phi < Math.PI / 2 ? phi : Math.PI - phi);
  const geo = loftGeometry(tankS, 80, 80, (u, phi) => (u > 0.03 && u < 0.93 && elev(phi) > -1.25 && elev(phi) < 0.88 ? 1 : 0));
  mesh(geo, [paint, chrome], g);
  const knee = MAT.textured(TEX.knee, 0.8);
  [1, -1].forEach((side) => {
    mesh(surfPatch(tankS, { uc: 0.31, du: 0.24, ec: 0.0, de: 0.6, side, off: 0.004, sq: 3.4 }), knee, g);
    // the patch's texture runs front-to-back on both sides, so the left side's copy is flipped to keep HONDA readable
    let map = TEX.tankBadge[side > 0 ? 1 : 0];
    if (side < 0) { map = map.clone(); map.wrapS = THREE.RepeatWrapping; map.repeat.x = -1; map.offset.x = 1; map.needsUpdate = true; }
    mesh(surfPatch(tankS, { uc: 0.73, du: 0.12, ec: 0.37, de: 0.44, side, off: 0.0035, sq: 6, even: true }), MAT.badge(map), g, false);
  });
  // bayonet filler cap with four lobes and a hinged centre flap (photo set3-21)
  const top = tankS(0.69, Math.PI / 2), n = tankS(0.695, Math.PI / 2).sub(tankS(0.685, Math.PI / 2));
  const capN = V(-n.y, n.x).normalize();
  const cg = new THREE.Group(); cg.position.copy(top); cg.quaternion.copy(qAlong(capN)); g.add(cg);
  const lobes = new THREE.Shape();
  for (let i = 0; i <= 96; i++) {
    const a = 2 * Math.PI * i / 96, r = 0.03 + 0.007 * Math.pow(Math.max(0, Math.cos(4 * a)), 3);
    if (i) lobes.lineTo(r * Math.cos(a), r * Math.sin(a)); else lobes.moveTo(r, 0);
  }
  const lg = new THREE.ExtrudeGeometry(lobes, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 3, curveSegments: 8 });
  lg.rotateX(-Math.PI / 2);
  const ch = MAT.chrome();
  mesh(lg, ch, cg);
  mesh(new THREE.CylinderGeometry(0.018, 0.021, 0.006, 32), ch, cg).position.y = 0.0155;
  mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.002, 32), MAT.black(), cg).position.y = 0.0188;
}
const seatS = superLoft({
  x0: 0.163, x1: 0.53, capR: 6, capF: 3.2,
  yTop: (u) => 0.776 + 0.008 * Math.pow(1 - u, 2) - 0.03 * Math.pow(u, 6),
  yBot: () => 0.64,
  w: (u) => 0.148 - 0.035 * u * u,
  nTop: 3.4, nBot: 12, nSide: 7,
});
const SEAT_TOP = Math.min(...Array.from({ length: 41 }, (_, i) => seatS(0.1 + 0.6 * i / 40, Math.PI / 2).y));
{
  const g = addPart('seat', 'body', 'Rider seat', 'photo', 'Pleated vinyl saddle with stitched cross pleats. The published seat height is 744 mm; on your bike it measures about 775 mm in the photos, so the seat may be thicker than the original.', [-0.04, 0.22, 0]);
  mesh(loftGeometry(seatS, 56, 64), MAT.textured(TEX.seat, 0.5), g);
  rbox(0.35, 0.012, 0.27, 0.005, MAT.black(), g, V(0.345, 0.637, 0));
}
{
  const g = addPart('pillion', 'body', 'Pillion seat', 'photo', 'Separate box-shaped passenger pad with cross pleats, bolted on top of the rear carrier.', [-0.12, 0.34, 0]);
  const S = superLoft({ x0: -0.222, x1: 0.131, capR: 6, capF: 6, yTop: () => 0.828, yBot: () => 0.737, w: () => 0.135, nTop: 4.5, nBot: 12, nSide: 8 });
  mesh(loftGeometry(S, 40, 56), MAT.textured(TEX.pillion, 0.5), g);
}
{
  const g = addPart('rack', 'body', 'Rear carrier', 'photo', 'Wide chrome luggage carrier running from behind the rider seat to past the tail light. The pillion pad sits on its cross rails.', [-0.22, 0.24, 0]);
  const ch = MAT.chrome(), Z = 0.2, T = 0.748, L = 0.692;
  tube([[0.148, 0.795, -0.14], [0.16, 0.768, -0.182], [0.16, T, -Z], [-0.1, T, -Z], [-0.37, T, -Z], [-0.4, T, -0.16], [-0.405, T, 0],
        [-0.4, T, 0.16], [-0.37, T, Z], [-0.1, T, Z], [0.16, T, Z], [0.16, 0.768, 0.182], [0.148, 0.795, 0.14], [0.146, 0.802, 0]], 0.0095, ch, g, 320, 10, true);
  [-1, 1].forEach((s) => {
    rod([0.13, L, 0.19 * s], [-0.37, L, 0.19 * s], 0.0085, ch, g);
    [0.13, 0.0, -0.13, -0.26, -0.37].forEach((x) => rod([x, L, 0.19 * s], [x, T, Z * s], 0.007, ch, g));
    rod([0.12, L, 0.19 * s], [0.12, 0.628, 0.1 * s], 0.0085, ch, g);
    rod([-0.13, L, 0.19 * s], [-0.13, 0.62, 0.1 * s], 0.0085, ch, g);
    rbox(0.05, 0.006, 0.06, 0.003, ch, g, V(0.1, T - 0.004, 0.16 * s));
    rbox(0.05, 0.006, 0.06, 0.003, ch, g, V(-0.19, T - 0.004, 0.16 * s));
  });
  [-0.05, -0.17, -0.27, -0.335].forEach((x) => rod([x, T - 0.005, -Z], [x, T - 0.005, Z], 0.007, ch, g));
}
{
  const g = addPart('sidecovers', 'body', 'Side covers', 'photo', 'Painted panels under the seat with a plain chrome front section and the ROAD MASTER CD200 badge. They close off the space between the frame rails behind the engine.');
  [1, -1].forEach((s) => {
    const sg = sideGroup(g, [0, 0, 0.28 * s]);
    const holder = new THREE.Group(); holder.scale.z = s; sg.add(holder);
    extrude(roundRectShape(0.199, 0.472, 0.49, 0.644, 0.035), 0.026, 0.008, MAT.paint(), holder, 0.118);
    extrude(roundRectShape(0.462, 0.48, 0.53, 0.644, 0.03), 0.03, 0.012, MAT.chrome(), holder, 0.114);
    // badge size and place measured from photo set3-01; kept outside the mirrored holder so the text reads on both sides
    const badge = mesh(new THREE.PlaneGeometry(0.2, 0.064), MAT.badge(TEX.sideBadge), sg, false);
    badge.position.set(0.335, 0.558, 0.1535 * s); if (s < 0) badge.rotation.y = Math.PI;
  });
}
{
  const g = addPart('chaincase', 'body', 'Chain case', 'photo', 'Fully enclosed chain case on the left side. It keeps road dirt and water off the drive chain.', [0, 0, -0.36]);
  const hull = hullOfCircles([[0, 0.31, 0.112], [0.07, 0.378, 0.092], [0.4, 0.4, 0.07]]);
  extrude(new THREE.Shape(hull.map(([x, y]) => new THREE.Vector2(x, y))), 0.03, 0.008, MAT.paint(), g, -0.158);
  const cap = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.01, 28), MAT.black(), g); cap.rotation.x = Math.PI / 2; cap.position.set(0, R, -0.172);
}
{
  const g = addPart('fmud', 'body', 'Front mudguard', 'photo', 'Deep chrome mudguard with side valances that wrap down over the tyre, longest behind the fork. It is bolted to the fork sliders, so it moves with the wheel.', [0.26, 0.04, 0]);
  const grp = new THREE.Group(); grp.position.copy(FA); g.add(grp);
  const ch = MAT.chrome(THREE.DoubleSide);
  const p0 = 52 * DEG, p1 = 205 * DEG;
  const rIn = (ph) => 0.27 - 0.065 * smooth((ph - p0) / (150 * DEG - p0)), rOut = () => 0.335;
  mesh(fenderGeometry({ rIn, rOut, width: 0.125, phi0: p0, phi1: p1 }), ch, grp);
  [-1, 1].forEach((s) => tube(arcPts(rIn, p0, p1, s * 0.0625, 60), 0.003, ch, grp, 90, 6));
  [-1, 1].forEach((s) => {
    const a = 62 * DEG, b = 165 * DEG;
    tube([FD.clone().multiplyScalar(0.04).setZ(s * 0.088), V(0.07, 0.15, s * 0.08), V(rIn(a) * Math.cos(a), rIn(a) * Math.sin(a), s * 0.064)], 0.0045, ch, grp, 24, 6);
    tube([FD.clone().multiplyScalar(0.06).setZ(s * 0.088), V(rIn(b) * Math.cos(b) + 0.01, rIn(b) * Math.sin(b), s * 0.066)], 0.0045, ch, grp, 12, 6);
  });
}
{
  const g = addPart('rmud', 'body', 'Rear mudguard', 'photo', 'Chrome rear mudguard that flares out at the back, behind the number plate. The tail light and plate mount at its rear end.', [-0.28, 0, 0]);
  const grp = new THREE.Group(); grp.position.copy(RA); g.add(grp);
  const ch = MAT.chrome(THREE.DoubleSide);
  const flare = (ph) => 0.055 * smooth((ph - 150 * DEG) / (45 * DEG));
  const rIn = (ph) => 0.258 + flare(ph), rOut = (ph) => 0.345 + flare(ph);
  mesh(fenderGeometry({ rIn, rOut, width: 0.15, phi0: 48 * DEG, phi1: 197 * DEG }), ch, grp);
  [-1, 1].forEach((s) => tube(arcPts(rIn, 48 * DEG, 197 * DEG, s * 0.075, 60), 0.003, ch, grp, 90, 6));
}
{
  const g = addPart('guard', 'body', 'Engine guard', 'photo', 'Wide chrome guard loops either side of the engine. They protect the cylinders, exhaust and the rider\'s legs if the bike falls.', [0.24, -0.02, 0]);
  const ch = MAT.chrome();
  [-1, 1].forEach((s) => {
    tube([[0.978, 0.57, 0.02 * s], [0.955, 0.573, 0.12 * s], [0.95, 0.57, 0.235 * s], [0.955, 0.545, 0.28 * s], [0.962, 0.4, 0.285 * s], [0.962, 0.27, 0.283 * s], [0.95, 0.228, 0.255 * s], [0.92, 0.212, 0.18 * s], [0.87, 0.205, 0.1 * s]], 0.0115, ch, g, 90, 12);
    rod([0.955, 0.573, 0.135 * s], [0.958, 0.225, 0.21 * s], 0.0105, ch, g);
  });
}
{
  const g = addPart('plates', 'body', 'Number plates', 'photo', 'Wide front plate below the headlamp and rear plate under the tail light, both in chrome frames. Left blank in the model.');
  const front = sideGroup(g, [0.42, 0.05, 0]);
  const fp = new THREE.Group(); fp.position.set(1.19, 0.745, 0); fp.quaternion.setFromUnitVectors(V(1, 0, 0), V(Math.cos(12 * DEG), Math.sin(12 * DEG), 0)); front.add(fp);
  rbox(0.006, 0.077, 0.312, 0.006, MAT.chrome(), fp, V(-0.004, 0, 0));
  rbox(0.004, 0.065, 0.3, 0.004, MAT.plate(), fp, V(0, 0, 0));
  rod([1.18, 0.735, 0], forkPt(0.45, -0.01), 0.007, MAT.black(), front);
  const rear = sideGroup(g, [-0.5, 0.05, 0]);
  const rp = new THREE.Group(); rp.position.set(-0.37, 0.49, 0); rp.quaternion.setFromUnitVectors(V(1, 0, 0), V(-Math.cos(8 * DEG), Math.sin(8 * DEG), 0)); rear.add(rp);
  rbox(0.006, 0.202, 0.312, 0.006, MAT.chrome(), rp, V(-0.004, 0, 0));
  rbox(0.004, 0.19, 0.3, 0.004, MAT.plate(), rp, V(0, 0, 0));
  rod([-0.362, 0.59, 0], [-0.352, 0.612, 0], 0.006, MAT.chrome(), rear);
}

export { SEAT_TOP };
