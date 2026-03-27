import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  auToR, dvColor, dvColorHex, formatTime,
  arrivalAngle, normalizeSweep,
  transferArcPathD, transferPoint,
  singleHopArcSpec, multiHopArcSpec,
  parsePath,
} from './orbit.js';

// ─── Planet data ───

const EARTH = { au: 1.0, period: 365.25 };
const VENUS = { au: 0.723, period: 224.7 };
const MARS  = { au: 1.524, period: 687.0 };
const JUPITER = { au: 5.203, period: 4332.59 };
const SATURN  = { au: 9.537, period: 10759.22 };

// ─── Helpers ───

function dist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function radius(pt) {
  return Math.sqrt(pt.x ** 2 + pt.y ** 2);
}

function angle(pt) {
  return Math.atan2(pt.y, pt.x);
}

function normAngle(a) {
  return ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
}

/**
 * Comprehensive path integrity checks.
 * Runs all structural assertions on a transfer arc.
 */
function assertPathIntegrity(au1, au2, startAngle, endAngle, label) {
  const steps = 100;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    pts.push(transferPoint(au1, au2, startAngle, endAngle, i / steps));
  }

  const rMin = auToR(Math.min(au1, au2));
  const rMax = auToR(Math.max(au1, au2));
  const outbound = au2 >= au1;

  // 1. Radius bounded between origin and dest orbits
  for (let i = 0; i < pts.length; i++) {
    const r = radius(pts[i]);
    assert.ok(r >= rMin - 0.5 && r <= rMax + 0.5,
      `${label}: point ${i} radius ${r.toFixed(2)} out of bounds [${rMin.toFixed(2)}, ${rMax.toFixed(2)}]`);
  }

  // 2. Monotonic radius (outbound increases, inbound decreases)
  for (let i = 1; i < pts.length; i++) {
    const rPrev = radius(pts[i - 1]);
    const rCurr = radius(pts[i]);
    if (outbound) {
      assert.ok(rCurr >= rPrev - 0.1,
        `${label}: outbound radius should increase, step ${i}: ${rCurr.toFixed(2)} < ${rPrev.toFixed(2)}`);
    } else {
      assert.ok(rCurr <= rPrev + 0.1,
        `${label}: inbound radius should decrease, step ${i}: ${rCurr.toFixed(2)} > ${rPrev.toFixed(2)}`);
    }
  }

  // 3. Monotonic angular progress (no direction reversal)
  const angles = pts.map(p => angle(p));
  const deltas = [];
  for (let i = 1; i < angles.length; i++) {
    let da = angles[i] - angles[i - 1];
    if (da > Math.PI) da -= 2 * Math.PI;
    if (da < -Math.PI) da += 2 * Math.PI;
    deltas.push(da);
  }
  // All deltas should have the same sign (or be ~0)
  const hasPositive = deltas.some(d => d > 0.01);
  const hasNegative = deltas.some(d => d < -0.01);
  assert.ok(!(hasPositive && hasNegative),
    `${label}: angular direction reversal detected — arc should be monotonic`);

  // 4. No backtracking toward start — distance from start should generally increase
  const startPt = pts[0];
  let maxDist = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = dist(startPt, pts[i]);
    // Allow small tolerance but distance should never drop below 80% of max seen
    assert.ok(d >= maxDist * 0.7 - 0.5,
      `${label}: point ${i} backtracks toward start (dist=${d.toFixed(2)}, maxSeen=${maxDist.toFixed(2)})`);
    maxDist = Math.max(maxDist, d);
  }

  // 5. Smoothness — max step distance bounded (no jumps)
  const avgStep = dist(pts[0], pts[pts.length - 1]) / steps;
  for (let i = 1; i < pts.length; i++) {
    const d = dist(pts[i - 1], pts[i]);
    assert.ok(d < avgStep * 5 + 1,
      `${label}: jump at step ${i}: ${d.toFixed(2)} >> avg ${avgStep.toFixed(2)}`);
  }

  // 6. Total angular sweep < 2π (no spirals)
  const totalSweep = deltas.reduce((sum, d) => sum + d, 0);
  assert.ok(Math.abs(totalSweep) < 2 * Math.PI,
    `${label}: total sweep ${totalSweep.toFixed(2)} rad exceeds 2π`);

  // 7. No self-intersection (check segment crossings)
  const segments = [];
  for (let i = 0; i < pts.length - 1; i++) {
    segments.push([pts[i], pts[i + 1]]);
  }
  for (let i = 2; i < segments.length; i++) {
    for (let j = 0; j < i - 1; j++) {
      assert.ok(!segmentsIntersect(segments[i], segments[j]),
        `${label}: self-intersection between segments ${j} and ${i}`);
    }
  }
}

/** Check if two line segments (each [[x1,y1],[x2,y2]]) intersect. */
function segmentsIntersect([a, b], [c, d]) {
  const cross = (o, p, q) => (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x);
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  return false;
}

// ═══════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════

// ─── auToR ───

describe('auToR', () => {
  it('maps 0.3 AU to 8', () => {
    assert.ok(Math.abs(auToR(0.3) - 8) < 0.01);
  });
  it('maps 32 AU to 90', () => {
    assert.ok(Math.abs(auToR(32) - 90) < 0.01);
  });
  it('is monotonically increasing', () => {
    assert.ok(auToR(1.0) < auToR(5.0));
    assert.ok(auToR(5.0) < auToR(10.0));
  });
});

// ─── dvColor / dvColorHex ───

describe('dvColor', () => {
  it('returns green for low dv', () => assert.equal(dvColor(4), 'green'));
  it('returns yellow for medium dv', () => assert.equal(dvColor(8), 'yellow'));
  it('returns red for high dv', () => assert.equal(dvColor(12), 'red'));
});

describe('dvColorHex', () => {
  it('returns green hex for low dv', () => assert.equal(dvColorHex(4), '#2ecc71'));
  it('returns yellow hex for medium dv', () => assert.equal(dvColorHex(8), '#f1c40f'));
  it('returns red hex for high dv', () => assert.equal(dvColorHex(12), '#e74c3c'));
});

// ─── formatTime ───

describe('formatTime', () => {
  it('formats days < 1 year', () => assert.equal(formatTime(200), '200 d'));
  it('formats days > 1 year', () => assert.equal(formatTime(730), '2.0 yr'));
});

// ─── arrivalAngle ───

describe('arrivalAngle', () => {
  it('computes arrival angle after transfer', () => {
    const angle = arrivalAngle(0, 365.25, 365.25);
    assert.ok(Math.abs(angle - (-2 * Math.PI)) < 0.01, `expected -2π, got ${angle}`);
  });
  it('half orbit', () => {
    const angle = arrivalAngle(1.0, 365.25, 365.25 / 2);
    assert.ok(Math.abs(angle - (1.0 - Math.PI)) < 0.01);
  });
});

// ─── normalizeSweep ───

describe('normalizeSweep', () => {
  it('passes through -π unchanged', () => {
    assert.ok(Math.abs(normalizeSweep(-Math.PI) - (-Math.PI)) < 0.01);
  });
  it('wraps small positive to nearly -2π', () => {
    const s = normalizeSweep(0.1);
    assert.ok(s < 0, 'should be negative (prograde)');
    // 0.1 wraps to 0.1 - 2π ≈ -6.18
    assert.ok(Math.abs(s - (0.1 - 2 * Math.PI)) < 0.01);
  });
  it('reduces huge sweep via modulo', () => {
    const s = normalizeSweep(-20);
    assert.ok(s > -2 * Math.PI && s < 0);
  });
  it('wraps positive > 2π', () => {
    const s = normalizeSweep(7);
    assert.ok(s < 0);
  });
  it('preserves endpoint accuracy for large sweeps', () => {
    // A sweep of -6.1 rad (~350°) should not be clamped
    const s = normalizeSweep(-6.1);
    assert.ok(Math.abs(s - (-6.1)) < 0.01);
  });
  it('preserves endpoint accuracy for small sweeps', () => {
    // A sweep of -0.3 rad (~17°) should not be clamped
    const s = normalizeSweep(-0.3);
    assert.ok(Math.abs(s - (-0.3)) < 0.01);
  });
});

// ─── transferArcPathD ───

describe('transferArcPathD', () => {
  const au1 = EARTH.au;
  const au2 = JUPITER.au;
  const screenR1 = auToR(au1);
  const screenR2 = auToR(au2);

  it('starts at origin position (screen-scaled)', () => {
    const d = transferArcPathD(au1, au2, 0, Math.PI, 10);
    const pts = parsePath(d);
    assert.ok(Math.abs(pts[0].x - screenR1) < 0.1, `x should be ~${screenR1}, got ${pts[0].x}`);
    assert.ok(Math.abs(pts[0].y) < 0.1, `y should be ~0, got ${pts[0].y}`);
  });

  it('ends at destination position (screen-scaled)', () => {
    const d = transferArcPathD(au1, au2, 0, Math.PI, 10);
    const pts = parsePath(d);
    const last = pts[pts.length - 1];
    assert.ok(Math.abs(last.x - (-screenR2)) < 0.5, `end x should be ~${-screenR2}, got ${last.x}`);
    assert.ok(Math.abs(last.y) < 0.5, `end y should be ~0, got ${last.y}`);
  });

  it('works for inbound transfer (au2 < au1)', () => {
    const d = transferArcPathD(au2, au1, Math.PI / 2, -Math.PI / 2, 10);
    const pts = parsePath(d);
    assert.ok(Math.abs(pts[0].x) < 0.5, `start x should be ~0, got ${pts[0].x}`);
    assert.ok(Math.abs(pts[0].y - screenR2) < 0.1, `start y should be ~${screenR2}, got ${pts[0].y}`);
  });

  it('arc is not a straight line — midpoints deviate from chord', () => {
    const d = transferArcPathD(au1, au2, 0, Math.PI, 20);
    const pts = parsePath(d);
    const startPt = pts[0], endPt = pts[pts.length - 1];
    const dx = endPt.x - startPt.x, dy = endPt.y - startPt.y;
    const chordLen = Math.sqrt(dx * dx + dy * dy);
    let maxDev = 0;
    for (const p of pts) {
      const cross = Math.abs((p.x - startPt.x) * dy - (p.y - startPt.y) * dx);
      maxDev = Math.max(maxDev, cross / chordLen);
    }
    assert.ok(maxDev > 1, `arc should bulge away from chord, max deviation=${maxDev.toFixed(2)}`);
  });

  it('Mars-to-Saturn arc is curved with realistic angular span', () => {
    const d = transferArcPathD(MARS.au, SATURN.au, 0, 2.0, 40);
    const pts = parsePath(d);
    const startPt = pts[0], endPt = pts[pts.length - 1];
    const dx = endPt.x - startPt.x, dy = endPt.y - startPt.y;
    const chordLen = Math.sqrt(dx * dx + dy * dy);
    let maxDev = 0;
    for (const p of pts) {
      const cross = Math.abs((p.x - startPt.x) * dy - (p.y - startPt.y) * dx);
      maxDev = Math.max(maxDev, cross / chordLen);
    }
    assert.ok(maxDev > 5, `Mars→Saturn arc should be curved, max deviation=${maxDev.toFixed(2)}`);
  });

  it('all midpoints stay between origin and destination screen radii', () => {
    const d = transferArcPathD(au1, au2, 0, Math.PI, 20);
    const pts = parsePath(d);
    for (let i = 1; i < pts.length - 1; i++) {
      const r = radius(pts[i]);
      assert.ok(r >= screenR1 - 0.1 && r <= screenR2 + 0.1,
        `point ${i} radius ${r.toFixed(2)} should be between ${screenR1.toFixed(2)} and ${screenR2.toFixed(2)}`);
    }
  });

  it('start and end points lie on their respective orbital circles', () => {
    const d = transferArcPathD(au1, au2, 0.7, 2.3, 20);
    const pts = parsePath(d);
    const startR = radius(pts[0]);
    const endR = radius(pts[pts.length - 1]);
    assert.ok(Math.abs(startR - screenR1) < 0.1, `start radius ${startR.toFixed(2)} should match ${screenR1.toFixed(2)}`);
    assert.ok(Math.abs(endR - screenR2) < 0.1, `end radius ${endR.toFixed(2)} should match ${screenR2.toFixed(2)}`);
  });
});

// ─── transferPoint ───

describe('transferPoint', () => {
  const au1 = EARTH.au;
  const au2 = JUPITER.au;
  const screenR1 = auToR(au1);
  const screenR2 = auToR(au2);

  it('returns origin position at t=0', () => {
    const pt = transferPoint(au1, au2, 0, Math.PI, 0);
    assert.ok(Math.abs(pt.x - screenR1) < 0.1);
    assert.ok(Math.abs(pt.y) < 0.1);
  });

  it('returns destination position at t=1', () => {
    const pt = transferPoint(au1, au2, 0, Math.PI, 1);
    assert.ok(Math.abs(pt.x - (-screenR2)) < 0.5);
    assert.ok(Math.abs(pt.y) < 0.5);
  });

  it('midpoint radius is between screen r1 and r2', () => {
    const pt = transferPoint(au1, au2, 0, Math.PI, 0.5);
    const r = radius(pt);
    assert.ok(r > screenR1 && r < screenR2);
  });

  it('works for inbound transfer', () => {
    const pt0 = transferPoint(au2, au1, 0, Math.PI, 0);
    assert.ok(Math.abs(pt0.x - screenR2) < 0.1);
    const pt1 = transferPoint(au2, au1, 0, Math.PI, 1);
    assert.ok(Math.abs(pt1.x - (-screenR1)) < 0.5);
  });

  it('outbound radius increases monotonically', () => {
    let prevR = 0;
    for (let i = 0; i <= 20; i++) {
      const pt = transferPoint(au1, au2, 0, Math.PI, i / 20);
      const r = radius(pt);
      assert.ok(r >= prevR - 0.01, `step ${i}: ${r.toFixed(2)} < ${prevR.toFixed(2)}`);
      prevR = r;
    }
  });

  it('all points lie on the transfer ellipse (r matches Keplerian equation)', () => {
    const a = (au1 + au2) / 2;
    const e = Math.abs(au2 - au1) / (au1 + au2);
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const theta = Math.PI * t;
      const expectedAU = a * (1 - e * e) / (1 + e * Math.cos(theta));
      const expectedR = auToR(expectedAU);
      const pt = transferPoint(au1, au2, 0, Math.PI, t);
      const actualR = radius(pt);
      assert.ok(Math.abs(actualR - expectedR) < 0.1,
        `step ${i}: screen radius ${actualR.toFixed(4)} should match ${expectedR.toFixed(4)}`);
    }
  });

  it('transferPoint matches transferArcPathD at same t values', () => {
    const nSteps = 20;
    const d = transferArcPathD(au1, au2, 0.5, 2.5, nSteps);
    const pathPts = parsePath(d);
    for (let i = 0; i <= nSteps; i++) {
      const pt = transferPoint(au1, au2, 0.5, 2.5, i / nSteps);
      assert.ok(Math.abs(pt.x - pathPts[i].x) < 0.01,
        `step ${i}: x mismatch ${pt.x.toFixed(4)} vs ${pathPts[i].x.toFixed(4)}`);
      assert.ok(Math.abs(pt.y - pathPts[i].y) < 0.01,
        `step ${i}: y mismatch ${pt.y.toFixed(4)} vs ${pathPts[i].y.toFixed(4)}`);
    }
  });
});

// ─── Arc endpoint matches endAngle ───

describe('arc endpoint matches endAngle', () => {
  const mars_au = MARS.au;
  const jupiter_au = JUPITER.au;
  const saturn_au = SATURN.au;

  it('transferPoint(t=1) angle equals endAngle for Mars→Jupiter', () => {
    const pt = transferPoint(mars_au, jupiter_au, 0, 2.0, 1);
    const actual = normAngle(angle(pt));
    const expected = normAngle(2.0);
    let diff = Math.abs(actual - expected);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    assert.ok(diff < 0.05, `endpoint angle should be ~2.0 rad, got ${angle(pt).toFixed(2)}`);
  });

  it('transferArcPathD last point angle equals endAngle', () => {
    const d = transferArcPathD(mars_au, jupiter_au, -1.5, -3.2, 50);
    const pts = parsePath(d);
    const last = pts[pts.length - 1];
    const actual = normAngle(angle(last));
    const expected = normAngle(-3.2);
    let diff = Math.abs(actual - expected);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    assert.ok(diff < 0.05, `arc end angle should be ~-3.2 rad, got ${angle(last).toFixed(2)}`);
  });

  it('transferPoint(t=0) angle equals startAngle', () => {
    const pt = transferPoint(mars_au, jupiter_au, 0.5, 2.0, 0);
    assert.ok(Math.abs(angle(pt) - 0.5) < 0.05);
  });

  it('does not spiral when endAngle is many radians from startAngle', () => {
    const steps = 100;
    let totalSweep = 0;
    for (let i = 1; i <= steps; i++) {
      const pt0 = transferPoint(saturn_au, mars_au, 0, -22, (i - 1) / steps);
      const pt1 = transferPoint(saturn_au, mars_au, 0, -22, i / steps);
      let da = angle(pt1) - angle(pt0);
      if (da > Math.PI) da -= 2 * Math.PI;
      if (da < -Math.PI) da += 2 * Math.PI;
      totalSweep += da;
    }
    assert.ok(Math.abs(totalSweep) < 2 * Math.PI,
      `arc should sweep < 2π, swept ${totalSweep.toFixed(2)} rad`);
  });

  it('endpoint matches endAngle modulo 2π after normalization', () => {
    const pt = transferPoint(saturn_au, mars_au, 0, -22, 1);
    const actual = normAngle(angle(pt));
    const expected = normAngle(-22);
    let diff = Math.abs(actual - expected);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    assert.ok(diff < 0.1, `endpoint angle mod 2π should be ~${expected.toFixed(2)}, got ${actual.toFixed(2)}`);
  });
});

// ─── Path integrity across planet pairs ───

describe('path integrity', () => {
  const cases = [
    { label: 'Earth→Mars (0→π)',        au1: EARTH.au, au2: MARS.au,    start: 0,    end: Math.PI },
    { label: 'Earth→Mars (1.2→-0.5)',   au1: EARTH.au, au2: MARS.au,    start: 1.2,  end: -0.5 },
    { label: 'Earth→Jupiter (0→2.0)',    au1: EARTH.au, au2: JUPITER.au, start: 0,    end: 2.0 },
    { label: 'Mars→Jupiter (0→-0.3)',    au1: MARS.au,  au2: JUPITER.au, start: 0,    end: -0.3 },
    { label: 'Mars→Saturn (0→2.0)',      au1: MARS.au,  au2: SATURN.au,  start: 0,    end: 2.0 },
    { label: 'Earth→Saturn (0.5→3.0)',   au1: EARTH.au, au2: SATURN.au,  start: 0.5,  end: 3.0 },
    { label: 'Saturn→Mars inbound',      au1: SATURN.au, au2: MARS.au,   start: 0,    end: -22 },
    { label: 'Venus→Earth inbound',      au1: VENUS.au,  au2: EARTH.au,  start: 1.0,  end: -1.0 },
    { label: 'Jupiter→Earth inbound',    au1: JUPITER.au, au2: EARTH.au, start: 0,    end: 4.0 },
    { label: 'Mars→Jupiter small span',  au1: MARS.au,  au2: JUPITER.au, start: 0,    end: -0.1 },
    { label: 'Earth→Mars nearly opposite', au1: EARTH.au, au2: MARS.au,  start: 0,    end: -3.0 },
  ];

  for (const { label, au1, au2, start, end } of cases) {
    it(label, () => {
      assertPathIntegrity(au1, au2, start, end, label);
    });
  }
});

// ─── Mars→Jupiter arc no longer loops (was known bug) ───

describe('Mars→Jupiter arc does not reverse direction', () => {
  it('angular path is monotonically prograde with small span', () => {
    const steps = 100;
    const angles = [];
    for (let i = 0; i <= steps; i++) {
      const pt = transferPoint(MARS.au, JUPITER.au, 0, -0.3, i / steps);
      angles.push(angle(pt));
    }
    const deltas = [];
    for (let i = 1; i < angles.length; i++) {
      let da = angles[i] - angles[i - 1];
      if (da > Math.PI) da -= 2 * Math.PI;
      if (da < -Math.PI) da += 2 * Math.PI;
      deltas.push(da);
    }
    const hasRetrograde = deltas.some(d => d > 0.01);
    assert.ok(!hasRetrograde,
      'Arc should not reverse direction — angular path should be monotonically prograde');
  });
});

// ─── singleHopArcSpec ───

describe('singleHopArcSpec', () => {
  it('computes correct endAngle from planet period and transfer time', () => {
    const spec = singleHopArcSpec(EARTH.au, MARS.au, 0, 1.0, MARS.period, 259);
    const expectedEnd = 1.0 - (2 * Math.PI / MARS.period) * 259;
    assert.ok(Math.abs(spec.endAngle - expectedEnd) < 0.001);
  });

  it('pathD starts at origin angle', () => {
    const spec = singleHopArcSpec(EARTH.au, MARS.au, 0.5, 1.0, MARS.period, 259);
    const pts = parsePath(spec.pathD);
    const a = angle(pts[0]);
    assert.ok(Math.abs(a - 0.5) < 0.05, `start angle should be ~0.5, got ${a.toFixed(2)}`);
  });

  it('pathD ends near endAngle', () => {
    const spec = singleHopArcSpec(EARTH.au, MARS.au, 0.5, 1.0, MARS.period, 259);
    const pts = parsePath(spec.pathD);
    const last = pts[pts.length - 1];
    const actual = normAngle(angle(last));
    const expected = normAngle(spec.endAngle);
    let diff = Math.abs(actual - expected);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    assert.ok(diff < 0.1, `end angle should match spec.endAngle`);
  });
});

// ─── multiHopArcSpec ───

describe('multiHopArcSpec', () => {
  it('computes correct timing fractions', () => {
    const spec = multiHopArcSpec(
      EARTH.au, MARS.au, JUPITER.au,
      0, 1.0, 2.0,
      MARS.period, JUPITER.period,
      259, 100, 900
    );
    const total = 259 + 100 + 900;
    assert.ok(Math.abs(spec.totalDays - total) < 0.01);
    assert.ok(Math.abs(spec.frac1 - 259 / total) < 0.001);
    assert.ok(Math.abs(spec.fracWait - (259 + 100) / total) < 0.001);
  });

  it('hop1 and hop2 have valid pathD', () => {
    const spec = multiHopArcSpec(
      EARTH.au, MARS.au, JUPITER.au,
      0, 1.0, 2.0,
      MARS.period, JUPITER.period,
      259, 100, 900
    );
    assert.ok(spec.hop1.pathD.startsWith('M '));
    assert.ok(spec.hop2.pathD.startsWith('M '));
  });

  it('midDepartAngle accounts for wait time', () => {
    const spec = multiHopArcSpec(
      EARTH.au, MARS.au, JUPITER.au,
      0, 1.0, 2.0,
      MARS.period, JUPITER.period,
      259, 100, 900
    );
    const expectedMidArr = arrivalAngle(1.0, MARS.period, 259);
    const expectedMidDep = arrivalAngle(expectedMidArr, MARS.period, 100);
    assert.ok(Math.abs(spec.midArrivalAngle - expectedMidArr) < 0.001);
    assert.ok(Math.abs(spec.midDepartAngle - expectedMidDep) < 0.001);
  });
});

// ─── Arc endpoints match planet positions ───

describe('singleHopArcSpec endpoints match planet positions', () => {
  const cases = [
    { label: 'Earth→Mars', origin: EARTH, dest: MARS, originAngle: 0.5, destAngle: 2.0, transferDays: 259 },
    { label: 'Earth→Jupiter', origin: EARTH, dest: JUPITER, originAngle: -1.0, destAngle: 1.5, transferDays: 997 },
    { label: 'Mars→Venus (inbound)', origin: MARS, dest: VENUS, originAngle: 1.2, destAngle: -0.8, transferDays: 200 },
    { label: 'Jupiter→Earth (inbound)', origin: JUPITER, dest: EARTH, originAngle: 0, destAngle: 3.0, transferDays: 997 },
    { label: 'Venus→Saturn', origin: VENUS, dest: SATURN, originAngle: 2.5, destAngle: 0.3, transferDays: 3000 },
    // Large sweep (>315°) — triggers normalizeSweep max clamp bug
    { label: 'Jupiter→Mars (large sweep)', origin: JUPITER, dest: MARS, originAngle: 0, destAngle: 3.0, transferDays: 997 },
    // Small sweep (<45°) — triggers normalizeSweep min clamp bug
    { label: 'Earth→Mars (small sweep)', origin: EARTH, dest: MARS, originAngle: 0, destAngle: 0.5, transferDays: 259 },
  ];

  for (const { label, origin, dest, originAngle, destAngle, transferDays } of cases) {
    it(`${label}: arc starts at origin planet position`, () => {
      const spec = singleHopArcSpec(origin.au, dest.au, originAngle, destAngle, dest.period, transferDays);
      const pts = parsePath(spec.pathD);
      const startPt = pts[0];
      const expectedR = auToR(origin.au);
      const actualR = radius(startPt);
      assert.ok(Math.abs(actualR - expectedR) < 0.5,
        `start radius ${actualR.toFixed(2)} should match origin orbit ${expectedR.toFixed(2)}`);
      const actualA = normAngle(angle(startPt));
      const expectedA = normAngle(originAngle);
      let diff = Math.abs(actualA - expectedA);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;
      assert.ok(diff < 0.1,
        `start angle ${actualA.toFixed(2)} should match origin angle ${expectedA.toFixed(2)}`);
    });

    it(`${label}: arc ends at destination planet position`, () => {
      const spec = singleHopArcSpec(origin.au, dest.au, originAngle, destAngle, dest.period, transferDays);
      const pts = parsePath(spec.pathD);
      const endPt = pts[pts.length - 1];
      const expectedR = auToR(dest.au);
      const actualR = radius(endPt);
      assert.ok(Math.abs(actualR - expectedR) < 0.5,
        `end radius ${actualR.toFixed(2)} should match dest orbit ${expectedR.toFixed(2)}`);
      const actualA = normAngle(angle(endPt));
      const expectedA = normAngle(spec.endAngle);
      let diff = Math.abs(actualA - expectedA);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;
      assert.ok(diff < 0.1,
        `end angle ${actualA.toFixed(2)} should match dest arrival angle ${expectedA.toFixed(2)}`);
    });
  }
});

describe('multiHopArcSpec endpoints match planet positions', () => {
  const cases = [
    {
      label: 'Earth→Mars→Jupiter',
      origin: EARTH, mid: MARS, dest: JUPITER,
      originAngle: 0, midAngle: 1.0, destAngle: 2.0,
      hop1Days: 259, waitDays: 100, hop2Days: 900,
    },
    {
      label: 'Earth→Mars→Venus',
      origin: EARTH, mid: MARS, dest: VENUS,
      originAngle: 0.5, midAngle: 2.0, destAngle: -1.0,
      hop1Days: 259, waitDays: 61, hop2Days: 153,
    },
    {
      label: 'Jupiter→Mars→Earth (inbound)',
      origin: JUPITER, mid: MARS, dest: EARTH,
      originAngle: 1.5, midAngle: -0.5, destAngle: 2.5,
      hop1Days: 997, waitDays: 200, hop2Days: 259,
    },
  ];

  for (const { label, origin, mid, dest, originAngle, midAngle, destAngle, hop1Days, waitDays, hop2Days } of cases) {
    it(`${label}: hop1 starts at origin planet`, () => {
      const spec = multiHopArcSpec(
        origin.au, mid.au, dest.au,
        originAngle, midAngle, destAngle,
        mid.period, dest.period,
        hop1Days, waitDays, hop2Days
      );
      const pts = parsePath(spec.hop1.pathD);
      const startPt = pts[0];
      const expectedR = auToR(origin.au);
      assert.ok(Math.abs(radius(startPt) - expectedR) < 0.5,
        `hop1 start radius should match origin orbit`);
      const actualA = normAngle(angle(startPt));
      const expectedA = normAngle(originAngle);
      let diff = Math.abs(actualA - expectedA);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;
      assert.ok(diff < 0.1, `hop1 start angle should match origin angle`);
    });

    it(`${label}: hop1 ends at intermediate planet arrival position`, () => {
      const spec = multiHopArcSpec(
        origin.au, mid.au, dest.au,
        originAngle, midAngle, destAngle,
        mid.period, dest.period,
        hop1Days, waitDays, hop2Days
      );
      const pts = parsePath(spec.hop1.pathD);
      const endPt = pts[pts.length - 1];
      const expectedR = auToR(mid.au);
      assert.ok(Math.abs(radius(endPt) - expectedR) < 0.5,
        `hop1 end radius should match intermediate orbit`);
      const actualA = normAngle(angle(endPt));
      const expectedA = normAngle(spec.midArrivalAngle);
      let diff = Math.abs(actualA - expectedA);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;
      assert.ok(diff < 0.1, `hop1 end angle should match intermediate arrival angle`);
    });

    it(`${label}: hop2 starts at intermediate planet departure position`, () => {
      const spec = multiHopArcSpec(
        origin.au, mid.au, dest.au,
        originAngle, midAngle, destAngle,
        mid.period, dest.period,
        hop1Days, waitDays, hop2Days
      );
      const pts = parsePath(spec.hop2.pathD);
      const startPt = pts[0];
      const expectedR = auToR(mid.au);
      assert.ok(Math.abs(radius(startPt) - expectedR) < 0.5,
        `hop2 start radius should match intermediate orbit`);
      const actualA = normAngle(angle(startPt));
      const expectedA = normAngle(spec.midDepartAngle);
      let diff = Math.abs(actualA - expectedA);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;
      assert.ok(diff < 0.1, `hop2 start angle should match intermediate departure angle`);
    });

    it(`${label}: hop2 ends at destination planet position`, () => {
      const spec = multiHopArcSpec(
        origin.au, mid.au, dest.au,
        originAngle, midAngle, destAngle,
        mid.period, dest.period,
        hop1Days, waitDays, hop2Days
      );
      const pts = parsePath(spec.hop2.pathD);
      const endPt = pts[pts.length - 1];
      const expectedR = auToR(dest.au);
      assert.ok(Math.abs(radius(endPt) - expectedR) < 0.5,
        `hop2 end radius should match destination orbit`);
      const actualA = normAngle(angle(endPt));
      const expectedA = normAngle(spec.hop2.endAngle);
      let diff = Math.abs(actualA - expectedA);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;
      assert.ok(diff < 0.1, `hop2 end angle should match destination arrival angle`);
    });
  }
});

// ─── parsePath ───

describe('parsePath', () => {
  it('parses M x y L x y format', () => {
    const pts = parsePath('M 1 2 L 3 4 L 5 6');
    assert.equal(pts.length, 3);
    assert.ok(Math.abs(pts[0].x - 1) < 0.001);
    assert.ok(Math.abs(pts[2].y - 6) < 0.001);
  });
});
