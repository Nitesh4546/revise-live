export const BASE_POINTS = 1000;
export const STREAK_STEP = 100;
export const STREAK_CAP = 5; // max 5 steps = 500 bonus points
export const CONFIDENCE_BONUS = 100; // bonus for certain-and-correct when confidenceScoring is enabled

/**
 * Calculates points awarded for an answer based on correctness, speed/accuracy mode,
 * consecutive streak, and optional confidence calibration.
 * Pure function per Section 7 & Part D7 specification.
 */
export function calculatePoints({
  isCorrect,
  timeMs = 0,
  timeLimitMs = 20000,
  streakAfter = 0,
  scoringMode = 'speed',
  confidence = null,
  confidenceScoring = false
}) {
  if (!isCorrect) {
    return {
      base: 0,
      streakBonus: 0,
      confidenceBonus: 0,
      total: 0
    };
  }

  let base;
  if (scoringMode === 'accuracy') {
    // Flat 1000 per correct answer, removing network-latency advantage
    base = BASE_POINTS;
  } else {
    // Speed decay: 1000 for instant answer, down to 500 at last second
    const clampedTime = Math.max(0, Math.min(timeMs, timeLimitMs));
    base = Math.round(BASE_POINTS * (1 - clampedTime / (2 * timeLimitMs)));
  }

  // Streak bonus: min(streakAfter - 1, 5) * 100 (kept in both modes)
  const bonusMultiplier = Math.max(0, Math.min(streakAfter - 1, STREAK_CAP));
  const streakBonus = bonusMultiplier * STREAK_STEP;

  // Confidence bonus (if enabled and level 3 'Certain' and correct)
  let confidenceBonus = 0;
  if (confidenceScoring && confidence === 3) {
    confidenceBonus = CONFIDENCE_BONUS;
  }

  const total = base + streakBonus + confidenceBonus;

  return {
    base,
    streakBonus,
    confidenceBonus,
    total
  };
}

/**
 * Computes leaderboard ranks according to:
 * 1. Score descending
 * 2. Cumulative response time on correct answers ascending (tie-breaker)
 * 3. Join time ascending (tie-breaker)
 */
export function rankPlayers(playersArray) {
  const sorted = [...playersArray].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    // Tie breaker 1: lower cumulative correct time
    const aTime = (a.history || [])
      .filter((h) => h.isCorrect)
      .reduce((sum, h) => sum + (h.timeMs || 0), 0);
    const bTime = (b.history || [])
      .filter((h) => h.isCorrect)
      .reduce((sum, h) => sum + (h.timeMs || 0), 0);
    if (aTime !== bTime) {
      return aTime - bTime;
    }
    // Tie breaker 2: earlier join time
    return (a.joinedAt || 0) - (b.joinedAt || 0);
  });

  return sorted.map((player, idx) => {
    const rank = idx + 1;
    const rankChange =
      player.previousRank !== null && player.previousRank !== undefined
        ? player.previousRank - rank
        : 0;
    const pointsGained =
      player.history && player.history.length > 0
        ? player.history[player.history.length - 1].points || 0
        : 0;

    return {
      ...player,
      rank,
      rankChange,
      pointsGained
    };
  });
}
