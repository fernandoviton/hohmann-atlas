import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

import { computePositions, isoToJD } from './positions.js';

const positionFixtures = JSON.parse(readFileSync(resolve(__dirname, 'test-fixtures/positions.json'), 'utf-8'));

describe('positions', () => {
  it('isoToJD computes correct Julian Date for J2000.0', () => {
    // J2000.0 = 2000-01-01T12:00:00 = JD 2451545.0
    const jd = isoToJD('2000-01-01');
    assert.equal(jd, 2451545.0);
  });

  it('computes positions within 5 degrees of astropy for each fixture date', () => {
    const MAX_ERROR_RAD = 5 * Math.PI / 180; // 5 degrees

    for (const fixture of positionFixtures) {
      const computed = computePositions(fixture.date);

      for (const expected of fixture.positions) {
        const actual = computed.find(p => p.name === expected.name);
        assert.ok(actual, `Missing planet ${expected.name}`);

        // Angular distance (handle wraparound)
        let diff = Math.abs(actual.longitude_rad - expected.longitude_rad);
        if (diff > Math.PI) diff = 2 * Math.PI - diff;

        assert.ok(
          diff < MAX_ERROR_RAD,
          `${expected.name} on ${fixture.date}: error ${(diff * 180 / Math.PI).toFixed(1)} degrees > 5 degree tolerance ` +
          `(computed ${(actual.longitude_rad * 180 / Math.PI).toFixed(1)}, expected ${(expected.longitude_rad * 180 / Math.PI).toFixed(1)})`
        );
      }
    }
  });
});
