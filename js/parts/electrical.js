// Stage 5: electrical system. Battery, fuse, charging, starting, ignition, lights, horn and signals,
// with the wiring drawn as simple runs that light up when their circuit is live.
//
// Layout from the manual (chapter 6 and the CD/CM 200 T wiring diagram; ignition chapter 3): negative
// earth; 20 A fuse in the battery's red lead; alternator rotor on the left end of the crankshaft with
// the stator in the left casing; combined regulator/rectifier behind the right frame side panel, to the
// rear of the battery; starter switch (solenoid) beside the battery; starter motor at the front of the
// crankcase, left side, driving the crankshaft through a chain and a one-way clutch behind the
// alternator; one ignition coil under the tank feeding both plugs, one contact breaker and condenser
// behind the round left cover. The owner's bike is 12 V (the manual's models are 6 V). Wire routes and
// component sizes are estimated, and the wiring diagram is too small to read the wire colours, so the
// wires are drawn in neutral colours.
import * as THREE from 'three';
import { CRANK, DEG, MAT, V, addPart, beltPath, canvasTexture, chainLinks, forkPt, gearShape, extrude, lathe, mesh, rbox, rod, tube } from '../core.js';
import { cylWorld } from './engine.js';
import { NEUTRAL_SWITCH } from './gearbox.js';

/* ---------- where things are (world, metres; est unless noted) ---------- */
const P = {
  batPos: V(0.395, 0.642, 0.068), batNeg: V(0.325, 0.642, 0.068), fuse: V(0.43, 0.66, 0.08),
  relay: V(0.27, 0.618, 0.08), reg: V(0.232, 0.56, 0.082), flasher: V(0.945, 0.8, -0.055),
  key: forkPt(0.715, 0.035, 0), head: forkPt(0.618, 0.138).add(V(-0.1, 0, 0)), speedo: forkPt(0.745, 0.02, 0),
  lsw: V(0.78, 1.064, -0.295), rsw: V(0.78, 1.064, 0.295), fbrk: V(0.8, 1.075, 0.262),
  rbrk: V(0.505, 0.437, 0.128), tail: V(-0.33, 0.69, 0), coil: V(0.74, 0.645, 0),
  starter: V(0.8, 0.445, -0.06), cb: V(CRANK.x, CRANK.y, -0.15),
  hornL: V(1.176, 0.742, -0.14), hornR: V(1.176, 0.742, 0.14),
  fiL: forkPt(0.638, 0, -0.115), fiR: forkPt(0.638, 0, 0.115), riL: V(-0.17, 0.62, -0.085), riR: V(-0.17, 0.62, 0.085),
  plugL: cylWorld(0.11, 0.155, -0.076), plugR: cylWorld(0.11, 0.155, 0.076),
};
// main loom along the frame: battery forward to the headstock, and back to the tail
const LOOM_F = [V(0.47, 0.675, 0.035), V(0.62, 0.692, 0.03), V(0.8, 0.718, 0.03), V(0.93, 0.792, 0.025), V(0.965, 0.87, 0.02)];
const LOOM_R = [V(0.31, 0.655, 0.035), V(0.1, 0.66, 0.03), V(-0.12, 0.648, 0.01), V(-0.28, 0.69, 0)];
const LOOM_E = [V(0.47, 0.62, 0.045), V(0.5, 0.47, 0.06), V(0.6, 0.44, -0.04), V(0.66, 0.43, -0.12)];   // down to the engine's left side
const toBars = (s) => [V(0.93, 0.98, 0.06 * s), V(0.86, 1.06, 0.2 * s)];

/* ---------- wires ---------- */
const STRIPE = canvasTexture(64, 8, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffb35a'; g.fillRect(0, 0, w * 0.45, h); });
STRIPE.wrapS = STRIPE.wrapT = THREE.RepeatWrapping;
const IDLE = new THREE.Color(0x5f676c), LIVE = new THREE.Color(0xff7a1a);
// segment id -> points, radius
const SEG_DEF = {
  bat_gnd: [[P.batNeg, V(0.3, 0.64, 0.09), V(0.26, 0.632, 0.1)], 0.0042],
  bat_fuse: [[P.batPos, V(0.41, 0.66, 0.075), P.fuse], 0.0032],
  fuse_key: [[P.fuse, ...LOOM_F, P.key], 0.0024],
  key_rsw: [[P.key, ...toBars(1), P.rsw], 0.0022],
  rsw_lsw: [[P.rsw, ...toBars(1).reverse(), V(0.97, 0.94, 0), ...toBars(-1), P.lsw], 0.0022],
  lsw_head: [[P.lsw, ...toBars(-1).reverse(), V(1.0, 0.91, -0.02), P.head], 0.0022],
  lsw_hi: [[P.lsw, ...toBars(-1).reverse(), V(0.99, 0.97, -0.01), P.speedo], 0.0018],
  rsw_tail: [[P.rsw, ...toBars(1).reverse(), ...LOOM_F.slice().reverse(), ...LOOM_R, P.tail], 0.0022],
  key_fbrk: [[P.key, ...toBars(1), V(0.81, 1.08, 0.24), P.fbrk], 0.0018],
  fbrk_tail: [[P.fbrk, ...toBars(1).reverse(), ...LOOM_F.slice().reverse(), ...LOOM_R, P.tail], 0.0018],
  key_rbrk: [[P.key, ...LOOM_F.slice().reverse(), V(0.47, 0.6, 0.09), P.rbrk], 0.0018],
  rbrk_tail: [[P.rbrk, V(0.42, 0.62, 0.09), ...LOOM_R, P.tail], 0.0018],
  key_flash: [[P.key, V(0.97, 0.86, -0.04), P.flasher], 0.0018],
  flash_lsw: [[P.flasher, ...toBars(-1), P.lsw], 0.0018],
  lsw_tfL: [[P.lsw, ...toBars(-1).reverse(), V(0.99, 0.9, -0.08), P.fiL], 0.0018],
  lsw_tfR: [[P.lsw, ...toBars(-1).reverse(), V(0.99, 0.9, 0.08), P.fiR], 0.0018],
  lsw_trL: [[P.lsw, ...toBars(-1).reverse(), ...LOOM_F.slice().reverse(), ...LOOM_R.slice(0, 3), V(-0.15, 0.63, -0.06), P.riL], 0.0018],
  lsw_trR: [[P.lsw, ...toBars(-1).reverse(), ...LOOM_F.slice().reverse(), ...LOOM_R.slice(0, 3), V(-0.15, 0.63, 0.06), P.riR], 0.0018],
  lsw_tlamp: [[P.lsw, ...toBars(-1).reverse(), V(0.99, 0.975, -0.02), P.speedo], 0.0018],
  key_horn: [[P.key, ...toBars(-1), P.lsw], 0.0018],
  lsw_horn: [[P.lsw, ...toBars(-1).reverse(), V(1.0, 0.84, 0), V(1.12, 0.77, 0)], 0.0018],
  horn_L: [[V(1.12, 0.77, 0), P.hornL], 0.0018],
  horn_R: [[V(1.12, 0.77, 0), P.hornR], 0.0018],
  key_neut: [[P.key, P.speedo], 0.0018],
  speedo_neut: [[P.speedo, ...LOOM_F.slice().reverse(), ...LOOM_E.slice(0, 3), V(0.6, 0.3, -0.08), NEUTRAL_SWITCH], 0.0018],
  key_coil: [[P.key, ...LOOM_F.slice(2).reverse(), P.coil], 0.0018],
  coil_cb: [[P.coil, V(0.62, 0.62, -0.05), ...LOOM_E.slice(2), P.cb], 0.0018],
  ht_L: [[P.coil, V(0.8, 0.62, -0.04), P.plugL], 0.0035],
  ht_R: [[P.coil, V(0.8, 0.62, 0.05), P.plugR], 0.0035],
  rsw_relay: [[P.rsw, ...toBars(1).reverse(), ...LOOM_F.slice().reverse(), V(0.35, 0.65, 0.085), P.relay], 0.0018],
  bat_relay: [[P.batPos, V(0.33, 0.66, 0.095), P.relay], 0.0045],
  relay_starter: [[P.relay, V(0.4, 0.6, 0.1), V(0.5, 0.5, 0.06), V(0.65, 0.47, -0.02), P.starter.clone().add(V(0, 0.03, 0.02))], 0.0045],
  alt_reg: [[V(0.64, 0.42, -0.13), ...LOOM_E.slice().reverse(), V(0.36, 0.6, 0.09), P.reg], 0.0022],
  reg_fuse: [[P.reg, V(0.33, 0.66, 0.088), P.fuse], 0.0022],
};
const SEGS = {};
{
  const g = addPart('wiring', 'electrical', 'Wiring', 'est', 'Simplified wiring. Each live circuit lights up and the stripes move from the battery\'s positive terminal, through the 20 A fuse and the switches, to the lamp, horn or motor. Every circuit returns to the battery\'s negative terminal through the frame (negative earth). The real loom follows the frame tubes; the routes here are approximate, and the wiring diagram in the manual is too small to read the wire colours, so they are not shown.');
  Object.entries(SEG_DEF).forEach(([id, [pts, r]]) => {
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const len = curve.getLength(), map = STRIPE.clone();
    map.repeat.set(len / 0.03, 1); map.needsUpdate = true;
    const mat = new THREE.MeshBasicMaterial({ color: IDLE.clone(), map: null });
    const m = mesh(new THREE.TubeGeometry(curve, Math.max(12, Math.round(len * 90)), r, 6, false), mat, g, false);
    SEGS[id] = { mat, map, m, live: false };
  });
}

/* ---------- battery, fuse, regulator/rectifier, starter switch, flasher relay ---------- */
{
  const g = addPart('battery', 'electrical', 'Battery', 'est', 'Lead-acid battery behind the right-hand side panel, held by a rubber strap; negative earth. The owner\'s bike is 12 V (the models in the manual have a 6 V, 12 Ah battery). The transparent case shows the electrolyte between the upper and lower level lines: top up with distilled water only. Specific gravity of the electrolyte 1.260–1.280. Charge at one tenth of the rated capacity (1.2 A for a 12 Ah battery), red to positive and black to negative. Clean corroded terminals and coat them with Vaseline, not grease.', [0, 0, 0.2]);
  const cs = new THREE.MeshPhysicalMaterial({ color: 0xe8ecef, transparent: true, opacity: 0.55, roughness: 0.3 });
  rbox(0.134, 0.15, 0.08, 0.006, cs, g, V(0.36, 0.555, 0.04));
  rbox(0.126, 0.11, 0.072, 0.004, new THREE.MeshStandardMaterial({ color: 0x4b4f52, roughness: 0.6 }), g, V(0.36, 0.535, 0.04));   // plates in electrolyte
  rbox(0.138, 0.016, 0.084, 0.004, MAT.black(), g, V(0.36, 0.636, 0.04));
  [[P.batPos, 0xc4141c], [P.batNeg, 0x17191c]].forEach(([p, c]) => rod(p.clone().setY(0.636), p, 0.006, new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 }), g, 12));
  [0.585, 0.505].forEach((y) => rbox(0.002, 0.002, 0.07, 0.001, MAT.black(), g, V(0.427, y, 0.04)));   // level lines
}
{
  const g = addPart('fuse', 'electrical', 'Main fuse', 'manual', 'A 20 A fuse in the red lead from the battery\'s positive terminal, in a nylon case beside the battery. A spare 20 A fuse is kept in a rubber holder on the inside of the right-hand side panel. If everything electrical dies, suspect the fuse, but find and cure the short circuit before fitting a new one, or it will blow again. Never bridge a fuse with foil except to get home, and replace it properly at once.', [0, 0.06, 0.2]);
  rbox(0.03, 0.016, 0.012, 0.004, new THREE.MeshStandardMaterial({ color: 0xe9e4d4, roughness: 0.6 }), g, P.fuse);
  rbox(0.024, 0.004, 0.006, 0.001, MAT.chrome(), g, P.fuse.clone().add(V(0, 0.009, 0)));
}
{
  const g = addPart('regrect', 'electrical', 'Regulator/rectifier', 'manual', 'One sealed unit behind the right-hand frame side panel, to the rear of the battery. The rectifier turns the alternator\'s alternating current into direct current to charge the battery; the regulator stops it overcharging. It cannot be repaired: if the alternator tests good but the battery will not charge, the unit is renewed.', [0, 0, 0.22]);
  const al = MAT.casting();
  rbox(0.05, 0.07, 0.014, 0.003, al, g, P.reg);
  for (let i = 0; i < 6; i++) rbox(0.05, 0.003, 0.008, 0.001, al, g, P.reg.clone().add(V(0, -0.03 + i * 0.012, 0.01)));
}
{
  const g = addPart('relay', 'electrical', 'Starter switch (solenoid)', 'manual', 'Beside the battery. Pressing the starter button passes a small current through the solenoid winding; the magnet closes a heavy set of contacts, and the large current the starter motor needs flows straight from the battery to the motor through the thick cable. A click with no starter motor turning points to a flat battery or worn contacts.', [0, 0.05, 0.22]);
  rbox(0.034, 0.042, 0.03, 0.005, MAT.black(), g, P.relay);
  [-1, 1].forEach((s) => rod(P.relay.clone().add(V(s * 0.009, 0.021, 0)), P.relay.clone().add(V(s * 0.009, 0.03, 0)), 0.004, MAT.chrome(), g, 8));
}
{
  const g = addPart('flasher', 'electrical', 'Flashing indicator relay', 'est', 'Switches the indicator current on and off so the lamps flash; the TURN lamp on the speedometer flashes with them. If the indicators stay on or flash fast on one side, look first for a blown bulb or a poor earth on that side. Its position on the bike is estimated.', [0.1, 0.05, 0]);
  const c = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.04, 16), new THREE.MeshStandardMaterial({ color: 0x2c3033, roughness: 0.5 }), g);
  c.position.copy(P.flasher);
}

/* ---------- ignition switch and handlebar switches ---------- */
const SW = {};
{
  const g = addPart('ignsw', 'electrical', 'Ignition switch', 'photo', 'Key switch under the speedometer, in a black cover (photo set3-20). With the key ON, battery current through the 20 A fuse reaches the ignition coil and the lighting, horn, signal and stop lamp circuits; with it OFF nothing works.', [0.1, 0.1, 0]);
  const grp = new THREE.Group(); grp.position.copy(P.key); grp.rotation.z = 0.45; g.add(grp);
  rbox(0.04, 0.03, 0.05, 0.006, MAT.black(), grp);
  rod(V(0, 0.015, 0), V(0, 0.022, 0), 0.009, MAT.chrome(), grp, 18);
  const key = new THREE.Group(); key.position.y = 0.022; grp.add(key);
  rbox(0.004, 0.026, 0.018, 0.002, MAT.chrome(), key, V(0, 0.013, 0));
  SW.key = key;
}
{
  const g = addPart('switches', 'electrical', 'Handlebar switches', 'photo', 'Left-hand block (photos set3-18, set3-19): TURN L/R switch, HORN button and the LIGHTS Hi/Lo dip switch. Right-hand block, from the manual: the starter button and the lighting switch. A switch that works only now and then usually has dirty contacts: separate the two halves of the block, clean the contacts and grease them lightly.', [0.04, 0.3, 0]);
  const blk = MAT.black(), red = MAT.red();
  const at = (p, d) => p.clone().add(d);
  SW.turn = rbox(0.008, 0.01, 0.012, 0.002, blk, g, at(P.lsw, V(-0.024, -0.008, 0)));
  SW.horn = rod(at(P.lsw, V(-0.02, 0.012, -0.012)), at(P.lsw, V(-0.03, 0.012, -0.012)), 0.0045, blk, g, 12);
  SW.dip = rbox(0.008, 0.012, 0.008, 0.002, blk, g, at(P.lsw, V(-0.022, 0.016, 0.012)));
  SW.start = rod(at(P.rsw, V(-0.02, 0.006, 0.01)), at(P.rsw, V(-0.031, 0.006, 0.01)), 0.0052, red, g, 12);
  SW.lights = rbox(0.008, 0.008, 0.016, 0.002, blk, g, at(P.rsw, V(-0.024, 0.016, -0.004)));
  Object.values(SW).forEach((o) => { o.userData.home = o.position.clone(); });
}

/* ---------- ignition: coil, contact breaker, HT leads ---------- */
const IGN = {};
{
  const g = addPart('coil', 'electrical', 'Ignition coil', 'manual', 'A sealed coil under the fuel tank, held by two bolts. Low-tension current from the ignition switch flows through its primary winding and the contact breaker; when the points open, the collapsing field induces a high voltage in the secondary winding, which jumps the gaps of both plugs at once. The coil cannot be repaired: test it for continuity, or have it tested, and renew it if faulty.', [0, 0.12, 0]);
  const c = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.1, 20), MAT.black(), g); c.rotation.z = Math.PI / 2; c.position.copy(P.coil);
  [-1, 1].forEach((s) => rod(P.coil.clone().add(V(0.05, 0, s * 0.01)), P.coil.clone().add(V(0.062, -0.006, s * 0.014)), 0.006, MAT.black(), g, 10));
}
{
  const g = addPart('cb', 'electrical', 'Contact breaker and condenser', 'manual', 'Behind the round cover on the left of the engine. A cam on the end of the crankshaft opens the points once every turn, which fires both plugs (one of them on its exhaust stroke). Gap 0.3–0.4 mm with the points fully open; dirty or pitted points cause misfiring and hard starting. The condenser stops the points arcing. The automatic timing unit (ATU) behind the cam advances the timing from 15° BTDC at idle (F mark on the timing unit lined up with the fixed index mark) to 32–35° BTDC by 2,800 rpm.', [0, 0, -0.2]);
  const plate = mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.003, 32), MAT.casting(), g); plate.rotation.x = Math.PI / 2; plate.position.copy(P.cb);
  const cam = new THREE.Group(); cam.position.copy(P.cb).add(V(0, 0, -0.006)); g.add(cam);
  const s = new THREE.Shape();
  for (let i = 0; i <= 72; i++) { const a = 2 * Math.PI * i / 72, r = 0.008 + 0.0022 * Math.pow(Math.max(0, Math.cos(a)), 8); if (i) s.lineTo(r * Math.cos(a), r * Math.sin(a)); else s.moveTo(r, 0); }
  extrude(s, 0.006, 0.0004, MAT.chrome(), cam, 0);
  // points: moving arm pivoted on the plate, heel on the cam, contact against the fixed contact
  const arm = new THREE.Group(); arm.position.copy(P.cb).add(V(-0.022, 0.012, -0.004)); g.add(arm);
  rbox(0.024, 0.003, 0.004, 0.001, MAT.alloy(), arm, V(0.012, -0.004, 0)).rotation.z = -0.5;
  rod(V(0.02, -0.011, -0.003), V(0.02, -0.011, 0.003), 0.002, MAT.chrome(), arm, 8);
  rod(P.cb.clone().add(V(-0.0005, -0.0075, -0.007)), P.cb.clone().add(V(-0.0005, -0.0075, 0)), 0.002, MAT.chrome(), g, 8);   // fixed contact
  const cond = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.022, 12), MAT.alloy(), g); cond.position.copy(P.cb).add(V(0.018, 0.016, -0.006));
  Object.assign(IGN, { cam, arm });
}

/* ---------- alternator ---------- */
{
  const g = addPart('alternator', 'electrical', 'Alternator', 'manual', 'A permanent-magnet rotor (flywheel) on the left-hand end of the crankshaft turns round an 8-coil stator fixed inside the left casing; the coils never touch the rotor. It makes alternating current whenever the engine runs, which the regulator/rectifier turns into direct current for the battery. To test it, check continuity between the stator leads at the 6-pin connector, and that none of them is connected to the frame.', [0, 0, -0.18]);
  const st = new THREE.Group(); st.position.set(CRANK.x, CRANK.y, -0.135); g.add(st);
  const cu = new THREE.MeshStandardMaterial({ color: 0xb06a32, metalness: 0.6, roughness: 0.4 });
  mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.01, 24), MAT.casting(), st).rotation.x = Math.PI / 2;
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; const c = rbox(0.016, 0.012, 0.012, 0.003, cu, st, V(Math.cos(a) * 0.03, Math.sin(a) * 0.03, 0)); c.rotation.z = a; }
  const rotor = new THREE.Group(); rotor.position.set(CRANK.x, CRANK.y, 0); g.add(rotor);
  lathe([[0.012, 0.146], [0.05, 0.146], [0.05, 0.124], [0.046, 0.124], [0.046, 0.143], [0.012, 0.143]], V(0, 0, 0), V(0, 0, -1), MAT.chain(), rotor, 40);   // bowl open towards the engine, round the stator
  IGN.rotor = rotor;
}

/* ---------- starter motor and its chain ---------- */
const ST = {};
{
  const g = addPart('starter', 'electrical', 'Starter motor', 'manual', 'At the front of the crankcase on the left, at the base of the cylinder barrel. It drives a chain to a sprocket on a one-way (roller) clutch behind the alternator rotor; once the engine fires and runs faster than the motor, the clutch frees and the motor stops. The brushes are 12.2–12.4 mm long new; renew them at 7.0 mm. Undercut the mica between the commutator segments to 0.5–0.8 mm when it is down to 0.2 mm. The motor needs a fully charged battery and clean, tight heavy cables.', [0.12, 0.05, -0.1]);
  const body = mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.09, 24), MAT.black(), g); body.rotation.x = Math.PI / 2; body.position.copy(P.starter);
  [-1, 1].forEach((s) => { const c = mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.01, 24), MAT.alloy(), g); c.rotation.x = Math.PI / 2; c.position.copy(P.starter).add(V(0, 0, s * 0.05)); });
  const sp = new THREE.Group(); sp.position.set(P.starter.x, P.starter.y, -0.116); g.add(sp);
  extrude(gearShape(0.0095, 9, 0.0035), 0.004, 0.0004, MAT.chain(), sp, -0.002);
  const cl = new THREE.Group(); cl.position.set(CRANK.x, CRANK.y, -0.116); g.add(cl);
  extrude(gearShape(0.034, 32, 0.0035), 0.004, 0.0004, MAT.chain(), cl, -0.002);   // driven sprocket on the starter clutch
  const path = beltPath(V(P.starter.x, P.starter.y), 0.011, V(CRANK.x, CRANK.y), 0.0355);
  Object.assign(ST, { sp, cl, chain: chainLinks(path, 0.0064, MAT.chain(), g, { thick: 0.003, width: 0.006, z: -0.116 }) });
}

/* =====================================================================
   Circuits
   ===================================================================== */
// state: { key, lights, beam: 'hi'|'lo', turn: 'L'|'R'|null, horn, fbrake, rbrake, start, engine: 'stopped'|'cranking'|'running', fuse, flat, neutral, flash, spark }
const CIRCUITS = [
  { id: 'charging', name: 'Charging', segs: ['alt_reg', 'reg_fuse', 'bat_fuse', 'bat_gnd'],
    steps: ['Alternator: the rotor\'s magnets turn past the stator coils and make alternating current.', 'Regulator/rectifier: turns it into direct current and stops the battery being overcharged.', 'Main fuse, 20 A.', 'Battery positive terminal: the battery is charged.', 'Back through the frame to the alternator (negative earth).'] },
  { id: 'starting', name: 'Starter', segs: ['bat_fuse', 'fuse_key', 'key_rsw', 'rsw_relay', 'bat_relay', 'relay_starter', 'bat_gnd'],
    steps: ['Battery, 20 A fuse and ignition switch ON.', 'Starter button on the right handlebar: a small current flows to the starter switch winding.', 'Starter switch (solenoid): its magnet closes the heavy contacts.', 'Thick cable: the large starting current flows straight from the battery to the starter motor.', 'Starter motor turns the crankshaft through its chain and the one-way clutch.', 'Back to the battery through the engine and frame.'] },
  { id: 'ignition', name: 'Ignition', segs: ['bat_fuse', 'fuse_key', 'key_coil', 'coil_cb', 'ht_L', 'ht_R', 'bat_gnd'],
    steps: ['Battery, 20 A fuse and ignition switch ON.', 'Ignition coil primary winding.', 'Contact breaker points, closed: current flows to earth and builds a magnetic field in the coil.', 'The cam opens the points 15° before TDC (at idle): the field collapses and the secondary winding makes a high voltage.', 'HT leads: both plugs spark at once; one fires the mixture, the other sparks on the exhaust stroke and does nothing.'] },
  { id: 'head', name: 'Headlamp', segs: ['bat_fuse', 'fuse_key', 'key_rsw', 'rsw_lsw', 'lsw_head', 'bat_gnd'],
    steps: ['Battery, 20 A fuse and ignition switch ON.', 'Lighting switch on the right handlebar: ON.', 'Dip switch on the left handlebar (LIGHTS Hi / Lo).', 'Headlamp bulb: the main (Hi) or dipped (Lo) filament.', 'Back through the frame to the battery.'] },
  { id: 'high', name: 'High beam lamp', segs: ['lsw_hi'],
    steps: ['With the dip switch at Hi, the blue HIGH BEAM lamp on the speedometer lights too.'] },
  { id: 'tail', name: 'Tail lamp', segs: ['bat_fuse', 'fuse_key', 'key_rsw', 'rsw_tail', 'bat_gnd'],
    steps: ['Battery, 20 A fuse and ignition switch ON.', 'Lighting switch ON.', 'Along the loom to the tail lamp: the tail filament of the double-filament bulb.', 'Back through the frame to the battery.'] },
  { id: 'stop', name: 'Stop lamp', segs: ['bat_fuse', 'fuse_key', 'key_fbrk', 'fbrk_tail', 'key_rbrk', 'rbrk_tail', 'bat_gnd'],
    steps: ['Battery, 20 A fuse and ignition switch ON.', 'Front brake lever switch or rear brake pedal switch: either one closes when its brake is applied.', 'The stop filament of the tail lamp bulb, much brighter than the tail filament.', 'Back through the frame to the battery. Set the rear switch to light the lamp at about 20 mm of pedal travel.'] },
  { id: 'turn', name: 'Indicators', segs: ['bat_fuse', 'fuse_key', 'key_flash', 'flash_lsw', 'lsw_tlamp', 'bat_gnd'],
    steps: ['Battery, 20 A fuse and ignition switch ON.', 'Flashing indicator relay: switches the current on and off.', 'TURN switch on the left handlebar: to the left or right pair of indicators.', 'Front and rear indicator bulbs on that side, and the TURN lamp on the speedometer, flash together.', 'Back through the frame to the battery.'] },
  { id: 'horn', name: 'Horn', segs: ['bat_fuse', 'fuse_key', 'key_horn', 'lsw_horn', 'horn_L', 'horn_R', 'bat_gnd'],
    steps: ['Battery, 20 A fuse and ignition switch ON.', 'HORN button on the left handlebar.', 'The horns: a small screw and locknut on each set the tone.', 'Back through the frame to the battery. A weak horn and dim lights point to a flat battery.'] },
  { id: 'neutral', name: 'Neutral lamp', segs: ['bat_fuse', 'fuse_key', 'key_neut', 'speedo_neut', 'bat_gnd'],
    steps: ['Battery, 20 A fuse and ignition switch ON.', 'Green NEUTRAL lamp on the speedometer.', 'Neutral indicator switch on the end of the gear selector drum: it earths the lamp only in neutral.'] },
];
const BY_ID = Object.fromEntries(CIRCUITS.map((c) => [c.id, c]));

/** Which circuits are live for a switch state, and how bright the loads are. */
function evalCircuits(s) {
  const keyLive = s.key && s.fuse, weak = s.flat && s.engine !== 'running';
  const live = {
    charging: s.engine === 'running' && s.fuse,
    starting: keyLive && s.start,
    ignition: keyLive && (s.engine === 'running' || s.engine === 'cranking'),
    head: keyLive && s.lights,
    high: keyLive && s.lights && s.beam === 'hi',
    tail: keyLive && s.lights,
    stop: keyLive && (s.fbrake || s.rbrake),
    turn: keyLive && !!s.turn,
    horn: keyLive && s.horn,
    neutral: keyLive && s.neutral,
  };
  const segs = new Set();
  CIRCUITS.forEach((c) => {
    if (!live[c.id]) return;
    let list = c.segs;
    if (c.id === 'stop') list = list.filter((id) => (s.fbrake || !id.includes('fbrk')) && (s.rbrake || !id.includes('rbrk')));
    if (c.id === 'turn' && s.flash) list = list.concat(s.turn === 'L' ? ['lsw_tfL', 'lsw_trL'] : ['lsw_tfR', 'lsw_trR']);
    if (c.id === 'turn' && !s.flash) list = list.filter((id) => id === 'bat_fuse' || id === 'fuse_key' || id === 'key_flash' || id === 'bat_gnd');
    if (c.id === 'ignition' && !s.spark) list = list.filter((id) => !id.startsWith('ht_'));
    list.forEach((id) => segs.add(id));
  });
  return { live, segs, bright: weak ? 0.3 : 1, hornWorks: !weak, starterTurns: !s.flat };
}

let flowT = 0;
/** Light the live wires and move the switches; returns nothing. crankDeg turns the rotor and contact breaker cam. */
function poseElectrical(s, segs, dt, { crankDeg = 0, starterDeg = 0 } = {}) {
  flowT += dt;
  Object.entries(SEGS).forEach(([id, S]) => {
    const on = segs.has(id);
    if (on !== S.live) { S.live = on; S.mat.map = on ? S.map : null; S.mat.color.copy(on ? LIVE : IDLE); S.mat.needsUpdate = true; }
    if (on) S.map.offset.x = -flowT * 1.6;
  });
  SW.key.rotation.y = s.key ? Math.PI / 2 : 0;
  SW.turn.position.copy(SW.turn.userData.home).add(V(0, 0, s.turn === 'L' ? -0.005 : s.turn === 'R' ? 0.005 : 0));
  SW.horn.position.copy(SW.horn.userData.home).add(V(s.horn ? 0.004 : 0, 0, 0));
  SW.start.position.copy(SW.start.userData.home).add(V(s.start ? 0.004 : 0, 0, 0));
  SW.dip.position.copy(SW.dip.userData.home).add(V(0, s.beam === 'hi' ? 0.003 : -0.003, 0));
  SW.lights.position.copy(SW.lights.userData.home).add(V(0, 0, s.lights ? 0.005 : -0.005));
  const th = -crankDeg * DEG;
  IGN.rotor.rotation.z = th;
  // the lobe reaches the points heel (about 250° round the plate) at 345°, i.e. 15° BTDC: the spark
  const camRot = th + (345 + 250) * DEG;
  IGN.cam.rotation.z = camRot;
  const lobe = Math.cos(camRot - 250 * DEG);
  IGN.arm.rotation.z = -0.12 * Math.pow(Math.max(0, lobe), 8);
  ST.sp.rotation.z = -starterDeg * DEG;
  ST.cl.rotation.z = -starterDeg * DEG * 11 / 35.5;
  ST.chain.update(starterDeg * DEG * 0.011);
}

export { BY_ID, CIRCUITS, evalCircuits, poseElectrical };
