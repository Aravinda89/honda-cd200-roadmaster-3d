// Render the model from a fitted photo camera and compare it with the photo.
//
//   node tools/photo-measure/overlay.mjs tools/photo-measure/data/cam-set2-03.json
//
// Writes tools/out/overlay-<photo>.jpg: the photo on top, the model from the same camera below,
// and a 50% blend at the bottom, all at half size with a 50 px grid so parts can be compared.
// Needs the camera file from fit_camera.py and the photo it names (in reference/photos/).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const camFile = process.argv[2];
if (!camFile) { console.error('usage: node tools/photo-measure/overlay.mjs <camera.json>'); process.exit(1); }
const cam = JSON.parse(fs.readFileSync(camFile, 'utf8'));
const photo = path.join(ROOT, cam.photo);
if (!fs.existsSync(photo)) { console.error(`photo not found: ${cam.photo}`); process.exit(1); }
const [W, H] = cam.size, w = Math.round(W / 2), h = Math.round(H / 2);

const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  const file = fs.existsSync(p) && fs.statSync(p).isDirectory() ? path.join(p, 'index.html') : p;
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg' }[path.extname(file)] || 'application/octet-stream';
  res.writeHead(200, { 'content-type': type }); fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}/`;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: w, height: h } });
const localThree = path.join(ROOT, 'node_modules', 'three');
if (fs.existsSync(localThree)) {
  await page.route(/cdn\.jsdelivr\.net\/npm\/three@[^/]+\//, (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(localThree, r.request().url().replace(/^.*\/npm\/three@[^/]+\//, ''))) }));
}
await page.goto(`${base}?nointro`);
await page.addStyleTag({ content: '#panel,.topbar,.bottombar,#info,#tip,#intro,.bpanel{display:none!important}#app{grid-template-columns:1fr!important}' });
await page.waitForFunction(() => window.viewer && document.querySelector('#loading').hidden, null, { timeout: 120000 });
await page.evaluate((c) => window.viewer.photoCam(c.pos, c.target, c.up, c.fov), cam);
await page.waitForTimeout(1500);
const render = (await page.screenshot({ timeout: 120000 })).toString('base64');

// compose photo / render / blend with a grid, in a canvas
await page.goto(`${base}${cam.photo}`);
const out = await page.evaluate(async ({ render, w, h }) => {
  const load = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
  const ph = document.querySelector('img') || await load(location.href);
  const rd = await load(`data:image/png;base64,${render}`);
  const c = document.createElement('canvas'); c.width = w; c.height = h * 3;
  const g = c.getContext('2d');
  g.drawImage(ph, 0, 0, w, h); g.drawImage(rd, 0, h, w, h);
  g.drawImage(ph, 0, 2 * h, w, h); g.globalAlpha = 0.5; g.drawImage(rd, 0, 2 * h, w, h); g.globalAlpha = 1;
  g.font = 'bold 12px sans-serif';
  for (let x = 0; x < w; x += 50) { g.strokeStyle = x % 100 ? 'rgba(160,0,160,.6)' : 'rgba(255,0,255,.9)'; g.beginPath(); g.moveTo(x + .5, 0); g.lineTo(x + .5, 3 * h); g.stroke(); if (x % 100 === 0) { g.fillStyle = '#ff0'; g.fillText(String(x), x + 2, 12); } }
  for (let y = 0; y < 3 * h; y += 50) { const yy = y % h; g.strokeStyle = yy % 100 ? 'rgba(0,140,140,.6)' : 'rgba(0,255,255,.9)'; g.beginPath(); g.moveTo(0, y + .5); g.lineTo(w, y + .5); g.stroke(); if (yy % 100 === 0) { g.fillStyle = '#ff0'; g.fillText(String(yy), 2, y + 12); } }
  return c.toDataURL('image/jpeg', 0.88).split(',')[1];
}, { render, w, h });
fs.mkdirSync(path.join(ROOT, 'tools', 'out'), { recursive: true });
const dest = path.join(ROOT, 'tools', 'out', `overlay-${path.basename(cam.photo, path.extname(cam.photo))}.jpg`);
fs.writeFileSync(dest, Buffer.from(out, 'base64'));
console.log('wrote', path.relative(ROOT, dest));
await browser.close(); server.close();
