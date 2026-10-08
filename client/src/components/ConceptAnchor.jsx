import { Compass, Lightbulb } from 'lucide-react';
import Badge from './ui/Badge.jsx';

export default function ConceptAnchor({ explanation, topicTag, correctAnswerText }) {
  if (!explanation) return null;

  return (
    <div className="w-full bg-surface border border-border rounded-[var(--radius-md,8px)] p-5 sm:p-6 shadow-[var(--shadow-card)] text-left transition-colors">
      <div className="flex items-center justify-between gap-4 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[var(--radius-sm,4px)] bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-accent">
              Concept Anchor
            </h3>
            <span className="text-[11px] text-text-muted">Classroom Retrieval Anchor</span>
          </div>
        </div>

        {topicTag && <Badge variant="neutral">{topicTag}</Badge>}
      </div>

      {correctAnswerText && (
        <div className="mb-2 text-xs font-medium text-success flex items-center gap-1.5">
          <Lightbulb className="w-3.5 h-3.5 shrink-0" />
          <span>Correct Answer: <strong className="font-semibold">{correctAnswerText}</strong></span>
        </div>
      )}

      <p className="text-base sm:text-lg text-text leading-relaxed font-medium">
        {explanation}
      </p>
    </div>
  );
}
