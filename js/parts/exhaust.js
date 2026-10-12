// Exhaust headers and silencers.
import * as THREE from 'three';
import { MAT, V, addPart, lathe, mesh, rod, sideGroup, tube } from '../core.js';
import { CYL_P, cylWorld } from './engine.js';

/* =====================================================================
   Build: exhaust
   ===================================================================== */
{
  const g = addPart('headers', 'exhaust', 'Exhaust headers', 'photo', 'One pipe per cylinder. They drop in front of the engine and run back underneath it.');
  [-1, 1].forEach((s) => {
    const sg = sideGroup(g, [0, -0.04, 0.26 * s]), ch = MAT.chrome();
    const p0 = cylWorld(0.1, 0.12, s * 0.065);
    tube([p0, [0.845, 0.5, 0.072 * s], [0.89, 0.43, 0.085 * s], [0.905, 0.34, 0.1 * s], [0.888, 0.262, 0.125 * s], [0.83, 0.215, 0.155 * s], [0.73, 0.205, 0.18 * s], [0.62, 0.215, 0.205 * s], [0.53, 0.262, 0.215 * s]], 0.019, ch, sg, 96, 14);
    const fl = mesh(new THREE.TorusGeometry(0.024, 0.006, 8, 24), ch, sg); fl.position.copy(p0); fl.quaternion.setFromUnitVectors(V(0, 0, 1), CYL_P);
  });
}
{
  const g = addPart('silencers', 'exhaust', 'Silencers', 'photo', 'Twin long chrome silencers, one each side, running nearly level and ending about 24 cm behind the rear axle.');
  [-1, 1].forEach((s) => {
    const sg = sideGroup(g, [0, -0.04, 0.34 * s]);
    const F = V(0.53, 0.262, 0.215 * s), B = V(-0.245, 0.268, 0.215 * s), d = B.clone().sub(F), L = d.length();
    lathe([[0.019, 0], [0.021, 0.03], [0.04, 0.1], [0.043, 0.12], [0.043, L - 0.13], [0.04, L - 0.09], [0.03, L - 0.035], [0.028, L - 0.03], [0.013, L - 0.025], [0.012, L], [0, L]], F, d, MAT.chrome(), sg, 40);
    rod([0.19, 0.33, 0.2 * s], [0.19, 0.3, 0.212 * s], 0.008, MAT.black(), sg);
  });
}
