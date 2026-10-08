import { describe, it, expect } from 'vitest';
import { PRESETS, DEFAULT_SETTINGS, resolveSettings } from '../src/utils/gameSettings.js';
import { calculatePoints } from '../src/utils/scoring.js';

describe('Game Settings & Presets (D7)', () => {
  it('provides all three required presets: Revision, Quick Fun, and Exam Prep', () => {
    expect(PRESETS.revision).toBeDefined();
    expect(PRESETS.quickFun).toBeDefined();
    expect(PRESETS.examPrep).toBeDefined();

    // Default preset is Revision
    expect(DEFAULT_SETTINGS.scoringMode).toBe('accuracy');
    expect(DEFAULT_SETTINGS.leaderboardMode).toBe('off');
    expect(DEFAULT_SETTINGS.leaderboardBetweenQuestions).toBe(false);
    expect(DEFAULT_SETTINGS.peerInstruction).toBe('suggest');
    expect(DEFAULT_SETTINGS.receiptsEnabled).toBe(true);
  });

  it('Quick Fun preset configures speed scoring and competitive leaderboard', () => {
    const qf = PRESETS.quickFun.settings;
    expect(qf.scoringMode).toBe('speed');
    expect(qf.leaderboardMode).toBe('competitive');
    expect(qf.leaderboardBetweenQuestions).toBe(true);
    expect(qf.confidenceScoring).toBe(false);
    expect(qf.peerInstruction).toBe('off');
  });

  it('Exam Prep preset configures recall-first delay and accuracy scoring', () => {
    const ep = PRESETS.examPrep.settings;
    expect(ep.scoringMode).toBe('accuracy');
    expect(ep.recallFirstSeconds).toBe(5);
    expect(ep.confidenceScoring).toBe(true);
    expect(ep.leaderboardBetweenQuestions).toBe(false);
  });

  it('resolveSettings correctly merges quiz defaults and custom overrides', () => {
    const resolved = resolveSettings(
      { scoringMode: 'speed' },
      { peerInstruction: 'auto' }
    );

    expect(resolved.scoringMode).toBe('speed');
    expect(resolved.peerInstruction).toBe('auto');
    expect(resolved.leaderboardMode).toBe('off'); // fallback to default
    expect(resolved.leaderboardBetweenQuestions).toBe(false);
  });

  it('migrates legacy classMeter leaderboardMode to off', () => {
    const resolved = resolveSettings(
      { leaderboardMode: 'classMeter' },
      { classTarget: 80 }
    );
    expect(resolved.leaderboardMode).toBe('off');
    expect(resolved.leaderboardBetweenQuestions).toBe(false);
    expect(resolved.classTarget).toBeUndefined();
    expect(resolved.classMeter).toBeUndefined();
  });

  it('accuracy scoring awards flat 1000 base points without speed degradation', () => {
    const fastAnswer = calculatePoints({
      isCorrect: true,
      timeMs: 1000,
      timeLimitMs: 20000,
      scoringMode: 'accuracy'
    });

    const slowAnswer = calculatePoints({
      isCorrect: true,
      timeMs: 18000,
      timeLimitMs: 20000,
      scoringMode: 'accuracy'
    });

    expect(fastAnswer.base).toBe(1000);
    expect(slowAnswer.base).toBe(1000);
    expect(fastAnswer.total).toBe(1000);
    expect(slowAnswer.total).toBe(1000);
  });

  it('resolves phoneOptionText and finalLeaderboard with default full and validates values', () => {
    const defaults = resolveSettings({}, {});
    expect(defaults.phoneOptionText).toBe('full');
    expect(defaults.finalLeaderboard).toBe('full');

    const letters = resolveSettings({ phoneOptionText: 'letters' });
    expect(letters.phoneOptionText).toBe('letters');

    const top10 = resolveSettings({ finalLeaderboard: 'top10' });
    expect(top10.finalLeaderboard).toBe('top10');

    const selfOnly = resolveSettings({ finalLeaderboard: 'self' });
    expect(selfOnly.finalLeaderboard).toBe('self');

    // Invalid fallback
    const invalid = resolveSettings({ phoneOptionText: 'invalid', finalLeaderboard: 'invalid' });
    expect(invalid.phoneOptionText).toBe('full');
    expect(invalid.finalLeaderboard).toBe('full');
  });
});
