# Honda CD200 Roadmaster in 3D

An interactive, full-scale 3D model of my own Honda CD200 Roadmaster, built one system at a time
so you can see how a classic motorcycle works.

**Live:** https://aravinda89.github.io/honda-cd200-roadmaster-3d/

## What you can do

- **Outer body.** Rotate and zoom the bike, click any of its parts to see what it is and what it
  does, explode the assembly, and compare the model with the published dimensions.
- **Working drum brakes.** Squeeze the lever or press the pedal and watch the cable or rod turn the
  cam, the shoes swing out on the anchor pin and the linings meet the drum. Set the free play with
  the adjuster nut, wear the linings down to the service limit and watch the wear indicator, and
  look up common brake faults.

Each part says where its size came from: the workshop manual, a published specification, a
measurement from photos of the bike, or an estimate.

## Coming next

Engine internals and the four-stroke cycle, then the clutch and gearbox, then the electrical system.

## How it is built

Plain HTML, CSS and JavaScript modules with [three.js](https://threejs.org/), no build step. Every
part is modelled in code from the dimensions in the workshop manual and measurements taken from
photos of the real bike. Run it locally with `npm install` and `npm run serve`.

## Credits

Specifications from the Haynes Owners Workshop Manual no. 572 (Honda CD/CM185 & 200T). The manual
itself is not included in this repository. Not affiliated with Honda.
