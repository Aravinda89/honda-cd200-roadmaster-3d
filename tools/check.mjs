// Smoke test and screenshot tool for the viewer.
//
//   npm run check                 load the page, fail on any script error, save the standard screenshots
//   npm run check -- --shots=f_on,r_worn --size=390x844 --dark
//   npm run check -- --details     also saves the d_* close-ups used to compare details with photos
//
// Serves the project folder on a local port, opens it in headless Chromium (Playwright) and drives
// the page through window.viewer (defined at the bottom of js/app.js). Screenshots go to tools/out/.
// If node_modules/three exists, the three.js CDN requests are answered from it, so the test also
// works offline and always uses the same version as the import map in index.html.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tools', 'out');
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const flag = (k) => process.argv.includes(`--${k}`);
const [W, H] = arg('size', '1400x860').split('x').map(Number);

// Each shot: a camera / mode setup applied through window.viewer, then a screenshot.
const SHOTS = {
  body_34: { view: 'three' },
  body_left: { view: 'left' },
  body_front: { view: 'front' },
  body_dims: { view: 'left', dims: true },
  body_explode: { view: 'three', explode: 0.8 },
  f_rest: { stage: 'brakes', brake: 'f', t: 0, bview: 'hub' },
  f_on: { stage: 'brakes', brake: 'f', t: 60, bview: 'hub' },
  f_lever: { stage: 'brakes', brake: 'f', t: 60, bview: 'link' },
  r_on: { stage: 'brakes', brake: 'r', t: 75, bview: 'hub' },
  r_pedal: { stage: 'brakes', brake: 'r', t: 75, bview: 'link' },
  r_worn: { stage: 'brakes', brake: 'r', t: 75, lining: 1.8, bview: 'hub' },
  brakes_34: { stage: 'brakes', brake: 'r', t: 75, view: 'three' },
  // engine: deg is the crank angle, 0 = left cylinder TDC on compression
  e_intake: { stage: 'engine', engine: { deg: 450 }, eview: 'cyl' },
  e_power: { stage: 'engine', engine: { deg: 20 }, eview: 'cyl' },
  e_head: { stage: 'engine', engine: { deg: 460 }, eview: 'head' },
  e_crank: { stage: 'engine', engine: { deg: 100 }, eview: 'crank' },
  e_tdc: { stage: 'engine', engine: { deg: 0 }, eview: 'head' },
  // gearbox: gear is '1' 'N' '2' '3' '4'; lever is clutch lever travel in mm
  g_neutral: { stage: 'gearbox', gearbox: { gear: 'N', rpm: 1200, lever: 0 }, gview: 'gears' },
  g_first: { stage: 'gearbox', gearbox: { gear: '1', rpm: 2000, lever: 0 }, gview: 'gears' },
  g_fourth: { stage: 'gearbox', gearbox: { gear: '4', rpm: 3000, lever: 0 }, gview: 'gears' },
  g_clutch: { stage: 'gearbox', gearbox: { gear: '2', rpm: 2000, lever: 45 }, gview: 'clutch' },
  g_chain: { stage: 'gearbox', gearbox: { gear: '3', rpm: 3000, lever: 0 }, gview: 'chain' },
  // electrical: switch state passed to viewer.electrical; run is seconds to simulate
  x_off: { stage: 'electrical', elec: { key: false, lights: false, turn: null, fuse: true, flat: false, engine: 'stopped' }, xview: 'lights' },
  x_lights: { stage: 'electrical', elec: { key: true, lights: true, beam: 'hi', turn: null, fuse: true, flat: false, engine: 'stopped' }, xview: 'lights' },
  x_turn: { stage: 'electrical', elec: { key: true, lights: false, turn: 'L', fuse: true, flat: false, engine: 'stopped', run: 0.1 }, xview: 'bars' },
  x_start: { stage: 'electrical', elec: { key: true, lights: false, turn: null, start: true, fuse: true, flat: false, engine: 'stopped', run: 0.5 }, xview: 'ignition' },
  x_run: { stage: 'electrical', elec: { key: true, lights: false, turn: null, start: false, fuse: true, flat: false, engine: 'running', run: 0.95 }, xview: 'ignition' },
  x_battery: { stage: 'electrical', elec: { key: true, lights: true, beam: 'lo', turn: null, start: false, fuse: true, flat: false, engine: 'running', run: 0.2 }, xview: 'battery' },
  x_fuse: { stage: 'electrical', elec: { key: true, lights: true, turn: null, start: false, fuse: false, flat: false, engine: 'stopped' }, xview: 'lights' },
  // close-ups for comparing details with the owner's photos: cam = [position, target, fov].
  // photoCam freezes the camera, so these run last and only when asked for (--shots=d_tank or --details).
  d_tank: { cam: [[0.75, 0.86, -0.62], [0.75, 0.78, -0.1], 30] },
  d_tank_r: { cam: [[0.75, 0.86, 0.62], [0.75, 0.78, 0.1], 30] },
  d_side: { cam: [[0.36, 0.6, -0.78], [0.36, 0.56, -0.15], 28] },
  d_speedo: { cam: [[0.72, 1.24, 0], [1.02, 1.0, 0], 24] },
  d_tail: { cam: [[-1.0, 0.76, 0.18], [-0.38, 0.66, 0], 22] },
  d_shock: { cam: [[0.12, 0.5, 0.95], [0.09, 0.49, 0.18], 30] },
  d_fhub: { cam: [[1.3, 0.34, -0.85], [1.3, 0.3, 0], 26] },
  d_gap: { stage: 'engine', engine: { deg: 0 }, cam: [[0.652, 0.606, -0.26], [0.652, 0.606, -0.061], 9] },   // left inlet rocker at TDC compression
};
const detail = Object.keys(SHOTS).filter((k) => SHOTS[k].cam);
const wanted = arg('shots', Object.keys(SHOTS).filter((k) => flag('details') || !SHOTS[k].cam).join(','))
  .split(',').filter(Boolean).sort((a, b) => detail.includes(a) - detail.includes(b));

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  const file = fs.existsSync(p) && fs.statSync(p).isDirectory() ? path.join(p, 'index.html') : p;
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const url = `http://localhost:${server.address().port}/`;

const errors = [];
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, colorScheme: flag('dark') ? 'dark' : 'light' });
page.on('pageerror', (e) => errors.push(`page error: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|fonts\.g/.test(m.text())) errors.push(`console: ${m.text()}`); });
const localThree = path.join(ROOT, 'node_modules', 'three');
if (fs.existsSync(localThree)) {
  await page.route(/cdn\.jsdelivr\.net\/npm\/three@[^/]+\//, (route) => {
    const rel = route.request().url().replace(/^.*\/npm\/three@[^/]+\//, '');
    const f = path.join(localThree, rel);
    if (fs.existsSync(f)) route.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(f) }); else route.continue();
  });
}
if (flag('offline-fonts')) await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());

await page.goto(url);
try {
  await page.waitForFunction(() => window.viewer && document.querySelector('#loading').hidden, null, { timeout: 120000 });
} catch {
  errors.push('the viewer did not finish loading within 120 s');
}
const info = await page.evaluate(() => window.viewer ? { parts: window.viewer.parts.length, systems: [...new Set(window.viewer.parts.map((p) => p.sys))] } : null);
console.log(`loaded ${url}  ${info ? `${info.parts} parts in ${info.systems.length} systems` : '(no viewer)'}`);

if (info) {
  fs.mkdirSync(OUT, { recursive: true });
  for (const name of wanted) {
    const s = SHOTS[name];
    if (!s) { console.log(`  unknown shot ${name}`); continue; }
    await page.evaluate((s) => {
      const v = window.viewer;
      v.stage(s.stage || 'body');
      if (s.brake) v.brake(s.brake, s.t ?? 0, s.lining, s.slack);
      if (s.bview) v.brakeView(s.brake, s.bview);
      if (s.engine) v.engine(s.engine.deg, false, s.engine.follow);
      if (s.eview) v.engineView(s.eview);
      if (s.gearbox) v.gearbox(s.gearbox);
      if (s.gview) v.gearView(s.gview);
      if (s.elec) v.electrical(s.elec);
      if (s.xview) v.elecView(s.xview);
      if (s.view) v.view(s.view);
      v.explode(s.explode || 0);
      if (s.dims) v.dims();
      if (s.cam) v.photoCam(s.cam[0], s.cam[1], [0, 1, 0], s.cam[2]);
    }, s);
    await page.waitForTimeout(1500);   // software rendering is slow; give the animations time to settle
    const file = path.join(OUT, `${name}${flag('dark') ? '_dark' : ''}${W !== 1400 ? `_${W}` : ''}.png`);
    await page.screenshot({ path: file, timeout: 120000 });
    if (s.dims) await page.evaluate(() => window.viewer.dims());
    console.log(`  saved ${path.relative(ROOT, file)}`);
  }
}
await browser.close();
server.close();
if (errors.length) { console.error('\nFAILED\n  ' + errors.join('\n  ')); process.exit(1); }
console.log('\nOK: no script errors');
