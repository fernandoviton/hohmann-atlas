import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

import { initCache, initPlanets, lookupWindow, cacheDateRange, _reset } from './cache.js';

// Load test data
const rawCache = JSON.parse(readFileSync(resolve(__dirname, 'data/windows.json'), 'utf-8'));
const planetsData = JSON.parse(readFileSync(resolve(__dirname, 'data/planets.json'), 'utf-8'));
const windowFixtures = JSON.parse(readFileSync(resolve(__dirname, 'test-fixtures/windows.json'), 'utf-8'));
const planetFixtures = JSON.parse(readFileSync(resolve(__dirname, 'test-fixtures/planets.json'), 'utf-8'));

describe('cache', () => {
  beforeEach(() => {
    _reset();
    initCache(rawCache);
    initPlanets(planetsData);
  });

  it('cacheDateRange returns the range from the cache', () => {
    const [start, end] = cacheDateRange();
    assert.equal(start, '2025-01-01');
    assert.equal(end, '2200-01-01');
  });

  it('lookupWindow returns correct window for each fixture case', () => {
    for (const fixture of windowFixtures) {
      const result = lookupWindow(fixture.origin, fixture.destination, fixture.after);
      assert.ok(result, `No window found for ${fixture.origin}->${fixture.destination} after ${fixture.after}`);
      assert.equal(result.launch, fixture.expected.launch);
      assert.equal(result.transfer_time_days, fixture.expected.transfer_time_days);
      assert.equal(result.departure_dv_km_s, fixture.expected.departure_dv_km_s);
      assert.equal(result.arrival_dv_km_s, fixture.expected.arrival_dv_km_s);
      assert.equal(result.delta_v_total_km_s, fixture.expected.delta_v_total_km_s);
    }
  });

  it('lookupWindow returns null for date past cache range', () => {
    const result = lookupWindow('earth', 'mars', '2300-01-01');
    assert.equal(result, null);
  });

  it('lookupWindow is case-insensitive', () => {
    const result = lookupWindow('Earth', 'Mars', '2026-06-01');
    assert.ok(result);
    assert.equal(result.launch, '2026-12-04');
  });

  it('planets data matches fixture', () => {
    assert.deepStrictEqual(planetsData, planetFixtures);
  });
});
