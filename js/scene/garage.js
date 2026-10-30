// Workshop garage round the bike: concrete floor, two painted block walls in a corner behind the
// default 3/4 view, a pegboard of tools over a workbench, a shelf of oil cans, a strip light, a spare
// tyre and a service poster. It is scenery, not part of the bike: it is added to the scene, not to
// `bike`, so picking, explode, ghosting and the dimensions ignore it.
//
// Light enough for phones: a few boxes and planes, small canvas textures, no extra lights, no
// shadow casting. A wall and everything on it is hidden while the camera is behind it, so the walls
// never block the view when you orbit round the bike.
import * as THREE from 'three';
import { canvasTexture } from '../core.js';

// a 4.6 x 3.8 m room round the bike; each wall faces inwards
const BACK_Z = 1.9, FRONT_Z = -1.9, SIDE_X = -1.6, FAR_X = 3.0, H = 3.2;
const G = { root: new THREE.Group(), back: new THREE.Group(), side: new THREE.Group(), front: new THREE.Group(), far: new THREE.Group(), props: [], walls: [], light: null, floor: null };
G.root.add(G.back, G.side, G.front, G.far);

/* ---------- textures ---------- */
const noise = (g, w, h, n, a, light = 255) => { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${light},${light},${light},${Math.random() * a})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } };
const concrete = canvasTexture(512, 512, (g, w, h) => {
  g.fillStyle = '#c9cdce'; g.fillRect(0, 0, w, h);
  noise(g, w, h, 9000, 0.12, 255); noise(g, w, h, 9000, 0.1, 0);
  for (let i = 0; i < 6; i++) {   // faint stains
    const x = Math.random() * w, y = Math.random() * h, r = 20 + Math.random() * 70;
    const grd = g.createRadialGradient(x, y, 0, x, y, r); grd.addColorStop(0, 'rgba(70,74,78,0.10)'); grd.addColorStop(1, 'rgba(70,74,78,0)');
    g.fillStyle = grd; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  g.fillStyle = 'rgba(80,84,88,0.35)'; g.fillRect(0, 0, w, 2); g.fillRect(0, 0, 2, h);   // expansion joints at the tile edge
});
concrete.wrapS = concrete.wrapT = THREE.RepeatWrapping; concrete.repeat.set(10, 10);   // 3 m tiles on a 30 m floor
const blocks = canvasTexture(512, 512, (g, w, h) => {   // painted concrete blocks, 400 x 200 mm, half bond
  g.fillStyle = '#e4e2dc'; g.fillRect(0, 0, w, h);
  noise(g, w, h, 4000, 0.08, 0);
  g.fillStyle = 'rgba(120,118,112,0.35)';
  for (let r = 0; r < 4; r++) {
    g.fillRect(0, r * 128, w, 3);
    for (let c = 0; c < 3; c++) g.fillRect(((c + (r % 2) * 0.5) * 256) % w, r * 128, 3, 128);
  }
});
blocks.wrapS = blocks.wrapT = THREE.RepeatWrapping;
const pegboard = canvasTexture(512, 288, (g, w, h) => {
  g.fillStyle = '#b08a5a'; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(60,40,20,0.55)';
  for (let x = 12; x < w; x += 16) for (let y = 12; y < h; y += 16) { g.beginPath(); g.arc(x, y, 2.2, 0, Math.PI * 2); g.fill(); }
  const steel = '#9aa3a8', dark = '#30363a', red = '#b8322a';
  g.lineCap = 'round';
  const shadow = (fn) => { g.save(); g.translate(3, 4); g.globalAlpha = 0.25; fn('#000'); g.restore(); fn(); };
  // spanners, longest to shortest
  [[60, 150], [92, 132], [124, 116], [156, 100], [188, 86]].forEach(([x, len]) => shadow((c) => {
    g.strokeStyle = c || steel; g.lineWidth = 9; g.beginPath(); g.moveTo(x, 40); g.lineTo(x, 40 + len); g.stroke();
    g.lineWidth = 7; g.beginPath(); g.arc(x, 34, 10, 0.6, Math.PI * 2 - 0.6 + Math.PI, false); g.stroke();
  }));
  // hammer
  shadow((c) => { g.strokeStyle = c || '#8a5a2b'; g.lineWidth = 10; g.beginPath(); g.moveTo(260, 60); g.lineTo(260, 210); g.stroke(); g.fillStyle = c || dark; g.fillRect(232, 44, 56, 22); });
  // screwdrivers
  [[320, red], [346, '#e0b02a'], [372, red], [398, '#2a6fb8']].forEach(([x, col]) => shadow((c) => {
    g.strokeStyle = c || col; g.lineWidth = 14; g.beginPath(); g.moveTo(x, 50); g.lineTo(x, 100); g.stroke();
    g.strokeStyle = c || steel; g.lineWidth = 4; g.beginPath(); g.moveTo(x, 100); g.lineTo(x, 170); g.stroke();
  }));
  // pliers
  shadow((c) => { g.strokeStyle = c || red; g.lineWidth = 8; g.beginPath(); g.moveTo(440, 200); g.lineTo(458, 110); g.moveTo(476, 200); g.lineTo(458, 110); g.stroke(); g.strokeStyle = c || steel; g.lineWidth = 7; g.beginPath(); g.moveTo(458, 110); g.lineTo(458, 60); g.stroke(); });
  // feeler gauges and a tyre gauge
  shadow((c) => { g.fillStyle = c || steel; g.fillRect(60, 220, 120, 14); g.fillRect(230, 230, 90, 10); });
});
const poster = canvasTexture(256, 360, (g, w, h) => {   // a generic service chart, no real brand
  g.fillStyle = '#f3efe4'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#b8322a'; g.fillRect(0, 0, w, 54);
  g.fillStyle = '#fff'; g.font = '700 26px Arial, sans-serif'; g.textAlign = 'center'; g.fillText('SERVICE', w / 2, 36);
  g.fillStyle = '#2b2b2b'; g.font = '600 14px Arial, sans-serif'; g.textAlign = 'left';
  ['Engine oil', 'Chain slack', 'Brake free play', 'Tyre pressure', 'Spark plugs', 'Points gap', 'Valve clearance'].forEach((t, i) => {
    const y = 88 + i * 36; g.fillText(t, 18, y);
    g.strokeStyle = '#9a958a'; g.lineWidth = 1; g.beginPath(); g.moveTo(18, y + 10); g.lineTo(w - 18, y + 10); g.stroke();
    g.fillStyle = i % 3 === 0 ? '#2a7a46' : '#2b2b2b'; g.fillRect(w - 40, y - 12, 14, 14); g.fillStyle = '#2b2b2b';
  });
});

const shutter = canvasTexture(256, 256, (g, w, h) => {   // roller door slats
  g.fillStyle = '#b9c0c4'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 16) { g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, y, w, 3); g.fillStyle = 'rgba(40,46,50,0.35)'; g.fillRect(0, y + 12, w, 4); }
});
shutter.wrapS = shutter.wrapT = THREE.RepeatWrapping; shutter.repeat.set(2, 5);
const windowTex = canvasTexture(256, 192, (g, w, h) => {   // daylight through a four-pane window
  const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#9fc9e8'); grd.addColorStop(0.7, '#d9ecf6'); grd.addColorStop(1, '#b7c9a8');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.ellipse(70, 50, 40, 12, 0, 0, Math.PI * 2); g.ellipse(170, 70, 50, 14, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#e9ecee'; g.fillRect(0, 0, w, 10); g.fillRect(0, h - 10, w, 10); g.fillRect(0, 0, 10, h); g.fillRect(w - 10, 0, 10, h); g.fillRect(w / 2 - 5, 0, 10, h); g.fillRect(0, h / 2 - 5, w, 10);
});

/* ---------- build ---------- */
const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0, ...o });
function box(w, h, d, mat, parent, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m; }
function cyl(r, h, mat, parent, x, y, z) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20), mat); m.position.set(x, y, z); parent.add(m); return m; }
const prop = (o) => { G.props.push(o); return o; };

// walls: a painted block upper part, a darker dado band and a skirting
function wall(parent, len) {
  const up = blocks.clone(); up.needsUpdate = true; up.repeat.set(len / 1.6, (H - 1.0) / 0.8);
  const wallMat = std({ map: up, color: 0xffffff }), dado = std({ color: 0x5f7a80, roughness: 0.6 }), skirt = std({ color: 0x3a3f42 });
  const a = new THREE.Mesh(new THREE.PlaneGeometry(len, H - 1.0), wallMat); a.position.y = 1.0 + (H - 1.0) / 2; parent.add(a);
  const b = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.0), dado); b.position.y = 0.5; parent.add(b);
  box(len, 0.1, 0.02, skirt, parent, 0, 0.05, 0.01);
  G.walls.push({ mat: wallMat, dado, skirt });
}
// back wall: faces -z, the length of the room
{
  const len = FAR_X - SIDE_X, g = G.back; g.position.set(SIDE_X + len / 2, 0, BACK_Z); g.rotation.y = Math.PI; wall(g, len);
  // pegboard of tools and the workbench under it (x is mirrored on this wall: local -x is world +x)
  const bx = -(0.15 - (SIDE_X + len / 2));   // world x 0.15: behind the middle of the bike
  const pb = prop(new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9), std({ map: pegboard, roughness: 0.9 }))); pb.position.set(bx, 1.55, 0.03); g.add(pb);
  const wood = std({ color: 0x8a6440, roughness: 0.7 }), steel = std({ color: 0x6d7479, metalness: 0.6, roughness: 0.45 }), red = std({ color: 0xa83228, roughness: 0.5 });
  const bench = prop(new THREE.Group()); g.add(bench);
  box(2.0, 0.05, 0.62, wood, bench, bx, 0.9, 0.33);
  [-0.95, 0.95].forEach((dx) => [0.06, 0.6].forEach((dz) => box(0.05, 0.88, 0.05, steel, bench, bx + dx, 0.44, dz)));
  box(1.9, 0.03, 0.55, wood, bench, bx, 0.22, 0.33);
  box(0.5, 0.28, 0.32, red, bench, bx - 0.5, 0.375, 0.33);            // tool chest on the under-shelf
  box(0.5, 0.012, 0.33, steel, bench, bx - 0.5, 0.45, 0.33);
  box(0.16, 0.1, 0.12, steel, bench, bx + 0.75, 0.975, 0.18);          // vice
  box(0.04, 0.03, 0.2, steel, bench, bx + 0.75, 0.96, 0.05);
  cyl(0.05, 0.16, std({ color: 0xc9a227, metalness: 0.3, roughness: 0.5 }), bench, bx + 0.2, 1.005, 0.4);   // oil can on the bench
  // shelf of cans, and the strip light
  const sx = -(1.75 - (SIDE_X + len / 2));   // world x 1.75: ahead of the front wheel
  const shelf = prop(new THREE.Group()); g.add(shelf);
  box(1.2, 0.03, 0.26, wood, shelf, sx, 2.05, 0.13);
  [[-0.45, 0xb8322a], [-0.3, 0x2a6fb8], [-0.15, 0xe0b02a], [0.0, 0x2a7a46]].forEach(([dx, c]) => cyl(0.045, 0.18, std({ color: c, metalness: 0.4, roughness: 0.4 }), shelf, sx + dx, 2.155, 0.13));
  box(0.24, 0.3, 0.14, std({ color: 0xb8322a, roughness: 0.5 }), shelf, sx + 0.35, 2.215, 0.11);   // fuel can
  const lamp = std({ color: 0xffffff, emissive: 0xf4f6ff, emissiveIntensity: 1.2 });
  box(1.3, 0.05, 0.07, lamp, g, bx, 2.75, 0.04); G.light = lamp;
}
// side wall: faces +x, behind the rear of the bike
{
  const len = BACK_Z - FRONT_Z, g = G.side; g.position.set(SIDE_X, 0, 0); g.rotation.y = Math.PI / 2; wall(g, len);
  // local x on this wall is world -z
  const tyre = prop(new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.05, 12, 40), std({ color: 0x1c1d1e, roughness: 0.9 })));
  tyre.position.set(1.0, 0.33, 0.1); tyre.rotation.x = -0.12; g.add(tyre);
  const ps = prop(new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.7), std({ map: poster, roughness: 0.9 }))); ps.position.set(-0.3, 1.65, 0.02); g.add(ps);
  const cal = prop(new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.42), std({ color: 0xf6f4ee }))); cal.position.set(0.45, 1.7, 0.02); g.add(cal);
  box(0.3, 0.12, 0.004, std({ color: 0x2a6fb8 }), g, 0.45, 1.85, 0.024);
}
// front wall: faces +z, with the roller door
{
  const len = FAR_X - SIDE_X, g = G.front; g.position.set(SIDE_X + len / 2, 0, FRONT_Z); wall(g, len);
  const door = prop(new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.4), std({ map: shutter, metalness: 0.3, roughness: 0.55 }))); door.position.set(0.25, 1.2, 0.02); g.add(door);
  const frame = std({ color: 0x3a3f42 });
  box(2.7, 0.08, 0.05, frame, g, 0.25, 2.44, 0.03); [-1, 1].forEach((s) => box(0.06, 2.44, 0.05, frame, g, 0.25 + s * 1.33, 1.22, 0.03));
  box(0.2, 0.04, 0.03, std({ color: 0x2b2f31 }), g, 0.25, 0.25, 0.04);   // handle
}
// far wall: faces -x, ahead of the front wheel, with a window and a fire extinguisher
{
  const len = BACK_Z - FRONT_Z, g = G.far; g.position.set(FAR_X, 0, 0); g.rotation.y = -Math.PI / 2; wall(g, len);
  const win = prop(new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.95), new THREE.MeshBasicMaterial({ map: windowTex }))); win.position.set(0.2, 1.75, 0.02); g.add(win);
  box(1.4, 0.05, 0.12, std({ color: 0xe9ecee }), g, 0.2, 1.255, 0.05);   // sill
  const ext = prop(new THREE.Group()); ext.position.set(-1.2, 0, 0.12); g.add(ext);
  cyl(0.075, 0.5, std({ color: 0xc0201a, metalness: 0.2, roughness: 0.4 }), ext, 0, 0.35, 0);
  cyl(0.03, 0.08, std({ color: 0x222222 }), ext, 0, 0.64, 0);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), std({ color: 0xc0201a })); sign.position.set(-1.2, 1.2, 0.02); g.add(sign); prop(sign);
}
G.root.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.raycast = () => {}; } });

/* ---------- API ---------- */
/** Add the garage to the scene and give the floor its concrete texture. */
function buildGarage(scene, floor) {
  scene.add(G.root);
  G.floor = floor;
  floor.material.map = concrete; floor.material.needsUpdate = true;
}
/** Hide a wall (and what is on it) while the camera is behind it, so it never blocks the view. */
function updateGarage(camera) {
  const p = camera.position;
  G.back.visible = p.z < BACK_Z - 0.05;
  G.front.visible = p.z > FRONT_Z + 0.05;
  G.side.visible = p.x > SIDE_X + 0.05;
  G.far.visible = p.x < FAR_X - 0.05;
}
/** Full garage in the body stage; in the tool stages the props go and the walls fade back. */
function setGarageMode(stage) {
  const full = stage === 'body';
  G.props.forEach((o) => { o.visible = full; });
  G.walls.forEach((w) => [w.mat, w.dado, w.skirt].forEach((m) => { m.transparent = !full; m.opacity = full ? 1 : 0.35; m.depthWrite = full; m.needsUpdate = true; }));
}
/** Colours for the light and dark themes. */
function setGarageTheme(dark) {
  G.walls.forEach((w) => { w.mat.color.set(dark ? 0x5c6266 : 0xffffff); w.dado.color.set(dark ? 0x2f3d41 : 0x5f7a80); });
  if (G.floor) G.floor.material.color.set(dark ? 0x4a5053 : 0xe8eaeb);
  G.light.emissiveIntensity = dark ? 0.7 : 1.2;
}

export { buildGarage, setGarageMode, setGarageTheme, updateGarage };
