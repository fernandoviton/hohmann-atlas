// ─── Launch window cache: load and query precomputed data ───

let _cache = null;
let _planets = null;

function _expandWindow(w) {
  return {
    launch: w.l,
    transfer_time_days: w.tt,
    departure_dv_km_s: w.dd,
    arrival_dv_km_s: w.ad,
    delta_v_total_km_s: w.dv,
  };
}

/**
 * Load the window cache. In browser, fetches from data/windows.json.
 * For testing, pass data directly via initCache().
 */
export async function loadCache() {
  if (_cache) return _cache;
  const resp = await fetch('data/windows.json');
  const raw = await resp.json();
  _cache = _parseRawCache(raw);
  return _cache;
}

/**
 * Initialize cache from raw JSON data (for testing or preloading).
 */
export function initCache(raw) {
  _cache = _parseRawCache(raw);
  return _cache;
}

function _parseRawCache(raw) {
  return {
    generated: raw.gen,
    range: raw.range,
    windows: Object.fromEntries(
      Object.entries(raw.w).map(([key, windows]) => [
        key,
        windows.map(_expandWindow),
      ])
    ),
  };
}

/**
 * Load planets list. In browser, fetches from data/planets.json.
 * For testing, pass data directly via initPlanets().
 */
export async function loadPlanets() {
  if (_planets) return _planets;
  const resp = await fetch('data/planets.json');
  _planets = await resp.json();
  return _planets;
}

/**
 * Get the already-loaded planets list (synchronous).
 * Call loadPlanets() or initPlanets() first.
 */
export function getPlanets() {
  if (!_planets) throw new Error('Planets not loaded');
  return _planets;
}

/**
 * Initialize planets from data (for testing or preloading).
 */
export function initPlanets(data) {
  _planets = data;
  return _planets;
}

/**
 * Return the [start, end] ISO date strings the cache covers.
 */
export function cacheDateRange() {
  if (!_cache) throw new Error('Cache not loaded');
  return [_cache.range[0], _cache.range[1]];
}

/**
 * Find the first cached window for origin->destination on or after afterIso.
 * Binary search on launch dates (ISO strings sort lexicographically).
 */
export function lookupWindow(origin, destination, afterIso) {
  if (!_cache) throw new Error('Cache not loaded');
  const key = `${origin.toLowerCase()}->${destination.toLowerCase()}`;
  const windows = _cache.windows[key];
  if (!windows || windows.length === 0) return null;

  // bisect_left equivalent
  let lo = 0, hi = windows.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (windows[mid].launch < afterIso) lo = mid + 1;
    else hi = mid;
  }

  if (lo < windows.length) return windows[lo];
  return null;
}

/**
 * Promise that resolves when both cache and planets are loaded.
 */
export async function ready() {
  await Promise.all([loadCache(), loadPlanets()]);
}

/**
 * Reset internal state (for testing).
 */
export function _reset() {
  _cache = null;
  _planets = null;
}
