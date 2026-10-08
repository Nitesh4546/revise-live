import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessionApi } from '../api/sessionApi.js';
import AppHeader from '../components/AppHeader.jsx';
import { Button, EmptyState } from '../components/ui/index.js';
import {
  Calendar,
  Users,
  Target,
  Download,
  FileText,
  Loader2,
  AlertCircle,
  History,
} from 'lucide-react';

export default function SessionHistory() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await sessionApi.list();
        setSessions(data.sessions || []);
      } catch (err) {
        setError(err.response?.data?.error?.message || 'Failed to load session history.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col font-sans transition-colors">
      <AppHeader />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text">
            Session history
          </h1>
          <p className="text-xs sm:text-sm text-text-muted mt-1">
            Review past classroom diagnostic revision quiz results and download gradebook exports
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 bg-danger/10 border border-danger/30 rounded-[var(--radius-sm,4px)] flex items-center gap-2.5 text-danger text-xs sm:text-sm">
            <AlertCircle className="w-4 h-4 text-danger shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <Loader2 className="w-7 h-7 text-accent animate-spin mb-3" />
            <p className="text-xs sm:text-sm text-text-muted">Loading past sessions...</p>
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={History}
            title="No finished sessions yet"
            description="When you host a live quiz and finish it, detailed diagnostic reports and student records will appear here."
            action={
              <Button variant="primary" size="md" onClick={() => navigate('/host')}>
                Host a live quiz
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            {sessions.map((s) => {
              const accuracy = Math.round((s.blindspotReport?.overallAccuracy || 0) * 100);
              const dateStr = s.endedAt
                ? new Date(s.endedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Recent';

              return (
                <div
                  key={s._id}
                  className="bg-surface border border-border rounded-[var(--radius-md,8px)] p-5 sm:p-6 shadow-[var(--shadow-card)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2.5 mb-2">
                      <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-[var(--radius-sm,4px)] bg-bg-subtle text-text border border-border">
                        PIN {s.pin}
                      </span>
                      <span className="text-xs text-text-muted flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {dateStr}
                      </span>
                    </div>

                    <h2 className="text-base sm:text-lg font-semibold text-text mb-2">
                      {s.quizTitle}
                    </h2>

                    <div className="flex items-center gap-4 text-xs text-text-muted">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        {s.playerCount} {s.playerCount === 1 ? 'student' : 'students'}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5" />
                        <span className="font-medium text-text">{accuracy}%</span> accuracy
                      </span>
                    </div>
                  </div>

                  {/* Actions Button Group */}
                  <div className="flex items-center gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/60">
                    <a
                      href={`/api/sessions/${s._id}/export.csv`}
                      download
                      className="inline-flex items-center justify-center font-medium rounded-[var(--radius-sm,4px)] h-9 px-3.5 text-xs gap-1.5 bg-surface hover:bg-surface-hover text-text border border-border transition-colors shadow-xs"
                      title="Download CSV"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export CSV</span>
                    </a>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => navigate(`/host/sessions/${s._id}`)}
                      className="gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>View report</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
