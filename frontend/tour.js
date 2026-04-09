// ─── Client-side tour planner ───
// Port of backend/app/engine/tour.py, using cache data directly.

import { lookupWindow, cacheDateRange, getPlanets } from './cache.js';

/**
 * Add days to an ISO date string, return new ISO date string.
 * Uses millisecond arithmetic to match Python's TimeDelta behavior.
 */
function addDays(isoDate, days) {
  const ms = new Date(isoDate + 'T00:00:00Z').getTime() + days * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Compute days between two ISO date strings.
 */
function daysBetween(isoA, isoB) {
  const a = new Date(isoA + 'T12:00:00Z');
  const b = new Date(isoB + 'T12:00:00Z');
  return (b - a) / 86400000;
}

/**
 * Plan a multi-hop tour from origin at startDateIso.
 *
 * @param {string} origin - Starting planet name
 * @param {string} startDateIso - Earliest departure date (YYYY-MM-DD)
 * @param {number} depth - How many hops (1 = direct, 2 = one relay, etc.)
 * @returns {object} TourResponse-shaped object with origin, start_date, options[]
 */
export function planTour(origin, startDateIso, depth) {
  const [, cacheEnd] = cacheDateRange();
  if (startDateIso >= cacheEnd) {
    throw new Error(
      `Start date ${startDateIso} is beyond the cache range. Cache ends ${cacheEnd}.`
    );
  }

  const planets = getPlanets();
  const options = findOptions(origin, startDateIso, depth, planets);

  if (!options.length) {
    const [cacheStart] = cacheDateRange();
    throw new Error(
      `No launch windows found for ${origin} after ${startDateIso}. ` +
      `Cache covers ${cacheStart} to ${cacheEnd}.`
    );
  }

  return {
    origin: options[0].window.origin,
    start_date: startDateIso,
    options,
  };
}

function findOptions(origin, afterIso, depth, planets) {
  const destinations = planets.filter(
    p => p.name.toLowerCase() !== origin.toLowerCase()
  );

  const options = [];
  for (const planet of destinations) {
    const entry = lookupWindow(origin, planet.name, afterIso);
    if (!entry) continue;

    const launchDate = entry.launch;
    const transferDays = entry.transfer_time_days;
    const arrivalDate = addDays(launchDate, transferDays);
    const waitDays = daysBetween(afterIso, launchDate);

    const window = {
      origin: origin.charAt(0).toUpperCase() + origin.slice(1).toLowerCase(),
      destination: planet.name,
      launch_date: launchDate,
      arrival_date: arrivalDate,
      transfer_time_days: transferDays,
      departure_dv_km_s: entry.departure_dv_km_s,
      arrival_dv_km_s: entry.arrival_dv_km_s,
      delta_v_total_km_s: entry.delta_v_total_km_s,
    };

    let nextOptions = [];
    if (depth > 1) {
      nextOptions = findOptions(planet.name, arrivalDate, depth - 1, planets);
    }

    options.push({
      window,
      wait_time_days: Math.round(waitDays * 10000) / 10000,
      next_options: nextOptions,
    });
  }

  return options;
}
