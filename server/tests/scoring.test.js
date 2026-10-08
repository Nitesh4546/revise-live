import { describe, it, expect } from 'vitest';
import { calculatePoints, rankPlayers, BASE_POINTS, STREAK_STEP, STREAK_CAP } from '../src/utils/scoring.js';

describe('Scoring Utility (calculatePoints & rankPlayers)', () => {
  const timeLimitMs = 20000; // 20s

  it('exports valid scoring constants', () => {
    expect(BASE_POINTS).toBe(1000);
    expect(STREAK_STEP).toBe(100);
    expect(STREAK_CAP).toBe(5);
  });

  describe('calculatePoints', () => {
    it('awards 1000 base points for an instantaneous correct answer (t=0)', () => {
      const res = calculatePoints({
        isCorrect: true,
        timeMs: 0,
        timeLimitMs,
        streakAfter: 1
      });
      expect(res.base).toBe(1000);
      expect(res.streakBonus).toBe(0); // 1st correct answer -> bonus = 0
      expect(res.total).toBe(1000);
    });

    it('awards 500 base points at the last second (t=timeLimit)', () => {
      const res = calculatePoints({
        isCorrect: true,
        timeMs: timeLimitMs,
        timeLimitMs,
        streakAfter: 1
      });
      expect(res.base).toBe(500);
      expect(res.streakBonus).toBe(0);
      expect(res.total).toBe(500);
    });

    it('awards 0 points for incorrect or missing answer and resets streak', () => {
      const res = calculatePoints({
        isCorrect: false,
        timeMs: 5000,
        timeLimitMs,
        streakAfter: 0
      });
      expect(res.base).toBe(0);
      expect(res.streakBonus).toBe(0);
      expect(res.total).toBe(0);
    });

    it('calculates streak bonus progression and respects STREAK_CAP of 500', () => {
      // 1st correct: streak 1 -> +0 bonus
      expect(calculatePoints({ isCorrect: true, timeMs: 10000, timeLimitMs, streakAfter: 1 }).streakBonus).toBe(0);

      // 2nd correct: streak 2 -> +100 bonus
      expect(calculatePoints({ isCorrect: true, timeMs: 10000, timeLimitMs, streakAfter: 2 }).streakBonus).toBe(100);

      // 3rd correct: streak 3 -> +200 bonus
      expect(calculatePoints({ isCorrect: true, timeMs: 10000, timeLimitMs, streakAfter: 3 }).streakBonus).toBe(200);

      // 6th correct: streak 6 -> capped at +500 bonus
      expect(calculatePoints({ isCorrect: true, timeMs: 10000, timeLimitMs, streakAfter: 6 }).streakBonus).toBe(500);

      // 10th correct: streak 10 -> still capped at +500 bonus
      expect(calculatePoints({ isCorrect: true, timeMs: 10000, timeLimitMs, streakAfter: 10 }).streakBonus).toBe(500);
    });

    it('correctly rounds intermediate times', () => {
      // t = 10000 (halfway) -> 1000 * (1 - 0.5/2) = 1000 * 0.75 = 750
      const res = calculatePoints({
        isCorrect: true,
        timeMs: 10000,
        timeLimitMs,
        streakAfter: 1
      });
      expect(res.base).toBe(750);
    });

    it('awards flat 1000 base points in accuracy scoring mode regardless of elapsed time', () => {
      const fast = calculatePoints({
        isCorrect: true,
        timeMs: 100,
        timeLimitMs,
        streakAfter: 1,
        scoringMode: 'accuracy'
      });
      const slow = calculatePoints({
        isCorrect: true,
        timeMs: 19500,
        timeLimitMs,
        streakAfter: 1,
        scoringMode: 'accuracy'
      });

      expect(fast.base).toBe(1000);
      expect(slow.base).toBe(1000);
      expect(fast.total).toBe(1000);
      expect(slow.total).toBe(1000);
    });

    it('awards confidence bonus (+100) when confidenceScoring is enabled and player chose Certain (3)', () => {
      const confidentCorrect = calculatePoints({
        isCorrect: true,
        timeMs: 5000,
        timeLimitMs,
        streakAfter: 1,
        scoringMode: 'accuracy',
        confidence: 3,
        confidenceScoring: true
      });
      expect(confidentCorrect.base).toBe(1000);
      expect(confidentCorrect.confidenceBonus).toBe(100);
      expect(confidentCorrect.total).toBe(1100);

      const unsureCorrect = calculatePoints({
        isCorrect: true,
        timeMs: 5000,
        timeLimitMs,
        streakAfter: 1,
        scoringMode: 'accuracy',
        confidence: 2,
        confidenceScoring: true
      });
      expect(unsureCorrect.confidenceBonus).toBe(0);
      expect(unsureCorrect.total).toBe(1000);
    });
  });

  describe('rankPlayers', () => {
    it('orders players by score descending and assigns sequential ranks', () => {
      const players = [
        { playerId: 'p1', name: 'Alice', score: 1200, joinedAt: 1, history: [] },
        { playerId: 'p2', name: 'Bob', score: 1800, joinedAt: 2, history: [] },
        { playerId: 'p3', name: 'Charlie', score: 900, joinedAt: 3, history: [] }
      ];

      const ranked = rankPlayers(players);
      expect(ranked[0].name).toBe('Bob');
      expect(ranked[0].rank).toBe(1);
      expect(ranked[1].name).toBe('Alice');
      expect(ranked[1].rank).toBe(2);
      expect(ranked[2].name).toBe('Charlie');
      expect(ranked[2].rank).toBe(3);
    });

    it('breaks score ties with cumulative response time on correct answers', () => {
      const players = [
        {
          playerId: 'p1',
          name: 'Fast Player',
          score: 1000,
          joinedAt: 2,
          history: [{ isCorrect: true, timeMs: 1500 }]
        },
        {
          playerId: 'p2',
          name: 'Slow Player',
          score: 1000,
          joinedAt: 1,
          history: [{ isCorrect: true, timeMs: 8000 }]
        }
      ];

      const ranked = rankPlayers(players);
      expect(ranked[0].name).toBe('Fast Player');
      expect(ranked[1].name).toBe('Slow Player');
    });

    it('calculates rankChange against previousRank', () => {
      const players = [
        { playerId: 'p1', name: 'Climber', score: 2000, previousRank: 3, joinedAt: 1, history: [{ points: 800 }] }
      ];

      const ranked = rankPlayers(players);
      expect(ranked[0].rank).toBe(1);
      expect(ranked[0].rankChange).toBe(2); // moved up from rank 3 to 1
      expect(ranked[0].pointsGained).toBe(800);
    });
  });
});
