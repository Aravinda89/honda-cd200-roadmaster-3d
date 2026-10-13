// Viewer: renderer, camera, dimensions overlay, explode, parts list, picking, brake and engine modes and the render loop.
// Entry point. Part modules are imported in build order; the order matters for parts that reference others.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { $, BASIS, DEG, FA, LAYSHAFT, MAINSHAFT, PARTS, R, RA, SYSTEMS, V, WB, bike, byId } from './core.js';
import { SEAT_TOP } from './parts/body.js';
import './parts/chassis.js';
import { FRONT_R, REAR_R, poseFinalDrive } from './parts/wheels.js';
import { cylWorld } from './parts/engine.js';
import { GAP_VIS, SPARK_BTDC, VALVE_EVENTS, cycleState, poseEngine } from './parts/internals.js';
import { DRUM_POS, GB, LIFT_MAX, RATIOS, SEQ, TEETH, engagedGear, poseGearbox, stepGearbox } from './parts/gearbox.js';
import './parts/exhaust.js';
import { poseLamps, setDialLamps, setNeutralLamp } from './parts/lights.js';
import { CONTROLS } from './parts/controls.js';
import { BY_ID, CIRCUITS, evalCircuits, poseElectrical } from './parts/electrical.js';
import { BRAKES, FB, LINING_LIMIT, RB, TAIL_GLOW, poseBrake, poseLinkages, setLining } from './parts/brakes.js';

/* =====================================================================
   Scene, renderer, lighting
   ===================================================================== */
const viewport = $('#viewport');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true });
} catch (err) {
  $('#loadingText').textContent = 'This browser could not start 3D graphics (WebGL). Try another browser or device.';
  throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
viewport.appendChild(renderer.domElement);
const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.className = 'labels';
viewport.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
scene.add(bike);
scene.fog = new THREE.Fog(0xdfe5e8, 6, 15);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

const hemi = new THREE.HemisphereLight(0xffffff, 0x8a979e, 0.55);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(2.2, 4.2, -1.6);
sun.target.position.set(0.6, 0, 0);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -1.7, right: 1.7, top: 1.7, bottom: -1.7, near: 0.5, far: 9 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: 0xd6dde1, roughness: 0.95, metalness: 0 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const grid = new THREE.GridHelper(3.2, 32);
grid.position.set(0.62, 0.0008, 0);
grid.material.vertexColors = false; grid.material.transparent = true; grid.material.opacity = 0.55;
scene.add(grid);

const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 60);
let viewShift = { x: 0, y: 0 };
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 0.45; controls.maxDistance = 11;
controls.maxPolarAngle = Math.PI / 2 - 0.03;
controls.autoRotateSpeed = 1.1;
const CENTER = V(0.62, 0.62, 0);
controls.target.copy(CENTER);

/* ---------- dimensions overlay ---------- */
const dims = new THREE.Group(); dims.visible = false; scene.add(dims);
const dimItems = [], dimMats = [];
const bboxAll = new THREE.Box3().setFromObject(bike);
const barBox = new THREE.Box3().setFromObject(byId.get('bars').group).union(new THREE.Box3().setFromObject(byId.get('levers').group));
const mm = (m) => Math.round(m * 1000).toLocaleString('en-US');
function dimLine(a, b, tick, label, sub, labelAt) {
  // drawn on the bike's centre plane and on top of it, so the lines line up with the model in side and front views
  const mat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.95, depthTest: false });
  dimMats.push(mat);
  const pts = [a, b, a.clone().add(tick), a.clone().sub(tick), b.clone().add(tick), b.clone().sub(tick)];
  const geo = new THREE.BufferGeometry().setFromPoints([pts[0], pts[1], pts[2], pts[3], pts[4], pts[5]]);
  const line = new THREE.LineSegments(geo, mat); line.renderOrder = 10; dims.add(line);
  const el = document.createElement('div'); el.className = 'dim';
  el.innerHTML = `<b>${label}</b>${sub ? `<span>${sub}</span>` : ''}`;
  const o = new CSS2DObject(el); o.position.copy(labelAt || a.clone().add(b).multiplyScalar(0.5)); o.visible = false;
  dims.add(o); dimItems.push({ line, label: o, axis: Math.abs(b.z - a.z) > 0.1 ? 'front' : 'side' });
}
{
  const z = 0;
  dimLine(V(0, 0.004, z), V(WB, 0.004, z), V(0, 0.04, 0), 'Wheelbase 1,280 mm', 'spec', V(WB / 2, 0.07, z));
  dimLine(V(bboxAll.min.x, 1.38, z), V(bboxAll.max.x, 1.38, z), V(0, 0.04, 0), 'Length 1,990 mm', `spec · model ${mm(bboxAll.max.x - bboxAll.min.x)}`);
  dimLine(V(0.4, 0, z), V(0.4, SEAT_TOP, z), V(0.04, 0, 0), 'Seat 744 mm', `spec · model ${mm(SEAT_TOP)}`, V(0.4, 0.5, z));
  dimLine(V(barBox.max.x - 0.03, 0, z), V(barBox.max.x - 0.03, barBox.max.y, z), V(0.04, 0, 0), 'Height 1,105 mm', `spec · model ${mm(barBox.max.y)}`, V(barBox.max.x - 0.03, 0.9, z));
  dimLine(V(0.8, barBox.max.y + 0.04, barBox.min.z), V(0.8, barBox.max.y + 0.04, barBox.max.z), V(0, 0.04, 0), 'Width 845 mm', `spec · model ${mm(barBox.max.z - barBox.min.z)}`, V(0.8, barBox.max.y + 0.13, 0));
}

/* ---------- theme ---------- */
const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function applyTheme() {
  const stage = new THREE.Color(cssVar('--stage') || '#dfe5e8');
  scene.background = stage; scene.fog.color.copy(stage);
  ground.material.color.set(cssVar('--floor') || '#d6dde1');
  grid.material.color.set(cssVar('--grid') || '#b4c0c7');
  const dark = stage.getHSL({}).l < 0.4;
  hemi.intensity = dark ? 0.35 : 0.55;
  dimMats.forEach((m) => m.color.set(cssVar('--accent') || '#16709f'));
}
applyTheme();
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

/* ---------- sizing ---------- */
function resize() {
  const w = viewport.clientWidth || 1, h = viewport.clientHeight || 1;
  renderer.setSize(w, h, false); labelRenderer.setSize(w, h);
  camera.aspect = w / h;
  if (viewShift.x || viewShift.y) camera.setViewOffset(w, h, -viewShift.x, -viewShift.y, w, h); else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(viewport);
resize();

/* =====================================================================
   Camera views
   ===================================================================== */
function effAspect() {
  const w = viewport.clientWidth || 1, h = viewport.clientHeight || 1;
  return Math.max(0.3, (w - 2 * viewShift.x) / Math.max(1, h - 2 * Math.abs(viewShift.y)));
}
function viewPose(name) {
  const a = effAspect(), side = Math.max(3.5, 4.5 / a), end = Math.max(3.6, 2.6 / a);
  const c = CENTER.clone();
  switch (name) {
    case 'left': return { pos: c.clone().add(V(0, 0.12, -side)), target: c };
    case 'right': return { pos: c.clone().add(V(0, 0.12, side)), target: c };
    case 'front': return { pos: c.clone().add(V(end, 0.18, 0)), target: c };
    case 'rear': return { pos: c.clone().add(V(-end, 0.25, 0)), target: c };
    case 'top': return { pos: c.clone().add(V(0, side * 1.02, -0.02)), target: c.clone().setY(0.4) };
    default: { const k = Math.max(3.5, 3.6 / a) / 3.3; return { pos: c.clone().add(V(1.75 * k, 0.8 * k, -2.45 * k)), target: c }; }
  }
}
let tween = null;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function flyTo(pose, ms = 750) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  tween = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pose.pos, t1: pose.target, start: performance.now(), ms: reduce ? 1 : ms };
}
function setViewButtons(name) {
  document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === name)));
}
function goView(name) { setViewButtons(name); flyTo(viewPose(name)); }
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => goView(b.dataset.view)));
controls.addEventListener('start', () => { tween = null; setViewButtons(''); });
{ const p = viewPose('three'); camera.position.copy(p.pos); controls.target.copy(p.target); controls.update(); }

/* =====================================================================
   Explode
   ===================================================================== */
let explodeNow = 0, explodeTarget = 0;
const HIDE_ON_EXPLODE = ['cables', 'ccable', 'fcable', 'rrod', 'stopsw'];
function applyExplode(t) {
  bike.traverse((o) => { if (o.userData.explode) o.position.copy(o.userData.home).addScaledVector(o.userData.explode, t); });
  HIDE_ON_EXPLODE.forEach((id) => { const p = byId.get(id); p.group.visible = p.visible && t < 0.04; });
}
const explodeInput = $('#explode'), explodeOut = $('#explodeOut');
explodeInput.addEventListener('input', () => { explodeTarget = explodeInput.value / 100; explodeOut.textContent = `${explodeInput.value}%`; if (explodeTarget > 0 && dims.visible) setDims(false); });

/* =====================================================================
   Parts list, selection, visibility
   ===================================================================== */
const eyeSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><g class="open"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></g><g class="shut"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a10 10 0 0 0 5.4-1.6"/></g></svg>';
let stage = 'body';
// systems that sit inside other parts and only show in the stages listed
const STAGE_ONLY = { internals: ['engine', 'gearbox', 'electrical'], transmission: ['gearbox'], electrical: ['electrical'] };
const inSys = (sys) => !STAGE_ONLY[sys] || STAGE_ONLY[sys].includes(stage);
const inStage = (p) => inSys(p.sys);
function showSystems() { SYSTEMS.forEach((s) => { $(`#sys-${s.id}`).hidden = !inSys(s.id); }); }
const systemsEl = $('#systems');
SYSTEMS.forEach((sys) => {
  const list = PARTS.filter((p) => p.sys === sys.id);
  const sec = document.createElement('section'); sec.className = 'sys'; sec.id = `sys-${sys.id}`;
  sec.innerHTML = `<div class="sys-head">
      <button type="button" class="sys-toggle" id="sx-${sys.id}" aria-expanded="true" aria-controls="sl-${sys.id}"><span class="caret"></span><span class="sys-name">${sys.name}</span><span class="count">${list.length}</span></button>
      <label class="switch" title="Show or hide ${sys.name}"><input type="checkbox" id="sv-${sys.id}" checked><span class="track"></span><span class="sr">Show ${sys.name}</span></label>
    </div>
    <ul class="parts" id="sl-${sys.id}">${list.map((p) => `<li><button type="button" class="part" id="pb-${p.id}" data-id="${p.id}">${p.name}</button><button type="button" class="eye" id="pe-${p.id}" data-eye="${p.id}" aria-pressed="true" aria-label="Hide ${p.name}">${eyeSvg}</button></li>`).join('')}</ul>`;
  systemsEl.appendChild(sec);
  sec.querySelector('.sys-toggle').addEventListener('click', (e) => {
    const btn = e.currentTarget, open = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!open)); $(`#sl-${sys.id}`).hidden = open;
  });
  sec.querySelector(`#sv-${sys.id}`).addEventListener('change', (e) => { isolated = null; list.forEach((p) => setVisible(p.id, e.target.checked)); syncUI(); });
});
systemsEl.addEventListener('click', (e) => {
  const pb = e.target.closest('.part'), eye = e.target.closest('.eye');
  if (pb) { const id = pb.dataset.id; if (!byId.get(id).visible) setVisible(id, true); select(id); focusPart(id); closePanelOnMobile(); syncUI(); }
  if (eye) { const id = eye.dataset.eye; isolated = null; setVisible(id, !byId.get(id).visible); syncUI(); }
});

let selected = null, hovered = null, isolated = null;
function setEmissive(p, color, intensity) {
  if (!p) return;
  p.group.traverse((o) => {
    if (!o.isMesh) return;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
      if (!m.emissive) return;
      if (!m.userData.em) { m.userData.em = m.emissive.clone(); m.userData.ei = m.emissiveIntensity; }
      if (color) { m.emissive.set(color); m.emissiveIntensity = intensity; } else { m.emissive.copy(m.userData.em); m.emissiveIntensity = m.userData.ei; }
    });
  });
}
const signal = () => cssVar('--signal') || '#d9730a';
function refreshHighlights() {
  PARTS.forEach((p) => setEmissive(p, null));
  if (hovered && hovered !== selected) setEmissive(hovered, signal(), 0.14);
  if (selected) setEmissive(selected, signal(), 0.34);
}
function setVisible(id, v) { const p = byId.get(id); p.visible = v; p.group.visible = v && inStage(p) && !(HIDE_ON_EXPLODE.includes(id) && explodeNow >= 0.04); if (!v && selected === p) select(null); }
function syncUI() {
  PARTS.forEach((p) => {
    const eye = $(`#pe-${p.id}`), pb = $(`#pb-${p.id}`);
    eye.setAttribute('aria-pressed', String(p.visible)); eye.setAttribute('aria-label', `${p.visible ? 'Hide' : 'Show'} ${p.name}`);
    pb.classList.toggle('off', !p.visible); pb.setAttribute('aria-current', String(selected === p));
  });
  SYSTEMS.forEach((s) => { $(`#sv-${s.id}`).checked = PARTS.some((p) => p.sys === s.id && p.visible); });
  $('#aIsolate').textContent = isolated ? 'Show all parts' : 'Show only this';
}
const infoEl = $('#info');
function select(id) {
  selected = id ? byId.get(id) : null;
  refreshHighlights();
  if (selected) {
    $('#infoSys').textContent = SYSTEMS.find((s) => s.id === selected.sys).name;
    $('#infoName').textContent = selected.name;
    $('#infoDesc').textContent = selected.desc;
    const b = $('#infoBasis'); b.dataset.basis = selected.basis; b.textContent = BASIS[selected.basis];
    infoEl.hidden = false;
  } else infoEl.hidden = true;
  syncUI();
}
function focusPart(id) {
  const p = byId.get(id); if (!p) return;
  const box = new THREE.Box3().setFromObject(p.group);
  if (box.isEmpty()) return;
  const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3()).length();
  const dir = camera.position.clone().sub(controls.target).normalize();
  const dist = Math.max(0.6, size * 1.9) * Math.max(1, 1.2 / camera.aspect);
  setViewButtons('');
  flyTo({ pos: c.clone().addScaledVector(dir, dist), target: c });
}
$('#infoClose').addEventListener('click', () => select(null));
$('#aFocus').addEventListener('click', () => selected && focusPart(selected.id));
$('#aHide').addEventListener('click', () => { if (!selected) return; isolated = null; setVisible(selected.id, false); syncUI(); });
$('#aIsolate').addEventListener('click', () => {
  if (isolated) { isolated = null; PARTS.forEach((p) => setVisible(p.id, true)); }
  else if (selected) { isolated = selected.id; PARTS.forEach((p) => setVisible(p.id, p === selected)); }
  syncUI();
});

/* ---------- picking ---------- */
const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
const shownChain = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
const partOf = (o) => { for (; o; o = o.parent) if (o.userData.partId) return byId.get(o.userData.partId); return null; };
function pick(x, y) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  let fallback = null;
  for (const h of raycaster.intersectObject(bike, true)) {
    if (!shownChain(h.object)) continue;
    const p = partOf(h.object); if (!p) continue;
    if (p.ghost != null) { if (stageFocus().has(p.id) && !fallback) fallback = p; continue; }
    return p;
  }
  return fallback;
}
const canvas = renderer.domElement, tip = $('#tip');
let downAt = null, hoverEvt = null;
canvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointerup', (e) => {
  if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 6) { const p = pick(e.clientX, e.clientY); select(p ? p.id : null); }
  downAt = null;
});
canvas.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') hoverEvt = e; });
canvas.addEventListener('pointerleave', () => { hoverEvt = null; hovered = null; tip.hidden = true; canvas.style.cursor = ''; refreshHighlights(); });
function processHover() {
  if (!hoverEvt) return;
  const e = hoverEvt; hoverEvt = null;
  if (e.buttons) { tip.hidden = true; return; }
  const p = pick(e.clientX, e.clientY);
  if (p !== hovered) { hovered = p; refreshHighlights(); }
  canvas.style.cursor = p ? 'pointer' : '';
  if (p) {
    const r = $('#stage').getBoundingClientRect();
    tip.textContent = p.name; tip.hidden = false;
    tip.style.left = `${e.clientX - r.left}px`; tip.style.top = `${e.clientY - r.top}px`;
  } else tip.hidden = true;
}
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') select(null); });

/* ---------- tools ---------- */
const tDims = $('#tDims'), tSpin = $('#tSpin');
function setDims(on) {
  tDims.setAttribute('aria-pressed', String(on)); dims.visible = on;
  if (!on) dimItems.forEach((d) => { d.label.visible = false; });
  if (on && explodeTarget > 0) { explodeTarget = 0; explodeInput.value = 0; explodeOut.textContent = '0%'; }
}
function updateDims() {
  if (!dims.visible) return;
  const dir = camera.position.clone().sub(controls.target).normalize();
  const sideOn = Math.abs(dir.z) > 0.45, frontOn = Math.abs(dir.x) > 0.6;
  dimItems.forEach((d) => { const on = d.axis === 'front' ? frontOn : sideOn; d.line.visible = on; d.label.visible = on; });
}
tDims.addEventListener('click', () => setDims(tDims.getAttribute('aria-pressed') !== 'true'));
tSpin.addEventListener('click', () => { const on = tSpin.getAttribute('aria-pressed') !== 'true'; tSpin.setAttribute('aria-pressed', String(on)); controls.autoRotate = on; });
$('#tReset').addEventListener('click', () => {
  if (stage !== 'body') { setStage('body'); return; }
  isolated = null; PARTS.forEach((p) => setVisible(p.id, true)); select(null);
  explodeTarget = 0; explodeInput.value = 0; explodeOut.textContent = '0%';
  controls.autoRotate = false; tSpin.setAttribute('aria-pressed', 'false');
  goView('three'); syncUI();
});
const panel = $('#panel'), panelToggle = $('#panelToggle');
panelToggle.addEventListener('click', () => { const open = !panel.classList.contains('open'); panel.classList.toggle('open', open); panelToggle.setAttribute('aria-expanded', String(open)); });
function closePanelOnMobile() { if (window.matchMedia('(max-width: 760px)').matches) { panel.classList.remove('open'); panelToggle.setAttribute('aria-expanded', 'false'); } }

/* =====================================================================
   Stage 2: brake mode (operate, adjust, check wear)
   ===================================================================== */
const BRAKE_UI = {
  f: {
    label: 'Front', travelMax: 60, k: 1.4, slack: 5, slackMax: 25, spec: [10, 20], firm: 2.5, firmText: 'The brake is on: the lever goes firm here.',
    hold: 'Hold to squeeze the lever', travelLabel: 'Lever travel', linkView: 'Lever view', where: 'at the lever end',
    adjHint: 'Turn the adjuster nut at the brake arm in to take up cable slack. The manual asks for 10–20 mm of free play at the lever end.',
    steps: ['The lever pulls the inner cable. The first part of the travel only takes up slack: that is the free play.', 'The cable turns the operating arm on the back plate.', 'The arm turns the cam inside the plate.', 'The cam pushes the shoes apart. Each shoe pivots on the anchor pin.', 'The linings press on the drum and slow the wheel.'],
  },
  r: {
    label: 'Rear', travelMax: 75, k: 1.2, slack: 13, slackMax: 25, spec: [20, 30], firm: 3, switchAt: 20, firmText: 'The brake is on: the pedal goes firm here.',
    hold: 'Hold to press the pedal', travelLabel: 'Pedal travel', linkView: 'Pedal view', where: 'at the pedal',
    adjHint: 'Turn the adjuster nut on the end of the brake rod in to reduce free play. The manual asks for 20–30 mm of pedal travel before the brake works.',
    steps: ['The pedal pulls the brake rod forward. The first part of the travel only takes up slack: that is the free play.', 'The rod turns the operating arm on the back plate.', 'The arm turns the cam inside the plate.', 'The cam pushes the shoes apart. Each shoe pivots on the anchor pin.', 'The linings press on the drum and slow the wheel.'],
  },
};
const BRAKE_FOCUS = new Set(PARTS.filter((p) => p.sys === 'brakes').map((p) => p.id).concat(['tail']));
const BRAKE_CONTEXT = { fwheel: 0.12, rwheel: 0.12, bars: 0.45, pegs: 0.3 };   // parts kept faintly visible for reference
const ENGINE_FOCUS = new Set(PARTS.filter((p) => p.sys === 'internals').map((p) => p.id));
const ENGINE_SHELL = ['cylinders', 'crankcase'];                  // see-through when "See inside" is on, solid when off
const ENGINE_CONTEXT = { headers: 0.12, frame: 0.06, fwheel: 0.05, rwheel: 0.05 };
const GEAR_FOCUS = new Set(PARTS.filter((p) => p.sys === 'transmission').map((p) => p.id).concat(['drive', 'rwheel', 'levers', 'ccable', 'pedals']));
const GEAR_SHELL = ['crankcase', 'chaincase'];                   // see-through when "See inside" is on
const GEAR_CONTEXT = { crank: 0.3, pistons: 0.14, conrods: 0.14, camchain: 0.1, camshaft: 0.08, rockers: 0.08, valves: 0.08, plugs: 0.08, cylinders: 0.06, bars: 0.35, speedo: 0.5, frame: 0.06, swingarm: 0.1 };
const ELEC_FOCUS = new Set(PARTS.filter((p) => p.sys === 'electrical').map((p) => p.id).concat(['headlamp', 'tail', 'findic', 'rindic', 'horn', 'speedo', 'plugs', 'stopsw']));
const ELEC_SHELL = ['sidecovers', 'crankcase', 'tank'];           // see-through when "See inside" is on
const ELEC_CONTEXT = { bars: 0.4, flever: 0.4, levers: 0.4, frame: 0.16, fwheel: 0.08, rwheel: 0.08, cylinders: 0.1, chaincase: 0.1, seat: 0.12, fork: 0.12 };
const NO_FOCUS = new Set();
const stageFocus = () => ({ brakes: BRAKE_FOCUS, engine: ENGINE_FOCUS, gearbox: GEAR_FOCUS, electrical: ELEC_FOCUS }[stage] || NO_FOCUS);
const bstate = { f: { t: 0, target: 0 }, r: { t: 0, target: 0 } };
let brakeKey = 'f', seeInside = true, holding = false;
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function setGhost(p, op) {
  if ((p.ghost ?? null) === op) return;
  p.ghost = op;
  p.group.traverse((o) => {
    if (!o.isMesh) return;
    if (o.userData.cs0 === undefined) o.userData.cs0 = o.castShadow;
    o.castShadow = op == null ? o.userData.cs0 : false;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
      if (m.userData.noGhost) return;
      if (!m.userData.g0) m.userData.g0 = { t: m.transparent, o: m.opacity, d: m.depthWrite };
      const g0 = m.userData.g0;
      if (op == null) { m.transparent = g0.t; m.opacity = g0.o; m.depthWrite = g0.d; } else { m.transparent = true; m.opacity = op; m.depthWrite = false; }
      m.needsUpdate = true;
    });
  });
}
function applyGhosts() {
  PARTS.forEach((p) => {
    let op = null;
    if (stage === 'brakes') {
      if (!BRAKE_FOCUS.has(p.id)) op = BRAKE_CONTEXT[p.id] ?? 0.07;
      else if (seeInside && (p.id === 'fplate' || p.id === 'rplate')) op = 0.16;
    } else if (stage === 'engine' && !ENGINE_FOCUS.has(p.id)) {
      op = ENGINE_SHELL.includes(p.id) ? (eng.inside ? 0.13 : null) : ENGINE_CONTEXT[p.id] ?? 0.04;
    } else if (stage === 'gearbox' && !GEAR_FOCUS.has(p.id)) {
      op = GEAR_SHELL.includes(p.id) ? (gb.inside ? 0.12 : null) : GEAR_CONTEXT[p.id] ?? 0.04;
    } else if (stage === 'electrical' && !ELEC_FOCUS.has(p.id)) {
      op = ELEC_SHELL.includes(p.id) ? (el.inside ? 0.12 : null) : ELEC_CONTEXT[p.id] ?? 0.05;
    }
    setGhost(p, op);
  });
}

function brakeNumbers(key) {
  const B = BRAKES[key], cfg = BRAKE_UI[key];
  const thC = B.thetaC(B.lining), fp = cfg.slack + thC / cfg.k, limit = fp + cfg.firm;
  const tEff = Math.min(bstate[key].t, limit);
  const theta = Math.min(thC, Math.max(0, (tEff - cfg.slack) * cfg.k));
  return { thC, fp, limit, tEff, theta, contact: tEff >= fp - 1e-6 && tEff > 0, firm: tEff >= limit - 0.05 };
}
function brakePose(key, which) {
  const m = Math.max(1, (which === 'hub' ? 0.85 : 1.15) / effAspect());
  let target, off;
  if (key === 'f' && which === 'hub') { target = FA.clone().add(V(-0.015, 0.02, -0.06)); off = V(-0.1, 0.1, -0.62); }
  else if (key === 'f') { target = V(0.78, 1.05, 0.34); off = V(0.2, 0.17, 0.3); }
  else if (which === 'hub') { target = RA.clone().add(V(0.03, -0.01, 0.07)); off = V(0.1, 0.1, 0.62); }
  else { target = V(0.31, 0.3, 0.13); off = V(0.04, 0.22, 1.15); }
  return { pos: target.clone().addScaledVector(off, m), target };
}

const panelEl = $('#brakePanel'), holdBtn = $('#bpHold'), travelIn = $('#bpTravel'), adjIn = $('#bpAdj'), liningIn = $('#bpLining');
function chip(el, state, text) { el.dataset.state = state; el.textContent = text; }
const fmm = (v) => `${v.toFixed(1)} mm`;
function renderSteps() {
  $('#bpSteps').innerHTML = BRAKE_UI[brakeKey].steps.map((t, i) => `<li id="bs${i}">${t}</li>`).join('');
}
function updateReadouts() {
  const key = brakeKey, cfg = BRAKE_UI[key], B = BRAKES[key], n = brakeNumbers(key);
  $('#bpTravelOut').textContent = `${n.tEff.toFixed(0)} mm`;
  $('#bpFirm').hidden = !n.firm; $('#bpFirm').textContent = cfg.firmText;
  $('#rdFp').textContent = fmm(n.fp);
  if (n.fp < cfg.spec[0]) chip($('#chFp'), 'bad', 'Too little: may drag');
  else if (n.fp > cfg.spec[1]) chip($('#chFp'), 'warn', 'Too much: adjust');
  else chip($('#chFp'), 'ok', `In spec ${cfg.spec[0]}–${cfg.spec[1]}`);
  $('#rdCam').textContent = `${n.theta.toFixed(0)}° of ${n.thC.toFixed(0)}°`;
  chip($('#chContact'), n.contact ? 'on' : 'idle', n.contact ? 'On the drum' : 'Clear');
  $('#rdContact').textContent = n.contact ? 'Pressing' : `${((B.need(B.lining) - Math.min(B.phiOf(n.theta), B.need(B.lining) / B.gAvg) * B.gAvg) * 1000).toFixed(1)} mm gap`;
  if (key === 'r') { const on = n.tEff >= cfg.switchAt; chip($('#chLamp'), on ? 'on' : 'idle', on ? 'On' : 'Off'); $('#rdLamp').textContent = `lights at ${cfg.switchAt} mm`; }
  // steps
  const t = n.tEff, phase = t <= 0.05 ? 0 : t < cfg.slack ? 1 : !n.contact ? 2 : 3;
  document.querySelectorAll('#bpSteps li').forEach((li, i) => {
    let c = '';
    if (phase === 1) c = i === 0 ? 'active' : '';
    if (phase === 2) c = i === 0 ? 'done' : i <= 3 ? 'active' : '';
    if (phase === 3) c = i <= 3 ? 'done' : 'active';
    li.className = c;
  });
  // adjuster
  $('#bpAdjOut').textContent = `${cfg.slack.toFixed(0)} mm slack`;
  // wear
  const w = B.lining, gap = B.markDeg - n.thC;
  $('#bpLiningOut').textContent = `${w.toFixed(1)} mm`;
  if (w > LINING_LIMIT + 0.04) chip($('#chWear'), 'ok', 'Linings OK');
  else if (w >= LINING_LIMIT - 0.04) chip($('#chWear'), 'warn', 'At the limit');
  else chip($('#chWear'), 'bad', 'Below the limit');
  $('#bpWear').textContent = w > LINING_LIMIT + 0.04
    ? `With the brake on, the arrow on the cam tag stops ${gap.toFixed(0)}° short of the mark on the back plate.`
    : w >= LINING_LIMIT - 0.04
      ? 'With the brake on, the arrow lines up with the mark: the linings are at the 2.0 mm service limit. Renew both shoes.'
      : 'With the brake on, the arrow passes the mark: the linings are below 2.0 mm. Renew both shoes now.';
}
function setBrake(key, fly = true) {
  brakeKey = key; holding = false; holdBtn.classList.remove('down');
  document.querySelectorAll('[data-brake]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.brake === key)));
  const cfg = BRAKE_UI[key];
  holdBtn.textContent = cfg.hold;
  $('#bpTravelLabel').textContent = cfg.travelLabel;
  travelIn.max = cfg.travelMax;
  adjIn.max = cfg.slackMax; adjIn.value = cfg.slackMax - cfg.slack;
  liningIn.value = BRAKES[key].lining;
  $('#rowLamp').hidden = key !== 'r';
  $('#bpLinkView').textContent = cfg.linkView;
  $('#bpAdjHint').textContent = cfg.adjHint;
  ['f', 'r'].forEach((k) => { if (k !== key) bstate[k].t = bstate[k].target = 0; });
  travelIn.value = bstate[key].t;
  renderSteps(); updateReadouts();
  if (fly) { setViewButtons(''); flyTo(brakePose(key, 'hub')); }
}
function updateViewShift() {
  const pe = { brakes: panelEl, engine: enginePanelEl, gearbox: gearPanelEl, electrical: elecPanelEl }[stage];
  let x = 0, y = 0;
  if (pe && !pe.hidden) {
    const r = pe.getBoundingClientRect(), v = viewport.getBoundingClientRect();
    if (v.width > 760) x = Math.round((r.right - v.left) / 2);
    else y = -Math.round((v.bottom - r.top) / 2);
  }
  if (x !== viewShift.x || y !== viewShift.y) { viewShift = { x, y }; resize(); }
}
const enginePanelEl = $('#enginePanel'), gearPanelEl = $('#gearPanel'), elecPanelEl = $('#elecPanel');
[panelEl, enginePanelEl, gearPanelEl, elecPanelEl].forEach((p) => new ResizeObserver(() => updateViewShift()).observe(p));
const EYEBROW = { body: 'Stage 1 · Outer body', brakes: 'Stage 2 · Brakes', engine: 'Stage 3 · Engine', gearbox: 'Stage 4 · Clutch and gearbox', electrical: 'Stage 5 · Electrical' };
function setStage(next) {
  if (stage === next) return;
  stage = next;
  const body = stage === 'body';
  document.querySelectorAll('[data-stage]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.stage === stage)));
  $('#stage').classList.toggle('panel-mode', !body);
  $('#eyebrow').textContent = EYEBROW[stage];
  panelEl.hidden = stage !== 'brakes'; enginePanelEl.hidden = stage !== 'engine'; gearPanelEl.hidden = stage !== 'gearbox'; elecPanelEl.hidden = stage !== 'electrical';
  $('#faults').hidden = stage !== 'brakes'; $('#engineFaults').hidden = stage !== 'engine'; $('#gearFaults').hidden = stage !== 'gearbox'; $('#elecFaults').hidden = stage !== 'electrical';
  $('.bottombar').hidden = !body;
  tDims.hidden = !body; if (!body) setDims(false);
  explodeTarget = explodeNow = 0; explodeInput.value = 0; explodeOut.textContent = '0%'; applyExplode(0);
  isolated = null; PARTS.forEach((p) => setVisible(p.id, true)); showSystems();
  ['f', 'r'].forEach((k) => { bstate[k].t = bstate[k].target = 0; });
  holding = false;
  if (stage === 'engine') { eng.target = null; setPlaying(!reduceMotion()); }
  gbEndHold(); if (stage !== 'gearbox') setNeutralLamp(false);
  elReleaseAll(); if (stage !== 'electrical') { poseLamps({}); setDialLamps({ turn: false, high: false }); }
  applyGhosts(); select(null);
  updateViewShift();
  if (stage === 'brakes') setBrake(brakeKey, true);
  else if (stage === 'engine') { setFollow(eng.follow); setViewButtons(''); flyTo(enginePose('cyl')); }
  else if (stage === 'gearbox') { gbReadouts(); setViewButtons(''); flyTo(gearPose('gears')); }
  else if (stage === 'electrical') { setViewButtons(''); flyTo(elecPose('lights')); }
  else goView('three');
  syncUI();
}
document.querySelectorAll('[data-stage]').forEach((b) => b.addEventListener('click', () => { setStage(b.dataset.stage); closePanelOnMobile(); }));
document.querySelectorAll('[data-brake]').forEach((b) => b.addEventListener('click', () => setBrake(b.dataset.brake)));
$('#bpHubView').addEventListener('click', () => { setViewButtons(''); flyTo(brakePose(brakeKey, 'hub')); });
$('#bpLinkView').addEventListener('click', () => { setViewButtons(''); flyTo(brakePose(brakeKey, 'link')); });
$('#bpInside').addEventListener('click', (e) => { seeInside = !seeInside; e.currentTarget.setAttribute('aria-pressed', String(seeInside)); applyGhosts(); });
$('#bpCollapse').addEventListener('click', (e) => {
  const open = e.currentTarget.getAttribute('aria-expanded') === 'true';
  e.currentTarget.setAttribute('aria-expanded', String(!open)); e.currentTarget.textContent = open ? 'Show' : 'Hide';
  $('#bpBody').hidden = open;
  updateViewShift();
});
function startHold(e) { if (e) e.preventDefault(); holding = true; holdBtn.classList.add('down'); bstate[brakeKey].target = BRAKE_UI[brakeKey].travelMax; }
function endHold() { if (!holding) return; holding = false; holdBtn.classList.remove('down'); bstate[brakeKey].target = 0; }
holdBtn.addEventListener('pointerdown', (e) => { startHold(e); try { holdBtn.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ } });
['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => holdBtn.addEventListener(ev, endHold));
holdBtn.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) startHold(e); });
holdBtn.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') endHold(); });
holdBtn.addEventListener('contextmenu', (e) => e.preventDefault());
travelIn.addEventListener('input', () => { holding = false; holdBtn.classList.remove('down'); bstate[brakeKey].t = bstate[brakeKey].target = +travelIn.value; });
adjIn.addEventListener('input', () => { BRAKE_UI[brakeKey].slack = BRAKE_UI[brakeKey].slackMax - +adjIn.value; updateReadouts(); });
liningIn.addEventListener('input', () => { setLining(BRAKES[brakeKey], +liningIn.value); applyGhosts(); updateReadouts(); });

function updateBrakes(dt) {
  const st = bstate[brakeKey], lim = brakeNumbers(brakeKey).limit, goal = Math.min(st.target, lim);
  if (st.t > lim) st.t = lim;
  if (st.t !== goal) {
    const step = 80 * dt;
    st.t = st.t < goal ? Math.min(goal, st.t + step) : Math.max(goal, st.t - step);
  }
  if (+travelIn.value !== st.t) travelIn.value = st.t;
  const nf = brakeNumbers('f'), nr = brakeNumbers('r');
  poseBrake(FB, nf.theta); poseBrake(RB, nr.theta);
  poseLinkages(nf.tEff, nr.tEff, nf.theta, nr.theta);
  [[FB, nf], [RB, nr]].forEach(([B, n]) => {
    B.glowMat.opacity += ((n.contact ? 0.85 : 0) - B.glowMat.opacity) * Math.min(1, dt * 12);
    const target = stage === 'brakes' && !reduceMotion() ? (n.contact ? 0 : 2.4) : 0;
    B.omega += (target - B.omega) * Math.min(1, dt * (n.contact ? 10 : 1.5));
    B.spin += B.omega * dt;
    byId.get(B.key === 'f' ? 'fwheel' : 'rwheel').group.children[0].rotation.z = -B.spin;
    B.drumGrp.rotation.z = -B.spin;
  });
  // stop lamp: lit by the rear brake switch in the brake stage, or by the stop circuit in the electrical stage
  const stopOn = Math.max(nr.tEff >= BRAKE_UI.r.switchAt ? 0.9 : 0, el.stopGlow);
  TAIL_GLOW.opacity += (stopOn - TAIL_GLOW.opacity) * Math.min(1, dt * 14);
  if (stage === 'brakes') updateReadouts();
}

/* =====================================================================
   Stage 3: engine mode (four-stroke cycle, valve clearance check)
   ===================================================================== */
const eng = { deg: 380, target: null, playing: false, dps: 60, follow: 0, inside: true };
const CYL_NAME = ['Left', 'Right'];
const STROKE_UI = {
  Intake: { step: 0, chip: 'ok', text: 'piston going down' },
  Compression: { step: 1, chip: 'warn', text: 'piston going up' },
  Power: { step: 2, chip: 'on', text: 'piston driven down' },
  Exhaust: { step: 3, chip: 'idle', text: 'piston going up' },
};
const wrapDeg = (a, m) => ((a % m) + m) % m;
// a cycle angle (0 = TDC at the start of the power stroke) as the manual writes valve timing
function fmtEvent(phi) {
  const r = wrapDeg(phi, 360), f = (d) => `${+d.toFixed(1)}°`;
  if (r >= 270) return `${f(360 - r)} BTDC`;
  if (r < 90) return `${f(r)} ATDC`;
  return r < 180 ? `${f(180 - r)} BBDC` : `${f(r - 180)} ABDC`;
}
const ENGINE_STEPS = [
  'Intake: the piston goes down with the inlet valve open and draws fresh mixture in from the carburettor.',
  'Compression: both valves are shut. The rising piston squeezes the mixture into the combustion chamber (compression ratio 8.8 : 1).',
  `Power: the plug fires ${SPARK_BTDC}° before TDC at idle. The burning gas drives the piston down and turns the crankshaft.`,
  'Exhaust: the exhaust valve opens before the bottom of the stroke and the rising piston pushes the burnt gas out.',
];
const epPlay = $('#epPlay'), epCrank = $('#epCrank'), epSpeed = $('#epSpeed');
$('#epSteps').innerHTML = ENGINE_STEPS.map((t) => `<li>${t}</li>`).join('');
$('#epNote').textContent = `Valve timing from the manual's CM200T column, because the CD200T column is blank: inlet opens ${fmtEvent(VALVE_EVENTS.inOpen)}, closes ${fmtEvent(VALVE_EVENTS.inClose)}; exhaust opens ${fmtEvent(VALVE_EVENTS.exOpen)}, closes ${fmtEvent(VALVE_EVENTS.exClose)}. The valve clearance is drawn ${Math.round(GAP_VIS / 0.00005)} times larger than real. Apart from bore and stroke, the internal parts are sized by estimate. Slow motion: the real engine idles at 1,200 rpm.`;

function setPlaying(on) { eng.playing = on; epPlay.setAttribute('aria-pressed', String(on)); epPlay.textContent = on ? 'Pause' : 'Play'; }
function setFollow(i) {
  eng.follow = i;
  document.querySelectorAll('[data-cyl]').forEach((b) => b.setAttribute('aria-selected', String(+b.dataset.cyl === i)));
  const name = CYL_NAME[i].toLowerCase();
  $('#epTdc').textContent = `Set ${name} cylinder to TDC on compression`;
  $('#epTdcHint').textContent = `Engine cold. Take off the head cover, both plugs and the left inspection cover. Turn the engine anticlockwise (seen from the left) with a spanner on the turning hexagon until the T mark on the ATU lines up with the fixed index mark. If both rockers of a cylinder have free play, that cylinder is at TDC on compression; if not, turn one more full turn. Check each valve with a 0.05 mm feeler gauge between the stem and the adjuster, set it with the square-headed adjuster and tighten the locknut. One more full turn (360°) brings the other cylinder to TDC on compression. The milled slot in the left end of the camshaft is at 3 o'clock for one cylinder${i === 0 ? ' (the left one in this model; the manual does not say which)' : ''}.`;
  updateEngineReadouts();
}
function updateEngineReadouts() {
  const st = cycleState(eng.deg), c = st[eng.follow], o = st[1 - eng.follow], su = STROKE_UI[c.stroke];
  $('#epCrankOut').textContent = `${Math.round(wrapDeg(eng.deg, 720))}°`;
  const dead = c.into < 1 ? (c.stroke === 'Power' || c.stroke === 'Intake' ? 'at TDC' : 'at BDC') : null;
  chip($('#chStroke'), su.chip, c.stroke); $('#rdStroke').textContent = dead ?? `${su.text}, ${Math.round(c.into)}° of 180°`;
  if (c.spark > 0 && c.usefulSpark) { chip($('#chSpark'), 'on', 'Firing'); $('#rdSpark').textContent = 'ignites the mixture'; }
  else if (c.spark > 0) { chip($('#chSpark'), 'warn', 'Wasted spark'); $('#rdSpark').textContent = 'end of exhaust: does nothing'; }
  else { chip($('#chSpark'), 'idle', 'Off'); $('#rdSpark').textContent = `fires ${SPARK_BTDC}° BTDC`; }
  [['In', c.inLift, VALVE_EVENTS.inOpen, VALVE_EVENTS.inClose], ['Ex', c.exLift, VALVE_EVENTS.exOpen, VALVE_EVENTS.exClose]].forEach(([k, lift, open, close]) => {
    chip($(`#ch${k}`), lift > 0 ? 'ok' : 'idle', lift > 0 ? 'Open' : 'Closed');
    $(`#rd${k}`).textContent = lift > 0 ? `closes ${fmtEvent(close)}` : `opens ${fmtEvent(open)}`;
  });
  $('#epOther').textContent = `${o.name} cylinder: ${o.stroke.toLowerCase()} stroke. Both pistons rise and fall together; the cylinders fire one turn apart.`;
  document.querySelectorAll('#epSteps li').forEach((li, i) => { li.className = i === su.step ? 'active' : ''; });
}
function enginePose(which) {
  const m = Math.max(1, (which === 'crank' ? 1.05 : 0.9) / effAspect());
  let target, off;
  if (which === 'head') { target = cylWorld(0, 0.15, -0.01); off = V(-0.22, 0.34, -0.3); }
  else if (which === 'crank') { target = cylWorld(0, 0.04, 0); off = V(0.52, 0.12, -0.36); }
  else { target = cylWorld(0, 0.06, -0.03); off = V(0.12, 0.08, -0.62); }
  return { pos: target.clone().addScaledVector(off, m), target };
}
function strokeStep(sign) {
  const phi = wrapDeg(eng.deg + (eng.follow ? 360 : 0), 720), into = phi % 180;
  const base = eng.target ?? eng.deg;
  setPlaying(false);
  eng.target = base + (sign > 0 ? 180 - into : -(into < 0.5 ? 180 : into));
}
epPlay.addEventListener('click', () => { eng.target = null; setPlaying(!eng.playing); });
$('#epFwd').addEventListener('click', () => strokeStep(1));
$('#epBack').addEventListener('click', () => strokeStep(-1));
epCrank.addEventListener('input', () => { setPlaying(false); eng.target = null; eng.deg = +epCrank.value; });
function setSpeed(v) { eng.dps = v; epSpeed.value = v; $('#epSpeedOut').textContent = `${(360 / v).toFixed(1)} s/turn`; }
epSpeed.addEventListener('input', () => setSpeed(+epSpeed.value));
setSpeed(eng.dps);
document.querySelectorAll('[data-cyl]').forEach((b) => b.addEventListener('click', () => setFollow(+b.dataset.cyl)));
document.querySelectorAll('[data-eview]').forEach((b) => b.addEventListener('click', () => { setViewButtons(''); flyTo(enginePose(b.dataset.eview)); }));
$('#epInside').addEventListener('click', (e) => { eng.inside = !eng.inside; e.currentTarget.setAttribute('aria-pressed', String(eng.inside)); applyGhosts(); });
$('#epTdc').addEventListener('click', () => {
  setPlaying(false);
  const tdc = eng.follow ? 360 : 0, from = eng.target ?? eng.deg;
  eng.target = from + wrapDeg(tdc - from, 720);
  setViewButtons(''); flyTo(enginePose('head'));
});
$('#epCollapse').addEventListener('click', (e) => {
  const open = e.currentTarget.getAttribute('aria-expanded') === 'true';
  e.currentTarget.setAttribute('aria-expanded', String(!open)); e.currentTarget.textContent = open ? 'Show' : 'Hide';
  $('#epBody').hidden = open;
  updateViewShift();
});
function updateEngine(dt) {
  if (stage !== 'engine') return;
  if (eng.target != null) {
    const d = eng.target - eng.deg, step = 300 * dt;
    if (Math.abs(d) <= step) { eng.deg = wrapDeg(eng.target, 720); eng.target = null; } else eng.deg += Math.sign(d) * step;
  } else if (eng.playing) eng.deg = wrapDeg(eng.deg + eng.dps * dt, 720);
  poseEngine(eng.deg);
  const shown = Math.round(wrapDeg(eng.deg, 720));
  if (+epCrank.value !== shown) epCrank.value = shown;
  updateEngineReadouts();
}
setFollow(0);

/* =====================================================================
   Stage 4: clutch and gearbox (pull the clutch, shift, follow the power to the rear wheel)
   ===================================================================== */
const VS = 1 / 60;                                     // slow motion: everything turns at 1/60 of real speed
const RPM2RAD = (2 * Math.PI / 60) * VS;                // real rpm -> rad/s as shown
const CLUTCH = { travelMax: 45, spec: [10, 20], bite: 8, slackMax: 30 };
const PLATE = { new: 3.0, limit: 2.6 };
const gb = { rpm: 1200, t: 0, target: 0, holding: false, slack: 14, plate: 3.0, drumDeg: DRUM_POS.N, drumTarget: DRUM_POS.N, pedalDir: 0, pedalPhase: 1, pedalAng: 0, main: 0, lay: 0, inside: true, warn: 0 };
const OVERALL = (g) => RATIOS.primary * RATIOS.gears[g - 1] * RATIOS.final;
const kmhAt = (wheelRpm) => wheelRpm * 2 * Math.PI * R * 60 / 1000;
const gearLabel = (deg) => SEQ.find((k) => Math.abs(DRUM_POS[k] - deg) < 0.5) ?? null;
const clutchCouple = () => 1 - Math.min(1, Math.max(0, (gb.t - gb.slack) / CLUTCH.bite));   // 1 = plates clamped, 0 = free
const clutchLift = () => LIFT_MAX * Math.min(1, Math.max(0, (gb.t - gb.slack) / (CLUTCH.travelMax - gb.slack)));
const GEAR_STEPS = [
  'Crankshaft: the 19-tooth primary drive gear on its right-hand end turns with it.',
  'Primary driven gear and clutch outer drum: 69 teeth, so they turn 3.632 times slower, the opposite way.',
  'Clutch: the friction plates turn with the drum, the plain plates with the clutch centre. Clamped by the springs, they turn together.',
  'Mainshaft: turns with the clutch centre. Its pinions turn the layshaft pinions, all of them, all the time.',
  'Selected gear: the dogs on a sliding pinion lock one free pinion to its shaft, so only that pair carries the drive.',
  'Layshaft: the gearbox output. It turns the final drive sprocket on its left-hand end.',
  'Chain and rear sprocket: 2.333 : 1 down to the rear wheel.',
];
const gpHold = $('#gpHold'), gpLever = $('#gpLever'), gpRpm = $('#gpRpm'), gpAdj = $('#gpAdj'), gpPlate = $('#gpPlate');
$('#gpSteps').innerHTML = GEAR_STEPS.map((t) => `<li>${t}</li>`).join('');
gpLever.max = CLUTCH.travelMax; gpAdj.max = CLUTCH.slackMax;
$('#gpFigs').innerHTML = [
  ['Primary reduction', `${RATIOS.primary.toFixed(3)} : 1 (19T crank gear)`],
  ...RATIOS.gears.map((r, i) => [`${['1st', '2nd', '3rd', '4th'][i]} gear`, `${r.toFixed(3)} : 1 (${TEETH.main[i]}T / ${TEETH.lay[i]}T)`]),
  ['Final reduction', `${RATIOS.final.toFixed(3)} : 1`],
  ...RATIOS.gears.map((r, i) => [`${['1st', '2nd', '3rd', '4th'][i]}: road speed per 1,000 rpm`, `${kmhAt(1000 / OVERALL(i + 1)).toFixed(1)} km/h (calc.)`]),
  ['Clutch plates', '5 friction, 4 plain, 4 springs'],
  ['Friction plate (limit)', '3.0 (2.6) mm'],
  ['Plain plate warpage', '0.2 mm max'],
  ['Spring free length (limit)', '37.8 (34.7) mm'],
  ['Clutch free play, lever end', '10–20 mm'],
  ['Chain play, lower run', 'about 20 mm'],
].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
$('#gpNote').textContent = 'Ratios, tooth counts, the 19-tooth crank gear and the clutch figures are from the workshop manual; the 69-tooth driven gear is calculated from the 3.632 : 1 primary ratio, and which pinions slide is worked out from the manual\'s assembly photos. Shift pattern from the owner. Sizes inside the cases are estimated and the plate lift is drawn larger than real. Slow motion: everything turns at 1/60 of real speed; the rpm figures are real. Road speed uses the 292 mm tyre radius, so it is approximate.';

function gbStartHold(e) { if (e) e.preventDefault(); gb.holding = true; gpHold.classList.add('down'); gb.target = CLUTCH.travelMax; }
function gbEndHold() { if (!gb.holding) return; gb.holding = false; gpHold.classList.remove('down'); gb.target = 0; }
gpHold.addEventListener('pointerdown', (e) => { gbStartHold(e); try { gpHold.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ } });
['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => gpHold.addEventListener(ev, gbEndHold));
gpHold.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) gbStartHold(e); });
gpHold.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') gbEndHold(); });
gpHold.addEventListener('contextmenu', (e) => e.preventDefault());
gpLever.addEventListener('input', () => { gbEndHold(); gb.t = gb.target = +gpLever.value; });
gpRpm.addEventListener('input', () => { gb.rpm = +gpRpm.value; });
gpAdj.addEventListener('input', () => { gb.slack = CLUTCH.slackMax - +gpAdj.value; });
gpPlate.addEventListener('input', () => { gb.plate = +gpPlate.value; });

// 1 down, 3 up: press from neutral for 1st; lift for 2nd, 3rd, 4th. Neutral is half a step between 1st and 2nd.
function shift(kind) {
  const cur = gearLabel(gb.drumTarget);
  if (!cur) return;
  const next = kind === 'down' ? { N: '1', 1: '1', 2: '1', 3: '2', 4: '3' }[cur]
    : kind === 'up' ? { N: '2', 1: '2', 2: '3', 3: '4', 4: '4' }[cur]
      : cur === '1' || cur === '2' ? 'N' : cur;
  gb.pedalDir = kind === 'down' ? -1 : kind === 'up' ? 1 : cur === '1' ? 0.5 : -0.5;
  gb.pedalPhase = 0;
  if (next !== cur) {
    gb.warn = clutchCouple() > 0.5 && (engagedGear(gb.drumDeg) || next !== 'N') ? 4 : 0;
    gb.drumTarget = DRUM_POS[next];
  }
}
$('#gpDown').addEventListener('click', () => shift('down'));
$('#gpUp').addEventListener('click', () => shift('up'));
$('#gpNeutral').addEventListener('click', () => shift('neutral'));
document.querySelectorAll('[data-gview]').forEach((b) => b.addEventListener('click', () => { setViewButtons(''); flyTo(gearPose(b.dataset.gview)); }));
$('#gpInside').addEventListener('click', (e) => { gb.inside = !gb.inside; e.currentTarget.setAttribute('aria-pressed', String(gb.inside)); applyGhosts(); });
$('#gpCollapse').addEventListener('click', (e) => {
  const open = e.currentTarget.getAttribute('aria-expanded') === 'true';
  e.currentTarget.setAttribute('aria-expanded', String(!open)); e.currentTarget.textContent = open ? 'Show' : 'Hide';
  $('#gpBody').hidden = open;
  updateViewShift();
});
function gearPose(which) {
  const m = Math.max(1, (which === 'chain' ? 1.15 : 0.9) / effAspect());
  let target, off;
  if (which === 'clutch') { target = V(MAINSHAFT.x, MAINSHAFT.y, 0.13); off = V(-0.12, 0.2, 0.42); }
  else if (which === 'chain') { target = V(0.25, 0.31, -0.112); off = V(0.0, 0.1, -1.25); }
  else { target = V((MAINSHAFT.x + LAYSHAFT.x) / 2, 0.32, 0.01); off = V(-0.26, 0.42, -0.2); }
  return { pos: target.clone().addScaledVector(off, m), target };
}

/* the drive line, as rates of turn about +z (rad/s); forward motion makes the crank and wheel rates negative */
function gbSim(dt) {
  if (gb.t !== gb.target) { const s = 140 * dt; gb.t = gb.t < gb.target ? Math.min(gb.target, gb.t + s) : Math.max(gb.target, gb.t - s); }
  if (gb.drumDeg !== gb.drumTarget) { const s = 260 * dt, d = gb.drumTarget - gb.drumDeg; gb.drumDeg = Math.abs(d) <= s ? gb.drumTarget : gb.drumDeg + Math.sign(d) * s; }
  if (gb.pedalPhase < 1) gb.pedalPhase = Math.min(1, gb.pedalPhase + dt / 0.45);
  gb.pedalAng = gb.pedalDir * 14 * Math.sin(Math.PI * gb.pedalPhase);
  gb.warn = Math.max(0, gb.warn - dt);
  const gear = engagedGear(gb.drumDeg), c = clutchCouple(), coast = Math.exp(-dt / 2.5);
  const crank = -gb.rpm * RPM2RAD, outer = -crank * TEETH.primary[0] / TEETH.primary[1];
  let { main, lay } = gb;
  const drive = (m) => (c >= 0.999 ? outer : c > 0 ? m + (outer - m) * Math.min(1, dt * 8 * c) : m * coast);
  if (gear) { main = drive(main); lay = -main * TEETH.main[gear - 1] / TEETH.lay[gear - 1]; }
  else { main = drive(main); lay *= coast; }
  Object.assign(gb, { main, lay });
  stepGearbox(dt, { crank, outer, main, lay });
  RB.spin -= lay * FRONT_R / REAR_R * dt;               // the brake code turns the rear wheel by -spin
  return { gear, c };
}
function updateGearbox(dt) {
  if (stage !== 'gearbox') return;
  const { c } = gbSim(dt);
  poseGearbox({ drumDeg: gb.drumDeg, lift: clutchLift(), pedal: gb.pedalAng, plate: gb.plate, power: c > 0.5 });
  poseFinalDrive(GB.rho.lay, -RB.spin);
  poseEngine(wrapDeg(-GB.rho.crank / DEG, 720), { gas: false });
  CONTROLS.clutchLever.group.rotation.y = gb.t / 1000 / CONTROLS.clutchLever.reach;
  CONTROLS.gearPedal.group.rotation.z = gb.pedalAng * DEG;
  setNeutralLamp(gearLabel(gb.drumDeg) === 'N');
  if (+gpLever.value !== gb.t) gpLever.value = gb.t;
  gbReadouts();
}
function gbReadouts() {
  const gear = engagedGear(gb.drumDeg), c = clutchCouple(), lab = gearLabel(gb.drumDeg);
  const realRpm = (rate) => Math.abs(rate) / RPM2RAD;
  $('#gpGear').textContent = lab ?? '·';
  chip($('#chNeutral'), lab === 'N' ? 'ok' : 'idle', lab === 'N' ? 'N lamp on' : 'N lamp off');
  $('#gpRpmOut').textContent = `${gb.rpm.toLocaleString('en-US')} rpm`;
  $('#gpLeverOut').textContent = `${gb.t.toFixed(0)} mm`;
  if (c >= 0.999) { chip($('#chClutch'), 'ok', 'Engaged'); $('#rdClutch').textContent = 'plates clamped'; }
  else if (c > 0) { chip($('#chClutch'), 'warn', 'Slipping'); $('#rdClutch').textContent = 'starting to free'; }
  else { chip($('#chClutch'), 'on', 'Free'); $('#rdClutch').textContent = 'plates apart'; }
  $('#rdRatio').textContent = gear ? `${RATIOS.gears[gear - 1].toFixed(3)} : 1` : lab === 'N' ? 'Neutral' : 'Shifting';
  $('#rdRatioSub').textContent = gear ? `overall ${OVERALL(gear).toFixed(1)} : 1` : 'no gear in mesh';
  const wheelRpm = realRpm(gb.lay) * FRONT_R / REAR_R;
  $('#rdWheel').textContent = `${Math.round(wheelRpm)} rpm`;
  $('#rdWheelSub').textContent = `≈ ${kmhAt(wheelRpm).toFixed(0)} km/h`;
  $('#rdShafts').textContent = `${Math.round(realRpm(gb.main))} / ${Math.round(realRpm(gb.lay))} rpm`;
  const w = $('#gpWarn'); w.hidden = gb.warn <= 0;
  w.textContent = 'Pull the clutch before shifting: shifting under load hammers the dogs, and worn dogs make the gearbox jump out of gear.';
  const reach = gear && c > 0 ? 7 : c > 0 ? 4 : 2;
  document.querySelectorAll('#gpSteps li').forEach((li, i) => { li.className = i < reach - 1 ? 'done' : i === reach - 1 ? 'active' : ''; });
  // workshop checks
  $('#gpAdjOut').textContent = `${gb.slack.toFixed(0)} mm`;
  if (gb.slack < CLUTCH.spec[0]) chip($('#chFree'), 'bad', 'Too little: may slip');
  else if (gb.slack > CLUTCH.spec[1]) chip($('#chFree'), 'warn', 'Too much: may drag');
  else chip($('#chFree'), 'ok', `In spec ${CLUTCH.spec[0]}–${CLUTCH.spec[1]}`);
  $('#gpFree').textContent = `Free play at the lever end: ${gb.slack.toFixed(0)} mm. Too little and the clutch may slip; too much and it may not free fully, so gears crunch and the bike creeps with the lever pulled.`;
  $('#gpPlateOut').textContent = `${gb.plate.toFixed(2)} mm`;
  if (gb.plate > PLATE.limit + 0.04) chip($('#chPlate'), 'ok', 'Plates OK');
  else if (gb.plate >= PLATE.limit - 0.04) chip($('#chPlate'), 'warn', 'At the limit');
  else chip($('#chPlate'), 'bad', 'Below the limit');
  $('#gpPlateTxt').textContent = gb.plate > PLATE.limit + 0.04
    ? 'Measure each friction plate across its faces with a vernier: 3.0 mm new.'
    : 'Renew the friction plates as a set: worn plates let the clutch slip under load, so the engine revs rise but the bike does not speed up. On the centre stand there is no load, so it may not show here.';
}
$('#gpGear').textContent = 'N';
gpRpm.value = gb.rpm; gpAdj.value = CLUTCH.slackMax - gb.slack; gpPlate.value = gb.plate;

/* =====================================================================
   Stage 5: electrical (work the switches, follow the current)
   ===================================================================== */
const FLASH_PERIOD = 60 / 85;          // about 85 flashes a minute (est; the manual gives no rate)
const CRANK_TO_RUN = 1.5;              // seconds of cranking before the engine fires (shown, not measured)
const el = {
  sw: { key: false, lights: false, beam: 'lo', turn: null, horn: false, fbrake: false, rbrake: false, start: false, fuse: true, flat: false },
  engine: 'stopped', crankT: 0, deg: 0, starterDeg: 0, t: 0, inside: true, sel: 'head', stopGlow: 0, lastLive: new Set(), out: null,
};
const ELEC_FIGS = [
  ['System voltage (your bike)', '12 V, negative earth'],
  ['Main fuse', '20 A, spare in the side panel'],
  ['Contact breaker gap', '0.3–0.4 mm'],
  ['Ignition timing', '15° BTDC idle (F mark)'],
  ['Full advance', '32–35° BTDC by 2,800 rpm'],
  ['Spark plug gap', '0.6–0.7 mm'],
  ['Plugs (UK)', 'NGK CR7HS or ND U22FSR-L'],
  ['Starter brushes (limit)', '12.2–12.4 (7.0) mm'],
  ['Commutator mica depth (limit)', '0.5–0.8 (0.2) mm'],
  ['Electrolyte specific gravity', '1.260–1.280'],
  ['Charging rate', 'one tenth of capacity'],
  ['Bulbs, manual (6 V models)', 'head 35/35 W, tail/stop 5/21 W, indicators 21 W'],
];
$('#xpFigs').innerHTML = ELEC_FIGS.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
$('#xpNote').textContent = 'Your bike is 12 V; the models in the workshop manual are 6 V, so its bulb wattages and charging voltages do not apply to your bike: check the ratings printed on the bulbs. The circuit layout, the 20 A fuse and the ignition figures follow the manual. Wire routes are approximate and the wiring diagram is too small to read the wire colours. The engine turns slowly here so the spark can be seen.';

function syncElecButtons() {
  const s = el.sw;
  document.querySelectorAll('[data-key]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.key === +s.key)));
  document.querySelectorAll('[data-lights]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.lights === +s.lights)));
  document.querySelectorAll('[data-beam]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.beam === s.beam)));
  document.querySelectorAll('[data-turn]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.turn || null) === s.turn)));
  $('#xpFuse').setAttribute('aria-pressed', String(!s.fuse)); $('#xpFuse').textContent = s.fuse ? 'Pull the 20 A fuse' : 'Refit the fuse';
  $('#xpFlat').setAttribute('aria-pressed', String(s.flat)); $('#xpFlat').textContent = s.flat ? 'Charge the battery' : 'Flat battery';
}
document.querySelectorAll('[data-key]').forEach((b) => b.addEventListener('click', () => { el.sw.key = b.dataset.key === '1'; el.sel = el.sw.key ? 'ignition' : el.sel; syncElecButtons(); }));
document.querySelectorAll('[data-lights]').forEach((b) => b.addEventListener('click', () => { el.sw.lights = b.dataset.lights === '1'; el.sel = 'head'; syncElecButtons(); }));
document.querySelectorAll('[data-beam]').forEach((b) => b.addEventListener('click', () => { el.sw.beam = b.dataset.beam; el.sel = 'head'; syncElecButtons(); }));
document.querySelectorAll('[data-turn]').forEach((b) => b.addEventListener('click', () => { el.sw.turn = b.dataset.turn || null; if (el.sw.turn) el.sel = 'turn'; syncElecButtons(); }));
$('#xpFuse').addEventListener('click', () => { el.sw.fuse = !el.sw.fuse; syncElecButtons(); });
$('#xpFlat').addEventListener('click', () => { el.sw.flat = !el.sw.flat; syncElecButtons(); });
const HOLD_SEL = { horn: 'horn', fbrake: 'stop', rbrake: 'stop', start: 'starting' };
document.querySelectorAll('[data-hold]').forEach((b) => {
  const k = b.dataset.hold;
  const down = (e) => { if (e) e.preventDefault(); el.sw[k] = true; el.sel = HOLD_SEL[k]; b.classList.add('down'); };
  const up = () => { if (!el.sw[k]) return; el.sw[k] = false; b.classList.remove('down'); };
  b.addEventListener('pointerdown', (e) => { down(e); try { b.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ } });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => b.addEventListener(ev, up));
  b.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) down(e); });
  b.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') up(); });
  b.addEventListener('contextmenu', (e) => e.preventDefault());
});
function elReleaseAll() { ['horn', 'fbrake', 'rbrake', 'start'].forEach((k) => { el.sw[k] = false; }); document.querySelectorAll('[data-hold]').forEach((b) => b.classList.remove('down')); }
$('#xpLive').addEventListener('click', (e) => { const c = e.target.closest('[data-circ]'); if (c) { el.sel = c.dataset.circ; elReadouts(); } });
document.querySelectorAll('[data-xview]').forEach((b) => b.addEventListener('click', () => { setViewButtons(''); flyTo(elecPose(b.dataset.xview)); }));
$('#xpInside').addEventListener('click', (e) => { el.inside = !el.inside; e.currentTarget.setAttribute('aria-pressed', String(el.inside)); applyGhosts(); });
$('#xpCollapse').addEventListener('click', (e) => {
  const open = e.currentTarget.getAttribute('aria-expanded') === 'true';
  e.currentTarget.setAttribute('aria-expanded', String(!open)); e.currentTarget.textContent = open ? 'Show' : 'Hide';
  $('#xpBody').hidden = open;
  updateViewShift();
});
function elecPose(which) {
  const m = Math.max(1, (which === 'lights' ? 1.3 : 0.95) / effAspect());
  let target, off;
  if (which === 'battery') { target = V(0.33, 0.58, 0.06); off = V(-0.08, 0.14, 0.62); }
  else if (which === 'bars') { target = V(0.9, 1.0, 0); off = V(-0.6, 0.38, -0.05); }
  else if (which === 'ignition') { target = V(0.71, 0.48, -0.08); off = V(0.12, 0.16, -0.72); }
  else { target = V(0.55, 0.65, 0); off = V(1.7, 0.75, -1.9); }
  return { pos: target.clone().addScaledVector(off, m), target };
}

/* switches -> engine state -> circuits -> pose */
function elSim(dt) {
  const s = el.sw, keyLive = s.key && s.fuse;
  el.t += dt;
  if (s.start && keyLive && !s.flat && el.engine !== 'running') {
    el.engine = 'cranking'; el.crankT += dt;
    if (el.crankT >= CRANK_TO_RUN) el.engine = 'running';
  } else if (el.engine === 'cranking') { el.engine = 'stopped'; el.crankT = 0; }
  if (el.engine === 'running' && !keyLive) { el.engine = 'stopped'; el.crankT = 0; }
  const starterRate = el.engine === 'cranking' ? 900 : 0;                   // shown degrees a second
  el.starterDeg += starterRate * dt;
  el.deg = wrapDeg(el.deg + (el.engine === 'running' ? 360 : starterRate * 11 / 35.5) * dt, 720);
  const flash = !!s.turn && (el.t % FLASH_PERIOD) < FLASH_PERIOD * 0.5;
  const sp = wrapDeg(el.deg, 360), spark = el.engine !== 'stopped' && sp > 335 && sp < 357;
  const state = { ...s, engine: el.engine, neutral: gearLabel(gb.drumDeg) === 'N', flash, spark };
  el.out = evalCircuits(state);
  return state;
}
function updateElectrical(dt) {
  if (stage !== 'electrical') { el.stopGlow = 0; return; }
  const state = elSim(dt), o = el.out, L = o.live, b = o.bright;
  poseElectrical(state, o.segs, dt, { crankDeg: el.deg, starterDeg: el.starterDeg });
  poseEngine(el.deg, { gas: false, spark: L.ignition });
  poseLamps({ head: L.head ? b : 0, main: el.sw.beam === 'hi', turnL: L.turn && state.flash && el.sw.turn === 'L' ? b : 0, turnR: L.turn && state.flash && el.sw.turn === 'R' ? b : 0, tail: L.tail ? b : 0, horn: L.horn && o.hornWorks ? 1 : 0, t: el.t });
  el.stopGlow = L.stop ? 0.9 * b : 0;
  setDialLamps({ turn: L.turn && state.flash, neutral: L.neutral, high: L.high });
  elReadouts();
}
function elReadouts() {
  const o = el.out; if (!o) return;
  const s = el.sw, liveIds = CIRCUITS.filter((c) => o.live[c.id]).map((c) => c.id);
  if (!o.live[el.sel] && liveIds.length) el.sel = liveIds.find((id) => id !== 'neutral') ?? liveIds[0];   // follow what is live
  const eng = el.engine;
  chip($('#chEngine'), eng === 'running' ? 'ok' : eng === 'cranking' ? 'warn' : 'idle', eng === 'running' ? 'Running' : eng === 'cranking' ? 'Cranking' : 'Stopped');
  $('#rdEngine').textContent = eng === 'running' ? 'charging the battery' : eng === 'cranking' ? 'starter turning it' : s.start && s.flat ? 'solenoid clicks, no turn' : s.start && !(s.key && s.fuse) ? 'no power to the button' : 'press and hold Start';
  chip($('#chBattery'), s.flat ? 'bad' : 'ok', s.flat ? 'Flat' : '12 V');
  $('#rdBattery').textContent = s.flat ? (eng === 'running' ? 'charging' : 'lamps dim, horn dead') : 'charged';
  chip($('#chFuse'), s.fuse ? 'ok' : 'bad', s.fuse ? '20 A OK' : 'Pulled');
  $('#rdFuse').textContent = s.fuse ? '' : 'nothing works';
  $('#rdCount').textContent = `${liveIds.length}`;
  const key = liveIds.join(',') + el.sel;
  if (key !== el.liveKey) {
    el.liveKey = key;
    $('#xpLive').innerHTML = liveIds.length
      ? liveIds.map((id) => `<button type="button" class="chip xp-chip" data-circ="${id}" data-state="${id === el.sel ? 'on' : 'ok'}" aria-pressed="${id === el.sel}">${BY_ID[id].name}</button>`).join('')
      : `<span class="xp-none">${!s.fuse ? 'No circuit is live: the fuse is out.' : !s.key ? 'No circuit is live: turn the key ON.' : 'No circuit is live: use a switch.'}</span>`;
    const c = BY_ID[el.sel];
    $('#xpCirc').textContent = `${c.name}${o.live[c.id] ? '' : ' (not live)'}`;
    $('#xpSteps').innerHTML = c.steps.map((t) => `<li class="${o.live[c.id] ? 'done' : ''}">${t}</li>`).join('');
  }
  $('#xpFault').textContent = !s.fuse
    ? 'Fuse out: nothing works, as with a blown fuse or a disconnected battery. Before fitting a new 20 A fuse, look for the short circuit that blew it.'
    : s.flat ? 'Flat battery: the lamps are dim, the horn does not sound and the starter only clicks. Recharge it at one tenth of its capacity, then check the alternator output if it goes flat again.' : 'Try pulling the fuse or flattening the battery to see the faults in the fault finder.';
}

PARTS.forEach((p) => setVisible(p.id, p.visible)); showSystems();
syncElecButtons();

/* =====================================================================
   Stage 6: intro screen (first visit, and the About button)
   ===================================================================== */
const introEl = $('#intro'), INTRO_KEY = 'cd200.introSeen';
let introReturn = null;
function openIntro(from) {
  introReturn = from || null;                 // where focus goes back to on close
  introEl.hidden = false; $('#introClose').focus();
}
function closeIntro() {
  introEl.hidden = true;
  try { localStorage.setItem(INTRO_KEY, '1'); } catch (err) { /* storage may be blocked */ }
  if (introReturn) introReturn.focus(); else if (introEl.contains(document.activeElement)) document.activeElement.blur();
}
$('#introClose').addEventListener('click', closeIntro);
$('#tAbout').addEventListener('click', (e) => openIntro(e.currentTarget));
introEl.addEventListener('click', (e) => { if (e.target === introEl) closeIntro(); });
introEl.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeIntro(); } });
document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { closeIntro(); setStage(b.dataset.go); }));
{
  let seen = false;
  try { seen = localStorage.getItem(INTRO_KEY) === '1'; } catch (err) { /* storage may be blocked */ }
  if (!seen && !new URLSearchParams(location.search).has('nointro')) openIntro();
}

/* =====================================================================
   Loop
   ===================================================================== */
let first = true, camFrozen = false, lastT = performance.now();
function frame(now) {
  const dt = Math.min(0.25, Math.max(0, (now - lastT) / 1000)); lastT = now;
  updateGearbox(dt);
  updateElectrical(dt);
  updateBrakes(dt);
  updateEngine(dt);
  if (tween) {
    const k = Math.min(1, (now - tween.start) / tween.ms), e = ease(k);
    camera.position.lerpVectors(tween.p0, tween.p1, e); controls.target.lerpVectors(tween.t0, tween.t1, e);
    if (k >= 1) tween = null;
  }
  if (Math.abs(explodeTarget - explodeNow) > 0.0005) { explodeNow += (explodeTarget - explodeNow) * 0.16; applyExplode(explodeNow); }
  if (!camFrozen) controls.update();
  updateDims();
  processHover();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
  if (first) { first = false; $('#loading').hidden = true; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
syncUI();

window.viewer = {
  view: (n) => { const p = viewPose(n); tween = null; camera.position.copy(p.pos); controls.target.copy(p.target); controls.update(); setViewButtons(n); },
  select, explode: (t) => { explodeTarget = explodeNow = t; applyExplode(t); },
  dims: () => tDims.click(), parts: PARTS, bbox: bboxAll,
  stage: (n) => setStage(n), brake: (k, t, lining, slack) => { setBrake(k, false); if (lining != null) { setLining(BRAKES[k], lining); liningIn.value = lining; } if (slack != null) { BRAKE_UI[k].slack = slack; adjIn.value = BRAKE_UI[k].slackMax - slack; } bstate[k].t = bstate[k].target = t; },
  brakeView: (k, w) => { const p = brakePose(k, w); tween = null; camera.position.copy(p.pos); controls.target.copy(p.target); controls.update(); },
  engine: (deg, play = false, follow) => { if (follow != null) setFollow(follow); eng.target = null; eng.deg = deg; setPlaying(play); poseEngine(deg); updateEngineReadouts(); },
  engineView: (w) => { const p = enginePose(w); tween = null; camera.position.copy(p.pos); controls.target.copy(p.target); controls.update(); },
  cycle: cycleState,
  // gear: '1' 'N' '2' '3' '4'; settle runs the drive line until speeds are steady
  gearbox: ({ gear, rpm, lever, slack, plate, settle = true } = {}) => {
    if (gear != null) gb.drumDeg = gb.drumTarget = DRUM_POS[gear];
    if (rpm != null) { gb.rpm = rpm; gpRpm.value = rpm; }
    if (lever != null) { gbEndHold(); gb.t = gb.target = lever; }
    if (slack != null) { gb.slack = slack; gpAdj.value = CLUTCH.slackMax - slack; }
    if (plate != null) { gb.plate = plate; gpPlate.value = plate; }
    if (settle) for (let i = 0; i < 80; i++) gbSim(0.05);
    updateGearbox(0);
    return { gear: engagedGear(gb.drumDeg), label: gearLabel(gb.drumDeg), mainRpm: Math.abs(gb.main) / RPM2RAD, layRpm: Math.abs(gb.lay) / RPM2RAD, clutch: clutchCouple() };
  },
  gearView: (w) => { const p = gearPose(w); tween = null; camera.position.copy(p.pos); controls.target.copy(p.target); controls.update(); },
  shift,
  // switch state (any of key, lights, beam, turn, horn, fbrake, rbrake, start, fuse, flat); run: seconds to simulate; returns the live circuits
  electrical: ({ run = 0.2, engine, ...sw } = {}) => {
    Object.assign(el.sw, sw);
    if (engine) { el.engine = engine; el.crankT = 0; }
    syncElecButtons();
    for (let t = 0; t < run; t += 0.05) elSim(0.05);
    updateElectrical(0);
    return { engine: el.engine, live: CIRCUITS.filter((c) => el.out.live[c.id]).map((c) => c.id), segs: [...el.out.segs] };
  },
  intro: (on) => { if (on && introEl.hidden) openIntro(); else if (!on && !introEl.hidden) closeIntro(); },
  elecView: (w) => { const p = elecPose(w); tween = null; camera.position.copy(p.pos); controls.target.copy(p.target); controls.update(); },
  // used for lining the model up with reference photos
  photoCam: (pos, target, up, fov) => { camFrozen = true; scene.fog = null; tween = null; camera.position.set(...pos); camera.up.set(...up); camera.fov = fov; camera.updateProjectionMatrix(); camera.lookAt(...target); },
};
