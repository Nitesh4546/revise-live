/**
 * Guards against CSV injection by prefixing formula characters (=, +, -, @) with a single quote.
 * Escapes quotes and commas according to RFC 4180.
 */
export function sanitizeCsvCell(value) {
  if (value === null || value === undefined) return '""';
  let str = String(value).trim();

  // Guard against CSV injection formula execution in Excel/Sheets
  if (/^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }

  // Escape inner double quotes
  str = str.replace(/"/g, '""');

  return `"${str}"`;
}

/**
 * Generates CSV string for a finished GameSession report
 */
export function generateSessionCsv(session) {
  const lines = [];

  // Session Summary Header
  lines.push(['ReviseLive Session Report', session.quizTitle].map(sanitizeCsvCell).join(','));
  lines.push(['Game PIN', session.pin].map(sanitizeCsvCell).join(','));
  lines.push(['Date', new Date(session.endedAt).toLocaleDateString()].map(sanitizeCsvCell).join(','));
  lines.push(['Total Players', session.playerCount].map(sanitizeCsvCell).join(','));
  lines.push(['Overall Accuracy', `${Math.round((session.blindspotReport?.overallAccuracy || 0) * 100)}%`].map(sanitizeCsvCell).join(','));
  lines.push([]); // blank line

  // Player Results Table
  lines.push(['Rank', 'Player Name', 'Final Score', 'Correct Answers', 'Total Answered', 'Accuracy', 'Topics to Revise'].map(sanitizeCsvCell).join(','));

  (session.players || []).forEach((player) => {
    const accuracy = player.answeredCount > 0 ? `${Math.round((player.correctCount / player.answeredCount) * 100)}%` : '0%';
    const missed = (player.missedTopics || []).join('; ');
    lines.push(
      [
        player.rank,
        player.name,
        player.finalScore,
        player.correctCount,
        player.answeredCount,
        accuracy,
        missed
      ]
        .map(sanitizeCsvCell)
        .join(',')
    );
  });

  lines.push([]); // blank line

  // Question Diagnostic Breakdown
  lines.push(['Q#', 'Topic Tag', 'Question Text', 'Class Accuracy', 'Correct Count', 'Top Misconception (Distractor)'].map(sanitizeCsvCell).join(','));

  (session.questionStats || []).forEach((stat, idx) => {
    const accuracy = `${Math.round((stat.accuracy || 0) * 100)}%`;
    const distractor = stat.topDistractorIndex !== null ? `Option ${stat.topDistractorIndex + 1}` : 'None';
    lines.push(
      [
        idx + 1,
        stat.topicTag || 'General',
        stat.questionText,
        accuracy,
        stat.correctCount,
        distractor
      ]
        .map(sanitizeCsvCell)
        .join(',')
    );
  });

  return lines.join('\n');
}
