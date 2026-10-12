# CD200 Roadmaster 3D viewer

An interactive, 1:1 scale 3D model of the owner's own Honda CD200 Roadmaster, built system by system
so that mechanics can learn how each part works. It runs as a static web page on GitHub Pages
(free hosting is a requirement) and is a portfolio pet project. Parts should match the real bike:
the owner can supply photos, measurements and pages from the workshop manual.

Stages 1 (outer body), 2 (working drum brakes) and 3 (engine internals and the four-stroke cycle)
are done. Stage 4 (clutch, gearbox, final drive) is next. See "Stage plan" below.

## Running it

```
npm install          # three.js (for offline tests) and Playwright
npm run setup        # downloads the Chromium build Playwright uses (once)
npm run serve        # http://localhost:8080 — ES modules need http, file:// will not work
npm run check        # loads the page headless, fails on any script error, saves screenshots
```

`npm run check -- --shots=f_on,r_worn --size=390x844 --dark` runs a subset at phone size in dark
mode. `npm run check -- --details` adds close-ups (`d_tank`, `d_speedo`, …) for comparing details
with the owner's photos. Shots are defined at the top of `tools/check.mjs`. Screenshots land in `tools/out/` (ignored
by git). Headless rendering is software-only and slow (2–4 frames a second): that is expected.

There is no build step. `index.html` loads `js/app.js` as an ES module; three.js 0.160.0 comes from
the jsDelivr CDN through the import map in `index.html`. Keep the version in the import map and
`package.json` in step.

Deploy: commit and push to `main`. GitHub Pages serves the repository root (Settings → Pages →
Deploy from a branch → main, / (root)). Changes go live within a few minutes.

## Layout

```
index.html              markup: side panel, top bar, brake panel, info card
css/styles.css          all styles; colour tokens for light and dark at the top
js/core.js              units, key geometry, materials, mesh helpers, part registry
js/parts/body.js        tank, seats, rack, side covers, chain case, mudguards, engine guard, plates
js/parts/chassis.js     frame, fork, swingarm, rear shocks, stands, footrests
js/parts/wheels.js      wheels and final drive
js/parts/engine.js      engine exterior; exports the cylinder frame (cylWorld)
js/parts/internals.js   stage 3: crankshaft, con rods, pistons, cam chain, camshaft, rockers, valves, plugs; poseEngine, cycleState
js/parts/exhaust.js     headers and silencers
js/parts/lights.js      headlamp, speedometer, indicators, tail light, horns
js/parts/controls.js    handlebar, clutch lever, mirrors, gear/kick pedals, cables
js/parts/brakes.js      stage 2: drums, back plates, shoes, springs, cams, lever, cable, pedal, rod, stop switch
js/app.js               renderer, camera views, dimensions, explode, parts list, picking, brake and engine modes, loop
tools/check.mjs         smoke test + screenshots
tools/serve.mjs         local server
tools/photo-measure/    measure part positions from side photos (see its README)
docs/                   measurements, manual page map
reference/              NOT in git: workshop manual PDF and the owner's photos (see below)
```

`js/app.js` imports every part module in build order. Order matters: `brakes.js` adds its stop-lamp
glow to the tail light from `lights.js`, and `exhaust.js` uses the cylinder geometry from `engine.js`.
`internals.js` builds in the same cylinder frame (from `CYL_BASE` / `CYL_TILT` in core.js).

## Conventions

**Units and axes.** Metres. The bike faces +x, y is up, +z is the rider's right (so the left side,
with the chain case and front brake, is negative z). Origin: rear axle at x = 0 on the ground plane
centre line. Key values live at the top of `core.js`: `R` (tyre radius), `RIM`, `WB` (1.28 m),
`RA`/`FA` (rear and front axle), `RAKE` (25°), `FD`/`FF` (up the fork / square to it), `forkPt(t, fwd, z)`
(a point `t` metres up the fork axis from the front axle), `CYL_BASE`/`CYL_TILT` (cylinder base, 8° forward lean).

**Parts.** Every clickable part is registered with
`addPart(id, system, name, basis, description, explodeVector)` and returns a group to build into.
- `system` is one of the ids in `SYSTEMS` (core.js). Add a system there for new stages.
- `basis` says where the shape and size came from, and is shown to the user: `spec` (published
  dimension), `manual` (workshop manual figure or drawing), `photo` (measured from the owner's
  photos, about ±3 cm), `est` (estimated, not visible). Never mark something `spec` or `manual`
  that was guessed.
- `description` is shown in the info card. Write it for a mechanic, in plain sentences, using the
  manual's terms, and include the manual's figures (sizes, limits, torques, free play) where they
  exist. No invented numbers.
- `explodeVector` is how far the part moves at 100% explode. Use `sideGroup(g, vector)` for left and
  right halves that should separate sideways.
- Create materials per part with the `MAT.*()` factories (and `BRAKE_MAT.*()`); never share a
  material between parts, because hover/selection highlighting changes the material's emissive colour.

**Helpers** in core.js: `rod`, `tube` (Catmull-Rom tube through points), `lathe` (profile turned
around an axis), `rbox` (rounded box), `extrude`, `superLoft` + `loftGeometry` (smooth bodies such as
the tank and seats, defined by side-profile functions), `surfPatch` (a patch laid on a loft surface:
knee pads, badges), `fenderGeometry`, `hullOfCircles`, `arcPts`.

**Modes.** `app.js` has a stage switch (`setStage('body' | 'brakes' | 'engine')`). In a tool stage,
parts outside the stage's focus set are faded with `setGhost` (`BRAKE_FOCUS` / `BRAKE_CONTEXT`,
`ENGINE_FOCUS` / `ENGINE_SHELL` / `ENGINE_CONTEXT`), the stage's panel drives the pose functions every
frame (`poseBrake` / `poseLinkages`, `poseEngine`), and the camera's projection is shifted
(`viewShift`) so the model stays clear of the panel. Systems listed in `STAGE_ONLY` (the engine
internals) are hidden outside their stage, in the scene and in the parts list. Follow the same
pattern for new stages: a focus set, a panel, and pose functions exported from the stage's part module.

**Test hooks.** `window.viewer` (bottom of app.js) exposes `view`, `select`, `explode`, `dims`,
`stage`, `brake`, `brakeView`, `engine(deg, play, follow)`, `engineView`, `cycle` and `photoCam`. `tools/check.mjs` and `tools/photo-measure/overlay.mjs`
depend on them; extend them for new stages rather than reaching into internals from tests.

**Design.** Colours are CSS custom properties defined for light and dark at the top of
`css/styles.css` (system dark mode and an explicit `data-theme` both work). Fonts: Saira Condensed
(display), IBM Plex Sans (body), IBM Plex Mono (figures). Semantic chip colours: `--ok`, `--warn`,
`--bad`, `--on`. Keep new UI on these tokens and check both themes and a 390 px wide phone.

## How to work on this

- After any change, run `npm run check` and look at the screenshots of the views you touched, in
  light and dark and at phone width. Fix layout overlap and unreadable text before committing.
- Keep the scene light enough for mid-range phones: reuse geometry, use `InstancedMesh` for
  repeated parts (spokes do), and avoid very dense tubes and lathes.
- Moving parts must move the way the manual describes. When something is drawn exaggerated for
  visibility (the brake shoe clearance is: `GAP_VIS` in brakes.js), say so in the UI.
- Write UI text plainly for mechanics: name parts the way the manual does, and say what to check
  and what the limit is.
- Commit in small steps with clear messages; one stage or fix per pull of work.

## Sources of truth

1. **The owner's bike** wins over everything else where they disagree.
2. **Haynes Owners Workshop Manual no. 572**, Honda CD/CM185 & 200T (CD200T column). Page map:
   `docs/manual-map.md`. The PDF lives in `reference/manual/` on the owner's computer only.
3. **The owner's photos** in `reference/photos/`, measured with `tools/photo-measure/` (results in
   `docs/measurements.md`).
4. Published specs (Wikipedia, UltimateSpecs, MotorcycleDB) only where the manual says nothing.

**Never commit `reference/`.** The manual is Haynes' copyrighted book and this copy carries a third
party's name and phone number on every page. The photos are the owner's and are kept private unless
the owner says otherwise. `.gitignore` covers this; do not override it, and do not copy manual pages,
drawings or long passages into the repository or the page. Short figures (sizes, limits, free play)
are fine and should be credited to the manual.

## Decisions so far

- **Wheels are 17-inch, 3.00-17** (manual). The model briefly used 18-inch based on photos; a later
  test showed the photos fit 17- and 18-inch equally well, so the manual's size stands. Only the tyre
  sidewall on the owner's bike would change this.
- **Seat**: manual says 744 mm; the owner's seat measures about 770–775 mm in photos, so the model
  follows the bike and the side panel notes the difference.
- **Rear tyre pressure**: the manual gives 28 psi in its maintenance section and 32 psi in its
  specifications; the panel shows both.
- **Rake** about 25°, measured from photos.
- **Front brake arm direction and the cable / rod routing** follow the manual's drawings (figs 5.1,
  5.2 and photos 3.3, 8.3), not yet the owner's bike. Photos set3-25, set2-03 and set1-01 show the
  owner's front arm hanging down in front of the fork leg; change it once a square-on photo shows
  where the cable meets the arm (see `docs/measurements.md`, close-up set).
- **Brake behaviour**: single leading shoe drums, both shoes on one anchor pin, flat cam. Free play
  10–20 mm at the lever end, 20–30 mm at the pedal; stop lamp at about 20 mm of pedal travel;
  linings 4.0 mm new, 2.0 mm limit; the wear tag arrow reaches the plate mark at the limit.
- **AI-generated 3D models** (two Copilot 3D GLB files) were checked and rejected as references:
  heights off by 3–6 cm in opposite directions and invented details. A photogrammetry scan of the
  real bike (for example Polycam, about 120–150 photos) would be a valid reference if more accuracy
  is wanted.
- **Crank phasing is 360°** (both pistons rise and fall together, firing one turn apart). The manual's
  valve clearance procedure (routine maintenance, PDF p.13–14) turns the engine one full turn to bring
  the second cylinder to TDC on compression, and chapter 3 shows one coil and one contact breaker
  firing both plugs together (wasted spark on the exhaust stroke).
- **Valve timing** comes from the manual's CM200T column, because the CD200T column is blank:
  inlet 7°30' BTDC / 27°30' ABDC, exhaust 27°30' BBDC / 7°30' ATDC. The engine panel says so.
- **Engine internals are sized by estimate** apart from bore and stroke (rod length, valve sizes and
  angles, valve lift, cam base circle). The cam lobes are generated from the same lift function that
  moves the valves, and the rocker angle is solved exactly, so cam, rocker and valve stay in contact.
  The valve clearance is drawn 30 times real size (`GAP_VIS` in internals.js).
- Parts still marked `est`: swingarm, chain and sprockets, gear and kick-start pedals, control cables,
  all engine internals.
- Known visual mismatches against photo set2-03: the handlebar and mirrors sit a few cm higher in
  the model than in the photo; check with `tools/photo-measure/overlay.mjs` before changing.

## Stage plan

| Stage | Content | Manual pages | Status |
|---|---|---|---|
| 1 | Outer body, click to identify, explode, dimensions | specs p.7 | done |
| 2 | Drum brakes: operate, free play adjustment, lining wear check, fault finder | 10–11 (adjustment), 115–128 | done |
| 3 | Engine internals: crankshaft, pistons (bore 53 mm, stroke 44 mm), camshaft and cam chain, valves; four-stroke cycle animation; valve clearance check; engine fault finder | chapter 1, 23–75; routine maintenance 13–14 | done |
| 4 | Clutch, 4-speed constant-mesh gearbox and final drive: pull the clutch, shift gears, follow the power to the rear wheel | chapter 1 (clutch/gearbox sections), 11 (chain) | next |
| 5 | Electrical: battery to lights, horn, ignition; switch interaction | chapter 6, 129–144; wiring diagrams 142–144; ignition chapter 3, 90–96 | |
| 6 | Portfolio polish: intro screen, README write-up, screenshots | — | |

Fuel system and lubrication (chapter 2, pages 76–89) were left out of stage 3 and can become their
own stage.

## Open questions for the owner

- Tyre size moulded on both sidewalls.
- Ground to top of seat, measured with a tape.
- Square-on close-ups of the front hub (left side) and rear hub (right side): arm, cable / rod end,
  adjuster, torque arm, wear indicator. The close-up set3 has no straight hub shots.
- Straight-on photos of the right side and the rear.
- Right side of the engine with the covers on (the close-up set has the left side only).
