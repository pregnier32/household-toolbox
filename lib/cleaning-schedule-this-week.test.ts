import assert from 'node:assert/strict';
import test from 'node:test';
import { thisWeekBounds, thisWeekDueDates, type CleaningFrequency } from './cleaning-schedule';

const today = '2026-11-17';
const zone = 'America/Chicago';
const onceAYear: CleaningFrequency = { kind: 'annually' };

test('This Week lists due dates inside the Sunday-start week, including 9pm Central', () => {
  assert.deepEqual(thisWeekBounds(today, zone), { start: '2026-11-15', end: '2026-11-21' });
  assert.deepEqual(thisWeekDueDates('2026-11-15', onceAYear, today, zone), ['2026-11-15']);
  assert.deepEqual(thisWeekDueDates('2026-11-21', onceAYear, today, zone), ['2026-11-21']);
  assert.deepEqual(thisWeekDueDates('2026-11-14', onceAYear, today, zone), []);
  assert.deepEqual(thisWeekDueDates('2026-11-22', onceAYear, today, zone), []);
  assert.deepEqual(thisWeekDueDates('2026-11-18T03:00:00.000Z', onceAYear, today, zone), ['2026-11-17']);
});
