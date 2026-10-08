/**
 * Pure analytics calculations for classroom revision diagnostics
 * and Blindspot Radar report generation.
 */

export function calculateQuestionStats({ question, questionIndex, players, round = null }) {
  const totalPlayers = players.length;
  const correctIndex = question.correctIndex;

  const optionCounts = [0, 0, 0, 0];
  let correctCount = 0;
  let answeredCount = 0;
  let confidentWrongCount = 0;

  players.forEach((p) => {
    const historyItem = (p.history || []).find((h) => {
      if (h.questionIndex !== questionIndex) return false;
      if (round) {
        return (h.round || 'main') === round;
      }
      return true;
    });
    if (historyItem && historyItem.selectedIndex !== null && historyItem.selectedIndex !== undefined) {
      answeredCount++;
      const sel = historyItem.selectedIndex;
      if (sel >= 0 && sel <= 3) {
        optionCounts[sel] = (optionCounts[sel] || 0) + 1;
      }
      if (historyItem.isCorrect) {
        correctCount++;
      } else if (historyItem.confidence === 3) {
        confidentWrongCount++;
      }
    }
  });

  const accuracy = totalPlayers > 0 ? Number((correctCount / totalPlayers).toFixed(3)) : 0;

  // Find top distractor (most-chosen wrong option)
  let topDistractorIndex = null;
  let maxWrongCount = 0;

  for (let i = 0; i < 4; i++) {
    if (i !== correctIndex && optionCounts[i] > maxWrongCount) {
      maxWrongCount = optionCounts[i];
      topDistractorIndex = i;
    }
  }

  const topDistractorRationale =
    topDistractorIndex !== null && question.distractorRationales && question.distractorRationales[topDistractorIndex]
      ? question.distractorRationales[topDistractorIndex]
      : '';

  // Item analysis flags (D4)
  const flags = [];
  if (totalPlayers >= 3) {
    if (accuracy >= 0.95) flags.push('TOO_EASY');
    if (accuracy <= 0.10) flags.push('TOO_HARD');
  }
  if (totalPlayers > 0 && maxWrongCount > totalPlayers * 0.5 && maxWrongCount > correctCount) {
    flags.push('SUSPECT_KEY');
  }

  // Discrimination index (when >= 15 players)
  let discriminationIndex = null;
  if (totalPlayers >= 15) {
    const sorted = [...players].sort((a, b) => b.score - a.score);
    const nCut = Math.max(1, Math.round(totalPlayers * 0.27));
    const topGroup = sorted.slice(0, nCut);
    const bottomGroup = sorted.slice(sorted.length - nCut);

    const topCorrect = topGroup.filter((p) => {
      const h = (p.history || []).find((item) => item.questionIndex === questionIndex);
      return h?.isCorrect;
    }).length;

    const bottomCorrect = bottomGroup.filter((p) => {
      const h = (p.history || []).find((item) => item.questionIndex === questionIndex);
      return h?.isCorrect;
    }).length;

    discriminationIndex = Number(((topCorrect - bottomCorrect) / nCut).toFixed(2));
    if (discriminationIndex < 0.2) {
      flags.push('LOW_DISCRIMINATION');
    }
  }

  return {
    questionIndex,
    questionText: question.questionText,
    topicTag: question.topicTag || 'General',
    correctIndex,
    explanation: question.explanation || '',
    options: question.options || [],
    totalPlayers,
    answeredCount,
    correctCount,
    accuracy,
    optionCounts,
    topDistractorIndex,
    topDistractorCount: maxWrongCount,
    topDistractorRationale,
    confidentWrongCount,
    flags,
    discriminationIndex
  };
}

/**
 * Computes the Blindspot Radar report and per-player missed topics at game conclusion
 */
export function generateBlindspotReport({ quiz, players, questionStatsList }) {
  const threshold = 0.5;

  let totalCorrect = 0;
  let totalOpportunities = 0;

  // Group by topicTag
  const topicMap = new Map();

  // Aggregate misconceptions by rationale
  const misconceptionCounts = new Map(); // rationale -> count

  questionStatsList.forEach((stat) => {
    totalCorrect += stat.correctCount;
    totalOpportunities += stat.totalPlayers;

    const topic = stat.topicTag || 'General';
    if (!topicMap.has(topic)) {
      topicMap.set(topic, { topicTag: topic, correct: 0, total: 0, questionCount: 0, confidentWrong: 0 });
    }
    const topicData = topicMap.get(topic);
    topicData.questionCount += 1;
    topicData.correct += stat.correctCount;
    topicData.total += stat.totalPlayers;
    topicData.confidentWrong += stat.confidentWrongCount || 0;

    if (stat.topDistractorRationale) {
      const rat = stat.topDistractorRationale.trim();
      if (rat) {
        misconceptionCounts.set(rat, (misconceptionCounts.get(rat) || 0) + stat.topDistractorCount);
      }
    }
  });

  const overallAccuracy =
    totalOpportunities > 0 ? Number((totalCorrect / totalOpportunities).toFixed(3)) : 0;

  // Topics array (worst first)
  const topics = Array.from(topicMap.values())
    .map((t) => {
      const accuracy = t.total > 0 ? Number((t.correct / t.total).toFixed(3)) : 0;
      return {
        topicTag: t.topicTag,
        accuracy,
        questionCount: t.questionCount,
        confidentWrong: t.confidentWrong,
        flagged: accuracy < threshold
      };
    })
    .sort((a, b) => a.accuracy - b.accuracy);

  // Weak questions (worst accuracy first)
  const weakQuestions = questionStatsList
    .filter((q) => q.accuracy < threshold)
    .sort((a, b) => a.accuracy - b.accuracy)
    .map((q) => {
      const questionDef = quiz.questions[q.questionIndex] || {};
      const distractorIndex = q.topDistractorIndex;
      const distractorText =
        distractorIndex !== null && questionDef.options ? questionDef.options[distractorIndex] : null;
      const distractorPercent =
        q.totalPlayers > 0 ? Number(((q.topDistractorCount / q.totalPlayers) * 100).toFixed(1)) : 0;

      return {
        questionIndex: q.questionIndex,
        questionText: q.questionText,
        topicTag: q.topicTag,
        accuracy: q.accuracy,
        correctAnswer: questionDef.options ? questionDef.options[q.correctIndex] : '',
        explanation: questionDef.explanation || '',
        topDistractor: {
          index: distractorIndex,
          text: distractorText,
          rationale: q.topDistractorRationale || '',
          percent: distractorPercent
        },
        confidentWrongCount: q.confidentWrongCount || 0,
        flags: q.flags || []
      };
    });

  // Top misconceptions across session
  const topMisconceptions = Array.from(misconceptionCounts.entries())
    .map(([rationale, count]) => ({ rationale, count }))
    .sort((a, b) => b.count - a.count);

  // Confident misconceptions (ranked by confidentWrongCount descending)
  const confidentMisconceptions = questionStatsList
    .filter((q) => (q.confidentWrongCount || 0) > 0)
    .sort((a, b) => (b.confidentWrongCount || 0) - (a.confidentWrongCount || 0))
    .map((q) => {
      const questionDef = quiz.questions[q.questionIndex] || {};
      return {
        questionIndex: q.questionIndex,
        questionText: q.questionText,
        topicTag: q.topicTag,
        confidentWrongCount: q.confidentWrongCount,
        confidentWrongPercent: q.totalPlayers > 0 ? Math.round((q.confidentWrongCount / q.totalPlayers) * 100) : 0,
        correctAnswer: questionDef.options ? questionDef.options[q.correctIndex] : '',
        rationale: q.topDistractorRationale || ''
      };
    });

  // Calculate per-player stats and missed topics
  const playersSummary = players.map((player) => {
    const topicResults = new Map(); // topic -> { correct: 0, total: 0 }
    let answeredCount = 0;
    let correctCount = 0;
    let confidentWrongTopics = new Set();

    (player.history || []).forEach((h) => {
      const q = quiz.questions[h.questionIndex];
      if (q) {
        const topic = q.topicTag || 'General';
        if (!topicResults.has(topic)) {
          topicResults.set(topic, { correct: 0, total: 0 });
        }
        const data = topicResults.get(topic);
        data.total += 1;
        if (h.isCorrect) {
          data.correct += 1;
          correctCount++;
        } else if (h.confidence === 3) {
          confidentWrongTopics.add(topic);
        }
        if (h.selectedIndex !== null && h.selectedIndex !== undefined) {
          answeredCount++;
        }
      }
    });

    // Missed topics: prioritize certain-and-wrong topics first (C2)
    const missedTopicsSet = new Set();
    confidentWrongTopics.forEach((t) => missedTopicsSet.add(t));

    topicResults.forEach((val, topic) => {
      if (val.total === 1 && val.correct === 0) {
        missedTopicsSet.add(topic);
      } else if (val.total > 1 && val.correct / val.total < 0.5) {
        missedTopicsSet.add(topic);
      }
    });

    return {
      playerId: player.playerId,
      name: player.name,
      finalScore: player.score,
      rank: player.rank,
      correctCount,
      answeredCount,
      missedTopics: Array.from(missedTopicsSet),
      history: (player.history || []).map((h) => ({
        questionIndex: h.questionIndex,
        selectedIndex: h.selectedIndex !== undefined ? h.selectedIndex : null,
        isCorrect: Boolean(h.isCorrect),
        score: h.score || 0,
        confidence: h.confidence !== undefined ? h.confidence : null,
        responseTimeMs: h.responseTimeMs !== undefined ? h.responseTimeMs : null,
        round: h.round || 'main'
      }))
    };
  });

  const questionAccuracy = questionStatsList.map((q) => {
    const questionDef = quiz.questions[q.questionIndex] || {};
    return {
      questionIndex: q.questionIndex,
      questionText: q.questionText,
      topicTag: q.topicTag || 'General',
      accuracy: q.accuracy,
      correctAnswer: questionDef.options ? questionDef.options[q.correctIndex] : '',
      topDistractorRationale: q.topDistractorRationale || '',
      topDistractorIndex: q.topDistractorIndex,
      topDistractorText:
        q.topDistractorIndex !== null && questionDef.options ? questionDef.options[q.topDistractorIndex] : null,
      flags: q.flags || [],
      flagged: (q.accuracy ?? 1) < threshold
    };
  });

  return {
    report: {
      threshold,
      overallAccuracy,
      topics,
      weakQuestions,
      questionAccuracy,
      topMisconceptions,
      confidentMisconceptions
    },
    playersSummary
  };
}
