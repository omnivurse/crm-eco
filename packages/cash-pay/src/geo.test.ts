import { describe, expect, it } from 'vitest';
import { filterByRadius, haversineMiles, originFromSlice } from './geo';

describe('geo', () => {
  it('measures miles and keeps metro-wide rows when radius is metro', () => {
    const miles = haversineMiles(
      { latitude: 39.7392, longitude: -104.9903 },
      { latitude: 39.7319, longitude: -105.0 },
    );
    expect(miles).toBeGreaterThan(0);
    expect(miles).toBeLessThan(5);
    const rows = [
      { latitude: 39.73, longitude: -104.98, zip: '80020' },
      { latitude: 40.01, longitude: -105.27, zip: '80301' },
    ];
    const origin = originFromSlice(rows, '80020');
    expect(origin?.latitude).toBeCloseTo(39.73);
    expect(filterByRadius(rows, origin, 'metro')).toHaveLength(2);
    expect(filterByRadius(rows, origin, 10).length).toBeGreaterThanOrEqual(1);
  });
});
