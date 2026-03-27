// ─── State management (no DOM access) ───

// Re-export orbit helpers so existing consumers don't break
export {
  auToR, dvColor, dvColorHex, formatTime,
  normalizeSweep, transferArcPathD, transferPoint,
  arrivalAngle, singleHopArcSpec, multiHopArcSpec, parsePath,
} from './orbit.js';

export const CACHE_MIN = '2025-01-01';
export const CACHE_MAX = '2199-12-31';

export function createState() {
  return {
    planets: [],
    positions: {},
    origin: null,
    tourData: null,
    tourDate: '2026-06-01',
    tourDepth: 1,
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
  if (state.tourData) {
    return state.tourData.options.findIndex(o => o.window.destination === state.selectedDest);
  }
  return -1;
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
    if (state.tourData) {
      const opt = state.tourData.options[idx];
      state.selectedDest = opt?.window.destination || null;
      if (opt) state.tourDate = opt.window.launch_date;
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

/**
 * Validates and clamps a date string to ensure it falls within acceptable bounds.
 *
 * If the provided date string is invalid or cannot be parsed, defaults to today's date.
 * The date is then clamped to ensure it doesn't fall below CACHE_MIN or above CACHE_MAX.
 *
 * @param {string} dateStr - The date string to validate and clamp (e.g., "2023-12-25")
 * @returns {string} - The validated and clamped date string in ISO format (YYYY-MM-DD)
 */
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
  return (state.tourData?.options || []).map(o => ({
    dest: o.window.destination,
    dv: o.window.delta_v_total_km_s,
    transferDays: o.window.transfer_time_days,
  }));
}

export function getSelectedHops(state) {
  if (state.selectedChildIdx == null) return [];
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
  const opt = state.tourData?.options[idx];
  if (!opt) return null;
  const w = opt.window;
  return {
    originName: state.origin,
    destName: w.destination,
    transferDays: w.transfer_time_days,
    dv: w.delta_v_total_km_s,
  };
}
