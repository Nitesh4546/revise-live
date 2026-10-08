import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { sessionApi } from '../api/sessionApi.js';
import BlindspotRadar from '../components/BlindspotRadar.jsx';
import AppHeader from '../components/AppHeader.jsx';
import BackButton from '../components/BackButton.jsx';
import { Button, Badge } from '../components/ui/index.js';
import {
  Calendar,
  Users,
  Download,
  AlertCircle,
  Loader2,
  Trophy,
  BookOpen,
  FileText,
} from 'lucide-react';

export default function SessionReport() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingStudentId, setDownloadingStudentId] = useState(null);
  const [downloadNotification, setDownloadNotification] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await sessionApi.get(id);
        setSession(data.session);
      } catch (err) {
        setError(err.response?.data?.error?.message || 'Failed to load session report.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const handleExportClassPdf = async () => {
    try {
      setDownloadingPdf(true);
      setDownloadNotification({ type: 'info', message: 'Generating Class Report PDF...' });
      const res = await sessionApi.downloadClassPdf(session._id);
      if (res.ok) {
        setDownloadNotification({ type: 'success', message: `Downloaded ${res.filename}` });
      } else {
        setDownloadNotification({ type: 'error', message: res.error || 'Failed to download PDF' });
      }
    } catch (err) {
      setDownloadNotification({ type: 'error', message: err.message || 'Failed to download PDF' });
    } finally {
      setDownloadingPdf(false);
      setTimeout(() => setDownloadNotification(null), 4000);
    }
  };

  const handleExportStudentPdf = async (playerId, playerName) => {
    try {
      setDownloadingStudentId(playerId);
      setDownloadNotification({ type: 'info', message: `Generating Report PDF for ${playerName}...` });
      const res = await sessionApi.downloadStudentPdf(session._id, playerId, playerName);
      if (res.ok) {
        setDownloadNotification({ type: 'success', message: `Downloaded ${res.filename}` });
      } else {
        setDownloadNotification({ type: 'error', message: res.error || 'Failed to download PDF' });
      }
    } catch (err) {
      setDownloadNotification({ type: 'error', message: err.message || 'Failed to download PDF' });
    } finally {
      setDownloadingStudentId(null);
      setTimeout(() => setDownloadNotification(null), 4000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg text-text flex flex-col font-sans">
        <AppHeader />
        <div className="flex-1 flex flex-col items-center justify-center py-20">
          <Loader2 className="w-7 h-7 text-accent animate-spin mb-3" />
          <p className="text-xs sm:text-sm text-text-muted">Loading session report...</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-bg text-text flex flex-col font-sans">
        <AppHeader />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <AlertCircle className="w-10 h-10 text-danger mb-3" />
          <h2 className="text-xl font-bold mb-2">{error || 'Session not found'}</h2>
          <Button variant="secondary" size="sm" onClick={() => navigate('/host/sessions')}>
            Back to Sessions
          </Button>
        </div>
      </div>
    );
  }

  const dateStr = session.endedAt
    ? new Date(session.endedAt).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col font-sans transition-colors">
      <AppHeader />

      {/* Report Sub-Header */}
      <div className="border-b border-border bg-surface/90 sticky top-14 z-30 px-4 sm:px-6 py-3">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BackButton fallback="/host/sessions" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-semibold tracking-tight text-text">
                  {session.quizTitle}
                </h1>
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-[var(--radius-sm,4px)] bg-bg-subtle text-text border border-border">
                  PIN {session.pin}
                </span>
              </div>
              <p className="text-xs text-text-muted flex items-center gap-3 mt-0.5">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {dateStr}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {session.playerCount} students
                </span>
              </p>
            </div>
          </div>

          {/* Consistent Export Button Group */}
          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportClassPdf}
              disabled={downloadingPdf}
              className="gap-1.5"
            >
              {downloadingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-accent" />
              )}
              <span>Export PDF</span>
            </Button>

            <a
              href={`/api/sessions/${session._id}/export.csv`}
              download
              className="inline-flex items-center justify-center font-medium rounded-[var(--radius-sm,4px)] h-8 px-3 text-xs gap-1.5 bg-surface hover:bg-surface-hover text-text border border-border transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </a>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 space-y-8">
        {downloadNotification && (
          <div
            className={`p-3.5 rounded-[var(--radius-sm,4px)] text-xs flex items-center gap-2.5 border transition ${
              downloadNotification.type === 'error'
                ? 'bg-danger/10 border-danger/30 text-danger'
                : downloadNotification.type === 'success'
                ? 'bg-success/10 border-success/30 text-success'
                : 'bg-bg-subtle border-border text-text'
            }`}
          >
            {downloadNotification.type === 'info' && <Loader2 className="w-4 h-4 animate-spin shrink-0 text-accent" />}
            {downloadNotification.type === 'success' && <FileText className="w-4 h-4 shrink-0 text-success" />}
            {downloadNotification.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0 text-danger" />}
            <span>{downloadNotification.message}</span>
          </div>
        )}

        {/* Blindspot Radar Diagnostic Summary */}
        <BlindspotRadar report={session.blindspotReport} />

        {/* Student Results Table Card */}
        <div className="bg-surface border border-border rounded-[var(--radius-md,8px)] p-5 sm:p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-4 h-4 text-accent" />
            <h2 className="text-base sm:text-lg font-semibold tracking-tight text-text">
              Student Performance Record
            </h2>
          </div>

          <div className="overflow-x-auto border border-border rounded-[var(--radius-sm,4px)]">
            <table className="w-full text-left text-sm text-text border-collapse">
              <thead className="bg-bg-subtle text-text-muted text-xs uppercase font-semibold border-b border-border">
                <tr>
                  <th className="py-2.5 px-3.5 font-semibold">Rank</th>
                  <th className="py-2.5 px-3.5 font-semibold">Student</th>
                  <th className="py-2.5 px-3.5 font-semibold">Score</th>
                  <th className="py-2.5 px-3.5 font-semibold">Correct</th>
                  <th className="py-2.5 px-3.5 font-semibold">Accuracy</th>
                  <th className="py-2.5 px-3.5 font-semibold">Topics to Revise</th>
                  <th className="py-2.5 px-3.5 text-right font-semibold">Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-medium">
                {(session.players || []).map((p, idx) => {
                  const acc =
                    p.answeredCount > 0 ? Math.round((p.correctCount / p.answeredCount) * 100) : 0;
                  return (
                    <tr key={idx} className="hover:bg-surface-hover/70 transition-colors">
                      <td className="py-2.5 px-3.5 font-mono font-semibold">
                        <span
                          className={`w-6 h-6 rounded-[var(--radius-sm,4px)] inline-flex items-center justify-center text-xs font-bold ${
                            p.rank === 1
                              ? 'bg-accent text-accent-fg'
                              : p.rank === 2
                              ? 'bg-bg-subtle text-text border border-border'
                              : p.rank === 3
                              ? 'bg-bg-subtle text-text-muted border border-border'
                              : 'bg-bg-subtle text-text border border-border'
                          }`}
                        >
                          #{p.rank}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 font-semibold text-text">{p.name}</td>
                      <td className="py-2.5 px-3.5 font-mono text-accent">
                        {p.finalScore?.toLocaleString() || 0}
                      </td>
                      <td className="py-2.5 px-3.5 text-text-muted font-mono">
                        {p.correctCount} / {p.answeredCount}
                      </td>
                      <td className="py-2.5 px-3.5">
                        <span
                          className={`font-mono font-bold ${
                            acc >= 75
                              ? 'text-success'
                              : acc >= 50
                              ? 'text-warning'
                              : 'text-danger'
                          }`}
                        >
                          {acc}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5">
                        {p.missedTopics?.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {p.missedTopics.map((topic, tIdx) => (
                              <Badge key={tIdx} variant="danger">
                                {topic}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-success text-xs flex items-center gap-1">
                            <BookOpen className="w-3.5 h-3.5" /> Full mastery
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3.5 text-right">
                        <button
                          type="button"
                          title={`Download report for ${p.name}`}
                          aria-label={`Download PDF report for ${p.name}`}
                          onClick={() => handleExportStudentPdf(p.playerId, p.name)}
                          disabled={downloadingStudentId === p.playerId}
                          className="p-1.5 text-text-muted hover:text-text hover:bg-surface-hover rounded-[var(--radius-sm,4px)] transition-colors cursor-pointer"
                        >
                          {downloadingStudentId === p.playerId ? (
                            <Loader2 className="w-4 h-4 animate-spin text-accent" />
                          ) : (
                            <FileText className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
