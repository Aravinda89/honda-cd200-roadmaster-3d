// Render the bike turning on the spot, for the README.
//
//   node tools/turntable.mjs [--frames=48] [--size=640x400] [--dark]
//   python tools/make_gif.py tools/out/turntable docs/screenshots/turntable.gif
//
// Saves one PNG per frame to tools/out/turntable/, with the page's panels hidden and the camera
// circling the bike at the 3/4 view's height and distance. make_gif.py joins them into a looping GIF.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tools', 'out', 'turntable');
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const N = Number(arg('frames', 48));
const [W, H] = arg('size', '640x400').split('x').map(Number);

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  const file = fs.existsSync(p) && fs.statSync(p).isDirectory() ? path.join(p, 'index.html') : p;
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const url = `http://localhost:${server.address().port}/?nointro`;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, colorScheme: process.argv.includes('--dark') ? 'dark' : 'light' });
const localThree = path.join(ROOT, 'node_modules', 'three');
if (fs.existsSync(localThree)) {
  await page.route(/cdn\.jsdelivr\.net\/npm\/three@[^/]+\//, (route) => {
    const f = path.join(localThree, route.request().url().replace(/^.*\/npm\/three@[^/]+\//, ''));
    if (fs.existsSync(f)) route.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(f) }); else route.continue();
  });
}
await page.goto(url);
await page.addStyleTag({ content: '#panel,.topbar,.bottombar,.navpad,#info,#tip,#intro,.bpanel{display:none!important}#app{grid-template-columns:1fr!important}' });
await page.waitForFunction(() => window.viewer && document.querySelector('#loading').hidden, null, { timeout: 120000 });

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const C = [0.62, 0.56, 0], R = 3.6, Y = 1.3, FOV = 30;   // circle round the bike, a little above it
for (let i = 0; i < N; i++) {
  const a = -0.95 - 2 * Math.PI * i / N;                  // start at the 3/4 view from the front left, turn clockwise from above
  const pos = [C[0] + R * Math.cos(a), Y, C[2] + R * Math.sin(a)];
  await page.evaluate(({ pos, C, FOV }) => new Promise((done) => {
    window.viewer.photoCam(pos, C, [0, 1, 0], FOV);
    requestAnimationFrame(() => requestAnimationFrame(done));   // let it draw at the new angle
  }), { pos, C, FOV });
  await page.screenshot({ path: path.join(OUT, `f${String(i).padStart(3, '0')}.png`), timeout: 120000 });
  process.stdout.write(`\r  frame ${i + 1}/${N}`);
}
console.log(`\nsaved ${N} frames to ${path.relative(ROOT, OUT)}`);
await browser.close();
server.close();
