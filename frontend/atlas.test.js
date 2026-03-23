import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  createState, selectedIdx, selectByIdx, clearSelection,
  setMode, setOrigin, setTransfers, setTourData, setPlanets,
  setPositions, setTourDate, setTourDepth, startPlaying, stopPlaying,
  validateAndClampDate, dvColor, dvColorHex, formatTime, auToR,
  getArcItems, getPlaybackData, transferArcPathD, transferPoint, normalizeSweep,
  setHoveredIdx, clearHoveredIdx, toggleTourExpand,
  selectChild, getSelectedHops,
  CACHE_MIN, CACHE_MAX,
} from './atlas.js';

// ─── Test fixtures ───

const PLANETS = [
  { name: 'Earth', semi_major_axis_au: 1.0, orbital_period_days: 365.25 },
  { name: 'Mars', semi_major_axis_au: 1.524, orbital_period_days: 687.0 },
  { name: 'Venus', semi_major_axis_au: 0.723, orbital_period_days: 224.7 },
];

const TRANSFERS = [
  { destination: 'Mars', departure_dv_km_s: 2.94, arrival_dv_km_s: 2.65, delta_v_total_km_s: 5.59, transfer_time_days: 259, synodic_period_days: 779.9 },
  { destination: 'Venus', departure_dv_km_s: 2.49, arrival_dv_km_s: 2.71, delta_v_total_km_s: 5.20, transfer_time_days: 146, synodic_period_days: 583.9 },
];

const TOUR_DATA = {
  origin: 'Earth',
  start_date: '2026-06-01',
  options: [
    {
      window: { origin: 'Earth', destination: 'Mars', launch_date: '2026-09-15', arrival_date: '2027-06-01', transfer_time_days: 259, departure_dv_km_s: 2.94, arrival_dv_km_s: 2.65, delta_v_total_km_s: 5.59 },
      wait_time_days: 106,
      next_options: [
        {
          window: { origin: 'Mars', destination: 'Venus', launch_date: '2027-08-01', arrival_date: '2028-01-01', transfer_time_days: 153, departure_dv_km_s: 3.0, arrival_dv_km_s: 3.0, delta_v_total_km_s: 6.0 },
          wait_time_days: 61,
          next_options: [],
        }
      ],
    },
    {
      window: { origin: 'Earth', destination: 'Venus', launch_date: '2026-08-01', arrival_date: '2026-12-25', transfer_time_days: 146, departure_dv_km_s: 2.49, arrival_dv_km_s: 2.71, delta_v_total_km_s: 5.20 },
      wait_time_days: 61,
      next_options: [],
    },
  ],
};

// ─── createState ───

describe('createState', () => {
  it('returns fresh default state', () => {
    const s = createState();
    assert.equal(s.mode, 'transfer');
    assert.equal(s.origin, null);
    assert.equal(s.selectedDest, null);
    assert.equal(s.playing, false);
    assert.deepEqual(s.planets, []);
    assert.deepEqual(s.transfers, []);
    assert.equal(s.tourData, null);
    assert.equal(s.hoveredIdx, -1);
    assert.deepEqual(s.expandedTourParents, new Set());
  });

  it('returns independent instances', () => {
    const a = createState();
    const b = createState();
    a.origin = 'Earth';
    assert.equal(b.origin, null);
  });
});

// ─── selectedIdx ───

describe('selectedIdx', () => {
  it('returns -1 when no selection', () => {
    const s = createState();
    assert.equal(selectedIdx(s), -1);
  });

  it('finds index in transfer mode', () => {
    const s = createState();
    s.transfers = TRANSFERS;
    s.selectedDest = 'Venus';
    assert.equal(selectedIdx(s), 1);
  });

  it('finds index in tour mode', () => {
    const s = createState();
    s.mode = 'tour';
    s.tourData = TOUR_DATA;
    s.selectedDest = 'Venus';
    assert.equal(selectedIdx(s), 1);
  });

  it('returns -1 for unknown dest', () => {
    const s = createState();
    s.transfers = TRANSFERS;
    s.selectedDest = 'Jupiter';
    assert.equal(selectedIdx(s), -1);
  });

  it('returns -1 in tour mode with no tourData', () => {
    const s = createState();
    s.mode = 'tour';
    s.selectedDest = 'Mars';
    assert.equal(selectedIdx(s), -1);
  });
});

// ─── selectByIdx ───

describe('selectByIdx', () => {
  it('selects a transfer by index', () => {
    const s = createState();
    s.transfers = TRANSFERS;
    selectByIdx(s, 0);
    assert.equal(s.selectedDest, 'Mars');
    assert.equal(selectedIdx(s), 0);
  });

  it('selects a tour option by index', () => {
    const s = createState();
    s.mode = 'tour';
    s.tourData = TOUR_DATA;
    selectByIdx(s, 1);
    assert.equal(s.selectedDest, 'Venus');
  });

  it('toggles off when clicking same index', () => {
    const s = createState();
    s.transfers = TRANSFERS;
    selectByIdx(s, 0);
    assert.equal(s.selectedDest, 'Mars');
    selectByIdx(s, 0);
    assert.equal(s.selectedDest, null);
  });

  it('switches selection to different index', () => {
    const s = createState();
    s.transfers = TRANSFERS;
    selectByIdx(s, 0);
    assert.equal(s.selectedDest, 'Mars');
    selectByIdx(s, 1);
    assert.equal(s.selectedDest, 'Venus');
  });

  it('stops playing on select', () => {
    const s = createState();
    s.transfers = TRANSFERS;
    s.playing = true;
    selectByIdx(s, 0);
    assert.equal(s.playing, false);
  });

  it('handles out-of-bounds index gracefully', () => {
    const s = createState();
    s.transfers = TRANSFERS;
    selectByIdx(s, 99);
    assert.equal(s.selectedDest, null);
  });
});

// ─── clearSelection ───

describe('clearSelection', () => {
  it('clears selectedDest', () => {
    const s = createState();
    s.selectedDest = 'Mars';
    clearSelection(s);
    assert.equal(s.selectedDest, null);
  });

  it('stops playing', () => {
    const s = createState();
    s.playing = true;
    clearSelection(s);
    assert.equal(s.playing, false);
  });
});

// ─── setMode ───

describe('setMode', () => {
  it('switches to tour mode, clears transfer data', () => {
    const s = createState();
    s.transfers = TRANSFERS;
    s.selectedDest = 'Mars';
    setMode(s, 'tour');
    assert.equal(s.mode, 'tour');
    assert.deepEqual(s.transfers, []);
    assert.equal(s.selectedDest, null);
  });

  it('switches to transfer mode, clears tour data', () => {
    const s = createState();
    s.mode = 'tour';
    s.tourData = TOUR_DATA;
    s.selectedDest = 'Mars';
    setMode(s, 'transfer');
    assert.equal(s.mode, 'transfer');
    assert.equal(s.tourData, null);
    assert.equal(s.selectedDest, null);
  });

  it('stops playing', () => {
    const s = createState();
    s.playing = true;
    setMode(s, 'tour');
    assert.equal(s.playing, false);
  });
});

// ─── setOrigin ───

describe('setOrigin', () => {
  it('sets origin and clears selection', () => {
    const s = createState();
    s.selectedDest = 'Mars';
    setOrigin(s, 'Earth');
    assert.equal(s.origin, 'Earth');
    assert.equal(s.selectedDest, null);
  });

  it('converts empty string to null', () => {
    const s = createState();
    setOrigin(s, '');
    assert.equal(s.origin, null);
  });

  it('stops playing', () => {
    const s = createState();
    s.playing = true;
    setOrigin(s, 'Mars');
    assert.equal(s.playing, false);
  });
});

// ─── Data setters ───

describe('data setters', () => {
  it('setTransfers', () => {
    const s = createState();
    setTransfers(s, TRANSFERS);
    assert.equal(s.transfers.length, 2);
  });

  it('setTourData', () => {
    const s = createState();
    setTourData(s, TOUR_DATA);
    assert.equal(s.tourData.origin, 'Earth');
  });

  it('setTourData resets expandedTourParents', () => {
    const s = createState();
    s.expandedTourParents.add(0);
    s.expandedTourParents.add(1);
    setTourData(s, TOUR_DATA);
    assert.deepEqual(s.expandedTourParents, new Set());
  });

  it('setPlanets', () => {
    const s = createState();
    setPlanets(s, PLANETS);
    assert.equal(s.planets.length, 3);
  });

  it('setPositions builds lookup', () => {
    const s = createState();
    setPositions(s, [{ name: 'Earth', longitude_rad: 1.5 }, { name: 'Mars', longitude_rad: 3.0 }]);
    assert.equal(s.positions['Earth'], 1.5);
    assert.equal(s.positions['Mars'], 3.0);
  });

  it('setTourDate', () => {
    const s = createState();
    setTourDate(s, '2027-01-01');
    assert.equal(s.tourDate, '2027-01-01');
  });

  it('setTourDepth', () => {
    const s = createState();
    setTourDepth(s, 1);
    assert.equal(s.tourDepth, 1);
  });
});

// ─── Playing ───

describe('startPlaying / stopPlaying', () => {
  it('starts playing when selection exists', () => {
    const s = createState();
    s.transfers = TRANSFERS;
    s.selectedDest = 'Mars';
    assert.equal(startPlaying(s), true);
    assert.equal(s.playing, true);
  });

  it('refuses to play without selection', () => {
    const s = createState();
    assert.equal(startPlaying(s), false);
    assert.equal(s.playing, false);
  });

  it('stops playing', () => {
    const s = createState();
    s.playing = true;
    stopPlaying(s);
    assert.equal(s.playing, false);
  });

  it('selectedIdx remains valid while playing', () => {
    const s = createState();
    s.transfers = TRANSFERS;
    s.selectedDest = 'Mars';
    startPlaying(s);
    assert.equal(s.playing, true);
    assert.equal(selectedIdx(s), 0);
  });

  it('getPlaybackData available while playing', () => {
    const s = createState();
    s.transfers = TRANSFERS;
    s.origin = 'Earth';
    s.selectedDest = 'Venus';
    startPlaying(s);
    const d = getPlaybackData(s);
    assert.equal(d.originName, 'Earth');
    assert.equal(d.destName, 'Venus');
    assert.equal(d.transferDays, 146);
  });
});

// ─── Selection survives data reload ───

describe('selection survives data reload', () => {
  it('selectedIdx finds same dest after tour data reload', () => {
    const s = createState();
    s.mode = 'tour';
    s.tourData = TOUR_DATA;
    selectByIdx(s, 0);
    assert.equal(s.selectedDest, 'Mars');

    // Simulate reload: new tourData with same destinations
    const newTourData = structuredClone(TOUR_DATA);
    newTourData.start_date = '2026-09-15';
    setTourData(s, newTourData);

    // Selection persists by name
    assert.equal(s.selectedDest, 'Mars');
    assert.equal(selectedIdx(s), 0);
  });

  it('selectedIdx returns -1 if dest no longer in new data', () => {
    const s = createState();
    s.mode = 'tour';
    s.tourData = TOUR_DATA;
    selectByIdx(s, 0);
    assert.equal(s.selectedDest, 'Mars');

    // New data without Mars
    setTourData(s, {
      origin: 'Earth',
      start_date: '2026-09-15',
      options: [TOUR_DATA.options[1]], // only Venus
    });

    assert.equal(s.selectedDest, 'Mars'); // name still set
    assert.equal(selectedIdx(s), -1);     // but not found in options
  });
});

// ─── Helpers ───

describe('dvColor', () => {
  it('green for low dv', () => assert.equal(dvColor(4), 'green'));
  it('yellow for medium dv', () => assert.equal(dvColor(8), 'yellow'));
  it('red for high dv', () => assert.equal(dvColor(12), 'red'));
  it('boundary at 6', () => assert.equal(dvColor(6), 'yellow'));
  it('boundary at 10', () => assert.equal(dvColor(10), 'red'));
});

describe('dvColorHex', () => {
  it('green hex', () => assert.equal(dvColorHex(4), '#2ecc71'));
  it('yellow hex', () => assert.equal(dvColorHex(8), '#f1c40f'));
  it('red hex', () => assert.equal(dvColorHex(12), '#e74c3c'));
});

describe('formatTime', () => {
  it('formats days', () => assert.equal(formatTime(100), '100 d'));
  it('formats years', () => assert.equal(formatTime(730), '2.0 yr'));
  it('boundary at 365.25', () => assert.equal(formatTime(365), '365 d'));
  it('just over a year', () => assert.equal(formatTime(400), '1.1 yr'));
});

describe('auToR', () => {
  it('returns number for Earth', () => {
    const r = auToR(1.0);
    assert.equal(typeof r, 'number');
    assert.ok(r > 8 && r < 90);
  });

  it('monotonically increasing', () => {
    assert.ok(auToR(0.5) < auToR(1.0));
    assert.ok(auToR(1.0) < auToR(5.0));
    assert.ok(auToR(5.0) < auToR(30.0));
  });
});

// ─── validateAndClampDate ───

describe('validateAndClampDate', () => {
  it('passes valid date through', () => {
    assert.equal(validateAndClampDate('2026-06-01'), '2026-06-01');
  });

  it('clamps below CACHE_MIN', () => {
    assert.equal(validateAndClampDate('2020-01-01'), CACHE_MIN);
  });

  it('clamps above CACHE_MAX', () => {
    assert.equal(validateAndClampDate('2300-01-01'), CACHE_MAX);
  });

  it('replaces empty string with today', () => {
    const result = validateAndClampDate('');
    assert.match(result, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(result >= CACHE_MIN);
  });

  it('replaces invalid date with today', () => {
    const result = validateAndClampDate('not-a-date');
    assert.match(result, /^\d{4}-\d{2}-\d{2}$/);
  });
});

// ─── getArcItems ───

describe('getArcItems', () => {
  it('returns transfer arcs in transfer mode', () => {
    const s = createState();
    s.transfers = TRANSFERS;
    const items = getArcItems(s);
    assert.equal(items.length, 2);
    assert.equal(items[0].dest, 'Mars');
    assert.equal(items[0].dv, 5.59);
    assert.equal(items[0].transferDays, 259);
  });

  it('returns tour arcs in tour mode', () => {
    const s = createState();
    s.mode = 'tour';
    s.tourData = TOUR_DATA;
    const items = getArcItems(s);
    assert.equal(items.length, 2);
    assert.equal(items[0].dest, 'Mars');
  });

  it('returns empty when no data', () => {
    const s = createState();
    assert.deepEqual(getArcItems(s), []);
  });
});

// ─── getPlaybackData ───

describe('getPlaybackData', () => {
  it('returns null without selection', () => {
    const s = createState();
    assert.equal(getPlaybackData(s), null);
  });

  it('returns transfer playback data', () => {
    const s = createState();
    s.transfers = TRANSFERS;
    s.selectedDest = 'Mars';
    s.origin = 'Earth';
    const d = getPlaybackData(s);
    assert.equal(d.originName, 'Earth');
    assert.equal(d.destName, 'Mars');
    assert.equal(d.transferDays, 259);
  });

  it('returns tour playback data', () => {
    const s = createState();
    s.mode = 'tour';
    s.tourData = TOUR_DATA;
    s.selectedDest = 'Venus';
    s.origin = 'Earth';
    const d = getPlaybackData(s);
    assert.equal(d.destName, 'Venus');
    assert.equal(d.transferDays, 146);
  });
});

// ─── selectByIdx sets tourDate in tour mode ───

describe('selectByIdx tour date', () => {
  it('sets tourDate to launch date when selecting tour row', () => {
    const s = createState();
    s.mode = 'tour';
    s.tourData = TOUR_DATA;
    selectByIdx(s, 0);
    assert.equal(s.selectedDest, 'Mars');
    assert.equal(s.tourDate, '2026-09-15');
  });

  it('sets tourDate for each row selected', () => {
    const s = createState();
    s.mode = 'tour';
    s.tourData = TOUR_DATA;
    selectByIdx(s, 1);
    assert.equal(s.selectedDest, 'Venus');
    assert.equal(s.tourDate, '2026-08-01');
  });

  it('does not change tourDate in transfer mode', () => {
    const s = createState();
    s.transfers = TRANSFERS;
    s.tourDate = '2026-06-01';
    selectByIdx(s, 0);
    assert.equal(s.tourDate, '2026-06-01');
  });

  it('stops playing and sets date during playback', () => {
    const s = createState();
    s.mode = 'tour';
    s.tourData = TOUR_DATA;
    selectByIdx(s, 0);
    startPlaying(s);
    assert.equal(s.playing, true);
    selectByIdx(s, 1);
    assert.equal(s.playing, false);
    assert.equal(s.selectedDest, 'Venus');
    assert.equal(s.tourDate, '2026-08-01');
  });

  it('preserves tourDate when toggling off', () => {
    const s = createState();
    s.mode = 'tour';
    s.tourData = TOUR_DATA;
    selectByIdx(s, 0);
    assert.equal(s.tourDate, '2026-09-15');
    selectByIdx(s, 0);
    assert.equal(s.selectedDest, null);
    assert.equal(s.tourDate, '2026-09-15');
  });

  it('returns tourDateChanged true when date changes', () => {
    const s = createState();
    s.mode = 'tour';
    s.tourData = TOUR_DATA;
    const result = selectByIdx(s, 0);
    assert.equal(result.tourDateChanged, true);
  });

  it('returns tourDateChanged false when toggling off', () => {
    const s = createState();
    s.mode = 'tour';
    s.tourData = TOUR_DATA;
    selectByIdx(s, 0);
    const result = selectByIdx(s, 0);
    assert.equal(result.tourDateChanged, false);
  });

  it('returns tourDateChanged false in transfer mode', () => {
    const s = createState();
    s.transfers = TRANSFERS;
    const result = selectByIdx(s, 0);
    assert.equal(result.tourDateChanged, false);
  });
});

// ─── Integration: full user flow ───

describe('integration: transfer flow', () => {
  it('select origin → load transfers → select row → clear', () => {
    const s = createState();
    setPlanets(s, PLANETS);

    setOrigin(s, 'Earth');
    assert.equal(s.origin, 'Earth');

    setTransfers(s, TRANSFERS);
    assert.equal(selectedIdx(s), -1);

    selectByIdx(s, 0);
    assert.equal(s.selectedDest, 'Mars');
    assert.equal(selectedIdx(s), 0);

    clearSelection(s);
    assert.equal(selectedIdx(s), -1);
  });
});

describe('integration: tour flow', () => {
  it('switch to tour → load data → click row → data reloads → selection persists', () => {
    const s = createState();
    setPlanets(s, PLANETS);
    setOrigin(s, 'Earth');

    setMode(s, 'tour');
    assert.equal(s.mode, 'tour');
    assert.deepEqual(s.transfers, []);

    setTourData(s, TOUR_DATA);
    selectByIdx(s, 0);
    assert.equal(s.selectedDest, 'Mars');

    // Simulate clicking row: sets date, then tour data reloads
    setTourDate(s, '2026-09-15');
    const reloaded = structuredClone(TOUR_DATA);
    reloaded.start_date = '2026-09-15';
    setTourData(s, reloaded);

    // Selection survives
    assert.equal(s.selectedDest, 'Mars');
    assert.equal(selectedIdx(s), 0);
  });

  it('play → select different row → stops playing', () => {
    const s = createState();
    s.mode = 'tour';
    s.tourData = TOUR_DATA;
    selectByIdx(s, 0);
    startPlaying(s);
    assert.equal(s.playing, true);

    selectByIdx(s, 1);
    assert.equal(s.playing, false);
    assert.equal(s.selectedDest, 'Venus');
  });
});

// ─── hoveredIdx ───

describe('setHoveredIdx / clearHoveredIdx', () => {
  it('sets hoveredIdx', () => {
    const s = createState();
    setHoveredIdx(s, 3);
    assert.equal(s.hoveredIdx, 3);
  });

  it('clears hoveredIdx to -1', () => {
    const s = createState();
    setHoveredIdx(s, 2);
    clearHoveredIdx(s);
    assert.equal(s.hoveredIdx, -1);
  });
});

// ─── expandedTourParents ───

describe('toggleTourExpand', () => {
  it('adds parent to expanded set', () => {
    const s = createState();
    toggleTourExpand(s, 0);
    assert.ok(s.expandedTourParents.has(0));
  });

  it('removes parent on second toggle', () => {
    const s = createState();
    toggleTourExpand(s, 0);
    toggleTourExpand(s, 0);
    assert.ok(!s.expandedTourParents.has(0));
  });

  it('tracks multiple parents independently', () => {
    const s = createState();
    toggleTourExpand(s, 0);
    toggleTourExpand(s, 2);
    assert.ok(s.expandedTourParents.has(0));
    assert.ok(s.expandedTourParents.has(2));
    toggleTourExpand(s, 0);
    assert.ok(!s.expandedTourParents.has(0));
    assert.ok(s.expandedTourParents.has(2));
  });
});

describe('setMode resets expandedTourParents', () => {
  it('clears expanded set on mode switch', () => {
    const s = createState();
    s.expandedTourParents.add(0);
    setMode(s, 'tour');
    assert.deepEqual(s.expandedTourParents, new Set());
  });
});

// ─── transferArcPathD ───

describe('transferArcPathD', () => {
  // Functions now take AU values and apply auToR internally
  const au1 = 1.0;   // Earth
  const au2 = 5.2;   // Jupiter
  const screenR1 = auToR(au1);
  const screenR2 = auToR(au2);

  it('starts at origin position (screen-scaled)', () => {
    const d = transferArcPathD(au1, au2, 0, Math.PI, 10);
    assert.ok(d.startsWith('M '));
    const [x, y] = d.slice(2).split(' L ')[0].split(' ').map(Number);
    // At angle 0, screen radius of 1 AU
    assert.ok(Math.abs(x - screenR1) < 0.1, `x should be ~${screenR1}, got ${x}`);
    assert.ok(Math.abs(y) < 0.1, `y should be ~0, got ${y}`);
  });

  it('ends at destination position (screen-scaled)', () => {
    const d = transferArcPathD(au1, au2, 0, Math.PI, 10);
    const segments = d.split(' L ');
    const last = segments[segments.length - 1].split(' ').map(Number);
    // At angle π, screen radius of 5.2 AU
    assert.ok(Math.abs(last[0] - (-screenR2)) < 0.1, `end x should be ~${-screenR2}, got ${last[0]}`);
    assert.ok(Math.abs(last[1]) < 0.5, `end y should be ~0, got ${last[1]}`);
  });

  it('works for inbound transfer (au2 < au1)', () => {
    const d = transferArcPathD(au2, au1, Math.PI / 2, -Math.PI / 2, 10);
    const first = d.slice(2).split(' L ')[0].split(' ').map(Number);
    // At angle π/2, screen radius of 5.2 AU
    assert.ok(Math.abs(first[0]) < 0.5, `start x should be ~0, got ${first[0]}`);
    assert.ok(Math.abs(first[1] - screenR2) < 0.1, `start y should be ~${screenR2}, got ${first[1]}`);
  });

  it('arc is not a straight line — midpoints deviate from chord', () => {
    const d = transferArcPathD(au1, au2, 0, Math.PI, 20);
    const segments = d.slice(2).split(' L ');
    const pts = segments.map(s => s.split(' ').map(Number));
    const startPt = pts[0];
    const endPt = pts[pts.length - 1];
    // Measure max perpendicular distance from chord (start→end)
    const dx = endPt[0] - startPt[0], dy = endPt[1] - startPt[1];
    const chordLen = Math.sqrt(dx * dx + dy * dy);
    let maxDev = 0;
    for (const [px, py] of pts) {
      const cross = Math.abs((px - startPt[0]) * dy - (py - startPt[1]) * dx);
      maxDev = Math.max(maxDev, cross / chordLen);
    }
    assert.ok(maxDev > 1, `arc should bulge away from chord, max deviation=${maxDev.toFixed(2)}`);
  });

  it('Mars-to-Saturn arc is curved with realistic angular span', () => {
    // Arc sweeps from startAngle to endAngle while radius follows
    // the Hohmann ellipse profile — the result should be visibly curved.
    const mars = 1.524;
    const saturn = 9.537;
    const d = transferArcPathD(mars, saturn, 0, 2.0, 40);
    const segments = d.slice(2).split(' L ');
    const pts = segments.map(s => s.split(' ').map(Number));
    const startPt = pts[0];
    const endPt = pts[pts.length - 1];
    const dx = endPt[0] - startPt[0], dy = endPt[1] - startPt[1];
    const chordLen = Math.sqrt(dx * dx + dy * dy);
    let maxDev = 0;
    for (const [px, py] of pts) {
      const cross = Math.abs((px - startPt[0]) * dy - (py - startPt[1]) * dx);
      maxDev = Math.max(maxDev, cross / chordLen);
    }
    assert.ok(maxDev > 5,
      `Mars→Saturn arc should be curved, max deviation=${maxDev.toFixed(2)}`);
  });

  it('Mars→Jupiter arc is curved even with small angular distance', () => {
    // When planets are close on the diagram (small angular span), the arc
    // must still bulge visibly — not collapse into a radial straight line.
    const mars = 1.524;
    const jupiter = 5.203;
    const d = transferArcPathD(mars, jupiter, 0, -0.3, 40);
    const segments = d.slice(2).split(' L ');
    const pts = segments.map(s => s.split(' ').map(Number));
    const startPt = pts[0];
    const endPt = pts[pts.length - 1];
    const dx = endPt[0] - startPt[0], dy = endPt[1] - startPt[1];
    const chordLen = Math.sqrt(dx * dx + dy * dy);
    let maxDev = 0;
    for (const [px, py] of pts) {
      const cross = Math.abs((px - startPt[0]) * dy - (py - startPt[1]) * dx);
      maxDev = Math.max(maxDev, cross / chordLen);
    }
    assert.ok(maxDev > 5,
      `Mars→Jupiter arc with small angular span should be curved, max deviation=${maxDev.toFixed(2)}`);
  });

  it('all midpoints stay between origin and destination screen radii', () => {
    const d = transferArcPathD(au1, au2, 0, Math.PI, 20);
    const segments = d.slice(2).split(' L ');
    const pts = segments.map(s => s.split(' ').map(Number));
    for (let i = 1; i < pts.length - 1; i++) {
      const r = Math.sqrt(pts[i][0] ** 2 + pts[i][1] ** 2);
      assert.ok(r >= screenR1 - 0.1 && r <= screenR2 + 0.1,
        `point ${i} radius ${r.toFixed(2)} should be between ${screenR1.toFixed(2)} and ${screenR2.toFixed(2)}`);
    }
  });

  it('start and end points lie on their respective orbital circles', () => {
    const d = transferArcPathD(au1, au2, 0.7, 2.3, 20);
    const segments = d.slice(2).split(' L ');
    const pts = segments.map(s => s.split(' ').map(Number));
    const startR = Math.sqrt(pts[0][0] ** 2 + pts[0][1] ** 2);
    const endR = Math.sqrt(pts.at(-1)[0] ** 2 + pts.at(-1)[1] ** 2);
    assert.ok(Math.abs(startR - screenR1) < 0.1, `start radius ${startR.toFixed(2)} should match origin orbit ${screenR1.toFixed(2)}`);
    assert.ok(Math.abs(endR - screenR2) < 0.1, `end radius ${endR.toFixed(2)} should match dest orbit ${screenR2.toFixed(2)}`);
  });
});

// ─── transferPoint ───

describe('transferPoint', () => {
  const au1 = 1.0;
  const au2 = 5.2;
  const screenR1 = auToR(au1);
  const screenR2 = auToR(au2);

  it('returns origin position at t=0 (screen-scaled)', () => {
    const pt = transferPoint(au1, au2, 0, Math.PI, 0);
    assert.ok(Math.abs(pt.x - screenR1) < 0.1, `x should be ~${screenR1}, got ${pt.x}`);
    assert.ok(Math.abs(pt.y) < 0.1);
  });

  it('returns destination position at t=1 (screen-scaled)', () => {
    const pt = transferPoint(au1, au2, 0, Math.PI, 1);
    assert.ok(Math.abs(pt.x - (-screenR2)) < 0.1, `x should be ~${-screenR2}, got ${pt.x}`);
    assert.ok(Math.abs(pt.y) < 0.5, `y should be ~0, got ${pt.y}`);
  });

  it('midpoint radius is between screen r1 and r2', () => {
    const pt = transferPoint(au1, au2, 0, Math.PI, 0.5);
    const r = Math.sqrt(pt.x * pt.x + pt.y * pt.y);
    assert.ok(r > screenR1 && r < screenR2, `midpoint radius ${r} should be between ${screenR1} and ${screenR2}`);
  });

  it('works for inbound transfer', () => {
    const pt0 = transferPoint(au2, au1, 0, Math.PI, 0);
    assert.ok(Math.abs(pt0.x - screenR2) < 0.1, `start x should be ~${screenR2}, got ${pt0.x}`);
    const pt1 = transferPoint(au2, au1, 0, Math.PI, 1);
    assert.ok(Math.abs(pt1.x - (-screenR1)) < 0.1, `end x should be ~${-screenR1}, got ${pt1.x}`);
  });

  it('traces a smooth elliptical arc — radius changes monotonically for outbound', () => {
    // For an outbound Hohmann, radius should increase monotonically from r1 to r2
    const steps = 20;
    let prevR = 0;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const pt = transferPoint(au1, au2, 0, Math.PI, t);
      const r = Math.sqrt(pt.x ** 2 + pt.y ** 2);
      assert.ok(r >= prevR - 0.01, `radius should increase monotonically, step ${i}: ${r.toFixed(2)} < ${prevR.toFixed(2)}`);
      prevR = r;
    }
  });

  it('Mars-to-Saturn midpoint deviates from chord with realistic angular span', () => {
    const mars = 1.524;
    const saturn = 9.537;
    const pt0 = transferPoint(mars, saturn, 0, 2.0, 0);
    const pt1 = transferPoint(mars, saturn, 0, 2.0, 1);
    const ptMid = transferPoint(mars, saturn, 0, 2.0, 0.5);
    // Perpendicular distance from midpoint to chord
    const dx = pt1.x - pt0.x, dy = pt1.y - pt0.y;
    const chordLen = Math.sqrt(dx * dx + dy * dy);
    const cross = Math.abs((ptMid.x - pt0.x) * dy - (ptMid.y - pt0.y) * dx);
    const deviation = cross / chordLen;
    assert.ok(deviation > 5,
      `Mars→Saturn midpoint should deviate from chord, got ${deviation.toFixed(2)}`);
  });

  it('Mars→Jupiter midpoint deviates from chord with small angular distance', () => {
    const mars = 1.524;
    const jupiter = 5.203;
    const pt0 = transferPoint(mars, jupiter, 0, -0.3, 0);
    const pt1 = transferPoint(mars, jupiter, 0, -0.3, 1);
    const ptMid = transferPoint(mars, jupiter, 0, -0.3, 0.5);
    const dx = pt1.x - pt0.x, dy = pt1.y - pt0.y;
    const chordLen = Math.sqrt(dx * dx + dy * dy);
    const cross = Math.abs((ptMid.x - pt0.x) * dy - (ptMid.y - pt0.y) * dx);
    const deviation = cross / chordLen;
    assert.ok(deviation > 5,
      `Mars→Jupiter midpoint should deviate from chord, got ${deviation.toFixed(2)}`);
  });

  it('all points lie on the transfer ellipse (r matches Keplerian equation)', () => {
    // Verify the screen radius at each point matches auToR of the analytical Hohmann radius
    const a = (au1 + au2) / 2;
    const e = Math.abs(au2 - au1) / (au1 + au2);
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const theta = Math.PI * t;  // outbound: 0 → π
      const expectedAU = a * (1 - e * e) / (1 + e * Math.cos(theta));
      const expectedScreenR = auToR(expectedAU);
      const pt = transferPoint(au1, au2, 0, Math.PI, t);
      const actualScreenR = Math.sqrt(pt.x ** 2 + pt.y ** 2);
      assert.ok(Math.abs(actualScreenR - expectedScreenR) < 0.01,
        `step ${i}: screen radius ${actualScreenR.toFixed(4)} should match expected ${expectedScreenR.toFixed(4)}`);
    }
  });
});

// ─── arc endpoint lands at endAngle (not startAngle ± π) ───

describe('arc endpoint matches endAngle', () => {
  // Mars → Jupiter realistic scenario.
  // The Hohmann transfer sweeps π in orbital mechanics, but on screen the
  // arc must connect origin (at startAngle) to destination-at-arrival
  // (at endAngle). These two angles are generally NOT π apart.
  const mars_au = 1.524;
  const jupiter_au = 5.203;

  it('transferPoint(t=1) angle equals endAngle for Mars→Jupiter', () => {
    const startAngle = 0;
    const endAngle = 2.0; // NOT startAngle + π (≈3.14)

    const pt = transferPoint(mars_au, jupiter_au, startAngle, endAngle, 1);
    const actualAngle = Math.atan2(pt.y, pt.x);

    // Normalize both to [0, 2π)
    const norm = a => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const expected = norm(endAngle);
    const actual = norm(actualAngle);

    assert.ok(Math.abs(actual - expected) < 0.05,
      `endpoint angle should be ~${endAngle.toFixed(2)} rad, ` +
      `got ${actualAngle.toFixed(2)} rad ` +
      `(startAngle+π=${(startAngle + Math.PI).toFixed(2)} would be wrong)`);
  });

  it('transferArcPathD last point angle equals endAngle for Mars→Jupiter', () => {
    const startAngle = -1.5;
    const endAngle = -3.2; // different from startAngle - π (≈-4.64)

    const d = transferArcPathD(mars_au, jupiter_au, startAngle, endAngle, 50);
    const segments = d.split(' L ');
    const last = segments[segments.length - 1].split(' ').map(Number);
    const actualAngle = Math.atan2(last[1], last[0]);

    const norm = a => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const expected = norm(endAngle);
    const actual = norm(actualAngle);

    assert.ok(Math.abs(actual - expected) < 0.05,
      `arc end angle should be ~${endAngle.toFixed(2)} rad, ` +
      `got ${actualAngle.toFixed(2)} rad`);
  });

  it('transferPoint(t=0) angle still equals startAngle', () => {
    const startAngle = 0.5;
    const endAngle = 2.0;

    const pt = transferPoint(mars_au, jupiter_au, startAngle, endAngle, 0);
    const actualAngle = Math.atan2(pt.y, pt.x);

    assert.ok(Math.abs(actualAngle - startAngle) < 0.05,
      `start angle should be ~${startAngle.toFixed(2)} rad, got ${actualAngle.toFixed(2)} rad`);
  });

  it('does not spiral when endAngle is many radians from startAngle (Saturn→Mars)', () => {
    // Saturn → Mars: Mars orbits ~3.5 times during the transfer, so the
    // raw destEndAngle is ~22 radians from startAngle. The arc must NOT
    // spiral — it should sweep less than one full revolution.
    const saturn_au = 9.537;
    const steps = 100;
    const startAngle = 0;
    const endAngle = -22; // Mars arrival after ~3.5 orbits

    let totalSweep = 0;
    for (let i = 1; i <= steps; i++) {
      const pt0 = transferPoint(saturn_au, mars_au, startAngle, endAngle, (i - 1) / steps);
      const pt1 = transferPoint(saturn_au, mars_au, startAngle, endAngle, i / steps);
      const a0 = Math.atan2(pt0.y, pt0.x);
      const a1 = Math.atan2(pt1.y, pt1.x);
      let da = a1 - a0;
      if (da > Math.PI) da -= 2 * Math.PI;
      if (da < -Math.PI) da += 2 * Math.PI;
      totalSweep += da;
    }
    assert.ok(Math.abs(totalSweep) < 2 * Math.PI,
      `arc should sweep < 2π, but swept ${totalSweep.toFixed(2)} rad (${(Math.abs(totalSweep) / Math.PI).toFixed(1)}π)`);
  });

  it('endpoint still matches endAngle modulo 2π even after normalization', () => {
    const saturn_au = 9.537;
    const startAngle = 0;
    const endAngle = -22;

    const pt = transferPoint(saturn_au, mars_au, startAngle, endAngle, 1);
    const actualAngle = Math.atan2(pt.y, pt.x);

    const norm = a => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const expected = norm(endAngle);
    const actual = norm(actualAngle);

    // Allow wrapping near 0/2π boundary
    let diff = Math.abs(actual - expected);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;

    assert.ok(diff < 0.1,
      `endpoint angle mod 2π should be ~${expected.toFixed(2)}, got ${actual.toFixed(2)}`);
  });

  it('BUG: Mars→Jupiter arc loops back when angular span is small', () => {
    // When the normalized sweep is small (planets close on diagram), the
    // sinusoidal bulge overshoots — the angle goes prograde past the
    // destination, then reverses retrograde to reach the endpoint.
    // This creates a visible loop in the arc path.
    //
    // Detect the reversal: sample the angular velocity (dθ/dt) along the
    // arc.  A monotonic arc would keep the same sign throughout.  The bug
    // manifests as the sign flipping partway through.
    const startAngle = 0;
    const endAngle = -0.3;  // small prograde span
    const steps = 100;

    const angles = [];
    for (let i = 0; i <= steps; i++) {
      const pt = transferPoint(mars_au, jupiter_au, startAngle, endAngle, i / steps);
      angles.push(Math.atan2(pt.y, pt.x));
    }

    // Compute angular deltas, unwrapping ±π jumps
    const deltas = [];
    for (let i = 1; i < angles.length; i++) {
      let da = angles[i] - angles[i - 1];
      if (da > Math.PI) da -= 2 * Math.PI;
      if (da < -Math.PI) da += 2 * Math.PI;
      deltas.push(da);
    }

    const hasPrograde  = deltas.some(d => d < -0.01);  // clockwise (negative)
    const hasRetrograde = deltas.some(d => d > 0.01);   // counter-clockwise (positive)

    // The arc should move monotonically prograde (no reversal).
    assert.ok(!hasRetrograde,
      'Arc should not reverse direction — angular path should be monotonically prograde');
  });
});

// ─── selectChild ───

describe('selectChild', () => {
  it('sets selectedDest to parent destination and selectedChildIdx', () => {
    const s = createState();
    s.mode = 'tour';
    s.origin = 'Earth';
    s.tourData = TOUR_DATA;
    selectChild(s, 0, 0);
    assert.equal(s.selectedDest, 'Mars');
    assert.equal(s.selectedChildIdx, 0);
  });

  it('stops playing', () => {
    const s = createState();
    s.mode = 'tour';
    s.origin = 'Earth';
    s.tourData = TOUR_DATA;
    s.playing = true;
    selectChild(s, 0, 0);
    assert.equal(s.playing, false);
  });

  it('sets tourDate to parent launch_date', () => {
    const s = createState();
    s.mode = 'tour';
    s.origin = 'Earth';
    s.tourData = TOUR_DATA;
    selectChild(s, 0, 0);
    assert.equal(s.tourDate, '2026-09-15');
  });

  it('auto-expands the parent', () => {
    const s = createState();
    s.mode = 'tour';
    s.origin = 'Earth';
    s.tourData = TOUR_DATA;
    selectChild(s, 0, 0);
    assert.ok(s.expandedTourParents.has(0));
  });

  it('does not collapse already-expanded parent', () => {
    const s = createState();
    s.mode = 'tour';
    s.origin = 'Earth';
    s.tourData = TOUR_DATA;
    s.expandedTourParents = new Set([0]);
    selectChild(s, 0, 0);
    assert.ok(s.expandedTourParents.has(0));
  });

  it('selectByIdx clears selectedChildIdx', () => {
    const s = createState();
    s.mode = 'tour';
    s.origin = 'Earth';
    s.tourData = TOUR_DATA;
    selectChild(s, 0, 0);
    assert.equal(s.selectedChildIdx, 0);
    selectByIdx(s, 1);
    assert.equal(s.selectedChildIdx, null);
  });

  it('clearSelection clears selectedChildIdx', () => {
    const s = createState();
    s.mode = 'tour';
    s.origin = 'Earth';
    s.tourData = TOUR_DATA;
    selectChild(s, 0, 0);
    clearSelection(s);
    assert.equal(s.selectedChildIdx, null);
  });

  it('setMode clears selectedChildIdx', () => {
    const s = createState();
    s.mode = 'tour';
    s.origin = 'Earth';
    s.tourData = TOUR_DATA;
    selectChild(s, 0, 0);
    setMode(s, 'transfer');
    assert.equal(s.selectedChildIdx, null);
  });

  it('setOrigin clears selectedChildIdx', () => {
    const s = createState();
    s.mode = 'tour';
    s.origin = 'Earth';
    s.tourData = TOUR_DATA;
    selectChild(s, 0, 0);
    setOrigin(s, 'Mars');
    assert.equal(s.selectedChildIdx, null);
  });
});

// ─── getSelectedHops ───

describe('getSelectedHops', () => {
  it('returns empty array when no child selected', () => {
    const s = createState();
    s.mode = 'tour';
    s.origin = 'Earth';
    s.tourData = TOUR_DATA;
    s.selectedDest = 'Mars';
    assert.deepEqual(getSelectedHops(s), []);
  });

  it('returns empty array in transfer mode', () => {
    const s = createState();
    s.mode = 'transfer';
    s.origin = 'Earth';
    s.transfers = TRANSFERS;
    s.selectedDest = 'Mars';
    s.selectedChildIdx = 0;
    assert.deepEqual(getSelectedHops(s), []);
  });

  it('returns 2-element array when child selected', () => {
    const s = createState();
    s.mode = 'tour';
    s.origin = 'Earth';
    s.tourData = TOUR_DATA;
    selectChild(s, 0, 0);
    const hops = getSelectedHops(s);
    assert.equal(hops.length, 2);
    assert.deepEqual(hops[0], { originName: 'Earth', destName: 'Mars', transferDays: 259, dv: 5.59, waitDaysBeforeHop: 0 });
    assert.deepEqual(hops[1], { originName: 'Mars', destName: 'Venus', transferDays: 153, dv: 6.0, waitDaysBeforeHop: 61 });
  });

  it('returns empty array for out-of-bounds childIdx', () => {
    const s = createState();
    s.mode = 'tour';
    s.origin = 'Earth';
    s.tourData = TOUR_DATA;
    s.selectedDest = 'Mars';
    s.selectedChildIdx = 99;
    assert.deepEqual(getSelectedHops(s), []);
  });
});

// ─── getPlaybackData multi-hop ───

describe('getPlaybackData multi-hop', () => {
  it('returns array of 2 hops when selectedChildIdx is set', () => {
    const s = createState();
    s.mode = 'tour';
    s.origin = 'Earth';
    s.tourData = TOUR_DATA;
    selectChild(s, 0, 0);
    const data = getPlaybackData(s);
    assert.ok(Array.isArray(data));
    assert.equal(data.length, 2);
    assert.equal(data[0].originName, 'Earth');
    assert.equal(data[0].destName, 'Mars');
    assert.equal(data[1].originName, 'Mars');
    assert.equal(data[1].destName, 'Venus');
  });

  it('returns single object when selectedChildIdx is null', () => {
    const s = createState();
    s.mode = 'tour';
    s.origin = 'Earth';
    s.tourData = TOUR_DATA;
    s.selectedDest = 'Mars';
    const data = getPlaybackData(s);
    assert.ok(!Array.isArray(data));
    assert.equal(data.destName, 'Mars');
  });
});

// ─── Integration: multi-hop flow ───

describe('integration: multi-hop flow', () => {
  it('select parent → expand → select child → getPlaybackData returns 2 hops', () => {
    const s = createState();
    s.mode = 'tour';
    s.origin = 'Earth';
    s.tourData = TOUR_DATA;
    selectByIdx(s, 0);
    toggleTourExpand(s, 0);
    selectChild(s, 0, 0);
    const data = getPlaybackData(s);
    assert.ok(Array.isArray(data));
    assert.equal(data.length, 2);
  });

  it('select child → selectByIdx on different parent → child clears', () => {
    const s = createState();
    s.mode = 'tour';
    s.origin = 'Earth';
    s.tourData = TOUR_DATA;
    selectChild(s, 0, 0);
    assert.equal(s.selectedChildIdx, 0);
    selectByIdx(s, 1);
    assert.equal(s.selectedChildIdx, null);
    assert.equal(s.selectedDest, 'Venus');
  });

  it('select child → clearSelection → both clear', () => {
    const s = createState();
    s.mode = 'tour';
    s.origin = 'Earth';
    s.tourData = TOUR_DATA;
    selectChild(s, 0, 0);
    assert.equal(s.selectedChildIdx, 0);
    assert.equal(s.selectedDest, 'Mars');
    clearSelection(s);
    assert.equal(s.selectedChildIdx, null);
    assert.equal(s.selectedDest, null);
  });
});
