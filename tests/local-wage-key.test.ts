import { it, expect } from 'vitest';
import { localWageKey, minWageFor } from '@/lib/engine/time';
it('matches local-ordinance cities written many ways', () => {
  expect(localWageKey('Los Angeles, CA')).toBe('los angeles');
  expect(localWageKey('Los Angeles, CA 90015')).toBe('los angeles');
  expect(localWageKey('City of Los Angeles')).toBe('los angeles');
  expect(localWageKey('San Francisco, California')).toBe('san francisco');
  expect(localWageKey('Remote (Riverside, CA)')).toBe('');
  expect(localWageKey('Remote (San Francisco, CA)')).toBe('san francisco');
  expect(localWageKey('Fresno, CA')).toBe('');
  expect(localWageKey('')).toBe('');
  expect(minWageFor('2026-06-05', { location: 'Los Angeles, CA' }).rate).toBe(17.87);
  expect(minWageFor('2026-06-05', { location: 'Fresno, CA' }).rate).toBe(16.9);
});
