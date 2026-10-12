// Viewer: renderer, camera, dimensions overlay, explode, parts list, picking, brake mode and the render loop.
// Entry point. Part modules are imported in build order; the order matters for parts that reference others.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { $, BASIS, FA, PARTS, RA, SYSTEMS, V, WB, bike, byId } from './core.js';
import { SEAT_TOP } from './parts/body.js';
import './parts/chassis.js';
import './parts/wheels.js';
import './parts/engine.js';
import './parts/exhaust.js';
import './parts/lights.js';
import './parts/controls.js';
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
const HIDE_ON_EXPLODE = ['cables', 'fcable', 'rrod', 'stopsw'];
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
const systemsEl = $('#systems');
SYSTEMS.forEach((sys) => {
  const list = PARTS.filter((p) => p.sys === sys.id);
  const sec = document.createElement('section'); sec.className = 'sys';
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
function setVisible(id, v) { const p = byId.get(id); p.visible = v; p.group.visible = v && !(HIDE_ON_EXPLODE.includes(id) && explodeNow >= 0.04); if (!v && selected === p) select(null); }
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
    if (p.ghost != null) { if (BRAKE_FOCUS.has(p.id) && !fallback) fallback = p; continue; }
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
const bstate = { f: { t: 0, target: 0 }, r: { t: 0, target: 0 } };
let stage = 'body', brakeKey = 'f', seeInside = true, holding = false;
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
  const panelShown = stage === 'brakes' && !panelEl.hidden;
  let x = 0, y = 0;
  if (panelShown) {
    const r = panelEl.getBoundingClientRect(), v = viewport.getBoundingClientRect();
    if (v.width > 760) x = Math.round((r.right - v.left) / 2);
    else y = -Math.round((v.bottom - r.top) / 2);
  }
  if (x !== viewShift.x || y !== viewShift.y) { viewShift = { x, y }; resize(); }
}
new ResizeObserver(() => updateViewShift()).observe(panelEl);
function setStage(next) {
  if (stage === next) return;
  stage = next;
  const brakes = stage === 'brakes';
  document.querySelectorAll('[data-stage]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.stage === stage)));
  $('#stage').classList.toggle('brakes-mode', brakes);
  $('#eyebrow').textContent = brakes ? 'Stage 2 · Brakes' : 'Stage 1 · Outer body';
  panelEl.hidden = !brakes; $('.bottombar').hidden = brakes; $('#faults').hidden = !brakes;
  tDims.hidden = brakes; if (brakes) setDims(false);
  explodeTarget = explodeNow = 0; explodeInput.value = 0; explodeOut.textContent = '0%'; applyExplode(0);
  isolated = null; PARTS.forEach((p) => setVisible(p.id, true));
  ['f', 'r'].forEach((k) => { bstate[k].t = bstate[k].target = 0; });
  holding = false;
  applyGhosts(); select(null);
  updateViewShift();
  if (brakes) setBrake(brakeKey, true); else goView('three');
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
  TAIL_GLOW.opacity += ((nr.tEff >= BRAKE_UI.r.switchAt ? 0.9 : 0) - TAIL_GLOW.opacity) * Math.min(1, dt * 14);
  if (stage === 'brakes') updateReadouts();
}

/* =====================================================================
   Loop
   ===================================================================== */
let first = true, camFrozen = false, lastT = performance.now();
function frame(now) {
  const dt = Math.min(0.25, Math.max(0, (now - lastT) / 1000)); lastT = now;
  updateBrakes(dt);
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
  // used for lining the model up with reference photos
  photoCam: (pos, target, up, fov) => { camFrozen = true; scene.fog = null; tween = null; camera.position.set(...pos); camera.up.set(...up); camera.fov = fov; camera.updateProjectionMatrix(); camera.lookAt(...target); },
};
