// Stage 2: working drum brakes, built from the workshop manual (figs 5.1 and 5.2).
// Exposes the brake rigs and posing functions that the brake mode in app.js drives.
import * as THREE from 'three';
import { DEG, FA, MAT, RA, V, addPart, byId, mesh, qAlong, rbox, rod, tube } from '../core.js';
import './lights.js'; // the brake glow is added to the tail light

/* =====================================================================
   Build: brakes (stage 2)
   Layout follows the workshop manual's Fig. 5.1 (front) and Fig. 5.2 (rear):
   single leading shoe drums, both shoes pivoting on one anchor pin and spread
   by a flat cam. Drum sizes, lining limits and free play from its specs.
   ===================================================================== */
const BRAKE_MAT = {
  drum: () => new THREE.MeshStandardMaterial({ color: 0x5d6267, metalness: 0.75, roughness: 0.45, side: THREE.DoubleSide }),
  lining: () => new THREE.MeshStandardMaterial({ color: 0x4d3c2f, metalness: 0, roughness: 0.95 }),
  shoe: () => new THREE.MeshStandardMaterial({ color: 0xa3a6a3, metalness: 0.6, roughness: 0.5 }),
  steel: () => new THREE.MeshStandardMaterial({ color: 0x80858a, metalness: 0.85, roughness: 0.35 }),
  spring: () => new THREE.MeshStandardMaterial({ color: 0xc2c6ca, metalness: 0.9, roughness: 0.3 }),
  mark: () => new THREE.MeshStandardMaterial({ color: 0xf4f4f0, metalness: 0.1, roughness: 0.5 }),
  glow: (color) => { const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }); m.userData.noGhost = true; return m; },
};
const LINING_NEW = 4.0, LINING_LIMIT = 2.0;
const GAP_VIS = 0.0015;                 // running clearance, drawn larger than real so the movement can be seen
const BRAKES = {};
const unitRod = new THREE.CylinderGeometry(1, 1, 1, 10);
const polar = (r, deg) => V(r * Math.cos(deg * DEG), r * Math.sin(deg * DEG), 0);
function placeRod(m, a, b, r) {
  const d = b.clone().sub(a);
  m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.copy(qAlong(d)); m.scale.set(r, Math.max(d.length(), 1e-4), r);
}
function springGeo(len, coilR, wireR) {
  const turns = Math.max(4, Math.round(len / 0.0026));
  const c = new (class extends THREE.Curve { getPoint(t, v = new THREE.Vector3()) { const a = t * Math.PI * 2 * turns; return v.set(coilR * Math.cos(a), t * len, coilR * Math.sin(a)); } })();
  return new THREE.TubeGeometry(c, turns * 12, wireR, 5, false);
}
function placeSpring(m, a, b, len0) { const d = b.clone().sub(a); m.position.copy(a); m.quaternion.copy(qAlong(d)); m.scale.set(1, d.length() / len0, 1); }
function sectorMesh(r0, r1, a0, a1, z0, z1, mat, parent) {
  const sh = new THREE.Shape();
  sh.absarc(0, 0, r1, a0, a1, false);
  sh.absarc(0, 0, r0, a1, a0, true);
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: Math.abs(z1 - z0), bevelEnabled: false, curveSegments: 40 });
  const m = mesh(g, mat, parent); m.position.z = Math.min(z0, z1);
  return m;
}
const rotAbout = (pt, piv, a) => { const c = Math.cos(a), s = Math.sin(a), x = pt.x - piv.x, y = pt.y - piv.y; return V(piv.x + x * c - y * s, piv.y + x * s + y * c, pt.z); };

function buildBrake(o) {
  const k = o.key, s = o.side, A = o.axle, dR = o.drumR;
  const zMid = s * 0.037, zW = 0.026, zPlate = s * 0.06, zTag = s * 0.067, zArm = s * 0.073;
  const Rt = dR - GAP_VIS - LINING_NEW / 1000;              // outer face of the shoe metal
  const anchorDeg = o.camDeg + 180, C = polar(o.camR, o.camDeg), P = polar(o.camR, anchorDeg);
  const dC = Math.asin(o.camT / 2 / o.camR) / DEG;          // shoe ends sit on the cam flats
  const B = { key: k, o, A, C, P, Rt, zArm, lining: LINING_NEW, shoes: [], springs: [], omega: 0, spin: 0, contactGlow: 0 };
  B.linMat = BRAKE_MAT.lining();
  B.glowMat = BRAKE_MAT.glow(0xff7a1a);

  /* drum: part of the hub, turns with the wheel */
  {
    const g = addPart(`${k}drum`, 'brakes', `${o.label} brake drum`, 'manual', o.drumDesc, o.ex.wheel);
    const grp = new THREE.Group(); grp.position.copy(A); g.add(grp); B.drumGrp = grp;
    const m = BRAKE_MAT.drum(), st = BRAKE_MAT.steel();
    const wall = new THREE.CylinderGeometry(dR, dR, 0.038, 72, 1, true); wall.rotateX(Math.PI / 2);
    mesh(wall, m, grp).position.z = s * 0.035;
    const outer = new THREE.CylinderGeometry(dR + 0.007, dR + 0.007, 0.038, 72, 1, true); outer.rotateX(Math.PI / 2);
    mesh(outer, m, grp).position.z = s * 0.035;
    mesh(new THREE.RingGeometry(0.018, dR + 0.007, 72), m, grp).position.z = s * 0.016;
    mesh(new THREE.RingGeometry(dR, dR + 0.007, 72), m, grp).position.z = s * 0.054;
    for (let i = 0; i < 8; i++) { const r = rbox(0.004, 0.012, 0.03, 0.0015, st, grp, polar(dR + 0.008, i * 45).setZ(s * 0.035)); r.rotation.z = i * 45 * DEG; }
  }

  /* back plate: carries everything that does not turn */
  {
    const g = addPart(`${k}plate`, 'brakes', o.plateName, 'manual', o.plateDesc, o.ex.plate);
    const grp = new THREE.Group(); grp.position.copy(A); g.add(grp);
    const cast = MAT.casting(), st = BRAKE_MAT.steel();
    const plate = mesh(new THREE.CylinderGeometry(dR + 0.016, dR + 0.018, 0.008, 64), cast, grp); plate.rotation.x = Math.PI / 2; plate.position.z = zPlate;
    mesh(new THREE.TorusGeometry(dR + 0.012, 0.0035, 8, 64), cast, grp).position.z = zPlate + s * 0.004;
    rod(P.clone().setZ(zMid - s * 0.017), P.clone().setZ(zPlate + s * 0.008), 0.0055, st, grp, 16);   // anchor pin
    const washer = mesh(new THREE.TorusGeometry(0.0072, 0.0016, 6, 20), st, grp); washer.position.copy(P).setZ(zMid - s * 0.015);
    const boss = mesh(new THREE.CylinderGeometry(0.011, 0.013, 0.008, 24), cast, grp); boss.rotation.x = Math.PI / 2; boss.position.copy(C).setZ(zPlate + s * 0.006);
    const hb = mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.012, 28), cast, grp); hb.rotation.x = Math.PI / 2; hb.position.z = zPlate + s * 0.007;
    // wear indicator mark: where the tag arrow points when a 2.0 mm lining touches the drum
    B.markMesh = mesh(new THREE.ConeGeometry(0.0034, 0.009, 3), BRAKE_MAT.mark(), grp);
    o.extras(grp, B, { cast, st, zPlate, zArm, dR });
  }

  /* shoes and linings: each shoe pivots on the anchor pin */
  {
    const g = addPart(`${k}shoes`, 'brakes', `${o.label} brake shoes`, 'manual', o.shoeDesc, o.ex.shoes);
    const grp = new THREE.Group(); grp.position.copy(A); g.add(grp); B.shoeGrp = grp;
    const spans = [[o.camDeg + dC, anchorDeg - 11, 'a0'], [anchorDeg + 11, o.camDeg + 360 - dC, 'a1']];
    spans.forEach(([a0, a1, camEnd]) => {
      const pg = new THREE.Group(); pg.position.copy(P); grp.add(pg);
      const inner = new THREE.Group(); inner.position.copy(P).multiplyScalar(-1); pg.add(inner);
      const metal = BRAKE_MAT.shoe();
      sectorMesh(Rt - 0.0025, Rt, a0 * DEG, a1 * DEG, zMid - zW / 2, zMid + zW / 2, metal, inner);
      sectorMesh(Rt - 0.017, Rt - 0.0025, a0 * DEG, a1 * DEG, zMid - 0.0025, zMid + 0.0025, metal, inner);
      const lin = { a0: (a0 + 6) * DEG, a1: (a1 - 6) * DEG, z0: zMid - zW / 2 + 0.001, z1: zMid + zW / 2 - 0.001, inner, mesh: null, glow: null };
      const gain = (sign) => {
        let best = 0; const rr = Rt + LINING_NEW / 1000;
        for (let i = 0; i <= 48; i++) { const a = lin.a0 + (lin.a1 - lin.a0) * i / 48, Q = V(rr * Math.cos(a), rr * Math.sin(a)); best = Math.max(best, (rotAbout(Q, P, sign * 1e-3).length() - Q.length()) / 1e-3); }
        return best;
      };
      const gp = gain(1), gn = gain(-1);
      B.shoes.push({ pg, lin, sign: gp >= gn ? 1 : -1, gmax: Math.max(gp, gn), camEnd: camEnd === 'a0' ? a0 : a1 });
    });
  }

  /* return springs: pull the shoes back onto the cam */
  {
    const g = addPart(`${k}springs`, 'brakes', `${o.label} shoe return springs`, 'manual', o.springDesc, o.ex.shoes);
    const grp = new THREE.Group(); grp.position.copy(A); g.add(grp);
    const rr = Rt - 0.012, zs = zMid + s * 0.0055, mat = BRAKE_MAT.spring();
    [[o.camDeg + dC + 17, o.camDeg - dC - 17], [anchorDeg - 26, anchorDeg + 26]].forEach(([d0, d1]) => {
      const a = polar(rr, d0).setZ(zs), b = polar(rr, d1).setZ(zs), len0 = a.distanceTo(b);
      const m = mesh(springGeo(len0, 0.0028, 0.0008), mat, grp);
      B.springs.push({ m, a, b, len0 });
      placeSpring(m, a, b, len0);
    });
  }

  /* cam, operating arm and wear indicator tag: turn together on the splined cam shaft */
  {
    const g = addPart(`${k}cam`, 'brakes', `${o.label} cam and operating arm`, 'manual', o.camDesc, o.ex.cam);
    const grp = new THREE.Group(); grp.position.copy(A); g.add(grp);
    const camG = new THREE.Group(); camG.position.copy(C); grp.add(camG); B.camG = camG;
    const st = BRAKE_MAT.steel(), al = MAT.alloy();
    const cam = rbox(o.camT, o.camL, zW, 0.0025, st, camG, V(0, 0, zMid)); cam.rotation.z = o.camDeg * DEG - Math.PI / 2;
    rod(V(0, 0, zMid), V(0, 0, zArm + s * 0.005), 0.0055, st, camG, 16);
    const arm = rbox(o.armLen, 0.014, 0.006, 0.0025, al, camG, polar(o.armLen / 2, o.armDeg).setZ(zArm)); arm.rotation.z = o.armDeg * DEG;
    const boss = mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.009, 20), al, camG); boss.rotation.x = Math.PI / 2; boss.position.z = zArm;
    const tr = mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.014, 16), st, camG); tr.rotation.x = Math.PI / 2; tr.position.copy(polar(o.armLen, o.armDeg)).setZ(zArm);
    rod(polar(0.012, o.armDeg + 90).setZ(zArm), polar(0.012, o.armDeg - 90).setZ(zArm), 0.0028, st, camG);   // pinch bolt
    // wear indicator tag with arrow
    const tag = rbox(0.026, 0.008, 0.0015, 0.0007, BRAKE_MAT.mark(), camG, polar(0.013, o.tagDeg).setZ(zTag)); tag.rotation.z = o.tagDeg * DEG;
    const tip = mesh(new THREE.ConeGeometry(0.0045, 0.008, 3), BRAKE_MAT.mark(), camG);
    tip.position.copy(polar(0.029, o.tagDeg)).setZ(zTag); tip.quaternion.copy(qAlong(polar(1, o.tagDeg)));
  }

  setLining(B, LINING_NEW);
  B.gAvg = (B.shoes[0].gmax + B.shoes[1].gmax) / 2;
  const ext = (th) => o.camL * Math.sin(th * DEG) + o.camT * Math.cos(th * DEG);
  B.phiOf = (th) => (ext(th) - o.camT) / (4 * o.camR);                       // shoe swing produced by the cam
  B.need = (w) => GAP_VIS + (LINING_NEW - w) / 1000;                           // gap to close before the lining touches
  B.thetaC = (w) => { let lo = 0, hi = 75; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (B.phiOf(m) * B.gAvg >= B.need(w)) hi = m; else lo = m; } return hi; };
  B.markDeg = B.thetaC(LINING_LIMIT);
  const mp = C.clone().add(polar(0.03, o.tagDeg + o.dir * B.markDeg)).setZ(zPlate + s * 0.0045);
  B.markMesh.position.copy(mp); B.markMesh.quaternion.copy(qAlong(C.clone().sub(mp).setZ(0)));
  B.trunnion = (th) => A.clone().add(C).add(polar(o.armLen, o.armDeg + o.dir * th)).setZ(zArm);
  BRAKES[k] = B;
  return B;
}
function setLining(B, w) {
  B.lining = w;
  B.shoes.forEach((sh) => {
    const L = sh.lin;
    [L.mesh, L.glow].forEach((m) => { if (m) { L.inner.remove(m); m.geometry.dispose(); } });
    L.mesh = sectorMesh(B.Rt, B.Rt + w / 1000, L.a0, L.a1, L.z0, L.z1, B.linMat, L.inner);
    L.glow = sectorMesh(B.Rt + w / 1000, B.Rt + w / 1000 + 0.0007, L.a0, L.a1, L.z0, L.z1, B.glowMat, L.inner); L.glow.castShadow = false;
  });
}
function poseBrake(B, theta) {
  B.camG.rotation.z = B.o.dir * theta * DEG;
  const phi = B.phiOf(theta);
  B.shoes.forEach((sh) => { sh.pg.rotation.z = sh.sign * Math.min(phi, B.need(B.lining) / sh.gmax); });
  B.springs.forEach((sp) => {
    const a = rotAbout(sp.a, B.P, B.shoes[0].pg.rotation.z), b = rotAbout(sp.b, B.P, B.shoes[1].pg.rotation.z);
    placeSpring(sp.m, a, b, sp.len0);
  });
}

/* ---------- front: lever, cable, drum ---------- */
{
  const g = addPart('flever', 'brakes', 'Front brake lever', 'manual', 'Right-hand lever. Its end should move 10–20 mm before the brake starts to bite. The threaded adjuster and lockring where the cable enters the lever give fine adjustment.', [0.04, 0.3, 0.12]);
  rbox(0.03, 0.026, 0.03, 0.006, MAT.alloy(), g, V(0.8, 1.075, 0.275));
  const piv = V(0.802, 1.071, 0.28);
  const lg = new THREE.Group(); lg.position.copy(piv); g.add(lg);
  tube([[0, 0, 0], [0.033, -0.011, 0.02], [0.008, -0.025, 0.08], [-0.032, -0.037, 0.14]], 0.0058, MAT.chrome(), lg, 32, 8);
  rod(V(0.812, 1.081, 0.262), V(0.832, 1.084, 0.254), 0.0048, MAT.chrome(), g);       // threaded adjuster
  rod(V(0.819, 1.0819, 0.2592), V(0.823, 1.0825, 0.2576), 0.0068, MAT.chrome(), g);   // lockring
  BRAKES.lever = { group: lg, reach: Math.hypot(0.032, 0.14) };
}
const FB = buildBrake({
  key: 'f', label: 'Front', axle: FA, side: -1, drumR: 0.07, camDeg: 115, camR: 0.052, camL: 0.026, camT: 0.008,
  armDeg: 190, armLen: 0.075, tagDeg: 285, dir: -1,
  plateName: 'Front brake back plate',
  plateDesc: 'Carries the shoes, cam and anchor pin and does not turn. The speedometer drive gearbox is also in this plate. The lining wear indicator mark is on its outer face.',
  drumDesc: 'Brake drum inside the front hub, 140 mm inside diameter, service limit 141 mm. It turns with the wheel. Scoring or oil on its surface reduces braking.',
  shoeDesc: 'Two shoes with bonded linings, 4.0 mm thick new, service limit 2.0 mm. Single leading shoe: both shoes pivot on one anchor pin, held by a washer and split pin. Renew as a pair; oil-soaked linings cannot be cleaned.',
  springDesc: 'Two springs pull the shoes back onto the cam when the lever is released. Weak springs give a spongy, slow brake release.',
  camDesc: 'The cable turns the arm, and the arm turns the cam on its splined shaft. The wear indicator tag sits on the splines; its flat must engage the cut-out on the cam. Line up the punch marks on cam and arm when refitting.',
  ex: { wheel: [0.34, 0, 0], plate: [0.34, 0, -0.18], shoes: [0.34, 0, -0.27], cam: [0.34, 0, -0.36] },
  extras(grp, B, { cast, st, zArm, dR }) {
    const T0 = B.C.clone().add(polar(0.075, 190));
    const tdir = V(-Math.sin(190 * DEG) * -1, Math.cos(190 * DEG) * -1, 0).normalize();
    B.lug = T0.clone().addScaledVector(tdir, 0.058).setZ(zArm);
    const edge = polar(dR + 0.014, Math.atan2(B.lug.y, B.lug.x) / DEG).setZ(zArm);
    const d = B.lug.clone().sub(edge);
    rbox(d.length() + 0.01, 0.012, 0.007, 0.002, cast, grp, edge.clone().addScaledVector(d, 0.5)).rotation.z = Math.atan2(d.y, d.x);
    const fer = mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.012, 12), st, grp); fer.position.copy(B.lug).addScaledVector(tdir, 0.004); fer.quaternion.copy(qAlong(tdir));
    rbox(0.022, 0.024, 0.018, 0.004, cast, grp, polar(0.026, 245).setZ(zArm - 0.004));   // speedometer drive gearbox
    B.lugWorld = FA.clone().add(B.lug);
  },
});
{
  const g = addPart('fcable', 'brakes', 'Front brake cable', 'manual', 'Cable from the lever to the operating arm on the front back plate. The adjuster nut at the arm end is for major adjustment: turn it in to reduce free play. Oil the exposed inner cable regularly.', [0, 0.15, 0]);
  const L = FB.lugWorld, up = V(-Math.sin(190 * DEG) * -1, Math.cos(190 * DEG) * -1, 0).normalize();
  tube([[0.832, 1.084, 0.254], [0.87, 1.0, 0.17], [0.96, 0.87, 0.06], [1.05, 0.74, -0.06], [1.12, 0.6, -0.118], [1.15, 0.5, -0.1], L.clone().addScaledVector(up, 0.06).setZ(-0.082), L.clone().addScaledVector(up, 0.012)], 0.0034, MAT.black(), g, 96, 6);
  const wire = mesh(unitRod, BRAKE_MAT.spring(), g, false);
  const nut = mesh(new THREE.CylinderGeometry(0.0065, 0.0065, 0.008, 6), MAT.chrome(), g);
  BRAKES.fcable = { wire, nut };
}

/* ---------- rear: pedal, rod, stop lamp switch, drum ---------- */
const RB = buildBrake({
  key: 'r', label: 'Rear', axle: RA, side: 1, drumR: 0.065, camDeg: -60, camR: 0.048, camL: 0.024, camT: 0.008,
  armDeg: -95, armLen: 0.072, tagDeg: 5, dir: 1,
  plateName: 'Rear brake back plate',
  plateDesc: 'Carries the shoes, cam and anchor pin. The torque arm ties it to the swingarm so it cannot turn with the wheel; the arm is held by a nut and split pin. The lining wear indicator mark is on its outer face.',
  drumDesc: 'Brake drum inside the rear hub, 130 mm inside diameter, service limit 131 mm. The maximum diameter is cast into the drum.',
  shoeDesc: 'Two shoes with bonded linings, 4.0 mm thick new, service limit 2.0 mm, in a 130 mm drum. Both shoes pivot on one anchor pin, held by a washer and split pin. Renew as a pair.',
  springDesc: 'Two springs pull the shoes back onto the cam when the pedal is released. Weak springs give a spongy, slow brake release.',
  camDesc: 'The brake rod turns the arm, and the arm turns the cam on its splined shaft. The wear indicator tag sits on the splines next to the back plate. Line up the punch marks on cam and arm when refitting.',
  ex: { wheel: [-0.36, 0, 0], plate: [-0.36, 0, 0.18], shoes: [-0.36, 0, 0.27], cam: [-0.36, 0, 0.36] },
  extras(grp, B, { cast, st, zArm, dR }) {
    const lug = polar(dR + 0.02, 42).setZ(zArm - 0.004);
    rbox(0.026, 0.018, 0.008, 0.003, cast, grp, lug).rotation.z = 42 * DEG;
    const end = V(0.25, 0.035, 0.1);
    rod(lug, end, 0.0055, MAT.black(), grp);
    [lug, end].forEach((p) => { const n = mesh(new THREE.CylinderGeometry(0.0062, 0.0062, 0.007, 6), st, grp); n.rotation.x = Math.PI / 2; n.position.copy(p).setZ(p.z + 0.008); });
  },
});
const PEDAL_PIVOT = V(0.47, 0.30, 0.135), PEDAL_ROD = V(-0.015, 0.06, 0), PEDAL_HOOK = V(0.03, -0.006, 0);
{
  const g = addPart('rpedal', 'brakes', 'Rear brake pedal', 'manual', 'Pivots on the centre-stand spindle and is held by a split pin. The brake should start to work after 20–30 mm of pedal travel. Pedal height is set by the stopper bolt on the footrest bar; reset the free play after changing it. An extension spring returns the pedal.', [0, 0, 0.2]);
  const ch = MAT.chrome(), st = BRAKE_MAT.steel();
  const pg = new THREE.Group(); pg.position.copy(PEDAL_PIVOT); g.add(pg);
  const boss = mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.022, 20), ch, pg); boss.rotation.x = Math.PI / 2;
  tube([[0, 0, 0.004], [0.06, -0.013, 0.014], [0.13, -0.037, 0.05], [0.165, -0.048, 0.066]], 0.008, ch, pg, 32, 10);
  rbox(0.036, 0.012, 0.05, 0.005, ch, pg, V(0.18, -0.05, 0.07));
  rbox(0.07, 0.014, 0.006, 0.003, ch, pg, PEDAL_ROD.clone().multiplyScalar(0.5).setZ(-0.008)).rotation.z = Math.atan2(PEDAL_ROD.y, PEDAL_ROD.x);
  rbox(0.014, 0.004, 0.016, 0.0015, ch, pg, V(0.03, -0.012, 0.0));                      // plate for the stopper bolt
  rod(V(0.5, 0.274, 0.135), V(0.5, 0.284, 0.135), 0.0045, st, g);                      // stopper bolt on the footrest bar
  const ln = mesh(new THREE.CylinderGeometry(0.0062, 0.0062, 0.004, 6), st, g); ln.position.set(0.5, 0.277, 0.135);
  BRAKES.pedal = { group: pg, reach: Math.hypot(0.18, 0.05) };
}
{
  const g = addPart('rrod', 'brakes', 'Rear brake rod', 'manual', 'Links the pedal to the operating arm on the rear back plate. The adjuster nut on its rear end sets the free play: turn it in to reduce free play.', [0, 0, 0.2]);
  const rodM = mesh(unitRod, MAT.chrome(), g);
  const nut = mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.009, 6), MAT.chrome(), g);
  const spr = mesh(springGeo(0.04, 0.0055, 0.0011), BRAKE_MAT.spring(), g);
  BRAKES.rod = { rodM, nut, spr };
}
{
  const g = addPart('stopsw', 'brakes', 'Stop lamp switch', 'manual', 'Linked to the pedal by a spring. It should light the stop lamp as the brake begins to work, at about 20 mm of pedal travel. Adjust it with the nut on the threaded switch body.', [0, 0.05, 0.2]);
  rod(V(0.505, 0.435, 0.128), V(0.505, 0.395, 0.128), 0.0075, MAT.black(), g);
  const an = mesh(new THREE.CylinderGeometry(0.0095, 0.0095, 0.005, 6), MAT.chrome(), g); an.position.set(0.505, 0.41, 0.128);
  const top = V(0.505, 0.39, 0.13), len0 = top.distanceTo(PEDAL_PIVOT.clone().add(PEDAL_HOOK));
  const spr = mesh(springGeo(len0, 0.0032, 0.0007), BRAKE_MAT.spring(), g);
  BRAKES.stopsw = { spr, top, len0 };
}
const TAIL_GLOW = BRAKE_MAT.glow(0xff3020);
{
  const tail = byId.get('tail').group;
  rbox(0.003, 0.104, 0.209, 0.002, TAIL_GLOW, tail, V(-0.3895, 0.672, 0)).castShadow = false;
  const b = mesh(new THREE.CylinderGeometry(0.037, 0.037, 0.003, 32), TAIL_GLOW, tail, false); b.rotation.z = Math.PI / 2; b.position.set(-0.41, 0.655, 0);
}

/* pose the linkages for given lever / pedal travel (mm actually reached) */
function poseLinkages(fTravel, rTravel, fTheta, rTheta) {
  BRAKES.lever.group.rotation.y = -fTravel / 1000 / BRAKES.lever.reach;
  const Tf = FB.trunnion(fTheta), L = FB.lugWorld;
  placeRod(BRAKES.fcable.wire, L, Tf, 0.0011);
  const wd = L.clone().sub(Tf).normalize();
  BRAKES.fcable.nut.position.copy(Tf).addScaledVector(wd, -0.009); BRAKES.fcable.nut.quaternion.copy(qAlong(wd));
  const psi = -rTravel / 1000 / BRAKES.pedal.reach;
  BRAKES.pedal.group.rotation.z = psi;
  const Q = PEDAL_PIVOT.clone().add(PEDAL_ROD.clone().applyAxisAngle(V(0, 0, 1), psi));
  const Tr = RB.trunnion(rTheta), rd = Q.clone().sub(Tr).normalize();
  placeRod(BRAKES.rod.rodM, Tr.clone().addScaledVector(rd, -0.016), Q, 0.0035);
  BRAKES.rod.nut.position.copy(Tr).addScaledVector(rd, -0.01); BRAKES.rod.nut.quaternion.copy(qAlong(rd));
  BRAKES.rod.spr.position.copy(Tr).addScaledVector(rd, 0.007); BRAKES.rod.spr.quaternion.copy(qAlong(rd));
  const H = PEDAL_PIVOT.clone().add(PEDAL_HOOK.clone().applyAxisAngle(V(0, 0, 1), psi));
  placeSpring(BRAKES.stopsw.spr, BRAKES.stopsw.top, H, BRAKES.stopsw.len0);
}
poseBrake(FB, 0); poseBrake(RB, 0); poseLinkages(0, 0, 0, 0);

export { BRAKES, FB, LINING_LIMIT, RB, TAIL_GLOW, poseBrake, poseLinkages, setLining };
