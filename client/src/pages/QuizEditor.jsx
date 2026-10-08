import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { quizApi } from '../api/quizApi.js';
import downloadHelper from '../utils/downloadHelper.js';
import AppHeader from '../components/AppHeader.jsx';
import BackButton from '../components/BackButton.jsx';
import { Button, IconButton, Badge } from '../components/ui/index.js';
import {
  Save,
  Plus,
  Trash2,
  AlertCircle,
  HelpCircle,
  Clock,
  Tag,
  Loader2,
  Download,
} from 'lucide-react';

const SHAPES = [
  { letter: 'A', name: 'Hexagon', shape: '⬡', color: 'bg-tile-a text-white' },
  { letter: 'B', name: 'Five-Point Star', shape: '★', color: 'bg-tile-b text-tile-b-text' },
  { letter: 'C', name: 'Plus/Cross', shape: '✚', color: 'bg-tile-c text-tile-c-text' },
  { letter: 'D', name: 'Crescent', shape: '☽', color: 'bg-tile-d text-white' },
];

export default function QuizEditor() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState('mixed');
  const [questions, setQuestions] = useState([]);
  const [defaultSettings, setDefaultSettings] = useState({
    phoneOptionText: 'full',
    finalLeaderboard: 'full',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  // PDF Export State
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [includeExplanations, setIncludeExplanations] = useState(true);
  const [downloadNotification, setDownloadNotification] = useState(null);

  useEffect(() => {
    const handleClickOutside = () => setDownloadMenuOpen(false);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        if (id === 'draft') {
          const draftJson = sessionStorage.getItem('quizDraft');
          if (draftJson) {
            const draft = JSON.parse(draftJson);
            setTitle(draft.title || '');
            setTopic(draft.topic || '');
            setDescription(draft.description || '');
            setDifficulty(draft.difficulty || 'mixed');
            setQuestions(draft.questions || []);
            if (draft.defaultSettings) setDefaultSettings(draft.defaultSettings);
          } else {
            setError('No AI draft found in session. Please generate one first.');
          }
        } else if (id !== 'new') {
          const data = await quizApi.get(id);
          const q = data.quiz;
          setTitle(q.title || '');
          setTopic(q.topic || '');
          setDescription(q.description || '');
          setDifficulty(q.difficulty || 'mixed');
          setQuestions(q.questions || []);
          if (q.defaultSettings) setDefaultSettings(q.defaultSettings);
        } else {
          // New manual quiz template
          setTitle('');
          setTopic('');
          setDescription('');
          setDifficulty('medium');
          setQuestions([
            {
              questionText: '',
              options: ['', '', '', ''],
              correctIndex: 0,
              timeLimit: 20,
              topicTag: 'General',
              explanation: '',
              distractorRationales: ['', '', '', ''],
            },
          ]);
        }
      } catch (err) {
        setError(err.response?.data?.error?.message || 'Failed to load quiz details.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const handleFieldChange = (qIdx, field, val) => {
    setIsDirty(true);
    setQuestions((prev) => {
      const copy = [...prev];
      copy[qIdx] = { ...copy[qIdx], [field]: val };
      return copy;
    });
  };

  const handleOptionChange = (qIdx, oIdx, val) => {
    setIsDirty(true);
    setQuestions((prev) => {
      const copy = [...prev];
      const opts = [...copy[qIdx].options];
      opts[oIdx] = val;
      copy[qIdx] = { ...copy[qIdx], options: opts };
      return copy;
    });
  };

  const handleRationaleChange = (qIdx, oIdx, val) => {
    setIsDirty(true);
    setQuestions((prev) => {
      const copy = [...prev];
      const rationales = [...(copy[qIdx].distractorRationales || ['', '', '', ''])];
      rationales[oIdx] = val;
      copy[qIdx] = { ...copy[qIdx], distractorRationales: rationales };
      return copy;
    });
  };

  const handleCorrectIndexChange = (qIdx, oIdx) => {
    setIsDirty(true);
    setQuestions((prev) => {
      const copy = [...prev];
      copy[qIdx] = { ...copy[qIdx], correctIndex: oIdx };
      return copy;
    });
  };

  const handleQuestionTextChange = (qIdx, val) => {
    setIsDirty(true);
    setQuestions((prev) => {
      const copy = [...prev];
      copy[qIdx] = { ...copy[qIdx], questionText: val };
      return copy;
    });
  };

  const handleExplanationChange = (qIdx, val) => {
    setIsDirty(true);
    setQuestions((prev) => {
      const copy = [...prev];
      copy[qIdx] = { ...copy[qIdx], explanation: val };
      return copy;
    });
  };

  const addQuestion = () => {
    setIsDirty(true);
    setQuestions((prev) => [
      ...prev,
      {
        questionText: '',
        options: ['', '', '', ''],
        correctIndex: 0,
        timeLimit: 20,
        topicTag: topic || 'General',
        explanation: '',
        distractorRationales: ['', '', '', ''],
      },
    ]);
  };

  const deleteQuestion = (index) => {
    if (questions.length <= 1) {
      alert('A quiz must contain at least 1 question.');
      return;
    }
    setIsDirty(true);
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const validateQuiz = () => {
    if (!title.trim()) return 'Quiz Title is required.';
    if (!topic.trim()) return 'Topic is required.';
    if (questions.length === 0) return 'At least one question is required.';

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.questionText.trim()) return `Question #${i + 1} is missing question text.`;
      if (q.options.length !== 4) return `Question #${i + 1} must have exactly 4 options.`;
      for (let j = 0; j < 4; j++) {
        if (!q.options[j].trim()) return `Question #${i + 1}, Option ${SHAPES[j].letter} cannot be empty.`;
      }
      if (typeof q.correctIndex !== 'number' || q.correctIndex < 0 || q.correctIndex > 3) {
        return `Question #${i + 1} must have a valid correct answer selected.`;
      }
      if (!q.explanation || !q.explanation.trim()) {
        return `Question #${i + 1} requires a Concept Anchor explanation.`;
      }
    }
    return null;
  };

  const handleSave = async (redirect = true) => {
    const valError = validateQuiz();
    if (valError) {
      setError(valError);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSaving(true);
    setError('');

    const payload = {
      title: title.trim(),
      topic: topic.trim(),
      description: description.trim(),
      difficulty,
      questions,
      defaultSettings,
    };

    try {
      if (id === 'new' || id === 'draft') {
        const res = await quizApi.create(payload);
        sessionStorage.removeItem('quizDraft');
        setIsDirty(false);
        if (redirect) navigate('/host');
        return res.quiz;
      } else {
        const res = await quizApi.update(id, payload);
        setIsDirty(false);
        if (redirect) navigate('/host');
        return res.quiz;
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to save quiz. Check your connection.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async (variant) => {
    setDownloadMenuOpen(false);
    setDownloading(true);
    setDownloadNotification({
      type: 'info',
      message: `Preparing ${variant === 'answers' ? 'answers key' : 'questions'} PDF...`,
    });

    try {
      let targetQuizId = id;
      if (id === 'draft' || id === 'new' || isDirty) {
        const savedQuiz = await handleSave(false);
        if (!savedQuiz || !savedQuiz._id) {
          throw new Error('Save the quiz first before downloading.');
        }
        targetQuizId = savedQuiz._id;
      }

      const res = await quizApi.exportPdf(targetQuizId, {
        variant,
        includeExplanations,
      });

      downloadHelper.triggerBlobDownload(res);
      setDownloadNotification({
        type: 'success',
        message: 'PDF downloaded successfully.',
      });
      setTimeout(() => setDownloadNotification(null), 3500);
    } catch (err) {
      setDownloadNotification({
        type: 'error',
        message: err.response?.data?.error?.message || err.message || 'Failed to download PDF.',
      });
      setTimeout(() => setDownloadNotification(null), 5000);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg text-text flex flex-col font-sans">
        <AppHeader />
        <div className="flex-1 flex flex-col items-center justify-center py-20">
          <Loader2 className="w-7 h-7 text-accent animate-spin mb-3" />
          <p className="text-xs sm:text-sm text-text-muted">Loading quiz details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col font-sans transition-colors">
      <AppHeader />

      {/* Editor Sub-Header */}
      <div className="border-b border-border bg-surface/90 sticky top-14 z-30 px-4 sm:px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BackButton fallback="/host" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-semibold tracking-tight text-text">
                  {id === 'draft' ? 'Review & Edit AI Draft' : id === 'new' ? 'Create New Quiz' : 'Edit Quiz'}
                </h1>
                {id === 'draft' && <Badge variant="accent">AI Generated</Badge>}
              </div>
              <p className="text-xs text-text-muted hidden sm:block">
                Configure questions, Concept Anchors, and options
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Download PDF Dropdown */}
            <div className="relative">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setDownloadMenuOpen((prev) => !prev);
                }}
                disabled={downloading}
                className="gap-1.5"
              >
                {downloading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>Download</span>
              </Button>

              {downloadMenuOpen && (
                <div
                  className="absolute right-0 top-full mt-1.5 w-56 bg-surface border border-border rounded-[var(--radius-md,8px)] shadow-[var(--shadow-card)] p-1.5 z-50"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-2.5 py-1 text-[11px] font-semibold text-text-muted border-b border-border/60 mb-1">
                    Export PDF
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownload('questions')}
                    className="w-full text-left px-2.5 py-1.5 text-xs text-text hover:bg-surface-hover rounded-[var(--radius-sm,4px)] transition-colors cursor-pointer"
                  >
                    Questions (.pdf)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload('answers')}
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

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => navigate('/host')}
            >
              Cancel
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => handleSave(true)}
              loading={saving}
              className="gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Quiz</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Editor Body */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8">
        {downloadNotification && (
          <div
            className={`mb-5 p-3.5 rounded-[var(--radius-sm,4px)] text-xs flex items-center gap-2.5 border transition ${
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

        {error && (
          <div className="mb-6 p-3.5 bg-danger/10 border border-danger/30 rounded-[var(--radius-sm,4px)] flex items-center gap-2.5 text-danger text-xs sm:text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 text-danger" />
            <span>{error}</span>
          </div>
        )}

        {/* Quiz Meta Card */}
        <div className="bg-surface border border-border rounded-[var(--radius-md,8px)] p-5 sm:p-6 mb-8 shadow-[var(--shadow-card)]">
          <h2 className="text-base font-semibold text-text mb-4">Quiz Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-text mb-1.5">
                Quiz Title *
              </label>
              <input
                type="text"
                required
                maxLength={100}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setIsDirty(true);
                }}
                placeholder="e.g. Cellular Respiration & ATP"
                className="w-full h-10 bg-surface border border-border rounded-[var(--radius-sm,4px)] px-3 text-sm text-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text mb-1.5">
                Topic Tag *
              </label>
              <input
                type="text"
                required
                maxLength={100}
                value={topic}
                onChange={(e) => {
                  setTopic(e.target.value);
                  setIsDirty(true);
                }}
                placeholder="e.g. Biology"
                className="w-full h-10 bg-surface border border-border rounded-[var(--radius-sm,4px)] px-3 text-sm text-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-text mb-1.5">
                Description (Optional)
              </label>
              <input
                type="text"
                maxLength={300}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setIsDirty(true);
                }}
                placeholder="Short overview for students..."
                className="w-full h-10 bg-surface border border-border rounded-[var(--radius-sm,4px)] px-3 text-sm text-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text mb-1.5">
                Difficulty
              </label>
              <select
                value={difficulty}
                onChange={(e) => {
                  setDifficulty(e.target.value);
                  setIsDirty(true);
                }}
                className="w-full h-10 bg-surface border border-border rounded-[var(--radius-sm,4px)] px-3 text-sm text-text focus:outline-none focus:border-accent cursor-pointer"
              >
                <option value="mixed">Mixed</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>
        </div>

        {/* Questions Section */}
        <div className="space-y-6 mb-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-semibold text-text">
              Questions ({questions.length})
            </h2>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={addQuestion}
              className="gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Question</span>
            </Button>
          </div>

          {questions.map((q, qIdx) => (
            <div
              key={qIdx}
              className="bg-surface border border-border rounded-[var(--radius-md,8px)] p-5 sm:p-6 shadow-[var(--shadow-card)] relative"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-[var(--radius-sm,4px)] bg-bg-subtle text-text border border-border">
                  Question #{qIdx + 1}
                </span>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-text-muted">
                    <Tag className="w-3.5 h-3.5" />
                    <input
                      type="text"
                      maxLength={40}
                      value={q.topicTag || 'General'}
                      onChange={(e) => handleFieldChange(qIdx, 'topicTag', e.target.value)}
                      placeholder="Subtopic Tag"
                      className="h-8 bg-surface border border-border rounded-[var(--radius-sm,4px)] px-2 text-xs text-text focus:outline-none focus:border-accent w-28"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-text-muted">
                    <Clock className="w-3.5 h-3.5" />
                    <select
                      value={q.timeLimit || 20}
                      onChange={(e) => handleFieldChange(qIdx, 'timeLimit', Number(e.target.value))}
                      className="h-8 bg-surface border border-border rounded-[var(--radius-sm,4px)] px-2 text-xs text-text focus:outline-none focus:border-accent cursor-pointer"
                    >
                      <option value={10}>10s</option>
                      <option value={15}>15s</option>
                      <option value={20}>20s</option>
                      <option value={30}>30s</option>
                      <option value={45}>45s</option>
                      <option value={60}>60s</option>
                    </select>
                  </div>

                  <IconButton
                    label="Delete Question"
                    variant="destructive"
                    onClick={() => deleteQuestion(qIdx)}
                    className="w-8 h-8 min-w-[32px] min-h-[32px]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </IconButton>
                </div>
              </div>

              {/* Source Quote Grounding Badge */}
              {q.sourceQuote && (
                <div className="mb-4 px-3.5 py-2 rounded-[var(--radius-sm,4px)] bg-bg-subtle border border-border flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 truncate mr-3">
                    <span className="text-text-muted font-semibold text-[10px] uppercase tracking-wider">
                      Source Note:
                    </span>
                    <span className="text-text italic truncate">"{q.sourceQuote}"</span>
                  </div>
                  <Badge variant={q.grounded ? 'success' : 'warning'}>
                    {q.grounded ? 'Grounded' : 'Unverified'}
                  </Badge>
                </div>
              )}

              {/* Question Text */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-text mb-1.5">
                  Question Text (max 300 chars) *
                </label>
                <textarea
                  rows={2}
                  maxLength={300}
                  value={q.questionText}
                  onChange={(e) => handleQuestionTextChange(qIdx, e.target.value)}
                  placeholder="e.g. Which organelle is responsible for generating ATP through oxidative phosphorylation?"
                  className="w-full bg-surface border border-border rounded-[var(--radius-sm,4px)] p-3 text-sm text-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                />
              </div>

              {/* 4 Options Grid */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-text mb-2">
                  Answer Options (Select the correct option with radio button) *
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {SHAPES.map((shapeMeta, oIdx) => {
                    const isCorrect = q.correctIndex === oIdx;
                    return (
                      <div
                        key={oIdx}
                        className={`flex flex-col gap-2 p-3 rounded-[var(--radius-sm,4px)] border transition-colors ${
                          isCorrect
                            ? 'bg-success/5 border-success/40 ring-1 ring-success/30'
                            : 'bg-surface border-border'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="radio"
                            name={`correct-${qIdx}`}
                            checked={isCorrect}
                            onChange={() => handleCorrectIndexChange(qIdx, oIdx)}
                            className="w-4 h-4 text-accent accent-accent cursor-pointer"
                          />
                          <span
                            className={`w-7 h-7 rounded-[var(--radius-sm,4px)] ${shapeMeta.color} flex items-center justify-center text-xs font-bold shrink-0`}
                          >
                            {shapeMeta.letter}
                          </span>
                          <input
                            type="text"
                            maxLength={120}
                            value={q.options[oIdx] || ''}
                            onChange={(e) => handleOptionChange(qIdx, oIdx, e.target.value)}
                            placeholder={`Option ${shapeMeta.letter} (${shapeMeta.name})`}
                            className="flex-1 bg-transparent border-none text-xs sm:text-sm text-text focus:outline-none placeholder:text-text-muted"
                          />
                          {isCorrect && (
                            <Badge variant="success" className="text-[10px]">
                              Correct
                            </Badge>
                          )}
                        </div>

                        {/* Misconception Rationale for Distractors */}
                        {!isCorrect && (
                          <div className="pt-2 border-t border-border/60">
                            <label className="block text-[10px] uppercase font-semibold text-text-muted mb-0.5">
                              Misconception Rationale (Why students pick this)
                            </label>
                            <input
                              type="text"
                              maxLength={160}
                              value={q.distractorRationales?.[oIdx] || ''}
                              onChange={(e) => handleRationaleChange(qIdx, oIdx, e.target.value)}
                              placeholder="e.g. Confuses mass with weight"
                              className="w-full h-8 bg-bg-subtle border border-border rounded-[var(--radius-sm,4px)] px-2.5 text-xs text-text focus:outline-none focus:border-accent"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Concept Anchor Explanation */}
              <div>
                <label className="block text-xs font-semibold text-text mb-1.5 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-accent" />
                  <span>Concept Anchor Explanation (max 400 chars) *</span>
                </label>
                <textarea
                  rows={2}
                  maxLength={400}
                  value={q.explanation}
                  onChange={(e) => handleExplanationChange(qIdx, e.target.value)}
                  placeholder="Explain why the correct answer is right and clarify why the distractor is a common pitfall..."
                  className="w-full bg-surface border border-border rounded-[var(--radius-sm,4px)] p-3 text-xs text-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Save Bar */}
        <div className="flex items-center justify-between p-4 bg-surface border border-border rounded-[var(--radius-md,8px)] shadow-[var(--shadow-card)] sticky bottom-4 z-20">
          <span className="text-xs text-text-muted">
            {questions.length} questions configured
          </span>
          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => navigate('/host')}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleSave(true)}
              loading={saving}
              className="gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Quiz</span>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
