import express from 'express';
import crypto from 'crypto';
import { GameSession } from '../models/GameSession.js';
import { Quiz } from '../models/Quiz.js';

const router = express.Router();

router.get('/:token', async (req, res, next) => {
  try {
    const rawToken = req.params.token.trim();
    if (!rawToken || rawToken.length < 16) {
      return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Invalid or missing receipt token' } });
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const session = await GameSession.findOne({ 'players.receiptTokenHash': tokenHash });
    if (!session) {
      return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Revision receipt not found or expired' } });
    }

    const player = session.players.find((p) => p.receiptTokenHash === tokenHash);
    if (!player) {
      return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Player record not found in session' } });
    }

    let quiz = null;
    if (session.quizId) {
      try {
        quiz = await Quiz.findById(session.quizId);
      } catch {
        quiz = null;
      }
    }

    const missedQuestions = [];
    if (quiz && quiz.questions) {
      session.questionStats.forEach((stat) => {
        const qDef = quiz.questions[stat.questionIndex];
        if (!qDef) return;

        missedQuestions.push({
          questionIndex: stat.questionIndex,
          questionText: qDef.questionText,
          options: qDef.options,
          correctIndex: qDef.correctIndex,
          explanation: qDef.explanation,
          topicTag: qDef.topicTag || 'General',
          distractorRationales: qDef.distractorRationales || [],
          topDistractorRationale: stat.topDistractorRationale || ''
        });
      });
    }

    const sessionSetting = session.settings?.finalLeaderboard || 'full';
    const sortedPlayers = [...(session.players || [])].sort((a, b) => (a.rank || 0) - (b.rank || 0));
    const allLeaderboardRows = sortedPlayers.map((p) => {
      const isYou = p.receiptTokenHash === tokenHash;
      const accuracy = p.answeredCount > 0 ? Number((p.correctCount / p.answeredCount).toFixed(3)) : 0;
      return {
        rank: p.rank,
        name: p.name,
        score: p.finalScore,
        correct: p.correctCount,
        answered: p.answeredCount,
        accuracy,
        isYou,
        left: !!p.left
      };
    });

    let receiptLeaderboard = allLeaderboardRows;
    if (sessionSetting === 'self') {
      receiptLeaderboard = allLeaderboardRows.filter((r) => r.isYou);
    } else if (sessionSetting === 'top10') {
      const top10 = allLeaderboardRows.slice(0, 10);
      const youRow = allLeaderboardRows.find((r) => r.isYou);
      if (youRow && !top10.some((r) => r.isYou)) {
        receiptLeaderboard = [...top10, youRow];
      } else {
        receiptLeaderboard = top10;
      }
    }

    res.json({
      ok: true,
      data: {
        quizTitle: session.quizTitle,
        date: session.endedAt || session.createdAt,
        name: player.name,
        score: player.finalScore,
        rank: player.rank,
        totalPlayers: session.playerCount,
        correctCount: player.correctCount,
        answeredCount: player.answeredCount,
        missedTopics: player.missedTopics || [],
        missedQuestions,
        blindspotTopics: session.blindspotReport?.topics || [],
        finalLeaderboard: receiptLeaderboard
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
