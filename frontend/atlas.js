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

export function selectByIdx(state, idx) {
  state.playing = false;
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
  state.selectedDest = null;
}

export function setMode(state, mode) {
  state.mode = mode;
  state.playing = false;
  state.selectedDest = null;
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
  state.playing = false;
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

export function stopPlaying(state) {
  state.playing = false;
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

export function transferArcPathD(r1, r2, startAngle, endAngle, steps = 50) {
  const a = (r1 + r2) / 2;
  const e = Math.abs(r2 - r1) / (r1 + r2);
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const theta = r2 >= r1 ? Math.PI * t : Math.PI * (1 - t);
    const rr = a * (1 - e * e) / (1 + e * Math.cos(theta));
    const angle = startAngle + (endAngle - startAngle) * t;
    pts.push(`${rr * Math.cos(angle)} ${rr * Math.sin(angle)}`);
  }
  return 'M ' + pts.join(' L ');
}

export function transferPoint(r1, r2, startAngle, endAngle, t) {
  const a = (r1 + r2) / 2;
  const e = Math.abs(r2 - r1) / (r1 + r2);
  const theta = r2 >= r1 ? Math.PI * t : Math.PI * (1 - t);
  const rr = a * (1 - e * e) / (1 + e * Math.cos(theta));
  const angle = startAngle + (endAngle - startAngle) * t;
  return { x: rr * Math.cos(angle), y: rr * Math.sin(angle) };
}

export function getPlaybackData(state) {
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
