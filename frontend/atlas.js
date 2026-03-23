// ─── Pure state & logic (no DOM access) ───

export const CACHE_MIN = '2025-01-01';
export const CACHE_MAX = '2199-12-31';

export function createState() {
  return {
    planets: [],
    positions: {},
    mode: 'transfer',
    origin: null,
    transfers: [],
    tourData: null,
    tourDate: '2026-06-01',
    tourDepth: 2,
    selectedDest: null,
    playing: false,
    hoveredIdx: -1,
    expandedTourParents: new Set(),
    selectedChildIdx: null,
    arrived: null,
  };
}

// ─── Derived ───

export function selectedIdx(state) {
  if (!state.selectedDest) return -1;
  if (state.mode === 'tour' && state.tourData) {
    return state.tourData.options.findIndex(o => o.window.destination === state.selectedDest);
  }
  if (state.mode === 'transfer' && state.transfers.length) {
    return state.transfers.findIndex(t => t.destination === state.selectedDest);
  }
  return -1;
}

// ─── Helpers ───

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

// ─── State mutations (return new state or mutate-in-place, caller renders) ───

export function selectChild(state, parentIdx, childIdx) {
  state.playing = false;
  state.arrived = null;
  const parent = state.tourData?.options[parentIdx];
  if (!parent) return;
  state.selectedDest = parent.window.destination;
  state.selectedChildIdx = childIdx;
  state.tourDate = parent.window.launch_date;
  state.expandedTourParents = new Set([...state.expandedTourParents, parentIdx]);
}

export function selectByIdx(state, idx) {
  state.playing = false;
  state.arrived = null;
  state.selectedChildIdx = null;
  const prevDate = state.tourDate;
  const current = selectedIdx(state);
  if (current === idx) {
    state.selectedDest = null;
  } else {
    if (state.mode === 'tour' && state.tourData) {
      const opt = state.tourData.options[idx];
      state.selectedDest = opt?.window.destination || null;
      if (opt) state.tourDate = opt.window.launch_date;
    } else if (state.mode === 'transfer') {
      state.selectedDest = state.transfers[idx]?.destination || null;
    }
  }
  return { tourDateChanged: state.tourDate !== prevDate };
}

export function clearSelection(state) {
  state.playing = false;
  state.arrived = null;
  state.selectedDest = null;
  state.selectedChildIdx = null;
}

export function setMode(state, mode) {
  state.mode = mode;
  state.playing = false;
  state.arrived = null;
  state.selectedDest = null;
  state.selectedChildIdx = null;
  state.expandedTourParents = new Set();
  if (mode === 'transfer') {
    state.tourData = null;
  } else {
    state.transfers = [];
  }
}

export function setOrigin(state, origin) {
  state.origin = origin || null;
  state.selectedDest = null;
  state.selectedChildIdx = null;
  state.playing = false;
  state.arrived = null;
}

export function setTourDate(state, date) {
  state.tourDate = date;
}

export function setTourDepth(state, depth) {
  state.tourDepth = depth;
}

export function setTransfers(state, transfers) {
  state.transfers = transfers;
}

export function setTourData(state, tourData) {
  state.tourData = tourData;
  state.expandedTourParents = new Set();
}

export function setPlanets(state, planets) {
  state.planets = planets;
}

export function setPositions(state, positions) {
  state.positions = {};
  positions.forEach(p => { state.positions[p.name] = p.longitude_rad; });
}

export function startPlaying(state) {
  if (selectedIdx(state) < 0) return false;
  state.playing = true;
  return true;
}

export function stopPlaying(state, arrivedAt, elapsedDays) {
  state.playing = false;
  state.arrived = arrivedAt ? { destName: arrivedAt, elapsedDays } : null;
}

export function setHoveredIdx(state, idx) {
  state.hoveredIdx = idx;
}

export function clearHoveredIdx(state) {
  state.hoveredIdx = -1;
}

export function toggleTourExpand(state, parentIdx) {
  const next = new Set(state.expandedTourParents);
  if (next.has(parentIdx)) next.delete(parentIdx);
  else next.add(parentIdx);
  state.expandedTourParents = next;
}

export function validateAndClampDate(dateStr) {
  let date = dateStr;
  if (!date || isNaN(new Date(date).getTime())) {
    date = new Date().toISOString().slice(0, 10);
  }
  if (date < CACHE_MIN) date = CACHE_MIN;
  if (date > CACHE_MAX) date = CACHE_MAX;
  return date;
}

// ─── Selectors for rendering ───

export function getArcItems(state) {
  if (state.mode === 'transfer') {
    return state.transfers.map(t => ({ dest: t.destination, dv: t.delta_v_total_km_s, transferDays: t.transfer_time_days }));
  }
  return (state.tourData?.options || []).map(o => ({
    dest: o.window.destination,
    dv: o.window.delta_v_total_km_s,
    transferDays: o.window.transfer_time_days,
  }));
}

// Normalize angular sweep: prograde (clockwise in SVG), then clamp
// magnitude to [π/2, 3π/2].  This prevents spirals (> 2π), straight
// lines (< π/2), and loops (non-monotonic bulge hacks).  For most
// planet configurations the sweep is naturally near -π and passes
// through unclamped; clamping only kicks in at extreme angular spans.
export function normalizeSweep(raw) {
  let s = raw % (2 * Math.PI);              // (-2π, 2π)
  if (s > 0) s -= 2 * Math.PI;              // (-2π, 0]
  if (s > -Math.PI / 2) s = -Math.PI / 2;   // min magnitude π/2
  if (s < -3 * Math.PI / 2) s = -3 * Math.PI / 2; // max magnitude 3π/2
  return s;
}

export function transferArcPathD(au1, au2, startAngle, endAngle, steps = 50) {
  const a = (au1 + au2) / 2;
  const e = Math.abs(au2 - au1) / (au1 + au2);
  const sweep = normalizeSweep(endAngle - startAngle);
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const theta = au2 >= au1 ? Math.PI * t : Math.PI * (1 - t);
    const rr = a * (1 - e * e) / (1 + e * Math.cos(theta));
    const screenR = auToR(rr);
    const angle = startAngle + sweep * t;
    pts.push(`${screenR * Math.cos(angle)} ${screenR * Math.sin(angle)}`);
  }
  return 'M ' + pts.join(' L ');
}

export function transferPoint(au1, au2, startAngle, endAngle, t) {
  const a = (au1 + au2) / 2;
  const e = Math.abs(au2 - au1) / (au1 + au2);
  const theta = au2 >= au1 ? Math.PI * t : Math.PI * (1 - t);
  const rr = a * (1 - e * e) / (1 + e * Math.cos(theta));
  const screenR = auToR(rr);
  const sweep = normalizeSweep(endAngle - startAngle);
  const angle = startAngle + sweep * t;
  return { x: screenR * Math.cos(angle), y: screenR * Math.sin(angle) };
}

export function getSelectedHops(state) {
  if (state.selectedChildIdx == null) return [];
  if (state.mode !== 'tour') return [];
  const parentIdx = selectedIdx(state);
  if (parentIdx < 0) return [];
  const parent = state.tourData?.options[parentIdx];
  if (!parent) return [];
  const child = parent.next_options[state.selectedChildIdx];
  if (!child) return [];
  return [
    { originName: state.origin, destName: parent.window.destination,
      transferDays: parent.window.transfer_time_days, dv: parent.window.delta_v_total_km_s,
      waitDaysBeforeHop: 0 },
    { originName: parent.window.destination, destName: child.window.destination,
      transferDays: child.window.transfer_time_days, dv: child.window.delta_v_total_km_s,
      waitDaysBeforeHop: child.wait_time_days },
  ];
}

export function getPlaybackData(state) {
  if (state.selectedChildIdx != null) {
    const hops = getSelectedHops(state);
    if (hops.length) return hops;
  }
  const idx = selectedIdx(state);
  if (idx < 0) return null;
  const isTransfer = state.mode === 'transfer';
  const opt = isTransfer ? state.transfers[idx] : state.tourData?.options[idx];
  if (!opt) return null;
  const w = isTransfer ? opt : opt.window;
  return {
    originName: state.origin,
    destName: w.destination,
    transferDays: w.transfer_time_days,
    dv: w.delta_v_total_km_s,
  };
}
