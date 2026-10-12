# Measurements from the owner's photos

Method: `tools/photo-measure/`. Two left-side photos (`set2-01` and `set2-03`) were each fitted
to a camera using the wheel axles, tyre contact points and rim edges, scaled by the 1,280 mm
wheelbase. Points were then picked on each photo and projected onto the side plane they lie on.
The two photos agree within about 2–3 cm, which is the accuracy to expect.

Coordinates: metres, rear axle at x = 0, ground at y = 0, +x forward. Values are the average of the
two photos (the original fit assumed a slightly larger tyre; the differences after switching to
17-inch wheels are under 1 cm for these points).

| Point | x | y | Notes |
|---|---|---|---|
| Tank top, front | 0.857 | 0.872 | centre line |
| Tank top, middle | 0.678 | 0.871 | |
| Tank top, rear | 0.522 | 0.778 | |
| Tank front end | 0.923 | 0.785 | |
| Tank rear end | 0.485 | 0.692 | |
| Tank bottom, front / rear | 0.904 / 0.496 | 0.672 / 0.659 | |
| Knee pad: front, rear, top, bottom | 0.728, 0.507, —, — | —, —, 0.829, 0.688 | |
| Tank badge centre | 0.812 | 0.786 | |
| Seat top: front, middle, rear | 0.462, 0.305, 0.163 | 0.783, 0.792, 0.787 | about 30 mm above the manual's 744 mm |
| Seat side bottom | 0.322 | 0.643 | |
| Pillion top: front, rear | 0.131, −0.222 | 0.847, 0.843 | |
| Rack rear rail | −0.400 | 0.761 | |
| Side cover: chrome front, top, rear, bottom | 0.528, 0.351, 0.199, 0.346 | 0.558, 0.644, 0.559, 0.472 | |
| Chain case top / rear end | 0.228 / −0.109 | 0.471 / 0.387 | |
| Silencer: top and bottom at mid, rear end | 0.106, 0.102, −0.245 | 0.310, 0.225, 0.268 | |
| Rider footrest | 0.502 | 0.261 | |
| Pillion footrest | 0.193 | 0.301 | |
| Rear shock: top / bottom mount | 0.132 / 0.030 | 0.658 / 0.372 | |
| Headlamp centre | 1.147 | 0.919 | |
| Front indicator | 1.111 | 0.877 | |
| Fork cover bottom | 1.163 | 0.554 | |
| Engine guard top | 0.930 | 0.573 | |
| Front mudguard: tip, top | 1.477, 1.343 | 0.570, 0.617 | |
| Rear mudguard tail | −0.397 | 0.298 | |
| Tail light | −0.387 | 0.674 | |
| Rear indicator | −0.187 | 0.617 | |
| Rear number plate centre | −0.369 | 0.494 | |
| Cylinder head top: front, rear | 0.808, 0.591 | 0.611 | |
| Generator cover centre | 0.655 | 0.360 | left side |

Single-photo values (set2-01): mirror centre about (0.76, 1.15), near grip end about (0.72, 0.97).

Overall model check after corrections: length 1,998 mm (manual 1,990), height to bar top
1,117 mm (manual 1,105), seat top about 772 mm (manual 744; follows the bike).

## Close-up set (`set3-01` to `set3-26`, taken 2026-10-10)

Detail photos, not fitted to a camera, so used for shape and layout rather than position.
`npm run check -- --details` saves matching model close-ups (`d_*`) for side-by-side checks.

| Part | Photo | What the model now follows |
|---|---|---|
| Speedometer | set3-09, set3-20 | Black housing and bezel; 0–160 km/h dial, odometer, green gear-range band 1–4; TURN / NEUTRAL / HIGH BEAM lamps in a column right of the dial |
| Side cover badge | set3-01 | ROAD MASTER plaques with crest over CD200, about 200 × 64 mm; chrome front section is plain (no slots) |
| Tank badge | set3-10, set2-03 | Honda wing in a black circle about 80 mm across, wing pointing to the rear on both sides, just ahead of the knee pad |
| Filler cap | set3-21 | Chrome bayonet cap with four lobes and a hinged centre flap |
| Rear shocks | set3-02, set3-17 | Spring fully covered: painted upper cover (top ~40 %), chrome lower cover (~25 %), alloy damper body (~22 %) |
| Tail light | set3-15 | Stanley one-piece red lens on a dark base, large round centre boss with reflector, two lens screws |
| Handlebar switches | set3-18, set3-19 | Bare alloy housings |

Not yet used: the ignition switch under the speedometer (set3-20; black HONDA cover with the key
barrel, for stage 5), the engine left side (set3-03, set3-23, set3-24; for stage 3), and the front
hub (set3-25). The front hub photo, with set2-03 and set1-01, shows the **front brake arm hanging
down in front of the fork leg**, not pointing back as in the manual's drawing that the model
follows. The cable's path to the arm is not visible, so the brake model is unchanged until a
square-on photo of the left side of the front hub is available.
