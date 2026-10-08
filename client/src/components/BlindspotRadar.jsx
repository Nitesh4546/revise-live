import { AlertTriangle, CheckCircle, Target } from 'lucide-react';
import Badge from './ui/Badge.jsx';

export default function BlindspotRadar({ report }) {
  if (!report) return null;

  const { overallAccuracy = 0, topics = [], weakQuestions = [] } = report;
  const overallPercent = Math.round(overallAccuracy * 100);

  return (
    <div className="w-full bg-surface border border-border rounded-[var(--radius-md,8px)] p-5 sm:p-6 shadow-[var(--shadow-card)] text-left transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-5 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-5 h-5 text-accent" />
            <h3 className="text-lg sm:text-xl font-semibold tracking-tight text-text">
              Classroom Blindspot Radar
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-text-muted">
            Diagnostic analytics flagging topics and misconceptions where accuracy fell below 50%
          </p>
        </div>

        <div className="flex items-center gap-3 bg-bg-subtle px-4 py-2.5 rounded-[var(--radius-sm,4px)] border border-border self-start sm:self-auto">
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Class Accuracy
          </span>
          <span
            className={`text-xl font-bold font-mono ${
              overallPercent >= 70
                ? 'text-success'
                : overallPercent >= 50
                ? 'text-warning'
                : 'text-danger'
            }`}
          >
            {overallPercent}%
          </span>
        </div>
      </div>

      {/* Flagged Topics Grid */}
      <div className="mb-6">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
          Topic Accuracy Breakdown
        </h4>

        {topics.length === 0 ? (
          <p className="text-xs sm:text-sm text-text-muted">No topic data available.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {topics.map((t, idx) => {
              const topicPct = Math.round((t.accuracy || 0) * 100);
              return (
                <div
                  key={idx}
                  className={`p-3.5 rounded-[var(--radius-sm,4px)] border flex items-center justify-between transition-colors ${
                    t.flagged
                      ? 'bg-danger/5 border-danger/30 text-text'
                      : 'bg-bg-subtle border-border text-text'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-1.5 font-semibold text-sm">
                      {t.flagged && <AlertTriangle className="w-4 h-4 text-danger shrink-0" />}
                      <span>{t.topicTag}</span>
                    </div>
                    <span className="text-[11px] text-text-muted">
                      {t.questionCount} {t.questionCount === 1 ? 'question' : 'questions'}
                    </span>
                  </div>

                  <span
                    className={`font-mono text-sm font-bold ${
                      t.flagged ? 'text-danger' : topicPct >= 70 ? 'text-success' : 'text-text'
                    }`}
                  >
                    {topicPct}%
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Weak Questions / Blindspots List */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
          Identified Misconceptions & Struggling Questions
        </h4>

        {weakQuestions.length === 0 ? (
          <div className="p-4 rounded-[var(--radius-sm,4px)] bg-success/10 border border-success/30 flex items-center gap-2.5 text-success text-xs font-medium">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>No critical blindspots identified! Class performed above 50% on all questions.</span>
          </div>
        ) : (
          <div className="space-y-3">
            {weakQuestions.map((q, idx) => {
              const acc = Math.round((q.accuracy || 0) * 100);
              return (
                <div
                  key={idx}
                  className="p-4 rounded-[var(--radius-sm,4px)] bg-bg-subtle border border-border space-y-2 text-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="neutral">Q#{q.questionIndex + 1}</Badge>
                      <Badge variant="neutral">{q.topicTag || 'General'}</Badge>
                      <span className="font-semibold text-text text-sm">{q.questionText}</span>
                    </div>
                    <span className="font-mono font-bold text-danger shrink-0 text-sm">
                      {acc}% accuracy
                    </span>
                  </div>

                  {q.topMisconception && (
                    <div className="p-2.5 rounded-[var(--radius-sm,4px)] bg-danger/10 border border-danger/20 text-text">
                      <span className="font-semibold text-danger mr-1">Primary Misconception:</span>
                      <span>{q.topMisconception}</span>
                    </div>
                  )}

                  {q.explanation && (
                    <p className="text-text-muted italic leading-relaxed pt-1">
                      "{q.explanation}"
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
