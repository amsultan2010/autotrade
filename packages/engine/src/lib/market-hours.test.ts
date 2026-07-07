import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { minutesSinceMidnightEastern, parseHHMM, isWithinTradingHours } from './market-hours.ts';

describe('market-hours', () => {
  it('parses HH:MM', () => {
    assert.equal(parseHHMM('09:30'), 570);
    assert.equal(parseHHMM('16:00'), 960);
  });

  it('uses US Eastern for midday ET during EDT', () => {
    const noonEt = new Date('2026-06-24T15:00:00.000Z');
    assert.equal(minutesSinceMidnightEastern(noonEt), 11 * 60);
    assert.equal(isWithinTradingHours('09:30', '16:00', noonEt), true);
  });

  it('blocks after 4pm Eastern', () => {
    const afterClose = new Date('2026-06-24T21:30:00.000Z');
    assert.equal(isWithinTradingHours('09:30', '16:00', afterClose), false);
  });
});
