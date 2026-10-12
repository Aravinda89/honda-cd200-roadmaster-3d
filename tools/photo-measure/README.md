# Measuring parts from photos

Phone photos of the bike can give part positions to about ±2–3 cm, as long as both wheels are
visible. The method: fit the camera from known wheel points, then turn picked pixels into bike
coordinates.

Requirements: Python 3 with `numpy`, `scipy` and `Pillow`; Node with Playwright for the overlay.

## Steps

1. **Grid the photo** to read pixel positions:
   `python3 tools/photo-measure/grid.py reference/photos/set2-03.jpg tools/out/grid.jpg 50`
   Crop with a fourth argument (`x0,y0,x1,y1`) to zoom into the wheels.
2. **Write a landmarks file** like `data/wheels-set2-03.json`: front and rear axle centres, tyre
   contact points, front edge of the front rim, back edge of the rear rim, bottom and top of the
   rims, each with its pixel position. Bike points use the tyre radius 0.292 m and rim lip radius
   0.229 m (17-inch wheels).
3. **Fit the camera**: `python3 tools/photo-measure/fit_camera.py data/wheels-set2-03.json`
   (`--scan` shows how the error changes with focal length; 2700 px has worked for these photos).
4. **Pick points** into a points file like `data/points-set2-03.json`: `"name": [u, v, z]`, where z
   is the side plane of the point (0 for the centre line, negative for the left side).
5. **Convert**: `python3 tools/photo-measure/points_to_bike.py data/cam-set2-03.json data/points-set2-03.json --scale 2`
6. **Compare** the model with the photo:
   `node tools/photo-measure/overlay.mjs tools/photo-measure/data/cam-set2-03.json`
   writes `tools/out/overlay-set2-03.jpg` (photo, model from the same camera, and a blend).

Always measure each point on two photos. If they disagree by more than about 3 cm, a landmark
pixel is probably wrong.

The best photos for this: bike on its centre stand on level ground, handlebar straight, taken from
5–6 m away with the zoom, phone level at about 60 cm high, and a tape measure on the ground beside
the bike as a scale check.
