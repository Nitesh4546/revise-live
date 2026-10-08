import { useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy,
  Search,
  ArrowLeft,
  Copy,
  Check,
  FileText,
  Target,
  Flame,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Award,
  RotateCcw
} from 'lucide-react';
import ThemeToggle from './ThemeToggle.jsx';

const PAGE_SIZE = 25;

export default function FinalLeaderboard({
  pin,
  you = {},
  totalPlayers = 1,
  leaderboard = [],
  receiptToken = null,
  retestData = null,
  onExit = () => {}
}) {
  const [activeTab, setActiveTab] = useState('leaderboard'); // 'leaderboard' | 'my-results' | 'retest'
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedLink, setCopiedLink] = useState(false);
  const selfRowRef = useRef(null);
  const tableContainerRef = useRef(null);

  const myRank = you?.rank ?? (leaderboard.find((p) => p.isYou)?.rank || '—');
  const myScore = you?.score ?? (leaderboard.find((p) => p.isYou)?.score || 0);
  const myCorrect = you?.correct ?? (leaderboard.find((p) => p.isYou)?.correct || 0);
  const myAnswered = you?.answered ?? (leaderboard.find((p) => p.isYou)?.answered || 0);
  const myAccuracy = you?.accuracy !== undefined
    ? you.accuracy
    : (leaderboard.find((p) => p.isYou)?.accuracy || (myAnswered > 0 ? myCorrect / myAnswered : 0));
  const myAccuracyPercent = Math.round((myAccuracy || 0) * 100);

  // Filter leaderboard by search query
  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return leaderboard;
    const q = searchQuery.toLowerCase().trim();
    return leaderboard.filter((p) => p.name?.toLowerCase().includes(q));
  }, [leaderboard, searchQuery]);

  // Total pages
  const totalPages = Math.max(1, Math.ceil(filteredList.length / PAGE_SIZE));

  // Clamped current page
  const page = Math.min(Math.max(1, currentPage), totalPages);

  // Paginated window for performance with 300+ players
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredList.slice(start, start + PAGE_SIZE);
  }, [filteredList, page]);

  // Is "you" on the current page?
  const isYouOnCurrentPage = paginatedRows.some((p) => p.isYou);
  const youRowData = useMemo(() => leaderboard.find((p) => p.isYou) || null, [leaderboard]);

  // Jump to user's row
  const handleJumpToMe = () => {
    if (!youRowData) return;
    setSearchQuery(''); // clear filter to ensure self is in list
    const myIndex = leaderboard.findIndex((p) => p.isYou);
    if (myIndex >= 0) {
      const targetPage = Math.floor(myIndex / PAGE_SIZE) + 1;
      setCurrentPage(targetPage);
      setTimeout(() => {
        if (selfRowRef.current) {
          selfRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
    }
  };

  const handleCopyReceipt = () => {
    if (!receiptToken) return;
    const url = `${window.location.origin}/r/${receiptToken}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col min-h-[90vh] py-2 px-3 sm:px-4 text-text">
      {/* Pinned Top Bar with Exit button and ThemeToggle */}
      <header className="flex items-center justify-between pb-3 border-b border-border gap-2">
        <button
          type="button"
          onClick={onExit}
          aria-label="Exit game"
          className="min-h-[44px] min-w-[44px] px-3.5 py-2 rounded bg-bg-subtle hover:bg-surface border border-border text-text text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Exit</span>
        </button>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[11px] font-mono text-text-muted">PIN: {pin}</span>
            <span className="text-[11px] font-bold text-accent block">Game Complete</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Standing Header Card */}
      <section className="bg-surface border border-border rounded-lg p-5 sm:p-6 my-4 shadow-sm text-center relative overflow-hidden">
        <div className="w-12 h-12 rounded-lg bg-accent/15 text-accent flex items-center justify-center mx-auto mb-2 shadow-xs">
          <Trophy className="w-6 h-6" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-text tracking-tight">
          You ranked #{myRank} of {totalPlayers}
        </h1>

        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mt-3 pt-3 border-t border-border text-xs sm:text-sm font-mono text-text">
          <div className="flex items-center gap-1.5">
            <span className="text-text-muted">Score:</span>
            <strong className="text-accent font-bold">{myScore.toLocaleString()} pts</strong>
          </div>
          <span className="text-border">•</span>
          <div className="flex items-center gap-1.5">
            <span className="text-text-muted">Solved:</span>
            <strong className="text-success font-bold">{myCorrect}/{myAnswered || totalPlayers ? myAnswered : '—'}</strong>
          </div>
          <span className="text-border">•</span>
          <div className="flex items-center gap-1.5">
            <span className="text-text-muted">Accuracy:</span>
            <strong className="text-accent font-bold">{myAccuracyPercent}%</strong>
          </div>
        </div>
      </section>

      {/* Tab Controls */}
      <nav aria-label="Leaderboard views" className="flex items-center gap-2 mb-4 p-1 bg-bg-subtle border border-border rounded">
        <button
          type="button"
          onClick={() => setActiveTab('leaderboard')}
          className={`flex-1 min-h-[44px] py-2 rounded font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
            activeTab === 'leaderboard'
              ? 'bg-accent text-accent-fg shadow-xs'
              : 'text-text-muted hover:text-text hover:bg-surface'
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span>Leaderboard</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('my-results')}
          className={`flex-1 min-h-[44px] py-2 rounded font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
            activeTab === 'my-results'
              ? 'bg-accent text-accent-fg shadow-xs'
              : 'text-text-muted hover:text-text hover:bg-surface'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>My Results</span>
        </button>

        {retestData && (
          <button
            type="button"
            onClick={() => setActiveTab('retest')}
            className={`flex-1 min-h-[44px] py-2 rounded font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeTab === 'retest'
                ? 'bg-accent text-accent-fg shadow-xs'
                : 'text-text-muted hover:text-text hover:bg-surface'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>Retest</span>
          </button>
        )}
      </nav>

      {/* TAB 1: LEADERBOARD */}
      {activeTab === 'leaderboard' && (
        <section className="flex-1 flex flex-col space-y-3">
          {/* Controls: Search and Jump To Me */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by name..."
                aria-label="Search players by name"
                className="w-full min-h-[44px] pl-9 pr-3 py-2 bg-surface border border-border rounded text-xs text-text placeholder-text-muted focus:outline-hidden focus:ring-2 focus:ring-focus-ring transition"
              />
            </div>

            {youRowData && (
              <button
                type="button"
                onClick={handleJumpToMe}
                className="min-h-[44px] px-3.5 py-2 bg-bg-subtle hover:bg-surface border border-border text-accent font-semibold text-xs rounded flex items-center gap-1.5 transition shrink-0 cursor-pointer"
              >
                <Target className="w-4 h-4" />
                <span>Jump to me</span>
              </button>
            )}
          </div>

          {/* Leaderboard Table */}
          <div
            ref={tableContainerRef}
            className="flex-1 bg-surface border border-border rounded-lg overflow-hidden shadow-xs flex flex-col"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-bg-subtle border-b border-border text-text-muted font-mono uppercase text-[10px] tracking-wider">
                    <th scope="col" className="py-2.5 px-3 w-14 text-center">Rank</th>
                    <th scope="col" className="py-2.5 px-3">Name</th>
                    <th scope="col" className="py-2.5 px-3 text-right">Score</th>
                    <th scope="col" className="py-2.5 px-3 text-right">Solved</th>
                    <th scope="col" className="py-2.5 px-3 text-right hidden sm:table-cell">Accuracy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-text-muted">
                        No players match &ldquo;{searchQuery}&rdquo;
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((player) => {
                      const isYou = !!player.isYou;
                      const accuracyPct = Math.round((player.accuracy || 0) * 100);

                      return (
                        <tr
                          key={`${player.rank}-${player.name}`}
                          ref={isYou ? selfRowRef : null}
                          className={`transition ${
                            isYou
                              ? 'bg-accent/15 border-y border-accent text-text font-bold'
                              : 'hover:bg-bg-subtle text-text'
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center font-mono">
                            {player.rank === 1 ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-accent/10 text-accent font-bold" title="1st Place">
                                🥇
                              </span>
                            ) : player.rank === 2 ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-bg-subtle text-text-muted font-bold" title="2nd Place">
                                🥈
                              </span>
                            ) : player.rank === 3 ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-accent/5 text-accent font-bold" title="3rd Place">
                                🥉
                              </span>
                            ) : (
                              <span className="text-text-muted">#{player.rank}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="break-words max-w-[150px] sm:max-w-[200px]">{player.name}</span>
                              {isYou && (
                                <span className="px-1.5 py-0.5 rounded bg-accent text-accent-fg text-[10px] font-bold uppercase tracking-wider">
                                  You
                                </span>
                              )}
                              {player.left && (
                                <span className="px-1.5 py-0.5 rounded bg-danger/15 border border-danger/30 text-danger text-[10px] font-semibold">
                                  left
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-text">
                            {player.score?.toLocaleString() || 0}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-text-muted">
                            {player.correct}/{player.answered || '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-accent hidden sm:table-cell">
                            {accuracyPct}%
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination footer if > 25 players */}
            {totalPages > 1 && (
              <div className="mt-auto p-3 border-t border-border bg-bg-subtle flex items-center justify-between text-xs text-text-muted">
                <span>
                  Page {page} of {totalPages} ({filteredList.length} total)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    aria-label="Previous page"
                    className="min-h-[44px] min-w-[44px] p-2 rounded bg-surface border border-border hover:bg-bg-subtle disabled:opacity-30 disabled:pointer-events-none text-text transition flex items-center justify-center cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    aria-label="Next page"
                    className="min-h-[44px] min-w-[44px] p-2 rounded bg-surface border border-border hover:bg-bg-subtle disabled:opacity-30 disabled:pointer-events-none text-text transition flex items-center justify-center cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sticky Self-Row Banner when off-page */}
          {youRowData && !isYouOnCurrentPage && (
            <div className="p-3 bg-accent/15 border border-accent rounded-lg flex items-center justify-between text-xs text-text shadow-sm">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-accent">#{youRowData.rank}</span>
                <span className="font-bold">{youRowData.name} (You)</span>
                <span className="text-text-muted font-mono">• {youRowData.score?.toLocaleString()} pts</span>
              </div>
              <button
                type="button"
                onClick={handleJumpToMe}
                className="min-h-[44px] px-3.5 py-1.5 bg-accent hover:bg-accent/90 text-accent-fg font-semibold rounded text-xs flex items-center gap-1 transition cursor-pointer"
              >
                <span>Jump</span>
              </button>
            </div>
          )}
        </section>
      )}

      {/* TAB 2: MY RESULTS */}
      {activeTab === 'my-results' && (
        <section className="space-y-4">
          {/* Personal Summary Card */}
          <div className="bg-surface border border-border rounded-lg p-5 space-y-4 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-2">
              <Award className="w-4 h-4 text-accent" />
              <span>Personal Performance</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 bg-bg-subtle rounded border border-border">
                <span className="text-[11px] text-text-muted block mb-0.5">Final Rank</span>
                <span className="text-xl font-bold text-accent font-mono">#{myRank}</span>
              </div>
              <div className="p-3 bg-bg-subtle rounded border border-border">
                <span className="text-[11px] text-text-muted block mb-0.5">Total Score</span>
                <span className="text-xl font-bold text-text font-mono">{myScore.toLocaleString()}</span>
              </div>
              <div className="p-3 bg-bg-subtle rounded border border-border">
                <span className="text-[11px] text-text-muted block mb-0.5">Accuracy</span>
                <span className="text-xl font-bold text-accent font-mono">{myAccuracyPercent}%</span>
              </div>
              <div className="p-3 bg-bg-subtle rounded border border-border">
                <span className="text-[11px] text-text-muted block mb-0.5">Best Streak</span>
                <span className="text-xl font-bold text-warning font-mono flex items-center justify-center gap-1">
                  <Flame className="w-4 h-4 fill-warning" />
                  {you?.streak || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Topics to Revise */}
          <div className="bg-surface border border-border rounded-lg p-5 space-y-3 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-accent" />
              <span>Topics to Revise</span>
            </h3>

            {you?.missedTopics && you.missedTopics.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-text-muted">
                  Based on missed questions and high-confidence errors in this session:
                </p>
                <div className="flex flex-wrap gap-2">
                  {you.missedTopics.map((topic, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded bg-warning/15 border border-warning/30 text-warning font-semibold text-xs"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded bg-success/15 border border-success/30 text-success text-xs text-center font-medium">
                No weak topics flagged! You demonstrated high mastery across all topics.
              </div>
            )}
          </div>

          {/* Revision Receipt Link */}
          {receiptToken && (
            <div className="bg-surface border border-border rounded-lg p-5 space-y-3 shadow-sm">
              <div className="flex items-center gap-2 text-accent">
                <FileText className="w-5 h-5" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-text">
                  Take-Home Revision Receipt
                </h3>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                Review all your mistakes with full Concept Anchor explanations and interactive practice mode!
              </p>
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <Link
                  to={`/r/${receiptToken}`}
                  className="flex-1 min-h-[44px] py-2.5 px-4 bg-accent hover:bg-accent/90 text-accent-fg font-semibold rounded text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  <span>Open My Revision Receipt</span>
                </Link>
                <button
                  type="button"
                  onClick={handleCopyReceipt}
                  aria-label="Copy receipt link"
                  className="min-h-[44px] px-4 py-2.5 bg-bg-subtle hover:bg-surface border border-border text-text font-semibold rounded text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0"
                  title="Copy receipt link"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* TAB 3: RETEST RESULTS */}
      {activeTab === 'retest' && retestData && (
        <section className="bg-surface border border-border rounded-lg p-5 space-y-4 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-accent" />
            <span>Retest Round Results</span>
          </h3>

          {retestData.headline && (
            <div className="p-3.5 bg-accent/10 border border-accent/20 rounded text-accent text-xs font-semibold leading-relaxed">
              {retestData.headline}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-4 bg-bg-subtle border border-border rounded">
              <span className="text-text-muted block mb-0.5">Retest Score</span>
              <strong className="text-accent text-lg font-mono font-bold">
                {retestData.score || 0} pts
              </strong>
            </div>
            <div className="p-4 bg-bg-subtle border border-border rounded">
              <span className="text-text-muted block mb-0.5">Solved</span>
              <strong className="text-text text-lg font-mono font-bold">
                {retestData.correct || 0} / {retestData.total || 0}
              </strong>
            </div>
          </div>

          {typeof retestData.improvedCount === 'number' && retestData.improvedCount > 0 && (
            <div className="p-3 bg-success/15 border border-success/30 rounded text-success text-xs flex items-center gap-2">
              <Award className="w-4 h-4 shrink-0" />
              <span>
                <strong>{retestData.improvedCount}</strong> question{retestData.improvedCount === 1 ? '' : 's'} improved from the main round!
              </span>
            </div>
          )}

          {Array.isArray(retestData.perQuestion) && retestData.perQuestion.length > 0 && (
            <div className="space-y-2 pt-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted block">
                Class Improvement per Question
              </span>
              {retestData.perQuestion.map((q, idx) => (
                <div key={idx} className="p-3 bg-bg-subtle border border-border rounded text-xs space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-text line-clamp-2">{q.questionText}</span>
                    <span className={`font-mono text-xs font-bold shrink-0 ${q.improvementPct >= 0 ? 'text-success' : 'text-danger'}`}>
                      {q.improvementPct >= 0 ? `+${q.improvementPct}%` : `${q.improvementPct}%`}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-text-muted">
                    <span>Before: {Math.round(q.beforeAccuracy * 100)}%</span>
                    <span>→</span>
                    <span>After: {Math.round(q.afterAccuracy * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
