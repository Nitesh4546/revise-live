import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { quizApi } from '../api/quizApi.js';
import apiClient from '../api/client.js';
import AppHeader from '../components/AppHeader.jsx';
import AIGeneratorModal from '../components/AIGeneratorModal.jsx';
import { Button, IconButton, Badge, EmptyState } from '../components/ui/index.js';
import {
  Plus,
  Play,
  Copy,
  Trash2,
  Search,
  BookOpen,
  HelpCircle,
  Clock,
  Loader2,
  AlertCircle,
  Download,
  Info,
  Sparkles,
  ArrowUpDown,
} from 'lucide-react';

export default function HostDashboard() {
  const navigate = useNavigate();

  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('recent'); // 'recent' | 'title' | 'questions'
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [isMockAi, setIsMockAi] = useState(false);

  // PDF Export State
  const [downloadingQuizId, setDownloadingQuizId] = useState(null);
  const [activeDownloadMenu, setActiveDownloadMenu] = useState(null);
  const [includeExplanations, setIncludeExplanations] = useState(true);
  const [downloadNotification, setDownloadNotification] = useState(null);

  useEffect(() => {
    async function loadQuizzes() {
      setLoading(true);
      setError('');
      try {
        const data = await quizApi.list();
        setQuizzes(data.quizzes || []);
      } catch (err) {
        setError(err.response?.data?.error?.message || 'Failed to load quizzes. Please refresh.');
      } finally {
        setLoading(false);
      }
    }

    async function checkAiStatus() {
      try {
        const res = await apiClient.get('/ai/status');
        setIsMockAi(Boolean(res.data?.aiMock));
      } catch {
        setIsMockAi(false);
      }
    }

    loadQuizzes();
    checkAiStatus();
  }, []);

  useEffect(() => {
    const handleCloseMenu = () => setActiveDownloadMenu(null);
    window.addEventListener('click', handleCloseMenu);
    return () => window.removeEventListener('click', handleCloseMenu);
  }, []);

  const handleDuplicate = async (id) => {
    try {
      const data = await quizApi.duplicate(id);
      setQuizzes((prev) => [data.quiz, ...prev]);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to duplicate quiz.');
    }
  };

  const handleDelete = async (id, title) => {
    if (window.confirm(`Are you sure you want to delete "${title}"? This cannot be undone.`)) {
      try {
        await quizApi.delete(id);
        setQuizzes((prev) => prev.filter((q) => q._id !== id));
      } catch (err) {
        setError(err.response?.data?.error?.message || 'Failed to delete quiz.');
      }
    }
  };

  const handleDownloadPdf = async (quizId, variant) => {
    setDownloadingQuizId(quizId);
    setActiveDownloadMenu(null);
    setDownloadNotification({
      type: 'info',
      message: `Preparing ${variant === 'answers' ? 'answers key' : 'questions'} PDF...`,
    });

    try {
      const res = await quizApi.downloadPdf(quizId, {
        variant,
        explanations: includeExplanations,
      });

      if (!res.ok) {
        throw new Error(res.error || 'Failed to download PDF export.');
      }

      setDownloadNotification({
        type: 'success',
        message: 'PDF downloaded successfully.',
      });
      setTimeout(() => setDownloadNotification(null), 3500);
    } catch (err) {
      setDownloadNotification({
        type: 'error',
        message: err.response?.data?.error?.message || 'Failed to download PDF export.',
      });
      setTimeout(() => setDownloadNotification(null), 5000);
    } finally {
      setDownloadingQuizId(null);
    }
  };

  const filteredQuizzes = quizzes
    .filter(
      (q) =>
        (q.title || '').toLowerCase().includes(search.toLowerCase()) ||
        (q.topic || '').toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'title') return (a.title || '').localeCompare(b.title || '');
      if (sortBy === 'questions') return (b.questions?.length || 0) - (a.questions?.length || 0);
      return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
    });

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col font-sans transition-colors">
      <AppHeader />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        {/* Mock AI Notice (Neutral Info Bar, no neon/gradient) */}
        {isMockAi && (
          <div className="mb-6 p-3.5 bg-bg-subtle border border-border rounded-[var(--radius-sm,4px)] flex items-center justify-between gap-3 text-xs text-text-muted">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-accent shrink-0" />
              <span>
                <strong>Demo AI mode active:</strong> Gemini API key is not configured. Generator returns simulated physics questions.
              </span>
            </div>
          </div>
        )}

        {/* Page Title & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text">
              Your quizzes
            </h1>
            <p className="text-xs sm:text-sm text-text-muted mt-0.5">
              Create, edit, and launch live diagnostic revision sessions
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setAiModalOpen(true)}
              className="gap-2"
            >
              <Sparkles className="w-4 h-4 text-accent" />
              <span>Generate with AI</span>
            </Button>

            <Button
              variant="primary"
              size="md"
              onClick={() => navigate('/host/quiz/new')}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Create quiz</span>
            </Button>
          </div>
        </div>

        {/* Search & Sort Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search quizzes by title or topic..."
              className="w-full h-10 bg-surface border border-border rounded-[var(--radius-sm,4px)] pl-9 pr-4 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <label htmlFor="sort-select" className="text-xs text-text-muted font-medium flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>Sort:</span>
            </label>
            <select
              id="sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-10 px-3 bg-surface border border-border rounded-[var(--radius-sm,4px)] text-xs text-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent cursor-pointer"
            >
              <option value="recent">Recently updated</option>
              <option value="title">Title (A-Z)</option>
              <option value="questions">Question count</option>
            </select>
          </div>
        </div>

        {/* Download Notification */}
        {downloadNotification && (
          <div
            className={`p-3.5 rounded-[var(--radius-sm,4px)] text-xs mb-5 flex items-center gap-2.5 transition border ${
              downloadNotification.type === 'error'
                ? 'bg-danger/10 border-danger/30 text-danger'
                : downloadNotification.type === 'success'
                ? 'bg-success/10 border-success/30 text-success'
                : 'bg-bg-subtle border-border text-text'
            }`}
          >
            {downloadNotification.type === 'info' && <Loader2 className="w-4 h-4 animate-spin shrink-0 text-accent" />}
            {downloadNotification.type === 'success' && <Download className="w-4 h-4 shrink-0 text-success" />}
            {downloadNotification.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0 text-danger" />}
            <span>{downloadNotification.message}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 bg-danger/10 border border-danger/30 rounded-[var(--radius-sm,4px)] text-danger text-xs sm:text-sm mb-6 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-danger" />
            <span>{error}</span>
          </div>
        )}

        {/* Quiz Cards Grid / Loading / Empty State */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <Loader2 className="w-7 h-7 text-accent animate-spin mb-3" />
            <p className="text-xs sm:text-sm text-text-muted">Loading your quizzes...</p>
          </div>
        ) : filteredQuizzes.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title={search ? 'No matching quizzes found' : 'No quizzes yet'}
            description={
              search
                ? 'Try a different search term or clear the search input.'
                : 'Generate a diagnostic quiz from your notes or PDF, or create one manually.'
            }
            action={
              !search && (
                <Button variant="primary" size="md" onClick={() => setAiModalOpen(true)}>
                  Create your first quiz
                </Button>
              )
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredQuizzes.map((quiz) => (
              <div
                key={quiz._id}
                role="link"
                tabIndex={0}
                aria-label={`Edit quiz: ${quiz.title}`}
                onClick={() => navigate(`/host/quiz/${quiz._id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    if (e.target === e.currentTarget) {
                      e.preventDefault();
                      navigate(`/host/quiz/${quiz._id}`);
                    }
                  }
                }}
                className="bg-surface border border-border rounded-[var(--radius-md,8px)] p-5 hover:border-accent focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-focus transition-colors flex flex-col justify-between shadow-[var(--shadow-card)] cursor-pointer"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <Badge variant="neutral">{quiz.topic}</Badge>
                    <span className="text-[11px] font-medium text-text-muted capitalize">
                      {quiz.difficulty}
                    </span>
                  </div>

                  <h2 className="text-base font-semibold text-text line-clamp-1 mb-1">
                    {quiz.title}
                  </h2>
                  <p className="text-xs text-text-muted line-clamp-2 mb-4 leading-relaxed">
                    {quiz.description || 'No description provided.'}
                  </p>

                  <div className="flex items-center gap-4 text-xs text-text-muted mb-5">
                    <div className="flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>{quiz.questions?.length || 0} questions</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        {(quiz.questions || []).reduce((acc, q) => acc + (q.timeLimit || 20), 0)}s total
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div
                  className="pt-3.5 border-t border-border/60 flex items-center justify-between"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-1">
                    <IconButton
                      label="Duplicate Quiz"
                      variant="subtle"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDuplicate(quiz._id);
                      }}
                      className="w-8 h-8 min-w-[36px] min-h-[36px] text-text-muted hover:text-text"
                    >
                      <Copy className="w-4 h-4" />
                    </IconButton>

                    <IconButton
                      label="Delete Quiz"
                      variant="destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(quiz._id, quiz.title);
                      }}
                      className="w-8 h-8 min-w-[36px] min-h-[36px]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </IconButton>

                    {/* Download PDF Menu */}
                    <div className="relative">
                      <button
                        type="button"
                        aria-label="Download quiz PDF"
                        aria-haspopup="true"
                        aria-expanded={activeDownloadMenu === quiz._id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDownloadMenu(activeDownloadMenu === quiz._id ? null : quiz._id);
                        }}
                        disabled={downloadingQuizId === quiz._id}
                        className="w-8 h-8 min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-[var(--radius-sm,4px)] text-text-muted hover:text-text hover:bg-surface-hover border border-transparent transition-colors cursor-pointer"
                        title="Download PDF"
                      >
                        {downloadingQuizId === quiz._id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-accent" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                      </button>

                      {activeDownloadMenu === quiz._id && (
                        <div
                          className="absolute left-0 bottom-full mb-2 w-56 bg-surface border border-border rounded-[var(--radius-md,8px)] shadow-[var(--shadow-card)] p-1.5 z-30"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="px-2.5 py-1 text-[11px] font-semibold text-text-muted border-b border-border/60 mb-1">
                            Download PDF
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDownloadPdf(quiz._id, 'questions')}
                            className="w-full text-left px-2.5 py-1.5 text-xs text-text hover:bg-surface-hover rounded-[var(--radius-sm,4px)] transition-colors cursor-pointer"
                          >
                            Questions (.pdf)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadPdf(quiz._id, 'answers')}
                            className="w-full text-left px-2.5 py-1.5 text-xs text-text hover:bg-surface-hover rounded-[var(--radius-sm,4px)] transition-colors cursor-pointer"
                          >
                            Answers & Keys (.pdf)
                          </button>
                          <label className="flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-text-muted border-t border-border/60 mt-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={includeExplanations}
                              onChange={(e) => setIncludeExplanations(e.target.checked)}
                              className="rounded border-border text-accent focus:ring-0 cursor-pointer"
                            />
                            <span>Include Concept Anchors</span>
                          </label>
                        </div>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/host/room/${quiz._id}`);
                    }}
                    className="gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Host Live</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <AIGeneratorModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        isMockAi={isMockAi}
      />
    </div>
  );
}
