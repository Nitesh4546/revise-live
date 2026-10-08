import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HostDashboard from './HostDashboard.jsx';
import { quizApi } from '../api/quizApi.js';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    user: { id: 'teacher-1', name: 'Professor Turing', role: 'teacher' },
    logout: vi.fn()
  })
}));

vi.mock('../api/quizApi.js', () => ({
  quizApi: {
    list: vi.fn(),
    duplicate: vi.fn(),
    delete: vi.fn()
  }
}));

vi.mock('../api/client.js', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { aiMock: true } })
  }
}));

describe('HostDashboard - F4 Quiz Card Navigation & Action Isolation', () => {
  const mockQuiz = {
    _id: 'quiz-abc-123',
    title: 'Cell Biology Mastery',
    topic: 'Biology',
    difficulty: 'medium',
    description: 'Mitosis and cellular respiration concepts',
    questions: [{ timeLimit: 20 }, { timeLimit: 25 }]
  };

  beforeEach(() => {
    vi.clearAllMocks();
    quizApi.list.mockResolvedValue({ quizzes: [mockQuiz] });
    window.confirm = vi.fn().mockReturnValue(true);
  });

  it('navigates to the editor when the quiz card is clicked', async () => {
    render(
      <MemoryRouter>
        <HostDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Cell Biology Mastery')).toBeDefined();
    });

    const card = screen.getByRole('link', { name: /Edit quiz: Cell Biology Mastery/i });
    fireEvent.click(card);

    expect(mockNavigate).toHaveBeenCalledWith('/host/quiz/quiz-abc-123');
  });

  it('navigates to the editor when Enter is pressed on the focused quiz card', async () => {
    render(
      <MemoryRouter>
        <HostDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Cell Biology Mastery')).toBeDefined();
    });

    const card = screen.getByRole('link', { name: /Edit quiz: Cell Biology Mastery/i });
    fireEvent.keyDown(card, { key: 'Enter', code: 'Enter' });

    expect(mockNavigate).toHaveBeenCalledWith('/host/quiz/quiz-abc-123');
  });

  it('navigates to Host Live without triggering card edit navigation when Host Live is clicked', async () => {
    render(
      <MemoryRouter>
        <HostDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Cell Biology Mastery')).toBeDefined();
    });

    const hostLiveButton = screen.getByRole('button', { name: /Host Live/i });
    fireEvent.click(hostLiveButton);

    expect(mockNavigate).toHaveBeenCalledWith('/host/room/quiz-abc-123');
    expect(mockNavigate).not.toHaveBeenCalledWith('/host/quiz/quiz-abc-123');
  });

  it('calls duplicate without triggering card edit navigation when Duplicate is clicked', async () => {
    quizApi.duplicate.mockResolvedValue({ quiz: { _id: 'quiz-copy-456' } });

    render(
      <MemoryRouter>
        <HostDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Cell Biology Mastery')).toBeDefined();
    });

    const duplicateButton = screen.getByTitle('Duplicate Quiz');
    await act(async () => {
      fireEvent.click(duplicateButton);
    });

    expect(quizApi.duplicate).toHaveBeenCalledWith('quiz-abc-123');
    expect(mockNavigate).not.toHaveBeenCalledWith('/host/quiz/quiz-abc-123');
  });

  it('calls delete without triggering card edit navigation when Delete is clicked', async () => {
    quizApi.delete.mockResolvedValue({ ok: true });

    render(
      <MemoryRouter>
        <HostDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Cell Biology Mastery')).toBeDefined();
    });

    const deleteButton = screen.getByTitle('Delete Quiz');
    await act(async () => {
      fireEvent.click(deleteButton);
    });

    expect(window.confirm).toHaveBeenCalled();
    expect(quizApi.delete).toHaveBeenCalledWith('quiz-abc-123');
    expect(mockNavigate).not.toHaveBeenCalledWith('/host/quiz/quiz-abc-123');
  });
});
