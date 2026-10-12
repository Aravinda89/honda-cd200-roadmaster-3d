// Shared foundation: units, key geometry, materials, mesh helpers and the part registry.
// Units are metres. The bike faces +x, y is up, and the rider's right is +z. Rear axle at x = 0.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const $ = (s) => document.querySelector(s);
const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);
const DEG = Math.PI / 180;
const Y_UP = V(0, 1, 0);

/* =====================================================================
   Key geometry, in metres. The bike faces +x; the rider's right is +z.
   ===================================================================== */
const R = 0.292;                     // 3.00-17 tyre outer radius (workshop manual tyre size)
const RIM = 0.2159;                  // 17-inch rim bead radius
const WB = 1.28;                     // wheelbase (published)
const RA = V(0, R), FA = V(WB, R);   // rear and front axle
const RAKE = 25 * DEG;               // measured from photos
const FD = V(-Math.sin(RAKE), Math.cos(RAKE));   // up the fork
const FF = V(Math.cos(RAKE), Math.sin(RAKE));    // forward, square to the fork
const forkPt = (t, fwd = 0, z = 0) => FA.clone().addScaledVector(FD, t).addScaledVector(FF, fwd).setZ(z);
const CYL_BASE = V(0.68, 0.42), CYL_TILT = 8 * DEG;

/* ---------- textures drawn on canvas ---------- */
function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function pleatTexture(n) {
  // transverse pleats across the seat top, each with a stitched seam, as on the owner's seats
  return canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#1e2124'; g.fillRect(0, 0, w, h);
    const y0 = (1 - 0.64) * h, y1 = (1 - 0.36) * h;
    for (let i = 1; i < n; i++) {
      const x = (0.07 + 0.86 * i / n) * w;
      g.fillStyle = '#0d0f11'; g.fillRect(x - 2, y0, 4, y1 - y0);
      g.fillStyle = '#9aa1a7'; for (let y = y0 + 4; y < y1 - 4; y += 10) g.fillRect(x + 5, y, 2, 5);
    }
    g.fillStyle = '#2c3034'; [0.36, 0.64].forEach((v) => g.fillRect(0, (1 - v) * h - 2, w, 4));
  });
}
const TEX = {
  knee: canvasTexture(64, 256, (g, w, h) => {
    g.fillStyle = '#131415'; g.fillRect(0, 0, w, h);
    for (let y = 8; y < h - 4; y += 15) { g.fillStyle = '#2d2f31'; g.fillRect(0, y, w, 6); g.fillStyle = '#070808'; g.fillRect(0, y + 6, w, 2); }
  }),
  seat: pleatTexture(7),
  pillion: pleatTexture(6),
  lens: canvasTexture(256, 256, (g, w, h) => {
    const grd = g.createRadialGradient(w * 0.42, h * 0.38, 8, w / 2, h / 2, w * 0.6);
    grd.addColorStop(0, '#ffffff'); grd.addColorStop(1, '#aeb9bf');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 9) { g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(x, 0, 3, h); g.fillStyle = 'rgba(60,75,85,0.2)'; g.fillRect(x + 4, 0, 2, h); }
    for (let y = 0; y < h; y += 28) { g.fillStyle = 'rgba(60,75,85,0.14)'; g.fillRect(0, y, w, 1); }
  }),
  // instrument face as on the owner's bike (photo set3-20): 0–160 km/h dial with a green gear-range
  // band and odometer on the left, TURN / NEUTRAL / HIGH BEAM lamps in a column on the right
  dial: canvasTexture(512, 330, (g, w, h) => {
    g.fillStyle = '#0b0d0e'; g.fillRect(0, 0, w, h);
    const cx = 188, cy = 168, r = 152, ang = (v) => (232 - 1.675 * v) * DEG;
    const at = (v, k) => [cx + Math.cos(ang(v)) * r * k, cy - Math.sin(ang(v)) * r * k];
    g.strokeStyle = g.fillStyle = '#eceee6'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let v = 0; v <= 165; v += 5) {
      const major = v % 10 === 0;
      g.lineWidth = major ? 6 : 3;
      g.beginPath(); g.moveTo(...at(v, major ? 0.8 : 0.87)); g.lineTo(...at(v, 1)); g.stroke();
    }
    g.font = '600 25px Arial, sans-serif';
    for (let v = 0; v <= 160; v += 20) g.fillText(String(v), ...at(v, 0.63));
    g.strokeStyle = '#1f9a5a'; g.fillStyle = '#1f9a5a'; g.lineWidth = 4;
    g.beginPath(); g.arc(cx, cy, r * 0.43, -ang(30), -ang(120)); g.stroke();
    g.font = '600 14px Arial, sans-serif';
    [[30, '1'], [55, '2'], [95, '3'], [120, '4']].forEach(([v, t]) => g.fillText(t, ...at(v, 0.36)));
    g.fillStyle = '#d8d9cf'; g.fillRect(cx + 4, cy + 38, 112, 32);
    g.fillStyle = '#111'; g.font = '600 24px "IBM Plex Mono", monospace';
    for (let i = 0; i < 5; i++) { g.fillStyle = '#111'; g.fillRect(cx + 7 + i * 22, cy + 41, 20, 26); g.fillStyle = '#e6e6e0'; g.fillText('0', cx + 17 + i * 22, cy + 55); }
    g.fillStyle = '#eceee6'; g.font = '600 20px Arial, sans-serif'; g.fillText('km/h', cx + 62, cy + 98);
    g.strokeStyle = '#e9dfb8'; g.lineWidth = 7; g.lineCap = 'round';
    g.beginPath(); g.moveTo(...at(180, 0.12)); g.lineTo(...at(0, 0.8)); g.stroke();
    g.fillStyle = '#e9dfb8'; g.beginPath(); g.arc(cx, cy, 15, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#eceee6'; g.lineWidth = 3; g.strokeRect(384, 22, 112, 286);
    [['TURN', '#5d5c34'], ['NEUTRAL', '#1d6b45'], ['HIGH BEAM', '#1f3a7a']].forEach(([t, c], i) => {
      const y = 36 + i * 92;
      g.fillStyle = c; g.fillRect(408, y, 64, 44);
      g.fillStyle = '#eceee6'; g.font = '700 15px Arial, sans-serif'; g.fillText(t, 440, y + 62);
    });
  }),
  sideBadge: canvasTexture(1024, 328, (g, w, h) => {
    // ROAD MASTER / CD200 badge on the side covers (photo set3-01); transparent outside the badge
    const chrome = '#dfe3e6', dark = '#15171a';
    const plaque = (x0, x1, text) => {
      g.fillStyle = chrome; g.beginPath(); g.roundRect(x0 - 8, 30, x1 - x0 + 16, 108, 16); g.fill();
      g.fillStyle = dark; g.beginPath(); g.roundRect(x0, 38, x1 - x0, 92, 10); g.fill();
      g.fillStyle = '#e0913f'; g.font = 'italic 700 68px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, (x0 + x1) / 2, 86);
    };
    plaque(30, 420, 'ROAD'); plaque(604, 994, 'MASTER');
    g.fillStyle = chrome; g.beginPath(); g.ellipse(512, 92, 92, 80, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = dark; g.beginPath(); g.ellipse(512, 92, 70, 60, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = chrome; g.lineWidth = 9; g.beginPath(); g.moveTo(512, 48); g.lineTo(552, 92); g.lineTo(512, 136); g.lineTo(472, 92); g.closePath(); g.stroke();
    g.fillStyle = chrome; g.beginPath(); g.roundRect(150, 150, 724, 162, 18); g.fill();
    g.fillStyle = dark; g.beginPath(); g.roundRect(160, 160, 704, 142, 12); g.fill();
    g.font = '800 132px "Arial Black", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 10; g.strokeStyle = chrome; g.strokeText('CD 200', 512, 234);
    g.fillStyle = dark; g.fillText('CD 200', 512, 234);
  }),
  // Honda wing badge on the tank (photo set3-10). The wing points to the rear on each side.
  // The circle is about 80 mm across on the bike (photo set2-03); the patch it is drawn on is about 106 mm square.
  tankBadge: [1, -1].map((wing) => canvasTexture(512, 512, (g) => {
    const cx = 256 - 18 * wing, cy = 280, chrome = '#dfe3e6';
    g.fillStyle = '#15171a'; g.beginPath(); g.arc(cx, cy, 186, 0, Math.PI * 2); g.fill();
    g.strokeStyle = chrome; g.lineWidth = 14; g.stroke();
    // wing: five feathers fanning up and back from a pivot left of centre
    g.save(); g.translate(cx - 120 * wing, cy + 10); g.scale(wing, 1); g.lineCap = 'round';
    for (let i = 4; i >= 0; i--) {
      const a = (10 + 6.5 * i) * DEG, len = 190 + 34 * i, tip = [Math.cos(a) * len, -Math.sin(a) * len];
      g.strokeStyle = '#2f3235'; g.lineWidth = 36; g.beginPath(); g.moveTo(20, 0); g.lineTo(...tip); g.stroke();
      g.strokeStyle = '#efe9d6'; g.lineWidth = 29; g.beginPath(); g.moveTo(20, 0); g.lineTo(...tip); g.stroke();
    }
    g.fillStyle = '#efe9d6'; g.beginPath(); g.ellipse(52, -20, 58, 34, -0.35, 0, Math.PI * 2); g.fill();
    g.restore();
    g.font = '700 84px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 10; g.strokeStyle = '#0b0c0d'; g.strokeText('HONDA', cx, cy + 104);
    g.fillStyle = chrome; g.fillText('HONDA', cx, cy + 104);
  })),
};

/* ---------- materials (each part makes its own, so highlighting stays per part) ---------- */
const MAT = {
  paint: () => new THREE.MeshPhysicalMaterial({ color: 0x2391cb, metalness: 0.35, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 }),
  chrome: (side = THREE.FrontSide) => new THREE.MeshStandardMaterial({ color: 0xf2f4f6, metalness: 1, roughness: 0.07, side }),
  alloy: () => new THREE.MeshStandardMaterial({ color: 0xbabdbb, metalness: 0.8, roughness: 0.36 }),
  casting: () => new THREE.MeshStandardMaterial({ color: 0xa5a8a4, metalness: 0.62, roughness: 0.52 }),
  black: () => new THREE.MeshStandardMaterial({ color: 0x17191c, metalness: 0.4, roughness: 0.42 }),
  rubber: () => new THREE.MeshStandardMaterial({ color: 0x1c1d1e, metalness: 0, roughness: 0.88 }),
  chain: () => new THREE.MeshStandardMaterial({ color: 0x55595c, metalness: 0.8, roughness: 0.45 }),
  amber: () => new THREE.MeshPhysicalMaterial({ color: 0xff8a17, metalness: 0, roughness: 0.18, emissive: 0x3c1600, clearcoat: 1 }),
  red: () => new THREE.MeshPhysicalMaterial({ color: 0xc4141c, metalness: 0, roughness: 0.2, emissive: 0x2c0000, clearcoat: 1 }),
  plate: () => new THREE.MeshStandardMaterial({ color: 0xe6eaec, metalness: 0.1, roughness: 0.55 }),
  glass: () => new THREE.MeshStandardMaterial({ color: 0xdfe8ee, metalness: 1, roughness: 0.03 }),
  textured: (map, rough = 0.55) => new THREE.MeshStandardMaterial({ color: 0xffffff, map, metalness: 0.05, roughness: rough }),
  badge: (map) => new THREE.MeshStandardMaterial({ color: 0xffffff, map, alphaTest: 0.5, metalness: 0.45, roughness: 0.3 }),
};

/* ---------- geometry helpers ---------- */
function mesh(geo, mat, parent, shadow = true) {
  const m = new THREE.Mesh(geo, mat); m.castShadow = shadow;
  if (parent) parent.add(m);
  return m;
}
const qAlong = (dir) => new THREE.Quaternion().setFromUnitVectors(Y_UP, dir.clone().normalize());
const toV = (p) => (p.isVector3 ? p.clone() : V(p[0], p[1], p[2] || 0));
function rod(a, b, r, mat, parent, seg = 14, rTop) {
  a = toV(a); b = toV(b);
  const d = b.clone().sub(a), len = d.length();
  const m = mesh(new THREE.CylinderGeometry(rTop ?? r, r, len, seg), mat, parent);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.copy(qAlong(d));
  return m;
}
function tube(pts, r, mat, parent, segs = 64, radial = 10, closed = false) {
  const curve = new THREE.CatmullRomCurve3(pts.map(toV), closed, 'centripetal');
  return mesh(new THREE.TubeGeometry(curve, segs, r, radial, closed), mat, parent);
}
function lathe(profile, a, dir, mat, parent, seg = 32) {
  mat.side = THREE.DoubleSide;
  const m = mesh(new THREE.LatheGeometry(profile.map(([r, s]) => new THREE.Vector2(r, s)), seg), mat, parent);
  m.position.copy(toV(a)); m.quaternion.copy(qAlong(dir));
  return m;
}
function rbox(w, h, d, r, mat, parent, pos, quat) {
  const m = mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2) * 0.999), mat, parent);
  if (pos) m.position.copy(toV(pos));
  if (quat) m.quaternion.copy(quat);
  return m;
}
function extrude(shape, depth, bevel, mat, parent, z) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 40 });
  const m = mesh(g, mat, parent); m.position.z = z;
  return m;
}
function roundRectShape(x0, y0, x1, y1, r) {
  const s = new THREE.Shape();
  s.moveTo(x0 + r, y0); s.lineTo(x1 - r, y0); s.quadraticCurveTo(x1, y0, x1, y0 + r);
  s.lineTo(x1, y1 - r); s.quadraticCurveTo(x1, y1, x1 - r, y1); s.lineTo(x0 + r, y1);
  s.quadraticCurveTo(x0, y1, x0, y1 - r); s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}
function hullOfCircles(circles, n = 64) {
  const pts = [];
  circles.forEach(([cx, cy, r]) => { for (let i = 0; i < n; i++) { const a = 2 * Math.PI * i / n; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } });
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  lo.pop(); up.pop();
  return lo.concat(up);
}

/* Superquadric loft: a smooth closed body (tank, seats) from side-profile functions of u (0 = rear, 1 = front). */
function superLoft(p) {
  const sp = (c, n) => Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
  const e = (u) => { const k = u < 0.5 ? p.capR : p.capF; const t = Math.min(1, Math.abs(2 * u - 1)); return Math.pow(Math.max(0, 1 - Math.pow(t, k)), 1 / k); };
  return (u, phi) => {
    const yt = p.yTop(u), yb = p.yBot(u), ee = e(u), c = Math.cos(phi), s = Math.sin(phi);
    return V(p.x0 + (p.x1 - p.x0) * u,
             (yt + yb) / 2 + (yt - yb) / 2 * ee * sp(s, s >= 0 ? p.nTop : p.nBot),
             p.w(u) * ee * sp(c, p.nSide));
  };
}
function loftGeometry(S, nu, nv, matFn) {
  const pos = [], uv = [], groups = {};
  const uAt = (i) => 0.5 - 0.5 * Math.cos(Math.PI * i / nu);
  for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
    const P = S(uAt(i), -Math.PI / 2 + 2 * Math.PI * j / nv); pos.push(P.x, P.y, P.z); uv.push(uAt(i), j / nv);
  }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const a = i * (nv + 1) + j, b = a + nv + 1, c = b + 1, d = a + 1;
    const k = matFn ? matFn((uAt(i) + uAt(i + 1)) / 2, -Math.PI / 2 + 2 * Math.PI * (j + 0.5) / nv) : 0;
    (groups[k] ||= []).push(a, b, d, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  let idx = [];
  Object.keys(groups).sort().forEach((k) => { g.addGroup(idx.length, groups[k].length, +k); idx = idx.concat(groups[k]); });
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
/* A rounded patch laid on a loft surface (knee pads, badges). side: +1 right, -1 left.
   even: space the patch by distance over the surface rather than by angle, so a texture keeps its shape
   where the loft's angle spacing is uneven (near the tank's widest line). */
function surfPatch(S, { uc, du, ec, de, side = 1, off = 0.004, sq = 4, nr = 10, na = 56, even = false }) {
  const phiOf = (el) => (side > 0 ? el : Math.PI - el), h = 1e-3;
  const pt = (u, el) => {
    const ph = phiOf(el), P = S(u, ph);
    const n = S(u + h, ph).sub(S(u - h, ph)).cross(S(u, ph + h).sub(S(u, ph - h))).normalize();
    return P.addScaledVector(n, off);
  };
  let elOf = (b) => ec + b * de;
  if (even) {
    const n = 64, el = (i) => ec - de + 2 * de * i / n, cum = [0];
    for (let i = 1; i <= n; i++) cum.push(cum[i - 1] + pt(uc, el(i)).distanceTo(pt(uc, el(i - 1))));
    elOf = (b) => {
      const t = (b + 1) / 2 * cum[n]; let i = 1;
      while (i < n && cum[i] < t) i++;
      return el(i - 1 + (t - cum[i - 1]) / (cum[i] - cum[i - 1]));
    };
  }
  const pos = [], uv = [], idx = [];
  const add = (a, b) => { const P = pt(uc + a * du, elOf(b)); pos.push(P.x, P.y, P.z); uv.push(0.5 + 0.5 * a, 0.5 + 0.5 * b); };
  add(0, 0);
  for (let r = 1; r <= nr; r++) for (let j = 0; j < na; j++) {
    const al = 2 * Math.PI * j / na, c = Math.cos(al), s = Math.sin(al);
    add((r / nr) * Math.sign(c) * Math.pow(Math.abs(c), 2 / sq), (r / nr) * Math.sign(s) * Math.pow(Math.abs(s), 2 / sq));
  }
  const vid = (r, j) => (r === 0 ? 0 : 1 + (r - 1) * na + (j % na));
  const tri = (a, b, c) => (side > 0 ? idx.push(a, b, c) : idx.push(a, c, b));
  for (let j = 0; j < na; j++) tri(0, vid(1, j), vid(1, j + 1));
  for (let r = 1; r < nr; r++) for (let j = 0; j < na; j++) { tri(vid(r, j), vid(r + 1, j), vid(r + 1, j + 1)); tri(vid(r, j), vid(r + 1, j + 1), vid(r, j + 1)); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
/* Mudguard shell: arc around the wheel centre with a domed cross-section. */
/* rIn: radius of the side valance edge, rOut: radius of the crown; both may vary with angle. */
function fenderGeometry({ rIn, rOut, width, phi0, phi1, p = 3, nPhi = 90, nS = 18 }) {
  const pos = [], idx = [];
  for (let i = 0; i <= nPhi; i++) {
    const ph = phi0 + (phi1 - phi0) * i / nPhi, c = Math.cos(ph), s = Math.sin(ph), a = rIn(ph), b = rOut(ph);
    for (let j = 0; j <= nS; j++) { const t = -1 + 2 * j / nS, r = a + (b - a) * (1 - Math.pow(Math.abs(t), p)); pos.push(r * c, r * s, t * width / 2); }
  }
  for (let i = 0; i < nPhi; i++) for (let j = 0; j < nS; j++) { const a = i * (nS + 1) + j, b = a + nS + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
const arcPts = (r, a0, a1, z, n = 40) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n, rr = typeof r === 'function' ? r(a) : r; return V(rr * Math.cos(a), rr * Math.sin(a), z); });
const smooth = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };

/* =====================================================================
   Part registry
   ===================================================================== */
const SYSTEMS = [
  { id: 'body', name: 'Bodywork' },
  { id: 'chassis', name: 'Frame & suspension' },
  { id: 'wheels', name: 'Wheels & drive' },
  { id: 'brakes', name: 'Brakes' },
  { id: 'engine', name: 'Engine (outside)' },
  { id: 'exhaust', name: 'Exhaust' },
  { id: 'lights', name: 'Lights & instruments' },
  { id: 'controls', name: 'Controls' },
];
const BASIS = { spec: 'From published spec', manual: 'From the workshop manual', photo: 'Measured from photos (about ±3 cm)', est: 'Estimated, not clear in photos' };
const bike = new THREE.Group();
const PARTS = [], byId = new Map();
function addPart(id, sys, name, basis, desc, explode = [0, 0, 0]) {
  const g = new THREE.Group(); g.userData.partId = id; bike.add(g);
  setExplode(g, explode);
  const p = { id, sys, name, basis, desc, group: g, visible: true };
  PARTS.push(p); byId.set(id, p);
  return g;
}
function setExplode(obj, v) { obj.userData.explode = toV(v); obj.userData.home = obj.position.clone(); }
function sideGroup(parent, explode) { const g = new THREE.Group(); parent.add(g); setExplode(g, explode); return g; }

export { $, BASIS, CYL_BASE, CYL_TILT, DEG, FA, FD, MAT, PARTS, R, RA, RIM, SYSTEMS, TEX, V, WB, Y_UP, addPart, arcPts, bike, byId, extrude, fenderGeometry, forkPt, hullOfCircles, lathe, loftGeometry, mesh, qAlong, rbox, rod, roundRectShape, sideGroup, smooth, superLoft, surfPatch, tube };
