import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client.js';
import { TILE_CONFIG } from '../components/AnswerTile.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import Bar from '../components/ui/Bar.jsx';
import {
  FileText,
  Printer,
  BookOpen,
  CheckCircle2,
  HelpCircle,
  Loader2,
  ArrowRight,
  Check,
  Trophy,
  Target
} from 'lucide-react';

export default function RevisionReceipt() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState(null);

  // Practice mode state
  const [practiceMode, setPracticeMode] = useState(false);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [practiceSelected, setPracticeSelected] = useState(null);
  const [practiceRevealed, setPracticeRevealed] = useState(false);

  useEffect(() => {
    async function fetchReceipt() {
      try {
        setLoading(true);
        const res = await api.get(`/api/receipts/${token}`);
        if (res.data?.ok) {
          setReceipt(res.data.data);
        } else {
          setError('Could not load revision receipt.');
        }
      } catch (err) {
        setError(err.response?.data?.error?.message || 'Revision receipt not found or expired.');
      } finally {
        setLoading(false);
      }
    }
    fetchReceipt();
  }, [token]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center text-text-muted">
        <Loader2 className="w-8 h-8 text-accent animate-spin mb-3" />
        <p className="text-sm">Preparing your Revision Receipt...</p>
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-6 text-text">
        <div className="max-w-md w-full bg-surface border border-border rounded-lg p-8 text-center shadow-sm">
          <FileText className="w-12 h-12 text-danger mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Receipt Not Available</h1>
          <p className="text-sm text-text-muted mb-6">{error}</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent/90 text-accent-fg font-semibold rounded text-sm transition"
          >
            Return to ReviseLive
          </Link>
        </div>
      </div>
    );
  }

  const {
    quizTitle,
    date,
    name,
    score,
    rank,
    totalPlayers,
    correctCount,
    answeredCount,
    missedQuestions = [],
    blindspotTopics = []
  } = receipt;

  const currentPracticeQ = missedQuestions[practiceIndex];

  return (
    <div className="min-h-screen bg-bg text-text selection:bg-accent selection:text-accent-fg print:bg-white print:text-black">
      {/* Printable Style Inject */}
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .receipt-paper { box-shadow: none !important; border: 1px solid var(--border) !important; max-width: 100% !important; margin: 0 !important; }
        }
      `}</style>

      {/* Top Navbar */}
      <header className="no-print border-b border-border bg-surface/95 backdrop-blur-sm px-4 sm:px-6 py-3 sticky top-0 z-30 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-text font-semibold text-sm">
          <div className="w-6 h-6 rounded bg-accent text-accent-fg flex items-center justify-center font-bold text-xs">
            RL
          </div>
          <span className="font-semibold tracking-tight">ReviseLive</span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setPracticeMode((prev) => !prev)}
            className="px-3 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 font-semibold rounded text-xs flex items-center gap-1.5 transition cursor-pointer min-h-[36px]"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{practiceMode ? 'View Full Receipt' : 'Practice Missed Questions'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-3 py-1.5 bg-bg-subtle hover:bg-surface border border-border text-text font-semibold rounded text-xs flex items-center gap-1.5 transition cursor-pointer min-h-[36px]"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Receipt</span>
          </button>

          <ThemeToggle />
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-3xl mx-auto p-4 sm:p-8">
        {practiceMode && missedQuestions.length > 0 ? (
          /* ==========================================
             PRACTICE MODE (Self-Marking Revision)
             ========================================== */
          <div className="bg-surface border border-border rounded-lg p-6 sm:p-8 shadow-sm">
            <div className="flex items-center justify-between border-b border-border pb-4 mb-6">
              <div>
                <span className="text-xs uppercase font-bold tracking-wider text-accent">
                  Interactive Practice Mode
                </span>
                <h2 className="text-xl font-bold">
                  Question {practiceIndex + 1} of {missedQuestions.length}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPracticeMode(false)}
                className="text-xs text-text-muted hover:text-text transition cursor-pointer"
              >
                Exit Practice
              </button>
            </div>

            {/* Question Text */}
            <div className="mb-6">
              <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-bg-subtle text-text-muted mb-2 inline-block border border-border">
                {currentPracticeQ.topicTag || 'General'}
              </span>
              <p className="text-lg sm:text-xl font-bold text-text leading-snug">
                {currentPracticeQ.questionText}
              </p>
            </div>

            {/* Options */}
            <div className="space-y-2.5 mb-6">
              {(currentPracticeQ.options || []).map((optText, oIdx) => {
                const tile = TILE_CONFIG[oIdx];
                const isSelected = practiceSelected === oIdx;
                const isCorrect = currentPracticeQ.correctIndex === oIdx;

                let cardStyle = 'border-border hover:border-accent/40 bg-surface';
                if (practiceRevealed) {
                  if (isCorrect) {
                    cardStyle = 'bg-success/15 border-success text-success font-bold';
                  } else if (isSelected && !isCorrect) {
                    cardStyle = 'bg-danger/15 border-danger text-danger line-through';
                  } else {
                    cardStyle = 'opacity-40 border-border bg-surface';
                  }
                } else if (isSelected) {
                  cardStyle = 'border-accent bg-accent/10 ring-1 ring-accent';
                }

                return (
                  <button
                    key={oIdx}
                    type="button"
                    disabled={practiceRevealed}
                    onClick={() => setPracticeSelected(oIdx)}
                    className={`w-full p-3.5 rounded border text-left flex items-center gap-3 transition cursor-pointer ${cardStyle}`}
                  >
                    <span className={`w-7 h-7 rounded flex items-center justify-center text-xs font-bold shrink-0 ${tile.bgColor} ${tile.textColor}`}>
                      {tile.letter}
                    </span>
                    <span className="text-sm font-medium flex-1">{optText}</span>
                    {practiceRevealed && isCorrect && (
                      <Check className="w-5 h-5 text-success shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Reveal & Concept Anchor */}
            {practiceRevealed ? (
              <div className="space-y-4">
                <div className="p-4 rounded bg-accent/10 border border-accent/20 text-text text-xs leading-relaxed">
                  <div className="flex items-center gap-1.5 font-bold text-accent mb-1 uppercase tracking-wider text-[11px]">
                    <HelpCircle className="w-4 h-4" />
                    <span>Concept Anchor Explanation</span>
                  </div>
                  <p>{currentPracticeQ.explanation}</p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <span className="text-xs text-text-muted">
                    {practiceSelected === currentPracticeQ.correctIndex ? '✓ Correctly answered!' : 'Keep practicing this concept.'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (practiceIndex + 1 < missedQuestions.length) {
                        setPracticeIndex((prev) => prev + 1);
                        setPracticeSelected(null);
                        setPracticeRevealed(false);
                      } else {
                        alert('You have practiced all missed questions! Great job.');
                        setPracticeMode(false);
                      }
                    }}
                    className="px-5 py-2.5 bg-accent hover:bg-accent/90 text-accent-fg font-semibold rounded text-xs flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <span>{practiceIndex + 1 < missedQuestions.length ? 'Next Question' : 'Complete Practice'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={practiceSelected === null}
                onClick={() => setPracticeRevealed(true)}
                className="w-full py-2.5 bg-accent hover:bg-accent/90 disabled:opacity-40 text-accent-fg font-semibold rounded text-sm transition cursor-pointer"
              >
                Check Answer
              </button>
            )}
          </div>
        ) : (
          /* ==========================================
             EXAM NOTEBOOK RECEIPT (Paper Layout)
             ========================================== */
          <div className="receipt-paper bg-surface border border-border rounded-lg p-6 sm:p-10 shadow-sm space-y-8">
            {/* Header / Banner */}
            <div className="border-b border-border pb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-accent">
                  ReviseLive Revision Receipt
                </span>
                <span className="text-xs font-mono text-text-muted">
                  {date ? new Date(date).toLocaleDateString() : 'Class Session'}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text mb-2">
                {quizTitle}
              </h1>

              <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-sm text-text-muted font-mono pt-2">
                <span>Student: <strong className="text-text font-sans">{name}</strong></span>
                <span>Standing: <strong>#{rank}</strong> of {totalPlayers}</span>
                <span>Score: <strong>{score?.toLocaleString() || 0} pts</strong></span>
                <span>Accuracy: <strong>{answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0}%</strong> ({correctCount}/{answeredCount})</span>
              </div>
            </div>

            {/* Topic Mastery Summary */}
            {blindspotTopics.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3 flex items-center gap-2">
                  <Target className="w-3.5 h-3.5 text-accent" />
                  <span>Topic Mastery Radar</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {blindspotTopics.map((topic, idx) => {
                    const acc = Math.round(topic.accuracy * 100);
                    return (
                      <div
                        key={idx}
                        className="p-3.5 rounded bg-bg-subtle border border-border"
                      >
                        <div className="flex justify-between items-center text-xs mb-1.5">
                          <span className="font-bold truncate mr-2">{topic.topicTag}</span>
                          <span className="font-mono text-text-muted">{acc}%</span>
                        </div>
                        <Bar
                          value={acc}
                          max={100}
                          orientation="horizontal"
                          color={acc >= 75 ? 'bg-success' : acc >= 50 ? 'bg-warning' : 'bg-danger'}
                          trackClassName="w-full h-1.5 rounded-full bg-border"
                          fillClassName="rounded-full"
                          showTrackBorder={false}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Session Leaderboard (F2) */}
            {receipt.finalLeaderboard && receipt.finalLeaderboard.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3 flex items-center gap-2">
                  <Trophy className="w-3.5 h-3.5 text-accent" />
                  <span>Class Standing &amp; Leaderboard</span>
                </h3>
                <div className="overflow-x-auto rounded border border-border bg-bg-subtle/50">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-bg-subtle border-b border-border text-text-muted font-mono uppercase text-[10px]">
                        <th className="py-2.5 px-3 text-center w-14">Rank</th>
                        <th className="py-2.5 px-3">Name</th>
                        <th className="py-2.5 px-3 text-right">Score</th>
                        <th className="py-2.5 px-3 text-right">Solved</th>
                        <th className="py-2.5 px-3 text-right hidden sm:table-cell">Accuracy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {receipt.finalLeaderboard.map((row) => (
                        <tr
                          key={`${row.rank}-${row.name}`}
                          className={row.isYou ? 'bg-accent/15 font-bold text-text' : 'text-text'}
                        >
                          <td className="py-2.5 px-3 text-center font-mono">
                            {row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : `#${row.rank}`}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="break-words">{row.name}</span>
                            {row.isYou && <span className="ml-1.5 px-1.5 py-0.5 rounded bg-accent text-accent-fg text-[10px] font-bold">You</span>}
                            {row.left && <span className="ml-1 px-1 rounded bg-danger/15 border border-danger/30 text-[10px] text-danger">left</span>}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">{row.score?.toLocaleString() || 0}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-text-muted">{row.correct}/{row.answered}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-accent hidden sm:table-cell">{Math.round((row.accuracy || 0) * 100)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Questions to Revise */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-2">
                  <BookOpen className="w-3.5 h-3.5 text-accent" />
                  <span>Review Missed Concepts ({missedQuestions.length})</span>
                </h3>
                {missedQuestions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPracticeMode(true)}
                    className="no-print text-xs font-semibold text-accent hover:underline transition cursor-pointer"
                  >
                    Start Practice →
                  </button>
                )}
              </div>

              {missedQuestions.length === 0 ? (
                <div className="p-6 rounded bg-success/10 border border-success/30 text-center text-success">
                  <CheckCircle2 className="w-8 h-8 text-success mx-auto mb-2" />
                  <p className="font-bold text-sm">Perfect Score on Missed Items!</p>
                  <p className="text-xs text-success/80 mt-1">
                    You demonstrated mastery across all questions in this session.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {missedQuestions.map((q, idx) => (
                    <div
                      key={idx}
                      className="p-4 sm:p-5 rounded bg-bg-subtle border border-border space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-surface border border-border text-text-muted">
                          {q.topicTag || 'General'}
                        </span>
                        <span className="text-xs font-mono text-text-muted">
                          #{idx + 1}
                        </span>
                      </div>

                      <h4 className="text-base font-bold text-text leading-snug">
                        {q.questionText}
                      </h4>

                      {/* Correct Answer Highlight */}
                      <div className="p-3 rounded bg-success/15 border border-success/30 text-success text-xs flex items-center gap-2.5">
                        <Check className="w-4 h-4 text-success shrink-0 font-bold" />
                        <div>
                          <span className="font-bold uppercase text-[10px] block text-success">
                            Correct Answer
                          </span>
                          <span className="font-medium text-text">
                            {q.options?.[q.correctIndex]}
                          </span>
                        </div>
                      </div>

                      {/* Top Distractor Misconception Note */}
                      {q.topDistractorRationale && (
                        <div className="p-3 rounded bg-warning/15 border border-warning/30 text-text text-xs">
                          <span className="font-bold uppercase text-[10px] block text-warning mb-0.5">
                            Common Classroom Misconception
                          </span>
                          <p className="text-text-muted">
                            {q.topDistractorRationale}
                          </p>
                        </div>
                      )}

                      {/* Concept Anchor */}
                      {q.explanation && (
                        <div className="p-3 rounded bg-surface border border-border text-xs leading-relaxed">
                          <span className="font-bold uppercase text-[10px] block text-accent mb-1">
                            Concept Anchor
                          </span>
                          <p className="text-text-muted">
                            {q.explanation}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Receipt Footer */}
            <div className="border-t border-border pt-6 text-center text-xs text-text-muted font-mono">
              ReviseLive • Learning science in the classroom • Take this receipt home to guide your revision!
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
