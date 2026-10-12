// Smoke test and screenshot tool for the viewer.
//
//   npm run check                 load the page, fail on any script error, save the standard screenshots
//   npm run check -- --shots=f_on,r_worn --size=390x844 --dark
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
};
const wanted = arg('shots', Object.keys(SHOTS).join(',')).split(',').filter(Boolean);

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
      if (s.view) v.view(s.view);
      v.explode(s.explode || 0);
      if (s.dims) v.dims();
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
