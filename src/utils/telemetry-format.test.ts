import { describe, it, expect } from 'vitest';
import {
  formatSpeed,
  formatLapTime,
  formatSessionTime,
  formatGear,
  formatPercent,
} from './telemetry-format';

describe('telemetry-format', () => {
  describe('formatSpeed', () => {
    it('formats metric speed correctly', () => {
      expect(formatSpeed(10, 'metric')).toBe('36');
    });

    it('formats imperial speed correctly', () => {
      // 10 m/s * 2.23694 = 22.3694 -> 22
      expect(formatSpeed(10, 'imperial')).toBe('22');
    });
  });

  describe('formatLapTime', () => {
    it('formats seconds correctly', () => {
      expect(formatLapTime(65.123)).toBe('1:05.123');
      expect(formatLapTime(5.123)).toBe('5.123');
    });

    it('handles null/zero correctly', () => {
      expect(formatLapTime(null)).toBe('\u2014');
      expect(formatLapTime(0)).toBe('\u2014');
    });
  });

  describe('formatSessionTime', () => {
    it('formats seconds to H:MM:SS', () => {
      expect(formatSessionTime(3661)).toBe('1:01:01');
      expect(formatSessionTime(61)).toBe('0:01:01');
    });
  });

  describe('formatGear', () => {
    it('formats gear correctly', () => {
      expect(formatGear(0)).toBe('N');
      expect(formatGear(-1)).toBe('R');
      expect(formatGear(1)).toBe('1');
      expect(formatGear(6)).toBe('6');
    });
  });

  describe('formatPercent', () => {
    it('formats fraction to percent string', () => {
      expect(formatPercent(0.5)).toBe('50%');
      expect(formatPercent(0.999)).toBe('100%');
      expect(formatPercent(null)).toBe('\u2014');
    });
  });
});
