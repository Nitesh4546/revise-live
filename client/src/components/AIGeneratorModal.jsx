import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { aiApi } from '../api/aiApi.js';
import { Button, Bar } from './ui/index.js';
import {
  X,
  Loader2,
  AlertCircle,
  FileText,
  UploadCloud,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
  Sparkles,
} from 'lucide-react';

export default function AIGeneratorModal({ isOpen, onClose, isMockAi }) {
  const navigate = useNavigate();

  // Mode: 'prompt' or 'pdf'
  const [activeTab, setActiveTab] = useState('prompt');

  // Common fields
  const [topic, setTopic] = useState('');
  const [title, setTitle] = useState('');
  const [questionCount, setQuestionCount] = useState(5);
  const [difficulty, setDifficulty] = useState('mixed');
  const [timeLimit, setTimeLimit] = useState(20);

  // Prompt mode fields
  const [notes, setNotes] = useState('');

  // PDF mode fields
  const [pdfFile, setPdfFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pageRangeMode, setPageRangeMode] = useState('all'); // 'all' or 'custom'
  const [startPage, setStartPage] = useState('1');
  const [endPage, setEndPage] = useState('5');
  const [extracting, setExtracting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [extractedData, setExtractedData] = useState(null);
  const [pdfPreviewExpanded, setPdfPreviewExpanded] = useState(true);

  // Status & errors
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelected(files[0]);
    }
  };

  const handleFileSelected = (file) => {
    setError('');
    setExtractedData(null);
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Invalid file type. Please upload a valid PDF document.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File size exceeds the 10 MB limit.');
      return;
    }
    setPdfFile(file);
    if (!topic && file.name) {
      const derivedTopic = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      setTopic(derivedTopic);
    }
  };

  const handleRemoveFile = () => {
    setPdfFile(null);
    setExtractedData(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleExtractPdf = async () => {
    if (!pdfFile) return;
    setExtracting(true);
    setError('');
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('pdf', pdfFile);

    if (pageRangeMode === 'custom') {
      const start = parseInt(startPage, 10);
      const end = parseInt(endPage, 10);
      if (isNaN(start) || start < 1 || isNaN(end) || end < start) {
        setError('Please enter a valid page range.');
        setExtracting(false);
        return;
      }
      formData.append('startPage', String(start));
      formData.append('endPage', String(end));
    }

    try {
      const res = await aiApi.extractPdf(formData, (progressEvent) => {
        if (progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percent);
        }
      });

      setExtractedData(res);
      if (!topic && res.text) {
        const firstLine = res.text.split('\n')[0].substring(0, 50).trim();
        if (firstLine.length > 3) setTopic(firstLine);
      }
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message || 'Failed to extract text from PDF.';
      setError(msg);
    } finally {
      setExtracting(false);
    }
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    setError('');

    let sourceMaterial = '';
    if (activeTab === 'prompt') {
      if (notes.trim().length < 50) {
        setError('Please enter at least 50 characters of lecture notes/syllabus content.');
        return;
      }
      sourceMaterial = notes.trim();
    } else {
      if (!extractedData || !extractedData.text || extractedData.text.trim().length < 50) {
        setError('Please extract at least 50 characters of text from the uploaded PDF first.');
        return;
      }
      sourceMaterial = extractedData.text.trim();
    }

    setGenerating(true);
    try {
      const res = await aiApi.generateQuiz({
        topic: topic.trim(),
        title: title.trim() || `${topic.trim()} Diagnostic Revision Quiz`,
        sourceMaterial,
        questionCount: Number(questionCount),
        difficulty,
        timeLimit: Number(timeLimit),
      });

      const draft = res.quiz || res.draft || res;
      sessionStorage.setItem('quizDraft', JSON.stringify(draft));
      onClose();
      navigate('/host/quiz/draft');
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message || 'Failed to generate quiz. Check server status.';
      setError(msg);
    } finally {
      setGenerating(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-surface border border-border rounded-[var(--radius-md,8px)] w-full max-w-2xl p-6 sm:p-8 shadow-xl relative max-h-[90vh] overflow-y-auto text-text">
        {/* Close Button */}
        <button
          type="button"
          disabled={generating || extracting}
          onClick={onClose}
          className="absolute top-5 right-5 text-text-muted hover:text-text transition-colors cursor-pointer disabled:opacity-50 p-1 rounded-[var(--radius-sm,4px)]"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-[var(--radius-sm,4px)] bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-text">
              Generate Diagnostic Quiz with Gemini
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Turn lecture notes or PDFs into diagnostic questions targeting student misconceptions
            </p>
          </div>
        </div>

        {/* Demo Mode Notice */}
        {isMockAi && (
          <div className="mb-4 p-3 bg-bg-subtle border border-border rounded-[var(--radius-sm,4px)] flex items-center gap-2 text-text-muted text-xs">
            <Info className="w-4 h-4 shrink-0 text-accent" />
            <span>
              <strong>Demo AI mode active:</strong> Quizzes are generated using deterministic templates without requiring a Gemini API key.
            </span>
          </div>
        )}

        {/* Error Notice */}
        {error && (
          <div className="mb-4 p-3 bg-danger/10 border border-danger/30 rounded-[var(--radius-sm,4px)] flex items-center gap-2 text-danger text-xs sm:text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 text-danger" />
            <span>{error}</span>
          </div>
        )}

        {/* Tabs: Topic/Prompt vs PDF */}
        <div className="flex border-b border-border mb-6 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('prompt')}
            className={`pb-2.5 px-3 text-xs sm:text-sm font-medium transition-colors border-b-2 cursor-pointer flex items-center gap-2 ${
              activeTab === 'prompt'
                ? 'border-accent text-accent font-semibold'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Topic / Lecture Notes</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pdf')}
            className={`pb-2.5 px-3 text-xs sm:text-sm font-medium transition-colors border-b-2 cursor-pointer flex items-center gap-2 ${
              activeTab === 'pdf'
                ? 'border-accent text-accent font-semibold'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Upload Document (PDF)</span>
          </button>
        </div>

        <form onSubmit={handleGenerate} className="space-y-4">
          {/* Topic & Title Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text mb-1.5">
                Topic / Subject *
              </label>
              <input
                type="text"
                required
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Cellular Respiration, Newton's Laws"
                className="w-full h-10 bg-surface border border-border rounded-[var(--radius-sm,4px)] px-3 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text mb-1.5">
                Quiz Title (Optional)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Unit 3 Biology Revision"
                className="w-full h-10 bg-surface border border-border rounded-[var(--radius-sm,4px)] px-3 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
              />
            </div>
          </div>

          {/* Tab 1: Direct Notes Input */}
          {activeTab === 'prompt' && (
            <div>
              <label className="block text-xs font-semibold text-text mb-1.5">
                Lecture Notes / Syllabus Material * (50 to 30,000 chars)
              </label>
              <textarea
                required
                rows={6}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Paste lecture transcript, textbook summary, or key revision concepts here..."
                className="w-full bg-surface border border-border rounded-[var(--radius-sm,4px)] p-3 text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors resize-y font-mono"
              />
              <div className="text-[11px] text-text-muted mt-1 flex justify-between">
                <span>Sanitized and verified for prompt boundaries</span>
                <span>{notes.length} / 30,000 chars</span>
              </div>
            </div>
          )}

          {/* Tab 2: PDF Upload & Extraction */}
          {activeTab === 'pdf' && (
            <div className="space-y-4">
              {/* Drop Zone */}
              {!pdfFile ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-[var(--radius-md,8px)] p-6 text-center cursor-pointer transition-colors flex flex-col items-center justify-center gap-2 ${
                    isDragging
                      ? 'border-accent bg-accent/5'
                      : 'border-border bg-bg-subtle/50 hover:border-accent'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => e.target.files?.[0] && handleFileSelected(e.target.files[0])}
                    accept="application/pdf"
                    className="hidden"
                  />
                  <div className="w-11 h-11 rounded-[var(--radius-sm,4px)] bg-surface border border-border flex items-center justify-center text-text-muted">
                    <UploadCloud className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text">
                      Click to browse or drag and drop your PDF here
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">
                      Worksheets, textbook chapters, or exam papers (up to 10 MB, max 100 pages)
                    </p>
                  </div>
                </div>
              ) : (
                /* Selected File Card */
                <div className="bg-bg-subtle border border-border rounded-[var(--radius-sm,4px)] p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3 truncate mr-2">
                    <div className="w-9 h-9 rounded-[var(--radius-sm,4px)] bg-surface border border-border flex items-center justify-center text-accent shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <p className="text-sm font-semibold text-text truncate">{pdfFile.name}</p>
                      <p className="text-xs text-text-muted">{formatFileSize(pdfFile.size)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="p-1.5 text-text-muted hover:text-danger rounded-[var(--radius-sm,4px)] transition-colors cursor-pointer shrink-0"
                    title="Remove file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Page Range Selector & Extract Action */}
              {pdfFile && !extractedData && (
                <div className="bg-bg-subtle border border-border rounded-[var(--radius-sm,4px)] p-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-semibold text-text uppercase tracking-wider">
                      Page Selection
                    </span>
                    <div className="flex items-center gap-4 text-xs">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="pageRange"
                          checked={pageRangeMode === 'all'}
                          onChange={() => setPageRangeMode('all')}
                          className="text-accent focus:ring-0 cursor-pointer"
                        />
                        <span className="text-text">All Pages</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="pageRange"
                          checked={pageRangeMode === 'custom'}
                          onChange={() => setPageRangeMode('custom')}
                          className="text-accent focus:ring-0 cursor-pointer"
                        />
                        <span className="text-text">Custom Range</span>
                      </label>
                    </div>
                  </div>

                  {pageRangeMode === 'custom' && (
                    <div className="flex items-center gap-3 pt-2 border-t border-border text-xs">
                      <span className="text-text-muted">Extract from page</span>
                      <input
                        type="number"
                        min="1"
                        value={startPage}
                        onChange={(e) => setStartPage(e.target.value)}
                        className="w-16 h-8 bg-surface border border-border rounded-[var(--radius-sm,4px)] px-2 text-text text-center focus:outline-none focus:border-accent"
                      />
                      <span className="text-text-muted">to page</span>
                      <input
                        type="number"
                        min="1"
                        value={endPage}
                        onChange={(e) => setEndPage(e.target.value)}
                        className="w-16 h-8 bg-surface border border-border rounded-[var(--radius-sm,4px)] px-2 text-text text-center focus:outline-none focus:border-accent"
                      />
                    </div>
                  )}

                  {/* Extract Button */}
                  <div className="pt-2">
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      disabled={extracting}
                      onClick={handleExtractPdf}
                      className="w-full gap-2"
                    >
                      {extracting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Extracting text from PDF ({uploadProgress}%)...</span>
                        </>
                      ) : (
                        <>
                          <FileText className="w-4 h-4" />
                          <span>Extract Text from PDF</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Upload Progress Bar */}
              {extracting && (
                <Bar
                  value={uploadProgress}
                  max={100}
                  orientation="horizontal"
                  color="bg-accent"
                  trackClassName="w-full h-2 rounded-full bg-border"
                  fillClassName="rounded-full"
                  showTrackBorder={false}
                />
              )}

              {/* Extracted Content Status & Preview */}
              {extractedData && (
                <div className="space-y-3">
                  {/* Scanned Image Warning */}
                  {extractedData.scannedLikely && (
                    <div className="p-3 bg-warning/10 border border-warning/30 rounded-[var(--radius-sm,4px)] flex items-start gap-2.5 text-warning text-xs">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-warning" />
                      <span>{extractedData.message}</span>
                    </div>
                  )}

                  {/* Truncation Notification */}
                  {extractedData.truncated && (
                    <div className="p-3 bg-bg-subtle border border-border rounded-[var(--radius-sm,4px)] flex items-start gap-2.5 text-text text-xs">
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-accent" />
                      <span>
                        Notice: Document length exceeded limit. The first{' '}
                        {extractedData.usedCharCount.toLocaleString()} characters are being used for quiz generation.
                      </span>
                    </div>
                  )}

                  {/* Collapsible Text Preview */}
                  <div className="bg-surface border border-border rounded-[var(--radius-sm,4px)] overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setPdfPreviewExpanded(!pdfPreviewExpanded)}
                      className="w-full px-3.5 py-2.5 bg-bg-subtle flex items-center justify-between text-xs font-semibold text-text hover:bg-surface-hover transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-success" />
                        <span>
                          Extracted {extractedData.pageCount} page(s) ({extractedData.charCount.toLocaleString()} chars)
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-text-muted">
                        <span>{pdfPreviewExpanded ? 'Collapse' : 'Expand'} Preview</span>
                        {pdfPreviewExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </button>

                    {pdfPreviewExpanded && (
                      <div className="p-3">
                        <textarea
                          rows={6}
                          value={extractedData.text}
                          onChange={(e) =>
                            setExtractedData({
                              ...extractedData,
                              text: e.target.value,
                              charCount: e.target.value.length,
                              usedCharCount: e.target.value.length,
                            })
                          }
                          className="w-full bg-surface border border-border rounded-[var(--radius-sm,4px)] p-2.5 text-xs text-text focus:outline-none focus:border-accent font-mono resize-y"
                        />
                        <div className="text-[11px] text-text-muted mt-1 flex justify-between">
                          <span>Editable: adjust content before generating</span>
                          <span>
                            {extractedData.text.length.toLocaleString()} / 30,000 chars
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quiz Configuration Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-border">
            <div>
              <label className="block text-xs font-semibold text-text mb-1.5">
                Question Count
              </label>
              <select
                value={questionCount}
                onChange={(e) => setQuestionCount(e.target.value)}
                className="w-full h-10 bg-surface border border-border rounded-[var(--radius-sm,4px)] px-3 text-xs sm:text-sm text-text focus:outline-none focus:border-accent cursor-pointer"
              >
                <option value={3}>3 Questions</option>
                <option value={5}>5 Questions</option>
                <option value={8}>8 Questions</option>
                <option value={10}>10 Questions</option>
                <option value={15}>15 Questions</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text mb-1.5">
                Difficulty
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full h-10 bg-surface border border-border rounded-[var(--radius-sm,4px)] px-3 text-xs sm:text-sm text-text focus:outline-none focus:border-accent cursor-pointer"
              >
                <option value="mixed">Mixed</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text mb-1.5">
                Time Per Question
              </label>
              <select
                value={timeLimit}
                onChange={(e) => setTimeLimit(e.target.value)}
                className="w-full h-10 bg-surface border border-border rounded-[var(--radius-sm,4px)] px-3 text-xs sm:text-sm text-text focus:outline-none focus:border-accent cursor-pointer"
              >
                <option value={15}>15 Seconds</option>
                <option value={20}>20 Seconds</option>
                <option value={30}>30 Seconds</option>
                <option value={45}>45 Seconds</option>
              </select>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              size="md"
              disabled={generating || extracting}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={
                generating ||
                extracting ||
                (activeTab === 'prompt' && notes.trim().length < 50) ||
                (activeTab === 'pdf' && (!extractedData || extractedData.text.trim().length < 50))
              }
              loading={generating}
              className="gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Generate Draft</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
