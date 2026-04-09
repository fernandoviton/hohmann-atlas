// ─── Planetary positions using JPL mean orbital elements ───
// Based on Standish "Approximate Positions of the Major Planets"
// Accuracy: ~1-5 degrees for dates within a few centuries of J2000

/**
 * Convert ISO date string to Julian Date.
 */
export function isoToJD(dateIso) {
  const d = new Date(dateIso + 'T12:00:00Z');
  return d.getTime() / 86400000 + 2440587.5;
}

/**
 * Convert Julian Date to centuries past J2000.0 (JD 2451545.0).
 */
function jdToT(jd) {
  return (jd - 2451545.0) / 36525.0;
}

// Mean orbital elements at J2000.0 and their rates (per century)
// Source: Standish (1992) / JPL Solar System Dynamics
// [L0, Ldot, w0, wdot, e0, edot]
// L = mean longitude (deg), w = longitude of perihelion (deg), e = eccentricity
const ELEMENTS = {
  Mercury: [252.25032350, 149472.67411175, 77.45779628,  0.16047689, 0.20563593,  0.00001906],
  Venus:   [181.97909950,  58517.81538729, 131.60246718, 0.00268329, 0.00677672, -0.00004107],
  Earth:   [100.46457166,  35999.37244981, 102.93768193, 0.32327364, 0.01671123, -0.00004392],
  Mars:    [355.44722830,  19140.30268499, 336.05637041, 0.44441088, 0.09339410,  0.00007882],
  Jupiter: [ 34.39644051,   3034.74612775,  14.72847983, 0.21252668, 0.04838624, -0.00013253],
  Saturn:  [ 49.95424423,   1222.49362201,  92.59887831, -0.41897216, 0.05386179, -0.00050991],
  Uranus:  [313.23810451,    428.48202785, 170.95427630, 0.40805281, 0.04725744, -0.00004397],
  Neptune: [304.87997031,    218.45945325,  44.96476227, -0.32241464, 0.00859048,  0.00005105],
};

/**
 * Normalize angle to [0, 2*PI) radians.
 */
function normalizeRad(angle) {
  const twoPi = 2 * Math.PI;
  return ((angle % twoPi) + twoPi) % twoPi;
}

/**
 * Solve Kepler's equation M = E - e*sin(E) via Newton's method.
 * M in radians, returns E in radians.
 */
function solveKepler(M, e) {
  let E = M;
  for (let i = 0; i < 20; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  return E;
}

/**
 * Compute approximate heliocentric ecliptic longitude for a planet at a given date.
 * Uses mean elements + Kepler's equation for the equation of center.
 * Returns radians in [0, 2*PI).
 */
export function planetLongitude(name, dateIso) {
  const elems = ELEMENTS[name];
  if (!elems) throw new Error(`Unknown planet: ${name}`);

  const jd = isoToJD(dateIso);
  const T = jdToT(jd);

  const [L0, Ldot, w0, wdot, e0, edot] = elems;
  const L_deg = L0 + Ldot * T;
  const w_deg = w0 + wdot * T;
  const e = e0 + edot * T;

  // Mean anomaly M = L - w
  const M_rad = (L_deg - w_deg) * Math.PI / 180;

  // Solve Kepler's equation for eccentric anomaly
  const E = solveKepler(normalizeRad(M_rad), e);

  // True anomaly
  const nu = 2 * Math.atan2(
    Math.sqrt(1 + e) * Math.sin(E / 2),
    Math.sqrt(1 - e) * Math.cos(E / 2)
  );

  // True longitude = true anomaly + longitude of perihelion
  const trueLon = nu + w_deg * Math.PI / 180;
  return normalizeRad(trueLon);
}

/**
 * Compute positions for all planets at a given ISO date.
 * Returns array of {name, longitude_rad}.
 */
export function computePositions(dateIso) {
  return Object.keys(ELEMENTS).map(name => ({
    name,
    longitude_rad: planetLongitude(name, dateIso),
  }));
}
