// Stage 3: engine internals. Crankshaft, con rods, pistons, cam chain, camshaft, rockers, valves and
// spark plugs, plus the pose functions that run the four-stroke cycle.
//
// Built in the cylinder frame used by engine.js: origin at CYL_BASE, local y up the bore (8° forward
// lean), local x forward, z across the bike. The left cylinder is at z < 0.
//
// From the manual: bore 53 mm, stroke 44 mm, one inlet and one exhaust valve per cylinder, single
// overhead camshaft driven by a duplex chain from a sprocket between the crank throws. Crank throws are
// in line (360°): the valve clearance procedure turns the engine one full turn to bring the second
// cylinder to TDC on compression, and one coil and contact breaker fire both plugs together.
// Valve timing: CM200T column (the CD200T column is blank). Everything else is sized by estimate.
import * as THREE from 'three';
import { CYL_BASE, CYL_TILT, DEG, MAT, V, Y_UP, addPart, beltPath, chainLinks, extrude, gearShape, hullOfCircles, lathe, mesh, rbox, rod } from '../core.js';

/* ---------- dimensions (metres, cylinder frame) ---------- */
const CR = 0.044 / 2;                 // crank throw: half the 44 mm stroke (manual)
const BORE_R = 0.053 / 2;             // 53 mm bore (manual)
const ROD = 0.11;                     // con rod centres (est)
const PIN_TO_CROWN = 0.027;           // gudgeon pin to piston crown (est)
const CRANK_Y = -0.06;                // crank axis below the cylinder base (est; agrees with the generator cover position from photos; CRANK in core.js)
const DECK = 0.1;                     // top of the barrel
const CAM_Y = 0.152;                  // camshaft axis (est)
const RB = 0.0095;                    // cam base circle radius (est)
const VALVE_LIFT = 0.007;             // valve lift (est)
const VALVE_LEN = 0.085, VALVE_TILT = 30 * DEG;   // est
const GAP_VIS = 0.0015;               // valve clearance as drawn: 30 times the real 0.05 mm, so it can be seen
const RAMP = 22;                      // crank degrees in which the rocker takes up the clearance
const SPRING_LEN = 0.03;              // installed spring length (est)
const CYLS = [{ key: 'L', name: 'Left', z: -0.07, off: 0 }, { key: 'R', name: 'Right', z: 0.07, off: 360 }];

// Cycle degrees, 0 = TDC at the start of the power stroke. CM200T: inlet opens 7°30' BTDC and closes
// 27°30' ABDC; exhaust opens 27°30' BBDC and closes 7°30' ATDC.
const VALVE_EVENTS = { inOpen: 352.5, inClose: 567.5, exOpen: 152.5, exClose: 367.5 };
const SPARK_BTDC = 15;                // static timing, idle (manual, chapter 3)
const STROKES = ['Power', 'Exhaust', 'Intake', 'Compression'];

const wrap = (a, m) => ((a % m) + m) % m;
const smooth = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
function liftFrac(phi, open, close) {          // 0..1 valve lift
  const t = wrap(phi - open, 720) / (close - open);
  return t > 1 ? 0 : Math.pow(Math.sin(Math.PI * t), 1.5);
}
function rockerDisp(phi, open, close) {         // movement of the rocker's valve end: clearance first, then lift
  const into = wrap(phi - open, 720), dur = close - open;
  let take;
  if (into <= dur) take = 1;
  else take = Math.max(smooth(1 - wrap(open - phi, 720) / RAMP), smooth(1 - wrap(phi - close, 720) / RAMP));
  return GAP_VIS * take + VALVE_LIFT * liftFrac(phi, open, close);
}
const cyclePhi = (deg, c) => wrap(deg + c.off, 720);

/* ---------- frame helper ---------- */
function frame(g) { const f = new THREE.Group(); f.position.copy(CYL_BASE); f.rotation.z = -CYL_TILT; g.add(f); return f; }
const noPick = (m) => { m.raycast = () => {}; return m; };

const E = { cyl: [], valves: [] };

/* ---------- crankshaft ---------- */
const R1 = 0.0153, R2 = 2 * R1;         // sprocket pitch radii; the cam sprocket has twice the teeth
{
  const g = addPart('crank', 'internals', 'Crankshaft', 'est', 'Built-up crankshaft with the two crankpins in line, so both pistons rise and fall together and the cylinders fire alternately, one each turn (a 360° twin). The manual\'s valve clearance check shows this: one full turn after the first cylinder is at TDC on compression, the second is. The cam chain sprocket sits between the throws; the alternator and contact breaker are on the left end, the primary drive gear on the right. Maximum runout 0.1 mm.');
  const f = frame(g);
  const cg = new THREE.Group(); cg.position.set(0, CRANK_Y, 0); f.add(cg);
  const steel = MAT.chain(), web = MAT.casting(), pin = MAT.alloy();
  const webShape = new THREE.Shape(hullOfCircles([[0, CR, 0.019], [0, -0.012, 0.044]]).map(([x, y]) => new THREE.Vector2(x, y)));
  CYLS.forEach((c) => {
    [-1, 1].forEach((s) => extrude(webShape, 0.006, 0.002, web, cg, c.z + s * 0.0145 - 0.003));
    rod(V(0, CR, c.z - 0.012), V(0, CR, c.z + 0.012), 0.0125, pin, cg, 20);
  });
  rod(V(0, 0, -0.052), V(0, 0, 0.052), 0.013, steel, cg, 20);
  [-1, 1].forEach((s) => rod(V(0, 0, s * 0.086), V(0, 0, s * 0.13), 0.011, steel, cg, 20));
  [-0.0055, 0.0015].forEach((z) => extrude(gearShape(R1 - 0.001, 15, 0.0035), 0.003, 0.0005, steel, cg, z));
  E.crankG = cg;
}

/* ---------- con rods ---------- */
{
  const g = addPart('conrods', 'internals', 'Connecting rods', 'est', 'Each rod links its piston to a crankpin and turns the up-and-down motion into rotation. Small-end bore 14.016–14.034 mm, service limit 14.08 mm. Big-end clearance: axial 0.10–0.40 mm (limit 0.60 mm), radial 0.004–0.012 mm (limit 0.05 mm). The rod length is estimated.');
  const f = frame(g), mat = MAT.alloy();
  CYLS.forEach((c, i) => {
    const rg = new THREE.Group(); rg.position.z = c.z; f.add(rg);
    lathe([[0.0125, -0.008], [0.021, -0.008], [0.021, 0.008], [0.0125, 0.008], [0.0125, -0.008]], V(0, 0, 0), V(0, 0, 1), mat, rg, 28);
    rbox(0.013, ROD - 0.03, 0.01, 0.003, mat, rg, V(0, ROD / 2, 0));
    lathe([[0.0071, -0.007], [0.0115, -0.007], [0.0115, 0.007], [0.0071, 0.007], [0.0071, -0.007]], V(0, ROD, 0), V(0, 0, 1), mat, rg, 24);
    E.cyl[i] = { ...c, rod: rg };
  });
}

/* ---------- pistons (and the charge in each cylinder) ---------- */
const GAS = {
  Intake: new THREE.Color(0x3d9be9), Compression: new THREE.Color(0x4f62d8),
  burn: new THREE.Color(0xffb347), burnt: new THREE.Color(0xc8541b), Exhaust: new THREE.Color(0x8d8a85),
};
{
  const g = addPart('pistons', 'internals', 'Pistons', 'est', 'Aluminium pistons with their rings and gudgeon pins. Skirt diameter 52.96–52.99 mm, service limit 52.87 mm, in a 53.00–53.01 mm bore (limit 53.10 mm). Ring end gap 0.15–0.35 mm (limit 0.5 mm); ring-to-groove clearance 0.015–0.045 mm (limit 0.12 mm). Gudgeon pin 13.994–14.000 mm (limit 13.98 mm). The colour above each crown shows the charge: blue fresh mixture, orange burning gas, grey exhaust.');
  const f = frame(g), al = MAT.alloy(), ring = MAT.chain(), pinM = MAT.chrome();
  CYLS.forEach((c, i) => {
    const pg = new THREE.Group(); pg.position.z = c.z; f.add(pg);
    lathe([[0.0252, -0.021], [0.0263, -0.019], [0.0264, 0.024], [0.0258, PIN_TO_CROWN], [0, PIN_TO_CROWN]], V(0, 0, 0), Y_UP, al, pg, 36);
    [0.0225, 0.0185, 0.0135].forEach((y) => { const t = mesh(new THREE.TorusGeometry(0.0263, 0.0009, 6, 40), ring, pg); t.rotation.x = Math.PI / 2; t.position.y = y; });
    rod(V(0, 0, -0.02), V(0, 0, 0.02), 0.007, pinM, pg, 16);
    const gasMat = new THREE.MeshBasicMaterial({ color: GAS.Intake, transparent: true, opacity: 0.3, depthWrite: false });
    gasMat.userData.noGhost = true;
    const gas = noPick(mesh(new THREE.CylinderGeometry(BORE_R - 0.001, BORE_R - 0.001, 1, 36), gasMat, f, false));
    gas.position.z = c.z;
    Object.assign(E.cyl[i], { piston: pg, gas, gasMat });
  });
}

/* ---------- cam chain ---------- */
// open loop round the crank sprocket and the cam sprocket
const chainPath = beltPath(V(0, CRANK_Y), R1, V(0, CAM_Y), R2);
{
  const g = addPart('camchain', 'internals', 'Cam chain and tensioner', 'est', 'Endless duplex roller chain from the crankshaft sprocket up a tunnel between the cylinders to the camshaft sprocket. The camshaft sprocket has twice as many teeth, so the camshaft turns once for every two turns of the crankshaft. The tensioner sets itself: with the T mark lined up, slacken the tensioner locknut at the rear of the cylinder block, then tighten it again. A stretched chain or worn sprockets rattle.');
  const f = frame(g);
  E.chain = chainLinks(chainPath, 0.00635, MAT.chain(), f);
  const r = chainPath.segs[1], d = r.p1.clone().sub(r.p0), nrm = V(-d.y, d.x).normalize();
  if (nrm.x > 0) nrm.negate();
  const mid = r.p0.clone().lerp(r.p1, 0.55).addScaledVector(nrm, 0.0045);
  rbox(0.004, d.length() * 0.55, 0.014, 0.0015, MAT.black(), f, mid).rotation.z = Math.atan2(-d.x, d.y);
}

/* ---------- camshaft ---------- */
const valveDefs = [];
CYLS.forEach((c, ci) => ['IN', 'EX'].forEach((type) => {
  const dir = type === 'IN' ? -1 : 1;                 // inlet at the rear, exhaust at the front
  const ev = type === 'IN' ? [VALVE_EVENTS.inOpen, VALVE_EVENTS.inClose] : [VALVE_EVENTS.exOpen, VALVE_EVENTS.exClose];
  const z = c.z + (type === 'IN' ? 0.009 : -0.009);
  const u = V(dir * Math.sin(VALVE_TILT), Math.cos(VALVE_TILT));
  const S = V(dir * 0.012, 0.103);                    // valve head centre at rest
  const T = S.clone().addScaledVector(u, VALVE_LEN);  // stem tip
  const psi = (90 - dir * 15) * DEG;                  // where the rocker pad meets the cam
  const A = V(Math.cos(psi) * RB, CAM_Y + Math.sin(psi) * RB);
  const P = V(dir * 0.03, 0.183);                     // rocker pivot
  const Ec = T.clone().addScaledVector(u, GAP_VIS);   // adjuster contact point at rest
  // rocker angle a puts the adjuster at depth t along the valve axis when kA cos a + kB sin a = t - kPT
  const w = Ec.clone().sub(P), kA = w.dot(u), kB = -w.y * u.x + w.x * u.y, kPT = P.clone().sub(T).dot(u);
  valveDefs.push({ ci, c, type, dir, ev, z, u, S, T, psi, A, P, Ec, kA, kB, kPT });
}));
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));
function rockerAngle(v, disp) {     // exact angle that moves the adjuster disp along the valve axis
  const C = GAP_VIS - disp - v.kPT, R = Math.hypot(v.kA, v.kB), base = Math.atan2(v.kB, v.kA);
  const d = Math.acos(Math.max(-1, Math.min(1, C / R))), a1 = wrapPi(base + d), a2 = wrapPi(base - d);
  return Math.abs(a1) < Math.abs(a2) ? a1 : a2;
}
function followerLift(v, phi) {    // how far the rocker pad rises at the cam, for the lobe profile
  const a = rockerAngle(v, rockerDisp(phi, v.ev[0], v.ev[1])), px = v.A.x - v.P.x, py = v.A.y - v.P.y;
  const dx = px * Math.cos(a) - py * Math.sin(a) - px, dy = px * Math.sin(a) + py * Math.cos(a) - py;
  return dx * Math.cos(v.psi) + dy * Math.sin(v.psi);
}
{
  const g = addPart('camshaft', 'internals', 'Camshaft', 'est', 'Single overhead camshaft in the two rocker carriers (camshaft holders), turned by the cam chain at half crankshaft speed. One inlet and one exhaust lobe per cylinder. Lobe height new: inlet 27.695 mm, exhaust 27.522 mm; service limit 26.6 mm and 26.5 mm. Journal 19.967–19.980 mm (limit 19.92 mm); maximum runout 0.05 mm. When setting the valve clearances, the milled slot in its left end shows which cylinder is ready.');
  const f = frame(g);
  const cam = new THREE.Group(); cam.position.set(0, CAM_Y, 0); f.add(cam);
  const steel = MAT.alloy(), blk = MAT.black();
  rod(V(0, 0, -0.118), V(0, 0, 0.118), 0.0075, steel, cam, 18);
  [-1, 1].forEach((s) => rod(V(0, 0, s * 0.1), V(0, 0, s * 0.112), 0.00998, steel, cam, 20));
  valveDefs.forEach((v) => {
    // the lobe is drawn from the same function that moves the valve, so cam, rocker and valve agree
    const s = new THREE.Shape();
    for (let i = 0; i <= 180; i++) {
      const b = 2 * Math.PI * i / 180, crankDeg = 2 * (b - v.psi) / DEG, r = RB + followerLift(v, cyclePhi(crankDeg, v.c));
      if (i) s.lineTo(r * Math.cos(b), r * Math.sin(b)); else s.moveTo(r * Math.cos(b), r * Math.sin(b));
    }
    const lg = new THREE.ExtrudeGeometry(s, { depth: 0.009, bevelEnabled: false, curveSegments: 4 });
    mesh(lg, steel, cam).position.z = v.z - 0.0045;
  });
  [-0.0055, 0.0015].forEach((z) => extrude(gearShape(R2 - 0.0012, 30, 0.0035), 0.003, 0.0005, MAT.chain(), cam, z));
  rbox(0.005, 0.003, 0.004, 0.001, blk, cam, V(-0.0078, 0, -0.1195));   // milled slot: at 3 o'clock from the left at left cylinder TDC compression
  E.cam = cam;
}

/* ---------- rockers ---------- */
{
  const g = addPart('rockers', 'internals', 'Rocker arms', 'est', 'Four rocker arms on spindles in the rocker carriers. The cam lobe lifts one end and the other end pushes the valve open. The square-headed adjuster and locknut at the valve end set the valve clearance: 0.05 mm inlet and exhaust, engine cold. Too much clearance gives tappet noise; too little stops the valve closing fully. Rocker bore 10.000–10.015 mm, service limit 10.1 mm.');
  const f = frame(g), arm = MAT.casting(), st = MAT.chrome(), spin = MAT.alloy();
  valveDefs.forEach((v) => {
    const rg = new THREE.Group(); rg.position.set(v.P.x, v.P.y, v.z); f.add(rg);
    const pad = v.A.clone().sub(v.P), endTop = v.Ec.clone().addScaledVector(v.u, 0.011).sub(v.P);
    [pad, endTop].forEach((e) => { const b = rbox(e.length() + 0.008, 0.008, 0.009, 0.003, arm, rg, e.clone().multiplyScalar(0.5)); b.rotation.z = Math.atan2(e.y, e.x); });
    const boss = mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.011, 20), arm, rg); boss.rotation.x = Math.PI / 2;
    rod(v.Ec.clone().sub(v.P), endTop, 0.0022, st, rg, 10);                                            // adjuster screw
    const nut = mesh(new THREE.CylinderGeometry(0.0042, 0.0042, 0.003, 6), st, rg);
    nut.position.copy(endTop).addScaledVector(v.u, 0.004); nut.quaternion.setFromUnitVectors(Y_UP, v.u);
    rod(V(v.P.x, v.P.y, v.z - 0.012), V(v.P.x, v.P.y, v.z + 0.012), 0.005, spin, f, 14);                 // spindle
    v.rocker = rg;
  });
}

/* ---------- valves and springs ---------- */
function helix(r, wire, turns, len) {
  const curve = new (class extends THREE.Curve {
    getPoint(t, tgt = new THREE.Vector3()) { const a = t * Math.PI * 2 * turns; return tgt.set(r * Math.cos(a), t * len, r * Math.sin(a)); }
  })();
  return new THREE.TubeGeometry(curve, Math.round(turns * 16), wire, 5, false);
}
{
  const g = addPart('valves', 'internals', 'Valves and springs', 'est', 'One inlet valve (at the rear) and one exhaust valve (at the front) per cylinder, each closed by an inner and an outer spring. Stem diameter: inlet 5.450–5.465 mm (limit 5.42 mm), exhaust 5.430–5.445 mm (limit 5.40 mm). Seat width 1.0 mm (limit 1.5 mm), seat angle 45°. Spring free length: outer 36.45 mm (limit 35.5 mm), inner 29.90 mm (limit 29.0 mm). Valve timing here is from the manual\'s CM200T column, because the CD200T column is blank.');
  const f = frame(g), inM = MAT.alloy(), exM = MAT.casting(), spr = MAT.chain(), ret = MAT.chrome();
  const outer = helix(0.0085, 0.0012, 5, SPRING_LEN), inner = helix(0.0062, 0.0009, 6, SPRING_LEN);
  valveDefs.forEach((v) => {
    const q = new THREE.Quaternion().setFromUnitVectors(Y_UP, v.u);
    const vg = new THREE.Group(); vg.quaternion.copy(q); vg.position.set(v.S.x, v.S.y, v.z); f.add(vg);
    const m = v.type === 'IN' ? inM : exM, hr = v.type === 'IN' ? 0.013 : 0.011;   // head sizes est
    lathe([[0, -0.0012], [hr, -0.0012], [hr, 0.0006], [hr * 0.45, 0.005], [0.0028, 0.012], [0, 0.012]], V(0, 0, 0), Y_UP, m, vg, 28);
    rod(V(0, 0.01, 0), V(0, VALVE_LEN, 0), 0.00273, m, vg, 10);
    lathe([[0.003, 0], [0.0095, 0], [0.0095, 0.0018], [0.003, 0.0035], [0.003, 0]], V(0, VALVE_LEN - 0.007, 0), Y_UP, ret, vg, 20);
    const sg = new THREE.Group(); sg.quaternion.copy(q); f.add(sg);
    sg.position.copy(v.S).addScaledVector(v.u, VALVE_LEN - 0.007 - SPRING_LEN).setZ(v.z);
    mesh(outer, spr, sg, false); mesh(inner, spr, sg, false);
    Object.assign(v, { valve: vg, spring: sg });
  });
}

/* ---------- spark plugs ---------- */
{
  const g = addPart('plugs', 'internals', 'Spark plugs', 'est', 'NGK or Nippondenso plugs: CR7HS or U22FSR-L on UK models, C7HS or U22FS on US models, gap 0.6–0.7 mm. One ignition coil feeds both plugs, so both spark together once every turn, 15° before TDC at idle. One cylinder is then at the end of its compression stroke; the other is at the end of its exhaust stroke, where the spark does nothing (a "wasted spark").');
  const f = frame(g), ins = MAT.plate(), hex = MAT.chrome(), el = MAT.chain();
  CYLS.forEach((c, i) => {
    const tip = V(0.004, 0.1015, c.z + 0.016), out = V(0.064, 0.137, c.z + 0.006), d = out.clone().sub(tip).normalize();
    rod(tip, tip.clone().addScaledVector(d, 0.02), 0.006, hex, f, 12);
    rod(tip.clone().addScaledVector(d, 0.02), tip.clone().addScaledVector(d, 0.03), 0.0095, hex, f, 6);
    rod(tip.clone().addScaledVector(d, 0.03), out, 0.0055, ins, f, 14);
    rod(tip.clone().addScaledVector(d, -0.003), tip, 0.0012, el, f, 6);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xbfe4ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    glowMat.userData.noGhost = true;
    const glow = noPick(mesh(new THREE.SphereGeometry(0.009, 16, 10), glowMat, f, false)); glow.position.copy(tip).addScaledVector(d, -0.004);
    Object.assign(E.cyl[i], { glowMat });
  });
}

/* =====================================================================
   Pose and cycle state
   ===================================================================== */
const sparkAt = (deg) => { const d = Math.abs(wrap(deg - (360 - SPARK_BTDC) + 180, 360) - 180); return Math.max(0, 1 - d / 8); };

/** State of each cylinder at a crankshaft angle (degrees, 0 = left cylinder TDC on compression). */
function cycleState(deg) {
  const spark = sparkAt(deg);
  return CYLS.map((c) => {
    const phi = cyclePhi(deg, c), k = Math.floor(phi / 180);
    const vIn = valveDefs.find((v) => v.c === c && v.type === 'IN'), vEx = valveDefs.find((v) => v.c === c && v.type === 'EX');
    return {
      key: c.key, name: c.name, phi, stroke: STROKES[k], into: phi - k * 180,
      inLift: VALVE_LIFT * liftFrac(phi, ...vIn.ev), exLift: VALVE_LIFT * liftFrac(phi, ...vEx.ev),
      spark, usefulSpark: spark > 0 && phi > 540,
    };
  });
}

/** Pose the engine at a crank angle. gas: false hides the charge colours; spark (default = gas) shows the plug glow. */
function poseEngine(deg, { gas = true, spark: showSpark = gas } = {}) {
  const th = deg * DEG;
  E.crankG.rotation.z = -th;
  const pinX = CR * Math.sin(th), pinY = CRANK_Y + CR * Math.cos(th);
  const pistonY = pinY + Math.sqrt(ROD * ROD - pinX * pinX);
  const crown = pistonY + PIN_TO_CROWN;
  const spark = sparkAt(deg);
  E.cyl.forEach((c) => {
    c.rod.position.set(pinX, pinY, c.z); c.rod.rotation.z = Math.atan2(pinX, pistonY - pinY);
    c.piston.position.set(0, pistonY, c.z);
    const h = DECK + 0.002 - crown; c.gas.scale.y = h; c.gas.position.y = crown + h / 2;
    const phi = cyclePhi(deg, c);
    let col, op;
    if (phi >= 720 - SPARK_BTDC || phi < 180) { const t = phi >= 540 ? 0 : phi / 180; col = GAS.burn.clone().lerp(GAS.burnt, t); op = 0.62 - 0.3 * t; }
    else if (phi < 360) { const t = (phi - 180) / 180; col = GAS.Exhaust; op = 0.3 - 0.16 * t; }
    else if (phi < 540) { const t = (phi - 360) / 180; col = GAS.Intake; op = 0.14 + 0.2 * t; }
    else { const t = (phi - 540) / 165; col = GAS.Intake.clone().lerp(GAS.Compression, t); op = 0.34 + 0.16 * t; }
    c.gasMat.color.copy(col); c.gasMat.opacity = op;
    c.glowMat.opacity = showSpark ? spark * 0.95 : 0;
    c.gas.visible = gas;
  });
  const camDeg = deg / 2;
  E.cam.rotation.z = -camDeg * DEG;
  valveDefs.forEach((v) => {
    const phi = cyclePhi(deg, v.c);
    v.rocker.rotation.z = rockerAngle(v, rockerDisp(phi, ...v.ev));
    const lift = VALVE_LIFT * liftFrac(phi, ...v.ev);
    v.valve.position.set(v.S.x, v.S.y, v.z).addScaledVector(v.u, -lift);
    v.spring.scale.y = (SPRING_LEN - lift) / SPRING_LEN;
  });
  E.chain.update(th * R1);
}
poseEngine(0);

export { GAP_VIS, SPARK_BTDC, STROKES, VALVE_EVENTS, cycleState, poseEngine };
