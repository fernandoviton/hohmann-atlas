import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

import { initCache, initPlanets, _reset } from './cache.js';
import { planTour } from './tour.js';

const rawCache = JSON.parse(readFileSync(resolve(__dirname, 'data/windows.json'), 'utf-8'));
const planetsData = JSON.parse(readFileSync(resolve(__dirname, 'data/planets.json'), 'utf-8'));
const tourFixtures = JSON.parse(readFileSync(resolve(__dirname, 'test-fixtures/tours.json'), 'utf-8'));

describe('tour', () => {
  beforeEach(() => {
    _reset();
    initCache(rawCache);
    initPlanets(planetsData);
  });

  for (const fixture of tourFixtures) {
    it(`planTour(${fixture.origin}, ${fixture.start_date}, depth=${fixture.depth}) matches fixture`, () => {
      const result = planTour(fixture.origin, fixture.start_date, fixture.depth);
      assert.equal(result.origin, fixture.expected.origin);
      assert.equal(result.start_date, fixture.expected.start_date);
      assert.equal(result.options.length, fixture.expected.options.length);

      for (let i = 0; i < result.options.length; i++) {
        assertOptionMatches(result.options[i], fixture.expected.options[i], `option[${i}]`);
      }
    });
  }

  it('throws for date past cache range', () => {
    assert.throws(() => planTour('Earth', '2300-01-01', 1), /beyond the cache range/);
  });
});

function assertOptionMatches(actual, expected, path) {
  const aw = actual.window;
  const ew = expected.window;

  assert.equal(aw.origin, ew.origin, `${path}.window.origin`);
  assert.equal(aw.destination, ew.destination, `${path}.window.destination`);
  assert.equal(aw.launch_date, ew.launch_date, `${path}.window.launch_date`);
  assert.equal(aw.arrival_date, ew.arrival_date, `${path}.window.arrival_date`);
  assert.equal(aw.transfer_time_days, ew.transfer_time_days, `${path}.window.transfer_time_days`);
  assert.equal(aw.departure_dv_km_s, ew.departure_dv_km_s, `${path}.window.departure_dv_km_s`);
  assert.equal(aw.arrival_dv_km_s, ew.arrival_dv_km_s, `${path}.window.arrival_dv_km_s`);
  assert.equal(aw.delta_v_total_km_s, ew.delta_v_total_km_s, `${path}.window.delta_v_total_km_s`);

  assert.equal(actual.wait_time_days, expected.wait_time_days, `${path}.wait_time_days`);
  assert.equal(actual.next_options.length, expected.next_options.length, `${path}.next_options.length`);

  for (let i = 0; i < actual.next_options.length; i++) {
    assertOptionMatches(actual.next_options[i], expected.next_options[i], `${path}.next_options[${i}]`);
  }
}
