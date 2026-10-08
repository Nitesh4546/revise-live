import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AIGeneratorModal from './AIGeneratorModal.jsx';
import { aiApi } from '../api/aiApi.js';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

vi.mock('../api/aiApi.js', () => ({
  aiApi: {
    generateQuiz: vi.fn(),
    extractPdf: vi.fn()
  }
}));

describe('AIGeneratorModal - F5 PDF Source Upload & Quiz Generation', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('renders modal when open, defaults to prompt tab, and toggles to PDF upload tab', () => {
    render(
      <MemoryRouter>
        <AIGeneratorModal isOpen={true} onClose={onClose} isMockAi={true} />
      </MemoryRouter>
    );

    expect(screen.getByText(/Generate Diagnostic Quiz with Gemini/i)).toBeDefined();
    expect(screen.getByText(/Topic \/ Lecture Notes/i)).toBeDefined();
    expect(screen.getByText(/Upload Document \(PDF\)/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/Paste lecture transcript/i)).toBeDefined();

    // Switch to PDF tab
    fireEvent.click(screen.getByRole('button', { name: /Upload Document \(PDF\)/i }));
    expect(screen.getByText(/Click to browse or drag and drop your PDF here/i)).toBeDefined();
  });

  it('selects a PDF file, displays file details, and allows custom page range selection', async () => {
    render(
      <MemoryRouter>
        <AIGeneratorModal isOpen={true} onClose={onClose} isMockAi={false} />
      </MemoryRouter>
    );

    // Switch to PDF tab
    fireEvent.click(screen.getByRole('button', { name: /Upload Document \(PDF\)/i }));

    const file = new File(['%PDF-1.4 sample content'], 'biology_notes.pdf', {
      type: 'application/pdf'
    });

    const fileInput = document.querySelector('input[type="file"]');
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(screen.getByText('biology_notes.pdf')).toBeDefined();
    expect(screen.getByText(/Page Selection/i)).toBeDefined();

    // Select Custom Range
    const customRangeRadio = screen.getByLabelText(/Custom Range/i);
    fireEvent.click(customRangeRadio);

    expect(screen.getByText(/Extract from page/i)).toBeDefined();
    expect(screen.getByDisplayValue('1')).toBeDefined();
    expect(screen.getByDisplayValue('5')).toBeDefined();
  });

  it('extracts text from PDF, displays character count, scanned warning, and generates draft', async () => {
    aiApi.extractPdf.mockResolvedValueOnce({
      text: 'Detailed revision material about eukaryotic cell organelles and ATP synthesis in mitochondria. '.repeat(
        3
      ),
      pageCount: 2,
      totalPages: 2,
      charCount: 260,
      originalCharCount: 260,
      usedCharCount: 260,
      truncated: false,
      scannedLikely: true,
      message: 'This PDF looks like scanned images. Text extraction may be incomplete.'
    });

    aiApi.generateQuiz.mockResolvedValueOnce({
      quiz: {
        title: 'biology notes Diagnostic Revision Quiz',
        topic: 'biology notes',
        difficulty: 'mixed',
        questions: [{ questionText: 'What is ATP?', options: ['A', 'B', 'C', 'D'], correctIndex: 0 }]
      }
    });

    render(
      <MemoryRouter>
        <AIGeneratorModal isOpen={true} onClose={onClose} isMockAi={false} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Upload Document \(PDF\)/i }));

    const file = new File(['%PDF-1.4 sample content'], 'biology_notes.pdf', {
      type: 'application/pdf'
    });
    const fileInput = document.querySelector('input[type="file"]');
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Click Extract Text
    const extractButton = screen.getByRole('button', { name: /Extract Text from PDF/i });
    fireEvent.click(extractButton);

    await waitFor(() => {
      expect(aiApi.extractPdf).toHaveBeenCalled();
    });

    // Check scanned warning
    expect(
      screen.getByText(/This PDF looks like scanned images. Text extraction may be incomplete./i)
    ).toBeDefined();

    // Check extracted preview
    expect(screen.getByText(/Extracted 2 page\(s\)/i)).toBeDefined();

    // Submit generation
    const generateBtn = screen.getByRole('button', { name: /Generate Draft/i });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(aiApi.generateQuiz).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'biology notes',
          sourceMaterial: expect.stringContaining('eukaryotic cell organelles')
        })
      );
    });

    expect(sessionStorage.getItem('quizDraft')).toContain('What is ATP?');
    expect(mockNavigate).toHaveBeenCalledWith('/host/quiz/draft');
    expect(onClose).toHaveBeenCalled();
  });

  it('displays truncation notification when text exceeds maximum limit', async () => {
    aiApi.extractPdf.mockResolvedValueOnce({
      text: 'Truncated content '.repeat(20),
      pageCount: 10,
      totalPages: 10,
      charCount: 360,
      originalCharCount: 50000,
      usedCharCount: 30000,
      truncated: true,
      scannedLikely: false
    });

    render(
      <MemoryRouter>
        <AIGeneratorModal isOpen={true} onClose={onClose} isMockAi={false} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Upload Document \(PDF\)/i }));

    const file = new File(['%PDF-1.4 large doc'], 'large.pdf', {
      type: 'application/pdf'
    });
    const fileInput = document.querySelector('input[type="file"]');
    fireEvent.change(fileInput, { target: { files: [file] } });

    const extractButton = screen.getByRole('button', { name: /Extract Text from PDF/i });
    fireEvent.click(extractButton);

    await waitFor(() => {
      expect(
        screen.getByText(/Notice: Document length exceeded limit/i)
      ).toBeDefined();
    });
  });
});
