// Stage 4: primary drive, clutch, 4-speed constant-mesh gearbox and gear selector.
//
// From the manual (CD200 column): primary reduction 3.632:1 with a 19-tooth gear on the crankshaft;
// gear ratios 2.846, 1.778, 1.273 and 1.000:1; final reduction 2.333:1; wet multiplate clutch with
// 5 friction and 4 plain plates and 4 springs. Tooth counts come from the manual's gearbox assembly
// photos (33.4a–m), which also show which pinions are free on their shafts and which slide:
//   pairs along the shafts (left to right): 2nd, 4th, 3rd, 1st
//   mainshaft 4th slides on splines between free mainshaft 2nd and 3rd
//   layshaft 3rd slides on splines between free layshaft 4th and 1st
// so 1st = layshaft 3rd dogs into layshaft 1st, 2nd = mainshaft 4th into mainshaft 2nd,
// 3rd = mainshaft 4th into mainshaft 3rd, 4th = layshaft 3rd into layshaft 4th.
// The clutch is on the right end of the mainshaft; the final drive sprocket on the left end of the
// layshaft. Shift pattern 1-N-2-3-4 (owner). Sizes and positions inside the cases are estimated.
//
// Angles: every rotating piece has a "rho", its rotation about +z. Going forward the crankshaft and
// the wheels turn clockwise seen from the right, so their rho falls; the mainshaft turns the other way.
import * as THREE from 'three';
import { CRANK, DEG, GEAR_C, LAYSHAFT, MAINSHAFT, MAT, PRIMARY_C, V, Y_UP, addPart, extrude, gearShape, lathe, mesh, rbox, rod, smooth, tube } from '../core.js';

const RATIOS = { primary: 3.632, gears: [2.846, 1.778, 1.273, 1.000], final: 2.333 };
const TEETH = { primary: [19, 69], main: [13, 18, 22, 22], lay: [37, 32, 28, 22] };   // [1st, 2nd, 3rd, 4th]
const PAIR_Z = { 2: -0.042, 4: -0.02, 3: 0.002, 1: 0.024 };   // pair centres along the shafts (est), left to right 2-4-3-1
const GW = 0.011;                       // gear face width (est)
const TRAVEL = 0.0075;                  // slider travel to full dog engagement (est)
const SEQ = ['1', 'N', '2', '3', '4'];  // drum detents in order, 1 down, 3 up
const DRUM_POS = { 1: 0, N: 30, 2: 60, 3: 120, 4: 180 };   // drum angle at each detent (est); neutral is half a step
const LIFT_MAX = 0.009;                 // pressure plate lift as drawn (much larger than real, so the plates can be seen to part)
const PRIMARY_Z = 0.103;                // primary gears' mid-plane (est)

/* ---------- selector drum tracks: fork offset (-1..1) against drum angle ---------- */
// fork A moves the mainshaft slider (-1 = into 2nd, +1 = into 3rd); fork B the layshaft slider (+1 = into 1st, -1 = into 4th)
const KNOTS = [0, 30, 60, 120, 180];
const TRACK = { A: [0, 0, -1, 1, 0], B: [1, 0, 0, 0, -1] };
function trackOff(key, deg) {
  const k = TRACK[key];
  if (deg <= KNOTS[0]) return k[0];
  for (let i = 1; i < KNOTS.length; i++) {
    if (deg <= KNOTS[i]) return k[i - 1] + (k[i] - k[i - 1]) * smooth((deg - KNOTS[i - 1]) / (KNOTS[i] - KNOTS[i - 1]));
  }
  return k[k.length - 1];
}
/** Gear in mesh for a drum angle: 1–4, or 0 when no dogs are fully engaged. */
function engagedGear(drumDeg) {
  const a = trackOff('A', drumDeg), b = trackOff('B', drumDeg);
  if (b >= 0.92) return 1;
  if (a <= -0.92) return 2;
  if (a >= 0.92) return 3;
  if (b <= -0.92) return 4;
  return 0;
}

/* ---------- gear speeds ---------- */
// m = mainshaft rate, l = layshaft rate (rad/s about +z). Fixed and sliding pinions turn with their
// shaft; a free pinion turns with its shaft only when the slider's dogs hold it, otherwise its mate drives it.
function gearRates(gear, m, l) {
  const [m1, m2, m3, m4] = TEETH.main, [c1, c2, c3, c4] = TEETH.lay;
  return {
    M1: m, M4: m, C2: l, C3: l,
    C1: gear === 1 ? l : -m * m1 / c1,
    M2: gear === 2 ? m : -l * c2 / m2,
    M3: gear === 3 ? m : -l * c3 / m3,
    C4: gear === 4 ? l : -m * m4 / c4,
  };
}

/* ---------- geometry helpers ---------- */
const phiML = Math.atan2(LAYSHAFT.y - MAINSHAFT.y, LAYSHAFT.x - MAINSHAFT.x), phiLM = phiML + Math.PI;
const phiKM = Math.atan2(MAINSHAFT.y - CRANK.y, MAINSHAFT.x - CRANK.x), phiMK = phiKM + Math.PI;
const pitchR = (n, mate, c) => c * n / (n + mate);
const toothH = (r, n) => Math.min(0.004, 3.6 * r / n);
function gearDisc(r, n, w, mat, parent, z = 0) {
  const h = toothH(r, n);
  return extrude(gearShape(r - h / 2, n, h), w - 0.0008, 0.0004, mat, parent, z - w / 2 + 0.0004);
}
function dogs(r, w, sign, mat, parent) {         // three dogs standing out of one face of a slider
  for (let i = 0; i < 3; i++) {
    const a = i * 2 * Math.PI / 3;
    rbox(0.006, 0.006, 0.0045, 0.001, mat, parent, V(Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42, sign * (w / 2 + 0.002)));
  }
}
function dogHoles(r, w, sign, parent) {           // dark recesses in the face of a free pinion
  const blk = MAT.black();
  for (let i = 0; i < 3; i++) {
    const a = i * 2 * Math.PI / 3 + Math.PI / 3;
    rbox(0.0068, 0.0068, 0.0006, 0.0005, blk, parent, V(Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42, sign * (w / 2 + 0.0002)));
  }
}
const atShaft = (c, z) => { const g = new THREE.Group(); g.position.set(c.x, c.y, z); return g; };

const GB = { gears: {}, rho: { crank: 0, outer: 0, main: 0, lay: 0 }, gearRho: { M1: 0, M2: 0, M3: 0, M4: 0, C1: 0, C2: 0, C3: 0, C4: 0 }, drumDeg: DRUM_POS.N, lift: 0, pedal: 0, plate: 3.0 };
const STEEL = 0x8f969b, POWER = 0xd98a3a;

/* ---------- primary drive ---------- */
{
  const g = addPart('primary', 'transmission', 'Primary drive gears', 'manual', 'Spur gears on the right of the engine. The 19-tooth gear on the crankshaft drives the large gear riveted to the back of the clutch outer drum, a reduction of 3.632 : 1 (so the driven gear has 69 teeth). If either gear is renewed, renew both as a pair. The driven gear turns the opposite way to the crankshaft.', [0, 0, 0.16]);
  const st = MAT.chain();
  const [n1, n2] = TEETH.primary, r1 = pitchR(n1, n2, PRIMARY_C), r2 = pitchR(n2, n1, PRIMARY_C);
  const drive = atShaft(CRANK, PRIMARY_Z); g.add(drive); gearDisc(r1, n1, GW, st, drive);
  const driven = atShaft(MAINSHAFT, PRIMARY_Z); g.add(driven); gearDisc(r2, n2, GW, st, driven);
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; rod(V(Math.cos(a) * r2 * 0.55, Math.sin(a) * r2 * 0.55, -0.007), V(Math.cos(a) * r2 * 0.55, Math.sin(a) * r2 * 0.55, 0.007), 0.0022, MAT.chrome(), driven, 8); }   // rivets
  Object.assign(GB, { drive, driven, drive0: phiKM, driven0: phiMK + Math.PI / n2 });
}

/* ---------- clutch ---------- */
const CL = { z0: PRIMARY_Z + GW / 2 + 0.002 };
{
  const g = addPart('clutch', 'transmission', 'Clutch', 'manual', 'Wet multiplate clutch on the right-hand end of the gearbox mainshaft: 5 friction plates turn with the outer drum, 4 plain plates with the clutch centre, and 4 springs clamp them together. Pulling the lever turns a cam on a vertical spindle inside the right-hand cover; the cam pushes the pushrod, which moves the pressure plate away and frees the plates. Friction plates 3.0 mm thick, renew at 2.6 mm. Plain plates may be warped no more than 0.2 mm. Spring free length 37.8 mm, renew at 34.7 mm. Plate lift is drawn larger than real.', [0, 0, 0.24]);
  const st = MAT.chain(), al = MAT.alloy(), cast = MAT.casting(), fr = new THREE.MeshStandardMaterial({ color: 0x7c5638, roughness: 0.85, metalness: 0.05 });
  const outer = atShaft(MAINSHAFT, 0); g.add(outer);
  // outer drum: a base with eight fingers; the friction plate tongues sit in the slots between them
  lathe([[0.012, CL.z0 - 0.001], [0.054, CL.z0 - 0.001], [0.054, CL.z0 + 0.002], [0.012, CL.z0 + 0.002]], V(0, 0, 0), V(0, 0, 1), cast, outer, 48);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + Math.PI / 8;
    const f = mesh(new THREE.CylinderGeometry(0.054, 0.054, 0.038, 6, 1, true, 0, Math.PI / 4 - 0.17), cast, outer);
    f.material.side = THREE.DoubleSide; f.rotation.x = Math.PI / 2; f.rotation.y = a - Math.PI / 8 + 0.085; f.position.z = CL.z0 + 0.021;
  }
  const inner = atShaft(MAINSHAFT, 0); g.add(inner);          // turns with the mainshaft
  const ring = (ro, ri, tabs, tabOut) => {
    const s = new THREE.Shape(); s.absarc(0, 0, ro, 0, Math.PI * 2, false);
    const hole = new THREE.Path(); hole.absarc(0, 0, ri, 0, Math.PI * 2, true); s.holes.push(hole);
    return { s, tabs, tabOut };
  };
  const plates = [];
  const addPlate = (kind, parent) => {
    const { s, tabs, tabOut } = kind === 'f' ? ring(0.047, 0.032, 8, true) : ring(0.0455, 0.027, 8, false);
    const th = kind === 'f' ? 0.003 : 0.0016;
    const grp = new THREE.Group(); parent.add(grp);
    const m = mesh(new THREE.ExtrudeGeometry(s, { depth: th, bevelEnabled: false, curveSegments: 40 }), kind === 'f' ? fr : st, grp);
    for (let i = 0; i < tabs; i++) {
      const a = i * Math.PI / 4 + (kind === 'f' ? 0 : Math.PI / 8), r = tabOut ? 0.0495 : 0.0245;
      const t = rbox(0.004, 0.005, th, 0.0008, kind === 'f' ? fr : st, grp, V(Math.cos(a) * r, Math.sin(a) * r, th / 2)); t.rotation.z = a;
    }
    plates.push({ kind, grp, th, body: m });
  };
  const ppGrp = new THREE.Group(); inner.add(ppGrp);              // pressure plate (innermost)
  lathe([[0.012, 0], [0.046, 0], [0.046, 0.004], [0.012, 0.004]], V(0, 0, 0), V(0, 0, 1), al, ppGrp, 40);
  ['f', 'p', 'f', 'p', 'f', 'p', 'f', 'p', 'f'].forEach((k) => addPlate(k, k === 'f' ? outer : inner));
  const centreZ = CL.z0 + 0.004 + 5 * 0.003 + 4 * 0.0016 + 0.0004;
  lathe([[0.012, centreZ], [0.044, centreZ], [0.044, centreZ + 0.005], [0.012, centreZ + 0.005]], V(0, 0, 0), V(0, 0, 1), al, inner, 40);   // clutch centre
  rod(V(0, 0, centreZ - 0.024), V(0, 0, centreZ + 0.005), 0.026, al, inner, 28);   // centre hub inside the plates
  const springs = [], thrust = new THREE.Group(); inner.add(thrust);
  const coil = (len) => new THREE.TubeGeometry(new (class extends THREE.Curve { getPoint(t, v = new THREE.Vector3()) { const a = t * Math.PI * 2 * 5; return v.set(0.0055 * Math.cos(a), 0.0055 * Math.sin(a), t * len); } })(), 60, 0.0011, 5, false);
  const sGeo = coil(0.012);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4, sp = mesh(sGeo, MAT.chrome(), inner, false);
    sp.position.set(Math.cos(a) * 0.02, Math.sin(a) * 0.02, centreZ + 0.005); springs.push(sp);
    rod(V(Math.cos(a) * 0.02, Math.sin(a) * 0.02, -0.038), V(Math.cos(a) * 0.02, Math.sin(a) * 0.02, 0.002), 0.0022, st, thrust, 8);   // bolt through to the pressure plate
  }
  lathe([[0.006, 0], [0.028, 0], [0.028, 0.003], [0.006, 0.003]], V(0, 0, 0), V(0, 0, 1), al, thrust, 32);   // thrust plate
  const thrustZ0 = centreZ + 0.017;
  // pushrod and the release cam on its vertical spindle, inside the right-hand cover
  const push = rod(V(0, 0, 0), V(0, 0, 0.012), 0.003, MAT.chrome(), atShaft(MAINSHAFT, 0), 10);
  const pushG = push.parent; g.add(pushG);
  const spindle = new THREE.Group(); spindle.position.set(MAINSHAFT.x + 0.007, MAINSHAFT.y, thrustZ0 + 0.017); g.add(spindle);
  rod(V(0, -0.006, 0), V(0, 0.082, 0), 0.0035, st, spindle, 12);
  rbox(0.009, 0.01, 0.006, 0.0015, st, spindle, V(-0.004, 0, -0.002));          // cam on the lower end
  const arm = rbox(0.036, 0.006, 0.01, 0.002, MAT.alloy(), spindle, V(0.016, 0.082, 0));   // operating arm, outside the cover
  Object.assign(CL, { outer, inner, plates, ppGrp, thrust, springs, centreZ, thrustZ0, pushG, spindle, arm, fr });
}
// where the clutch cable meets the operating arm (used by controls.js)
const CLUTCH_ARM = V(MAINSHAFT.x + 0.007 + 0.034, MAINSHAFT.y + 0.082, CL.thrustZ0 + 0.017);

/* ---------- gearbox shafts and pinions ---------- */
{
  const g = addPart('gears', 'transmission', 'Gearbox shafts and pinions', 'manual', 'Four-speed constant-mesh gearbox: every pair of pinions is always in mesh, and a gear is chosen by locking a free pinion to its shaft with the dogs on a sliding pinion. The clutch drives the mainshaft; the layshaft is the output and carries the final drive sprocket. Teeth (mainshaft / layshaft): 1st 13/37 (2.846 : 1), 2nd 18/32 (1.778), 3rd 22/28 (1.273), 4th 22/22 (1.000). Mainshaft 4th slides to select 2nd or 3rd; layshaft 3rd slides to select 1st or 4th. Worn dogs let the gearbox jump out of gear. Which pinions slide is worked out from the manual\'s assembly photos.', [0, 0.12, 0]);
  const shaftM = atShaft(MAINSHAFT, 0), shaftL = atShaft(LAYSHAFT, 0); g.add(shaftM, shaftL);
  const st = MAT.alloy();
  rod(V(0, 0, -0.062), V(0, 0, PRIMARY_Z + 0.06), 0.0085, st, shaftM, 16);
  rod(V(0, 0, -0.125), V(0, 0, 0.042), 0.009, st, shaftL, 16);
  const [m1, m2, m3, m4] = TEETH.main, [c1, c2, c3, c4] = TEETH.lay;
  const mats = {};
  const mk = (id) => { mats[id] = new THREE.MeshStandardMaterial({ color: STEEL, metalness: 0.8, roughness: 0.38 }); return mats[id]; };
  const pair = (gear, nm, nc) => ({ rm: pitchR(nm, nc, GEAR_C), rc: pitchR(nc, nm, GEAR_C), z: PAIR_Z[gear] });
  const P = { 1: pair(1, m1, c1), 2: pair(2, m2, c2), 3: pair(3, m3, c3), 4: pair(4, m4, c4) };
  const G = GB.gears;
  // fixed: mainshaft 1st (part of the shaft), layshaft 2nd
  G.M1 = { grp: atShaft(V(0, 0), P[1].z), parentShaft: shaftM, n: m1, base: phiML };
  shaftM.add(G.M1.grp); gearDisc(P[1].rm, m1, GW, mk('M1'), G.M1.grp);
  G.C2 = { grp: atShaft(V(0, 0), P[2].z), parentShaft: shaftL, n: c2, base: phiLM + Math.PI / c2 };
  shaftL.add(G.C2.grp); gearDisc(P[2].rc, c2, GW, mk('C2'), G.C2.grp);
  // sliders, grooved for the selector forks, with dogs on both faces
  const slider = (id, r, n, base, shaft, z) => {
    const grp = atShaft(V(0, 0), z); shaft.add(grp);
    const m = mk(id), part = GW * 0.38;
    gearDisc(r, n, part, m, grp, -GW / 2 + part / 2); gearDisc(r, n, part, m, grp, GW / 2 - part / 2);
    rod(V(0, 0, -GW / 2), V(0, 0, GW / 2), r * 0.66, m, grp, 28);
    dogs(r, GW, -1, m, grp); dogs(r, GW, 1, m, grp);
    G[id] = { grp, n, base, z0: z, r };
  };
  slider('M4', P[4].rm, m4, phiML, shaftM, P[4].z);
  slider('C3', P[3].rc, c3, phiLM + Math.PI / c3, shaftL, P[3].z);
  // free pinions: turn on their shaft unless a slider's dogs hold them
  const free = (id, r, n, base, at, z, holeSide) => {
    const grp = atShaft(at, z); g.add(grp);
    gearDisc(r, n, GW, mk(id), grp); dogHoles(r, GW, holeSide, grp);
    G[id] = { grp, n, base };
  };
  free('M2', P[2].rm, m2, phiML, MAINSHAFT, P[2].z, 1);
  free('M3', P[3].rm, m3, phiML, MAINSHAFT, P[3].z, -1);
  free('C4', P[4].rc, c4, phiLM + Math.PI / c4, LAYSHAFT, P[4].z, 1);
  free('C1', P[1].rc, c1, phiLM + Math.PI / c1, LAYSHAFT, P[1].z, -1);
  Object.assign(GB, { shaftM, shaftL, mats, P });
}

/* ---------- selector drum, forks and gearchange ---------- */
const DRUM = V(0.605, 0.258), FORK_SHAFT = V(0.6, 0.29), CHANGE_SHAFT = V(0.56, 0.255);
{
  const g = addPart('selector', 'transmission', 'Gear selector', 'manual', 'The gear pedal turns the gearchange shaft, whose arm and pawl turn the selector drum one step at a time. Two selector forks on a support shaft ride in tracks cut in the drum and slide the two sliding pinions. A spring-loaded stopper arm holds the drum at each position, and the neutral indicator switch on the drum end lights the green N lamp in neutral. Shift pattern: 1st down, neutral half a step up, then 2nd, 3rd and 4th up. Fork end thickness 5.00–5.07 mm (limit 4.70 mm); fork bore 12.000–12.018 mm (limit 12.05 mm); support shaft 11.976–11.994 mm (limit 11.96 mm). Bent forks make gears hard to select; a weak stopper arm lets the gearbox jump out of gear.', [0, -0.12, 0]);
  const st = MAT.chain(), al = MAT.alloy(), blk = MAT.black();
  const drum = atShaft(DRUM, 0); g.add(drum);
  rod(V(0, 0, -0.064), V(0, 0, 0.056), 0.016, al, drum, 28);
  const a0 = Math.atan2(FORK_SHAFT.y - DRUM.y, FORK_SHAFT.x - DRUM.x);   // where the fork pins meet the drum
  ['A', 'B'].forEach((key) => {
    const z0 = key === 'A' ? PAIR_Z[4] : PAIR_Z[3], pts = [];
    for (let d = -20; d <= 200; d += 5) {
      const th = a0 + d * DEG;
      pts.push(V(Math.cos(th) * 0.0165, Math.sin(th) * 0.0165, z0 + trackOff(key, d) * TRAVEL));
    }
    tube(pts, 0.0022, blk, drum, 90, 6);                       // the track, drawn as a groove line
  });
  for (let i = 0; i < 5; i++) { const a = i * 2 * Math.PI / 5; rod(V(Math.cos(a) * 0.01, Math.sin(a) * 0.01, 0.056), V(Math.cos(a) * 0.01, Math.sin(a) * 0.01, 0.064), 0.002, st, drum, 8); }   // change pins
  const star = new THREE.Shape();
  for (let i = 0; i <= 120; i++) { const a = 2 * Math.PI * i / 120, r = 0.019 - 0.004 * Math.pow(Math.max(0, Math.cos(5 * a)), 6); if (i) star.lineTo(r * Math.cos(a), r * Math.sin(a)); else star.moveTo(r, 0); }
  extrude(star, 0.004, 0.0005, st, drum, 0.05);                // detent cam
  const nsw = atShaft(DRUM, 0); g.add(nsw); rod(V(0, 0, -0.084), V(0, 0, -0.066), 0.007, blk, nsw, 6);   // neutral switch
  // stopper arm pressing a roller into the detent cam
  const stopPivot = V(DRUM.x + 0.036, DRUM.y - 0.012, 0.053);
  rod(stopPivot, V(DRUM.x + 0.019, DRUM.y, 0.053), 0.0026, st, g, 8);
  const roller = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.005, 14), al, g); roller.rotation.x = Math.PI / 2; roller.position.set(DRUM.x + 0.019, DRUM.y, 0.053);
  // fork support shaft and the two forks
  rod(V(FORK_SHAFT.x, FORK_SHAFT.y, -0.06), V(FORK_SHAFT.x, FORK_SHAFT.y, 0.05), 0.006, al, g, 14);
  const forks = {};
  [['A', MAINSHAFT, GB.gears.M4], ['B', LAYSHAFT, GB.gears.C3]].forEach(([key, shaft, sl]) => {
    const fg = new THREE.Group(); fg.position.z = sl.z0; g.add(fg);
    const boss = mesh(new THREE.CylinderGeometry(0.0095, 0.0095, 0.012, 16), st, fg); boss.rotation.x = Math.PI / 2; boss.position.set(FORK_SHAFT.x, FORK_SHAFT.y, 0);
    const d = V(shaft.x - FORK_SHAFT.x, shaft.y - FORK_SHAFT.y), len = d.length(), ang = Math.atan2(d.y, d.x), rr = sl.r * 0.73;
    const arm = rbox(len - rr, 0.008, 0.004, 0.0015, st, fg, V(FORK_SHAFT.x + Math.cos(ang) * (len - rr) / 2, FORK_SHAFT.y + Math.sin(ang) * (len - rr) / 2, 0)); arm.rotation.z = ang;
    const c = mesh(new THREE.TorusGeometry(rr, 0.0017, 6, 32, Math.PI * 1.1), st, fg);   // fingers in the slider groove
    c.position.set(shaft.x, shaft.y, 0); c.rotation.z = ang + Math.PI - Math.PI * 0.55;
    rod(V(FORK_SHAFT.x, FORK_SHAFT.y, 0), V(DRUM.x + Math.cos(a0) * 0.017, DRUM.y + Math.sin(a0) * 0.017, 0), 0.0025, st, fg, 8);   // guide pin into the drum track
    forks[key] = fg;
  });
  // gearchange shaft from the pedal on the left, arm and pawl at the drum on the right
  rod(V(CHANGE_SHAFT.x, CHANGE_SHAFT.y, -0.16), V(CHANGE_SHAFT.x, CHANGE_SHAFT.y, 0.066), 0.0055, st, g, 12);
  const changeArm = new THREE.Group(); changeArm.position.set(CHANGE_SHAFT.x, CHANGE_SHAFT.y, 0.062); g.add(changeArm);
  const cd = V(DRUM.x - CHANGE_SHAFT.x, DRUM.y - CHANGE_SHAFT.y), cl = cd.length();
  rbox(cl, 0.009, 0.004, 0.0015, st, changeArm, V(cd.x / 2, cd.y / 2, 0)).rotation.z = Math.atan2(cd.y, cd.x);
  Object.assign(GB, { drum, forks, changeArm });
}

/* ---------- final drive sprocket on the layshaft ---------- */
const SPROCKET_Z = -0.112, SPROCKET_R = 0.0305, SPROCKET_T = 15;   // drawn 15T: with the drawn 35T rear sprocket that gives the manual's 2.333 : 1
{
  const g = addPart('sprocket', 'transmission', 'Final drive sprocket', 'est', 'Splined onto the left-hand end of the layshaft (the gearbox output shaft) and held by a plate and two bolts. It turns the same way as the rear wheel. The manual gives the final reduction, 2.333 : 1, but not the number of teeth; it is drawn with 15 teeth to suit a 35-tooth rear sprocket.', [0, 0, -0.2]);
  const sg = atShaft(LAYSHAFT, SPROCKET_Z); g.add(sg);
  gearDisc(SPROCKET_R, SPROCKET_T, 0.006, MAT.black(), sg);
  rbox(0.03, 0.012, 0.003, 0.002, MAT.chrome(), sg, V(0, 0, -0.0045));
  GB.sprocket = sg;
}

/* =====================================================================
   Simulation step and pose
   ===================================================================== */
/** Advance the rotating parts by dt seconds at the given shaft rates (rad/s about +z). */
function stepGearbox(dt, rates) {
  const gear = engagedGear(GB.drumDeg);
  ['crank', 'outer', 'main', 'lay'].forEach((k) => { GB.rho[k] += rates[k] * dt; });
  const gr = gearRates(gear, rates.main, rates.lay);
  Object.keys(gr).forEach((k) => { GB.gearRho[k] += gr[k] * dt; });
}
function poseGearbox({ drumDeg = GB.drumDeg, lift = GB.lift, pedal = GB.pedal, plate = GB.plate, power = false } = {}) {
  Object.assign(GB, { drumDeg, lift, pedal, plate });
  const R = GB.rho, gear = engagedGear(drumDeg);
  GB.drive.rotation.z = GB.drive0 + R.crank;
  GB.driven.rotation.z = GB.driven0 + R.outer;
  CL.outer.rotation.z = R.outer;
  CL.inner.rotation.z = R.main;
  GB.shaftM.rotation.z = R.main; GB.shaftL.rotation.z = R.lay;
  GB.sprocket.rotation.z = R.lay;
  Object.entries(GB.gears).forEach(([id, G]) => {
    if (G.grp.parent === GB.shaftM || G.grp.parent === GB.shaftL) G.grp.rotation.z = G.base;   // turns with its shaft
    else G.grp.rotation.z = G.base + GB.gearRho[id];
  });
  // sliders and forks follow the drum tracks
  const a = trackOff('A', drumDeg), b = trackOff('B', drumDeg);
  GB.gears.M4.grp.position.z = GB.gears.M4.z0 + a * TRAVEL; GB.forks.A.position.z = GB.gears.M4.z0 + a * TRAVEL;
  GB.gears.C3.grp.position.z = GB.gears.C3.z0 + b * TRAVEL; GB.forks.B.position.z = GB.gears.C3.z0 + b * TRAVEL;
  GB.drum.rotation.z = -drumDeg * DEG;
  GB.changeArm.rotation.z = pedal * DEG;
  // clutch: the plates are stacked against the clutch centre, the pressure plate under them. Worn
  // friction plates make the stack thinner, so the pressure plate sits further out. Lifting moves
  // the pressure plate (and the thrust plate bolted to it) in, and the plates spread into the gap.
  const k = plate / 3.0, n = CL.plates.length;
  let cur = CL.centreZ - 0.0004;
  const base = [];
  for (let i = n - 1; i >= 0; i--) { const p = CL.plates[i]; cur -= p.kind === 'f' ? p.th * k : p.th; base[i] = cur; }
  const wear = cur - 0.004 - CL.z0;            // 0 with new plates, positive when worn
  CL.plates.forEach((p, i) => { p.grp.scale.z = p.kind === 'f' ? k : 1; p.grp.position.z = base[i] - lift * (n - i) / (n + 1); });
  CL.ppGrp.position.z = CL.z0 + wear - lift;
  CL.thrust.position.z = CL.thrustZ0 + wear - lift;
  CL.springs.forEach((s) => { s.scale.z = (0.012 + wear - lift) / 0.012; });
  CL.pushG.position.z = CL.thrustZ0 + 0.003 + wear - lift;
  CL.spindle.rotation.y = -lift / 0.008;
  // tint the pinions that are carrying the drive
  const live = power && gear ? { 1: ['M1', 'C1', 'C3'], 2: ['M2', 'C2', 'M4'], 3: ['M3', 'C3', 'M4'], 4: ['M4', 'C4', 'C3'] }[gear] : [];
  Object.entries(GB.mats).forEach(([id, m]) => m.color.setHex(live.includes(id) ? POWER : STEEL));
  return gear;
}
poseGearbox();

const NEUTRAL_SWITCH = V(DRUM.x, DRUM.y, -0.084);   // on the left end of the selector drum (used by electrical.js)

export { CLUTCH_ARM, CHANGE_SHAFT, NEUTRAL_SWITCH, DRUM_POS, GB, LIFT_MAX, RATIOS, SEQ, SPROCKET_R, TEETH, engagedGear, gearRates, poseGearbox, stepGearbox };
