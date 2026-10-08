import crypto from 'crypto';
import { calculatePoints, rankPlayers } from '../utils/scoring.js';
import { calculateQuestionStats, generateBlindspotReport } from '../services/analyticsService.js';
import { GameSession } from '../models/GameSession.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { shuffleQuestionOptions } from '../utils/shuffle.js';

export function computeLiveOptionCounts(room) {
  const counts = [0, 0, 0, 0];
  for (const player of room.players.values()) {
    if (player.currentAnswer !== null && player.currentAnswer.index >= 0 && player.currentAnswer.index < 4) {
      counts[player.currentAnswer.index] += 1;
    }
  }
  return counts;
}

export function computeNudgeList(room) {
  const list = [];
  for (const player of room.players.values()) {
    if ((player.consecutiveWrong || 0) >= 3) {
      list.push({ playerId: player.playerId, name: player.name, reason: 'Missed 3 questions in a row' });
    } else if ((player.consecutiveUnanswered || 0) >= 2) {
      list.push({ playerId: player.playerId, name: player.name, reason: 'Unanswered 2 questions in a row' });
    }
  }
  return list;
}

/**
 * Builds personalized ranked final leaderboard for a recipient student (F2)
 * Ensures:
 * - Fully sorted by rank/tie-break rules
 * - Exactly one isYou row per recipient (if present)
 * - Never leaks playerId, socketId, or tokens of other players
 * - Filters by room.settings.finalLeaderboard ('full' | 'top10' | 'self')
 */
export function buildFinalLeaderboard({ ranked, setting = 'full', recipientPlayerId = null, totalQuestions = 0 }) {
  const allRows = (ranked || []).map((p) => {
    const history = p.history || [];
    const correct = history.filter((h) => h.isCorrect).length;
    const answered = history.filter((h) => h.selectedIndex !== null && h.selectedIndex !== undefined).length;
    const accuracy = answered > 0 ? Number((correct / answered).toFixed(3)) : 0;
    return {
      rank: p.rank,
      name: p.name,
      score: p.score,
      correct,
      answered,
      totalQuestions: totalQuestions || history.length,
      accuracy,
      isYou: p.playerId === recipientPlayerId,
      left: !!p.left
    };
  });

  if (setting === 'self') {
    return allRows.filter((r) => r.isYou);
  }

  if (setting === 'top10') {
    const top10 = allRows.slice(0, 10);
    const selfRow = allRows.find((r) => r.isYou);
    if (selfRow && !top10.some((r) => r.isYou)) {
      return [...top10, selfRow];
    }
    return top10;
  }

  // 'full'
  return allRows;
}

/**
 * GameEngine manages authoritative state transitions and timer logic for a room.
 */
export class GameEngine {
  /**
   * Starts next question from LOBBY, LEADERBOARD, or RETEST
   */
  static startQuestion(room, io) {
    if (room.status !== 'LOBBY' && room.status !== 'LEADERBOARD' && room.status !== 'QUESTION_REVEAL') {
      return { ok: false, error: { code: 'INVALID_STATE', message: `Cannot start question in state ${room.status}` } };
    }

    // Require at least 1 connected player
    const connectedPlayers = Array.from(room.players.values()).filter((p) => p.connected && !p.left);
    if (connectedPlayers.length === 0) {
      return { ok: false, error: { code: 'NO_PLAYERS', message: 'At least one connected player is required to start.' } };
    }

    const questionList = room.currentRound === 'retest' ? (room.retestQuestions || []) : room.quiz.questions;
    const nextIndex = room.currentQuestionIndex + 1;

    if (nextIndex >= questionList.length) {
      return { ok: false, error: { code: 'NO_MORE_QUESTIONS', message: 'All questions have been completed.' } };
    }

    if (room.timerId) {
      clearTimeout(room.timerId);
      room.timerId = null;
    }

    room.currentQuestionIndex = nextIndex;
    room.status = 'QUESTION_ACTIVE';
    room.finalized = false;
    room.hasDiscussedCurrentQuestion = false;
    room.lastActivityAt = Date.now();

    // Reset current answers for all players
    for (const player of room.players.values()) {
      player.currentAnswer = null;
      player.currentConfidence = null;
      player.revoteAnswer = null;
    }

    const question = questionList[nextIndex];
    const timeLimitSec = question.timeLimit || 20;
    const timeLimitMs = timeLimitSec * 1000;

    room.questionStartedAtEpoch = Date.now();
    room.questionStartedAtMono = performance.now();

    const endsAt = room.questionStartedAtEpoch + timeLimitMs;

    // Masked question payload: NEVER send correctIndex, explanation, or distractorRationales!
    const questionPayload = {
      round: room.currentRound || 'main',
      questionIndex: nextIndex,
      totalQuestions: questionList.length,
      questionText: question.questionText,
      options: question.options,
      topicTag: question.topicTag || 'General',
      timeLimit: timeLimitSec,
      endsAt,
      serverNow: room.questionStartedAtEpoch,
      phoneOptionText: room.settings?.phoneOptionText || 'full'
    };

    if (io) {
      io.to(room.pin).emit('game:question-start', questionPayload);

      // Private host preview during question (correct answer + Concept Anchor preview)
      io.to(`${room.pin}:host`).emit('host:question-preview', {
        questionIndex: nextIndex,
        correctIndex: question.correctIndex,
        explanation: question.explanation,
        distractorRationales: question.distractorRationales || []
      });
    }

    // Schedule authoritative server timeout
    room.timerId = setTimeout(() => {
      GameEngine.finalizeQuestion(room, io);
    }, timeLimitMs + env.GRACE_MS);

    return { ok: true, questionPayload };
  }

  /**
   * Submits an answer from a player
   */
  static submitAnswer(room, playerId, selectedIndex, io) {
    if (room.status !== 'QUESTION_ACTIVE') {
      return { ok: false, error: { code: 'INVALID_STATE', message: 'Question is not currently active.' } };
    }

    const player = room.players.get(playerId);
    if (!player) {
      return { ok: false, error: { code: 'PLAYER_NOT_FOUND', message: 'Player not found in this room.' } };
    }

    // Double submission prevention: lock on first submit
    if (player.currentAnswer !== null) {
      return { ok: true, alreadyAnswered: true };
    }

    const questionList = room.currentRound === 'retest' ? (room.retestQuestions || []) : room.quiz.questions;
    const question = questionList[room.currentQuestionIndex];
    const timeLimitMs = (question.timeLimit || 20) * 1000;
    const elapsedMono = Math.round(performance.now() - room.questionStartedAtMono);

    // Reject late answer past the grace window
    if (elapsedMono > timeLimitMs + env.GRACE_MS) {
      return { ok: false, error: { code: 'TIME_EXPIRED', message: 'Time limit expired for this question.' } };
    }

    const clampedTimeMs = Math.min(elapsedMono, timeLimitMs);
    player.currentAnswer = {
      index: selectedIndex,
      timeMs: clampedTimeMs
    };

    room.lastActivityAt = Date.now();

    // Calculate answered stats for connected players
    const connectedPlayers = Array.from(room.players.values()).filter((p) => p.connected && !p.left);
    const answeredCount = connectedPlayers.filter((p) => p.currentAnswer !== null).length;
    const totalConnected = connectedPlayers.length;

    if (io) {
      // General progress event
      io.to(`${room.pin}:host`).emit('host:player-answered', {
        answeredCount,
        totalPlayers: totalConnected
      });

      // Private host live stats (histogram + nudge list) - never sent to display or players!
      io.to(`${room.pin}:host`).emit('host:live-stats', {
        answeredCount,
        totalPlayers: totalConnected,
        histogram: computeLiveOptionCounts(room),
        nudgeList: computeNudgeList(room)
      });
    }

    // If all connected players have answered, finalize immediately
    if (answeredCount >= totalConnected && totalConnected > 0) {
      GameEngine.finalizeQuestion(room, io);
    }

    return { ok: true, answeredCount, totalConnected };
  }

  /**
   * Idempotently finalizes the current question, computes scores, and broadcasts reveal
   */
  static finalizeQuestion(room, io) {
    if (room.status !== 'QUESTION_ACTIVE' || room.finalized) {
      return { ok: false, error: { code: 'ALREADY_FINALIZED', message: 'Question already finalized or not active' } };
    }

    if (room.timerId) {
      clearTimeout(room.timerId);
      room.timerId = null;
    }

    const qIdx = room.currentQuestionIndex;
    const questionList = room.currentRound === 'retest' ? (room.retestQuestions || []) : room.quiz.questions;
    const question = questionList[qIdx];
    const timeLimitMs = (question.timeLimit || 20) * 1000;
    const allPlayers = Array.from(room.players.values());

    const isRetest = room.currentRound === 'retest';
    const activePlayers = isRetest ? allPlayers.filter((p) => !p.left) : allPlayers;

    // Update each player's streak, points, and score
    for (const player of activePlayers) {
      const ans = player.currentAnswer;
      const isCorrect = ans !== null && ans.index === question.correctIndex;
      const timeMs = ans ? ans.timeMs : timeLimitMs;

      // Track consecutive stats for nudge list
      if (ans === null) {
        player.consecutiveUnanswered = (player.consecutiveUnanswered || 0) + 1;
      } else {
        player.consecutiveUnanswered = 0;
      }

      if (isCorrect) {
        player.consecutiveWrong = 0;
      } else if (ans !== null) {
        player.consecutiveWrong = (player.consecutiveWrong || 0) + 1;
      }

      const currentStreak = isRetest ? (player.retestStreak || 0) : (player.streak || 0);
      const streakAfter = isCorrect ? currentStreak + 1 : 0;
      if (isRetest) {
        player.retestStreak = streakAfter;
      } else {
        player.streak = streakAfter;
      }

      const points = calculatePoints({
        isCorrect,
        timeMs,
        timeLimitMs,
        streakAfter,
        scoringMode: room.settings?.scoringMode || 'accuracy',
        confidence: player.currentConfidence,
        confidenceScoring: room.settings?.confidenceScoring || false
      });

      if (isRetest) {
        player.retestScore = (player.retestScore || 0) + points.total;
      } else {
        player.score += points.total;
      }

      player.history.push({
        round: room.currentRound || 'main',
        questionIndex: qIdx,
        selectedIndex: ans ? ans.index : null,
        confidence: player.currentConfidence,
        isCorrect,
        points: points.total,
        timeMs
      });
    }

    // Compute question stats
    const stats = calculateQuestionStats({
      question,
      questionIndex: qIdx,
      players: activePlayers,
      round: room.currentRound || 'main'
    });

    if (room.currentRound === 'retest') {
      room.retestAnswerLog.push(stats);
    } else {
      room.answerLog.push(stats);
    }

    // Check Peer Instruction triggers (round 1 only)
    if (room.currentRound === 'main' && !room.hasDiscussedCurrentQuestion) {
      const piSetting = room.settings?.peerInstruction || 'off';
      const bounds = room.settings?.peerInstructionBounds || { min: 30, max: 70 };
      const accuracyPct = Math.round(stats.accuracy * 100);

      if (piSetting === 'auto' && accuracyPct >= bounds.min && accuracyPct <= bounds.max) {
        // Automatically start discussion directly from QUESTION_ACTIVE -> DISCUSSION
        return GameEngine.startDiscussion(room, io);
      }

      if (piSetting === 'suggest' && accuracyPct >= bounds.min && accuracyPct <= bounds.max) {
        // Prompt teacher console
        if (io) {
          io.to(`${room.pin}:host`).emit('host:peer-instruction-suggested', {
            questionIndex: qIdx,
            accuracyPct,
            min: bounds.min,
            max: bounds.max
          });
        }
      }
    }

    room.finalized = true;
    room.status = 'QUESTION_REVEAL';
    room.lastActivityAt = Date.now();

    // Rank players
    const rankedPlayers = rankPlayers(allPlayers);
    const totalPlayers = allPlayers.length;

    // Send private results to each player
    if (io) {
      for (const ranked of rankedPlayers) {
        if (ranked.socketId && ranked.connected) {
          const lastHist = ranked.history[ranked.history.length - 1];
          const isCorrect = lastHist?.isCorrect || false;
          const pointsEarned = lastHist?.points || 0;

          // Streak bonus portion
          const effectiveStreak = room.currentRound === 'retest' ? (ranked.retestStreak || 0) : (ranked.streak || 0);
          const streakMultiplier = Math.max(0, Math.min(effectiveStreak - 1, 5));
          const streakBonus = isCorrect ? streakMultiplier * 100 : 0;
          const pointsAwarded = Math.max(0, pointsEarned - streakBonus);

          const chosenIdx = lastHist?.selectedIndex;
          const chosenRationale =
            chosenIdx !== null && chosenIdx !== undefined && question.distractorRationales
              ? question.distractorRationales[chosenIdx] || ''
              : '';

          io.to(ranked.socketId).emit('player:result', {
            isCorrect,
            chosenIndex: chosenIdx,
            chosenRationale,
            conceptAnchor: question.explanation,
            pointsAwarded,
            streakBonus,
            streak: effectiveStreak,
            totalScore: room.currentRound === 'retest' ? ranked.retestScore : ranked.score,
            rank: ranked.rank,
            totalPlayers
          });
        }
      }
    }

    // Broadcast reveal event to host, display, and players
    const revealPayload = {
      round: room.currentRound || 'main',
      questionIndex: qIdx,
      correctIndex: question.correctIndex,
      explanation: question.explanation,
      topicTag: question.topicTag || 'General',
      optionCounts: stats.optionCounts,
      topDistractorIndex: stats.topDistractorIndex,
      topDistractorRationale: stats.topDistractorRationale,
      confidentWrongCount: stats.confidentWrongCount,
      flags: stats.flags,
      peerShift: stats.peerShift || null,
      phoneOptionText: room.settings?.phoneOptionText || 'full'
    };

    if (io) {
      io.to(room.pin).emit('game:question-reveal', revealPayload);

      // If at final question of main round, provide host blindspot preview for retest selection
      const questionList = room.currentRound === 'retest' ? (room.retestQuestions || []) : room.quiz.questions;
      const isFinalQuestion = room.currentQuestionIndex >= questionList.length - 1;
      if (isFinalQuestion && room.currentRound === 'main') {
        const flaggedQuestions = (room.answerLog || [])
          .filter((stat) => (stat.accuracy ?? 1) < 0.5)
          .map((stat) => ({
            questionIndex: stat.questionIndex,
            questionText: stat.questionText,
            accuracy: stat.accuracy,
            topicTag: stat.topicTag,
            flags: stat.flags || []
          }));
        io.to(`${room.pin}:host`).emit('host:blindspot-preview', {
          flaggedQuestions,
          totalQuestions: room.quiz.questions.length,
          weakCount: flaggedQuestions.length
        });
      }
    }

    return { ok: true, stats, revealPayload };
  }

  /**
   * Starts Peer Instruction discussion (C3)
   */
  static startDiscussion(room, io, customSeconds = null) {
    if (room.status !== 'QUESTION_ACTIVE') {
      return { ok: false, error: { code: 'INVALID_STATE', message: 'Discussion can only start during QUESTION_ACTIVE before reveal' } };
    }

    if (room.hasDiscussedCurrentQuestion) {
      return { ok: false, error: { code: 'ALREADY_DISCUSSED', message: 'At most one discussion allowed per question' } };
    }

    room.hasDiscussedCurrentQuestion = true;

    if (room.timerId) {
      clearTimeout(room.timerId);
      room.timerId = null;
    }

    room.finalized = false;
    room.status = 'DISCUSSION';
    room.lastActivityAt = Date.now();

    const qIdx = room.currentQuestionIndex;
    const question = room.quiz.questions[qIdx];
    const durationSec = customSeconds || room.settings?.peerDiscussionSeconds || 60;
    const durationMs = durationSec * 1000;
    const endsAt = Date.now() + durationMs;

    const distribution = computeLiveOptionCounts(room);

    // Broadcast: answer distribution is shown, CORRECT ANSWER IS NOT!
    const discussionPayload = {
      questionIndex: qIdx,
      questionText: question.questionText,
      options: question.options,
      distribution,
      endsAt,
      serverNow: Date.now(),
      seconds: durationSec,
      phoneOptionText: room.settings?.phoneOptionText || 'full'
    };

    if (io) {
      io.to(room.pin).emit('game:discussion-start', discussionPayload);
    }

    // Server timer transitions to REVOTE when discussion ends
    room.timerId = setTimeout(() => {
      GameEngine.startRevote(room, io);
    }, durationMs + env.GRACE_MS);

    return { ok: true, discussionPayload };
  }

  /**
   * Starts Peer Instruction re-vote phase (C3)
   */
  static startRevote(room, io) {
    if (room.status !== 'DISCUSSION') {
      return { ok: false, error: { code: 'INVALID_STATE', message: 'Re-vote can only start from DISCUSSION' } };
    }

    if (room.timerId) {
      clearTimeout(room.timerId);
      room.timerId = null;
    }

    room.status = 'REVOTE';
    room.lastActivityAt = Date.now();

    const qIdx = room.currentQuestionIndex;
    const question = room.quiz.questions[qIdx];
    const durationSec = room.settings?.peerRevoteSeconds || 15;
    const durationMs = durationSec * 1000;
    const endsAt = Date.now() + durationMs;

    // Reset revoteAnswer for each player
    for (const player of room.players.values()) {
      player.revoteAnswer = null;
    }

    // Broadcast revote start (still masked!)
    const revotePayload = {
      questionIndex: qIdx,
      questionText: question.questionText,
      options: question.options,
      endsAt,
      serverNow: Date.now(),
      seconds: durationSec,
      phoneOptionText: room.settings?.phoneOptionText || 'full'
    };

    if (io) {
      io.to(room.pin).emit('game:revote-start', revotePayload);
    }

    // Server timer finalizes revote when expired
    room.timerId = setTimeout(() => {
      GameEngine.finalizeRevote(room, io);
    }, durationMs + env.GRACE_MS);

    return { ok: true, revotePayload };
  }

  /**
   * Submits a player's re-vote answer (C3)
   */
  static submitRevote(room, playerId, selectedIndex, io) {
    if (room.status !== 'REVOTE') {
      return { ok: false, error: { code: 'INVALID_STATE', message: 'Re-vote is not currently active' } };
    }

    const player = room.players.get(playerId);
    if (!player) {
      return { ok: false, error: { code: 'PLAYER_NOT_FOUND', message: 'Player not found in room' } };
    }

    player.revoteAnswer = selectedIndex;

    const connected = Array.from(room.players.values()).filter((p) => p.connected && !p.left);
    const revotedCount = connected.filter((p) => p.revoteAnswer !== null).length;

    if (revotedCount >= connected.length && connected.length > 0) {
      GameEngine.finalizeRevote(room, io);
    }

    return { ok: true, revotedCount, total: connected.length };
  }

  /**
   * Finalizes the re-vote and computes peer shift (C3)
   */
  static finalizeRevote(room, io) {
    if (room.status !== 'REVOTE') {
      return { ok: false, error: { code: 'INVALID_STATE', message: 'Re-vote not active' } };
    }

    if (room.timerId) {
      clearTimeout(room.timerId);
      room.timerId = null;
    }

    const qIdx = room.currentQuestionIndex;
    const question = room.quiz.questions[qIdx];
    const allPlayers = Array.from(room.players.values());

    let wrongToRight = 0;
    let rightToWrong = 0;
    let wrongToWrong = 0;
    let rightToRight = 0;

    for (const player of allPlayers) {
      const r1Correct = player.currentAnswer !== null && player.currentAnswer.index === question.correctIndex;
      const r2Choice = player.revoteAnswer !== null ? player.revoteAnswer : player.currentAnswer?.index;
      const r2Correct = r2Choice === question.correctIndex;

      if (!r1Correct && r2Correct) {
        wrongToRight++;
        // Recovered bonus (flat +500)
        player.score += 500;
        player.recoveredCount = (player.recoveredCount || 0) + 1;
      } else if (r1Correct && !r2Correct) {
        rightToWrong++;
        // Round 1 score is preserved! Never reduced.
      } else if (!r1Correct && !r2Correct) {
        wrongToWrong++;
      } else if (r1Correct && r2Correct) {
        rightToRight++;
      }
    }

    const peerShift = { wrongToRight, rightToWrong, wrongToWrong, rightToRight };

    // Mark finalized and compute reveal
    room.finalized = true;
    room.status = 'QUESTION_REVEAL';
    room.lastActivityAt = Date.now();

    const stats = calculateQuestionStats({ question, questionIndex: qIdx, players: allPlayers });
    stats.peerShift = peerShift;
    room.answerLog.push(stats);

    const rankedPlayers = rankPlayers(allPlayers);
    const totalPlayers = allPlayers.length;

    if (io) {
      for (const ranked of rankedPlayers) {
        if (ranked.socketId && ranked.connected) {
          const lastHist = ranked.history[ranked.history.length - 1];
          const isCorrect = ranked.revoteAnswer !== null ? ranked.revoteAnswer === question.correctIndex : lastHist?.isCorrect;
          io.to(ranked.socketId).emit('player:result', {
            isCorrect,
            chosenIndex: ranked.revoteAnswer ?? ranked.currentAnswer?.index,
            conceptAnchor: question.explanation,
            pointsAwarded: 0,
            streakBonus: 0,
            streak: ranked.streak,
            totalScore: ranked.score,
            rank: ranked.rank,
            totalPlayers,
            recovered: !lastHist?.isCorrect && isCorrect
          });
        }
      }

      const revealPayload = {
        questionIndex: qIdx,
        correctIndex: question.correctIndex,
        explanation: question.explanation,
        topicTag: question.topicTag || 'General',
        optionCounts: stats.optionCounts,
        topDistractorIndex: stats.topDistractorIndex,
        topDistractorRationale: stats.topDistractorRationale,
        confidentWrongCount: stats.confidentWrongCount,
        flags: stats.flags,
        peerShift
      };

      io.to(room.pin).emit('game:question-reveal', revealPayload);

      // If at final question of main round, provide host blindspot preview for retest selection
      const questionList = room.currentRound === 'retest' ? (room.retestQuestions || []) : room.quiz.questions;
      const isFinalQuestion = room.currentQuestionIndex >= questionList.length - 1;
      if (isFinalQuestion && room.currentRound === 'main') {
        const flaggedQuestions = room.answerLog
          .filter((stat) => (stat.accuracy ?? 1) < 0.5)
          .map((stat) => ({
            questionIndex: stat.questionIndex,
            questionText: stat.questionText,
            accuracy: stat.accuracy,
            topicTag: stat.topicTag,
            flags: stat.flags || []
          }));
        io.to(`${room.pin}:host`).emit('host:blindspot-preview', {
          flaggedQuestions,
          totalQuestions: room.quiz.questions.length,
          weakCount: flaggedQuestions.length
        });
      }
    }

    return { ok: true, peerShift };
  }

  /**
   * Advances from QUESTION_REVEAL to LEADERBOARD
   */
  static showLeaderboard(room, io) {
    if (room.status !== 'QUESTION_REVEAL') {
      return { ok: false, error: { code: 'INVALID_STATE', message: 'Leaderboard can only be shown from QUESTION_REVEAL' } };
    }

    if (!room.settings?.leaderboardBetweenQuestions && room.settings?.leaderboardMode !== 'competitive') {
      return { ok: false, error: { code: 'LEADERBOARD_DISABLED', message: 'Between-question leaderboard is disabled by settings.' } };
    }

    room.status = 'LEADERBOARD';
    room.lastActivityAt = Date.now();

    const allPlayers = Array.from(room.players.values());
    const ranked = rankPlayers(allPlayers);

    for (const r of ranked) {
      const orig = room.players.get(r.playerId);
      if (orig) {
        orig.previousRank = r.rank;
      }
    }

    const top5 = ranked.slice(0, 5).map((p) => ({
      playerId: p.playerId,
      name: p.name,
      score: p.score,
      rank: p.rank,
      rankChange: p.rankChange,
      pointsGained: p.pointsGained
    }));

    const leaderboardPayload = {
      questionIndex: room.currentQuestionIndex,
      leaderboardMode: room.settings?.leaderboardMode || 'competitive',
      topPlayers: top5
    };

    if (io) {
      io.to(room.pin).emit('game:leaderboard-update', leaderboardPayload);

      // Private update to each player
      for (const p of ranked) {
        if (p.socketId && p.connected) {
          io.to(p.socketId).emit('game:leaderboard-update', {
            ...leaderboardPayload,
            you: {
              rank: p.rank,
              score: p.score
            }
          });
        }
      }

      // If at final question of main round, provide host blindspot preview for retest selection
      const questionList = room.currentRound === 'retest' ? (room.retestQuestions || []) : room.quiz.questions;
      const isFinalQuestion = room.currentQuestionIndex >= questionList.length - 1;
      if (isFinalQuestion && room.currentRound === 'main') {
        const flaggedQuestions = room.answerLog
          .filter((stat) => (stat.accuracy ?? 1) < 0.5)
          .map((stat) => ({
            questionIndex: stat.questionIndex,
            questionText: stat.questionText,
            accuracy: stat.accuracy,
            topicTag: stat.topicTag,
            flags: stat.flags || []
          }));
        io.to(`${room.pin}:host`).emit('host:blindspot-preview', {
          flaggedQuestions,
          totalQuestions: room.quiz.questions.length,
          weakCount: flaggedQuestions.length
        });
      }
    }

    return { ok: true, ...leaderboardPayload };
  }

  /**
   * Starts a Retest Round
   */
  static startRetest(room, questionIndexes, io) {
    if (room.retestCompleted) {
      return { ok: false, error: { code: 'RETEST_ALREADY_COMPLETED', message: 'A retest has already been completed for this session' } };
    }

    if (room.status !== 'LEADERBOARD' && room.status !== 'FINISHED' && room.status !== 'QUESTION_REVEAL') {
      return { ok: false, error: { code: 'INVALID_STATE', message: 'Retest can only be started from LEADERBOARD, FINISHED, or QUESTION_REVEAL' } };
    }

    if (!Array.isArray(questionIndexes) || questionIndexes.length === 0) {
      return { ok: false, error: { code: 'INVALID_QUESTIONS', message: 'At least one question must be selected for retest' } };
    }

    const invalidIndex = questionIndexes.find((idx) => typeof idx !== 'number' || idx < 0 || idx >= room.quiz.questions.length);
    if (invalidIndex !== undefined) {
      return { ok: false, error: { code: 'INVALID_QUESTION_INDEX', message: `Question index ${invalidIndex} is out of bounds` } };
    }

    room.currentRound = 'retest';
    room.rounds = room.rounds || ['main'];
    if (!room.rounds.includes('retest')) {
      room.rounds.push('retest');
    }
    room.retestQuestionIndexes = questionIndexes;
    room.retestAnswerLog = [];

    // Reshuffle options for retest questions
    const selectedQuestions = questionIndexes.map((idx) => {
      const orig = room.quiz.questions[idx];
      const shuffled = shuffleQuestionOptions(orig.options, orig.correctIndex, orig.distractorRationales);
      return {
        ...orig,
        originalQuestionIndex: idx,
        options: shuffled.options,
        correctIndex: shuffled.correctIndex,
        distractorRationales: shuffled.distractorRationales || orig.distractorRationales
      };
    });

    room.retestQuestions = selectedQuestions;
    room.currentQuestionIndex = -1;
    room.status = 'LEADERBOARD'; // Ready to start questions

    // Reset retest scores & streak for active players (excluding players who left)
    for (const player of room.players.values()) {
      if (player.left) continue;
      player.retestScore = 0;
      player.retestStreak = 0;
      player.currentAnswer = null;
      player.currentConfidence = null;
      player.revoteAnswer = null;
      player.hasAnswered = false;
    }

    if (io) {
      io.to(room.pin).emit('game:retest-start', {
        questionIndexes,
        totalQuestions: selectedQuestions.length
      });
    }

    // Automatically start first retest question
    return GameEngine.startQuestion(room, io);
  }

  /**
   * Finishes the game, persists GameSession, and distributes podium and Blindspot Radar reports
   */
  static async endGame(room, io) {
    if (room.status === 'FINISHED') {
      return { ok: false, error: { code: 'INVALID_STATE', message: 'Game has already finished' } };
    }

    room.status = 'FINISHED';
    room.lastActivityAt = Date.now();

    if (room.timerId) {
      clearTimeout(room.timerId);
      room.timerId = null;
    }

    // Requirement 6: Don't persist a GameSession when end-game happens with zero completed questions
    if (!room.answerLog || room.answerLog.length === 0) {
      logger.info(`Game ended with zero completed questions for room ${room.pin}; skipping GameSession persistence.`);
      if (io) {
        io.to(room.pin).emit('game:ended', {
          sessionId: null,
          podium: [],
          finalLeaderboard: [],
          blindspotReport: null,
          leaderboardMode: room.settings?.leaderboardMode || 'competitive'
        });
        io.to(room.pin).emit('room:closed', { reason: 'Game ended by host with zero completed questions.' });
      }
      return { ok: true, sessionId: null, persisted: false, podium: [], finalLeaderboard: [] };
    }

    const allPlayers = Array.from(room.players.values());
    const ranked = rankPlayers(allPlayers);

    // Top 3 Podium
    const podium = ranked.slice(0, 3).map((p) => ({
      playerId: p.playerId,
      name: p.name,
      score: p.score,
      rank: p.rank
    }));

    // Full leaderboard
    const finalLeaderboard = ranked.map((p) => ({
      playerId: p.playerId,
      name: p.name,
      score: p.score,
      rank: p.rank
    }));

    // Generate Blindspot Radar analytics report
    const { report: blindspotReport, playersSummary } = generateBlindspotReport({
      quiz: room.quiz,
      players: ranked,
      questionStatsList: room.answerLog
    });

    // Generate revision receipt tokens
    const playerReceiptTokens = new Map();
    for (const summary of playersSummary) {
      const rawToken = crypto.randomBytes(16).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      summary.receiptTokenHash = tokenHash;
      playerReceiptTokens.set(summary.playerId, rawToken);
    }

    // Retest metrics persistence & summary calculation
    let retestData = room.finalRetestData || null;
    if (room.retestQuestionIndexes && room.retestQuestionIndexes.length > 0 && !retestData) {
      let beforeCorrect = 0;
      let beforeTotal = 0;
      const perQuestion = [];
      const perTopicMap = new Map();

      room.retestQuestionIndexes.forEach((origIdx, rIdx) => {
        const origQuestion = room.quiz?.questions?.[origIdx] || {};
        const mainStat = (room.answerLog || [])[origIdx];
        const retestStat = (room.retestAnswerLog || [])[rIdx];

        const bCorr = mainStat ? (mainStat.correctCount || 0) : 0;
        const bTot = mainStat ? (mainStat.totalPlayers || 0) : 0;
        beforeCorrect += bCorr;
        beforeTotal += bTot;

        const aCorr = retestStat ? (retestStat.correctCount || 0) : 0;
        const aTot = retestStat ? (retestStat.totalPlayers || 0) : 0;

        const beforeAcc = bTot > 0 ? Number((bCorr / bTot).toFixed(3)) : 0;
        const afterAcc = aTot > 0 ? Number((aCorr / aTot).toFixed(3)) : 0;

        const topic = origQuestion.topicTag || 'General';
        if (!perTopicMap.has(topic)) {
          perTopicMap.set(topic, { topicTag: topic, beforeCorrect: 0, beforeTotal: 0, afterCorrect: 0, afterTotal: 0 });
        }
        const topicData = perTopicMap.get(topic);
        topicData.beforeCorrect += bCorr;
        topicData.beforeTotal += bTot;
        topicData.afterCorrect += aCorr;
        topicData.afterTotal += aTot;

        perQuestion.push({
          questionIndex: origIdx,
          retestQuestionIndex: rIdx,
          questionText: origQuestion.questionText || '',
          topicTag: topic,
          beforeAccuracy: beforeAcc,
          afterAccuracy: afterAcc,
          improvementPct: Math.round((afterAcc - beforeAcc) * 100),
          topMisconception: mainStat?.topDistractorRationale || ''
        });
      });

      let afterCorrect = 0;
      let afterTotal = 0;
      (room.retestAnswerLog || []).forEach((stat) => {
        afterCorrect += stat.correctCount || 0;
        afterTotal += stat.totalPlayers || 0;
      });

      const beforeAccuracy = beforeTotal > 0 ? Number((beforeCorrect / beforeTotal).toFixed(3)) : 0;
      const afterAccuracy = afterTotal > 0 ? Number((afterCorrect / afterTotal).toFixed(3)) : 0;

      const perTopic = Array.from(perTopicMap.values()).map((t) => {
        const bAcc = t.beforeTotal > 0 ? Number((t.beforeCorrect / t.beforeTotal).toFixed(3)) : 0;
        const aAcc = t.afterTotal > 0 ? Number((t.afterCorrect / t.afterTotal).toFixed(3)) : 0;
        return {
          topicTag: t.topicTag,
          beforeAccuracy: bAcc,
          afterAccuracy: aAcc,
          improvementPct: Math.round((aAcc - bAcc) * 100)
        };
      });

      const perPlayer = [];
      for (const p of allPlayers) {
        if (p.left) continue;
        const pMainHistory = (p.history || []).filter(
          (h) => (!h.round || h.round === 'main') && room.retestQuestionIndexes.includes(h.questionIndex)
        );
        const pRetestHistory = (p.history || []).filter((h) => h.round === 'retest');
        const retestCorrect = pRetestHistory.filter((h) => h.isCorrect).length;
        const retestTotal = pRetestHistory.length;
        let improvedCount = 0;
        pRetestHistory.forEach((rh) => {
          const origIdx =
            room.retestQuestionIndexes[rh.questionIndex] !== undefined
              ? room.retestQuestionIndexes[rh.questionIndex]
              : rh.questionIndex;
          const mainH = pMainHistory.find((mh) => mh.questionIndex === origIdx);
          if (mainH && !mainH.isCorrect && rh.isCorrect) {
            improvedCount += 1;
          }
        });

        perPlayer.push({
          playerId: p.playerId,
          name: p.name,
          score: p.retestScore || 0,
          correct: retestCorrect,
          total: retestTotal,
          improvedCount
        });
      }

      const beforePct = Math.round(beforeAccuracy * 100);
      const afterPct = Math.round(afterAccuracy * 100);
      const headline =
        afterPct > beforePct
          ? `After re-teaching, accuracy on weak topics rose from ${beforePct}% to ${afterPct}%`
          : `Retest complete: accuracy on review topics is ${afterPct}%`;

      retestData = {
        questionIndexes: room.retestQuestionIndexes,
        beforeAccuracy,
        afterAccuracy,
        headline,
        perQuestion,
        perTopic,
        perPlayer,
        results: room.retestAnswerLog || []
      };

      room.retestCompleted = true;
      room.finalRetestData = retestData;
    }

    // Cache final state on room for rejoining players during FINISHED_ROOM_TTL_MIN (F2)
    room.finalRanked = ranked;
    room.finalPlayersSummary = playersSummary;
    room.playerReceiptTokens = playerReceiptTokens;
    room.finalBlindspotReport = blindspotReport;

    // Save or update GameSession document in MongoDB
    let sessionId = room.sessionId || null;
    try {
      if (sessionId) {
        const updated = await GameSession.findByIdAndUpdate(
          sessionId,
          {
            endedAt: Date.now(),
            players: playersSummary,
            questionStats: room.answerLog,
            retest: retestData,
            blindspotReport
          },
          { new: true }
        );
        if (updated) {
          sessionId = updated._id.toString();
          logger.info(`Updated GameSession ${sessionId} for room ${room.pin}`);
        }
      } else {
        const sessionDoc = await GameSession.create({
          quizId: room.quiz._id,
          quizTitle: room.quiz.title,
          hostId: room.hostId,
          classId: room.classId,
          pin: room.pin,
          startedAt: room.createdAt,
          endedAt: Date.now(),
          playerCount: allPlayers.length,
          settings: room.settings,
          players: playersSummary,
          questionStats: room.answerLog,
          retest: retestData,
          blindspotReport
        });
        sessionId = sessionDoc._id.toString();
        room.sessionId = sessionId;
        logger.info(`Persisted GameSession ${sessionId} for room ${room.pin}`);
      }
    } catch (dbErr) {
      logger.error(`Failed to persist/update GameSession for room ${room.pin}: ${dbErr.message}`);
    }

    if (io) {
      // Host and display payload
      const gameEndPayload = {
        sessionId,
        podium,
        finalLeaderboard,
        blindspotReport,
        leaderboardMode: room.settings?.leaderboardMode || 'competitive',
        retest: retestData,
        retestCompleted: !!room.retestCompleted
      };

      io.to(`${room.pin}:host`).emit('game:ended', gameEndPayload);
      io.to(`${room.pin}:display`).emit('game:ended', gameEndPayload);

      // Player private payloads with Revision Receipt token and finalLeaderboard
      for (const p of ranked) {
        if (p.socketId && p.connected) {
          const rawReceiptToken = playerReceiptTokens.get(p.playerId);
          const pSummary = playersSummary.find((s) => s.playerId === p.playerId);
          const playerLeaderboard = buildFinalLeaderboard({
            ranked,
            setting: room.settings?.finalLeaderboard || 'full',
            recipientPlayerId: p.playerId,
            totalQuestions: room.quiz.questions?.length || 0
          });

          const pCorrect = (p.history || []).filter((h) => (!h.round || h.round === 'main') && h.isCorrect).length;
          const pAnswered = (p.history || []).filter(
            (h) => (!h.round || h.round === 'main') && h.selectedIndex !== null && h.selectedIndex !== undefined
          ).length;
          const pAccuracy = pAnswered > 0 ? Number((pCorrect / pAnswered).toFixed(3)) : 0;
          const pRetestItem = retestData?.perPlayer?.find((item) => item.playerId === p.playerId) || null;

          const playerPayload = {
            rank: p.rank,
            score: p.score,
            totalPlayers: allPlayers.length,
            finalLeaderboard: playerLeaderboard,
            podium: podium.map((pod) => ({ name: pod.name, score: pod.score, rank: pod.rank })),
            you: {
              rank: p.rank,
              score: p.score,
              correct: pCorrect,
              answered: pAnswered,
              totalQuestions: room.quiz.questions?.length || 0,
              accuracy: pAccuracy,
              streak: p.streak,
              missedTopics: pSummary?.missedTopics || []
            },
            retest: retestData
              ? {
                  beforeAccuracy: retestData.beforeAccuracy,
                  afterAccuracy: retestData.afterAccuracy,
                  headline: retestData.headline,
                  perQuestion: retestData.perQuestion,
                  perTopic: retestData.perTopic,
                  score: pRetestItem?.score || p.retestScore || 0,
                  correct: pRetestItem?.correct || 0,
                  total: pRetestItem?.total || (room.retestQuestionIndexes?.length || 0),
                  improvedCount: pRetestItem?.improvedCount || 0
                }
              : null,
            receiptToken: rawReceiptToken,
            receiptUrl: rawReceiptToken ? `/r/${rawReceiptToken}` : null
          };
          io.to(p.socketId).emit('game:ended', playerPayload);
          io.to(p.socketId).emit('player:game-ended', playerPayload);
        }
      }
    }

    return {
      ok: true,
      sessionId,
      podium,
      finalLeaderboard,
      blindspotReport
    };
  }
}
