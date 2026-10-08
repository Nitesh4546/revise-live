import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function BackButton({ fallback = '/', label = 'Back to home', className = '' }) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history?.state?.idx > 0) {
      navigate(-1);
    } else {
      navigate(fallback);
    }
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label={label}
      title={label}
      className={`min-h-[44px] min-w-[44px] w-11 h-11 p-0 inline-flex items-center justify-center rounded-[var(--radius-sm,4px)] bg-surface hover:bg-surface-hover text-text border border-border transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 ${className}`}
    >
      <ArrowLeft className="w-5 h-5 shrink-0 rtl:rotate-180" aria-hidden="true" />
    </button>
  );
}
