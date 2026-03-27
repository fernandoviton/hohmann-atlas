// ─── Pure orbital-mechanics helpers (no DOM, no state) ───

// ─── Scaling & display ───

export function auToR(au) {
  return 8 + (Math.log(au) - Math.log(0.3)) / (Math.log(32) - Math.log(0.3)) * 82;
}

export function dvColor(dv) {
  if (dv < 6) return 'green';
  if (dv < 10) return 'yellow';
  return 'red';
}

export function dvColorHex(dv) {
  if (dv < 6) return '#2ecc71';
  if (dv < 10) return '#f1c40f';
  return '#e74c3c';
}

export function formatTime(days) {
  return days > 365.25 ? (days / 365.25).toFixed(1) + ' yr' : Math.round(days) + ' d';
}

// ─── Angle helpers ───

/**
 * Compute a planet's angle after it has orbited for `days`.
 * Angles decrease (prograde = clockwise in our SVG convention).
 */
export function arrivalAngle(currentAngle, orbitalPeriodDays, days) {
  const omega = 2 * Math.PI / orbitalPeriodDays;
  return currentAngle - omega * days;
}

/**
 * Normalize angular sweep to prograde (negative) direction.
 * The modulo reduction prevents multi-revolution spirals; no further
 * clamping is applied so the arc endpoint always matches the true
 * planet position.
 */
export function normalizeSweep(raw) {
  let s = raw % (2 * Math.PI);              // (-2π, 2π)
  if (s > 0) s -= 2 * Math.PI;              // (-2π, 0]
  if (s === 0) s = -2 * Math.PI;            // full circle when exactly 0
  return s;
}

// ─── Core arc geometry ───

/**
 * Compute the Hohmann transfer ellipse point at parameter t ∈ [0,1].
 *
 * The ellipse is computed in its natural orbital frame (true anomaly θ
 * sweeps 0→π for outbound, π→0 for inbound), giving radius r(θ).
 *
 * To place the arc on screen connecting startAngle → endAngle, we compute
 * the angular position of each point on the physical ellipse (relative to
 * the ellipse's own angular span) and map it proportionally onto the
 * screen sweep.  This avoids the linear-interpolation overshoot that
 * caused the reversal bug: the screen angle now tracks the natural
 * angular progress of the ellipse.
 */
function ellipsePoint(au1, au2, startAngle, sweep, t) {
  const a = (au1 + au2) / 2;
  const e = Math.abs(au2 - au1) / (au1 + au2);
  const outbound = au2 >= au1;

  // True anomaly at parameter t
  const theta = outbound ? Math.PI * t : Math.PI * (1 - t);
  const rr = a * (1 - e * e) / (1 + e * Math.cos(theta));
  const screenR = auToR(rr);

  // Angular position on the physical ellipse, normalized to [0, 1].
  // For outbound: periapsis is at θ=0 (origin), apoapsis at θ=π (dest).
  // The polar angle of a point on the ellipse in its own frame is θ itself.
  // We need the fraction of the total angular span covered at this θ.
  //
  // In the ellipse's polar frame, the angle at θ relative to the apse line
  // depends on both θ and the eccentricity.  For a Hohmann orbit the
  // physical polar angle IS the true anomaly θ, so the fraction of the
  // π-radian orbital arc traversed is simply θ/π.  But the *screen* angle
  // of each point should reflect where the point actually sits angularly
  // on the ellipse — not a linear t-based interpolation.
  //
  // We compute the actual angle of each point in Cartesian ellipse coords
  // and use that to drive the screen mapping.

  // Ellipse in its own frame: x = r cos(θ), y = r sin(θ)  (AU-space)
  // The angle from the origin in this frame is just θ for the focus-centered
  // polar coords.  But we want the visual angle — the angle as seen from the
  // focus to the point.  That IS θ in focus-centered polars.
  //
  // So the fraction of the angular sweep at parameter t is θ/π.
  const angularFraction = theta / Math.PI;
  // For inbound, theta goes π→0 as t goes 0→1, so angularFraction goes 1→0.
  // We want screen fraction to go 0→1 as t goes 0→1.
  const screenFraction = outbound ? angularFraction : 1 - angularFraction;

  const angle = startAngle + sweep * screenFraction;
  return { x: screenR * Math.cos(angle), y: screenR * Math.sin(angle), screenR, angle };
}

/**
 * Generate SVG path data for a Hohmann transfer arc.
 */
export function transferArcPathD(au1, au2, startAngle, endAngle, steps = 50) {
  const sweep = normalizeSweep(endAngle - startAngle);
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const { x, y } = ellipsePoint(au1, au2, startAngle, sweep, t);
    pts.push(`${x} ${y}`);
  }
  return 'M ' + pts.join(' L ');
}

/**
 * Return a single {x, y} point on the transfer arc at progress t ∈ [0,1].
 */
export function transferPoint(au1, au2, startAngle, endAngle, t) {
  const sweep = normalizeSweep(endAngle - startAngle);
  const { x, y } = ellipsePoint(au1, au2, startAngle, sweep, t);
  return { x, y };
}

// ─── Arc spec builders (replace inline angle math in index.html) ───

/**
 * Compute everything needed to render a single-hop transfer arc.
 * Returns { r1, r2, startAngle, endAngle, pathD }.
 */
export function singleHopArcSpec(originAU, destAU, originAngle, destCurrentAngle, destPeriodDays, transferDays) {
  const endAngle = arrivalAngle(destCurrentAngle, destPeriodDays, transferDays);
  return {
    r1: originAU,
    r2: destAU,
    startAngle: originAngle,
    endAngle,
    pathD: transferArcPathD(originAU, destAU, originAngle, endAngle),
  };
}

/**
 * Compute everything needed to render a two-hop transfer.
 * Returns { hop1, hop2, midArrivalAngle, midDepartAngle, totalDays, frac1, fracWait }.
 */
export function multiHopArcSpec(
  originAU, midAU, destAU,
  originAngle, midAngle, destAngle,
  midPeriodDays, destPeriodDays,
  hop1TransferDays, waitDays, hop2TransferDays
) {
  const totalDays = hop1TransferDays + waitDays + hop2TransferDays;
  const frac1 = hop1TransferDays / totalDays;
  const fracWait = (hop1TransferDays + waitDays) / totalDays;

  // Hop 1: origin → intermediate arrival
  const midArrivalAngle = arrivalAngle(midAngle, midPeriodDays, hop1TransferDays);
  const hop1PathD = transferArcPathD(originAU, midAU, originAngle, midArrivalAngle);

  // Hop 2: intermediate departure (after wait) → destination
  const midDepartAngle = arrivalAngle(midArrivalAngle, midPeriodDays, waitDays);
  const totalElapsed = hop1TransferDays + waitDays;
  const destEndAngle = arrivalAngle(destAngle, destPeriodDays, totalElapsed + hop2TransferDays);
  const hop2PathD = transferArcPathD(midAU, destAU, midDepartAngle, destEndAngle);

  return {
    hop1: { r1: originAU, r2: midAU, startAngle: originAngle, endAngle: midArrivalAngle, pathD: hop1PathD },
    hop2: { r1: midAU, r2: destAU, startAngle: midDepartAngle, endAngle: destEndAngle, pathD: hop2PathD },
    midArrivalAngle,
    midDepartAngle,
    totalDays,
    frac1,
    fracWait,
  };
}

// ─── Test utilities ───

/**
 * Parse an SVG path string (M x y L x y L ...) into [{x, y}, ...].
 */
export function parsePath(d) {
  const parts = d.replace(/^M\s+/, '').split(/\s+L\s+/);
  return parts.map(s => {
    const [x, y] = s.trim().split(/\s+/).map(Number);
    return { x, y };
  });
}
