import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PlayerGamePad from './PlayerGamePad.jsx';

// Comprehensive localStorage mock
const createStorageMock = () => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (idx) => Object.keys(store)[idx] || null
  };
};

const storageMock = createStorageMock();
Object.defineProperty(window, 'localStorage', {
  value: storageMock,
  writable: true
});
Object.defineProperty(globalThis, 'localStorage', {
  value: storageMock,
  writable: true
});

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams({ pin: '123456' }), vi.fn()],
    useLocation: () => ({ state: null })
  };
});

let socketHandlers = {};
const mockSocket = {
  emit: vi.fn(),
  on: vi.fn((event, cb) => {
    socketHandlers[event] = cb;
  }),
  off: vi.fn((event) => {
    delete socketHandlers[event];
  })
};

vi.mock('../context/SocketContext.jsx', () => ({
  useSocket: () => ({
    socket: mockSocket,
    connected: true
  })
}));

describe('PlayerGamePad - F1 Student Question and Option Cards Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    socketHandlers = {};
    storageMock.clear();
    storageMock.setItem(
      'reviselive:player:123456',
      JSON.stringify({
        pin: '123456',
        playerId: 'player_test_1',
        name: 'Sarah Connor',
        reconnectToken: 'rec_tok_1'
      })
    );
  });

  it('renders all four option texts and letters when phoneOptionText is "full"', async () => {
    render(
      <MemoryRouter>
        <PlayerGamePad />
      </MemoryRouter>
    );

    // Transition into QUESTION_ACTIVE with phoneOptionText: 'full'
    act(() => {
      socketHandlers['game:question-start']?.({
        questionIndex: 0,
        totalQuestions: 5,
        questionText: 'What is the powerhouse of the cell?',
        options: ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi apparatus'],
        phoneOptionText: 'full',
        timeLimit: 20
      });
    });

    expect(screen.getByText('What is the powerhouse of the cell?')).toBeDefined();
    expect(screen.getByText('Nucleus')).toBeDefined();
    expect(screen.getByText('Mitochondria')).toBeDefined();
    expect(screen.getByText('Ribosome')).toBeDefined();
    expect(screen.getByText('Golgi apparatus')).toBeDefined();
    expect(screen.getByText('A')).toBeDefined();
    expect(screen.getByText('B')).toBeDefined();
    expect(screen.getByText('C')).toBeDefined();
    expect(screen.getByText('D')).toBeDefined();
    expect(screen.getByText(/Q 1 of 5/i)).toBeDefined();
  });

  it('hides option text and displays only shapes and letter chips when phoneOptionText is "letters"', async () => {
    render(
      <MemoryRouter>
        <PlayerGamePad />
      </MemoryRouter>
    );

    act(() => {
      socketHandlers['game:question-start']?.({
        questionIndex: 0,
        totalQuestions: 5,
        questionText: 'Look at the board to read the options!',
        options: ['Visible on board 1', 'Visible on board 2', 'Visible on board 3', 'Visible on board 4'],
        phoneOptionText: 'letters',
        timeLimit: 20
      });
    });

    expect(screen.getByText('Look at the board to read the options!')).toBeDefined();
    // Letters are still rendered
    expect(screen.getByText('A')).toBeDefined();
    expect(screen.getByText('B')).toBeDefined();
    expect(screen.getByText('C')).toBeDefined();
    expect(screen.getByText('D')).toBeDefined();
    // Option texts are NOT rendered
    expect(screen.queryByText('Visible on board 1')).toBeNull();
    expect(screen.queryByText('Visible on board 2')).toBeNull();
    expect(screen.queryByText('Visible on board 3')).toBeNull();
    expect(screen.queryByText('Visible on board 4')).toBeNull();
  });

  it('submits answer on click (not touchstart) and locks in answer and shows confidence bar', async () => {
    render(
      <MemoryRouter>
        <PlayerGamePad />
      </MemoryRouter>
    );

    act(() => {
      socketHandlers['game:question-start']?.({
        questionIndex: 0,
        totalQuestions: 3,
        questionText: 'Which planet is known as the Red Planet?',
        options: ['Venus', 'Mars', 'Jupiter', 'Saturn'],
        phoneOptionText: 'full',
        timeLimit: 20
      });
    });

    const marsButton = screen.getByRole('button', { name: /Option B \(Star\): Mars/i });
    expect(marsButton).toBeDefined();

    mockSocket.emit.mockClear();

    // Verify touchstart alone does NOT submit the answer
    fireEvent.touchStart(marsButton);
    expect(mockSocket.emit).not.toHaveBeenCalledWith('player:submit-answer', expect.anything(), expect.anything());

    // Click submits exactly once
    fireEvent.click(marsButton);
    expect(mockSocket.emit).toHaveBeenCalledTimes(1);
    expect(mockSocket.emit).toHaveBeenCalledWith(
      'player:submit-answer',
      { pin: '123456', selectedIndex: 1 },
      expect.any(Function)
    );

    // "Locked in" badge is visible
    expect(screen.getByText(/Locked in/i)).toBeDefined();

    // Confidence bar appears after lock-in
    expect(screen.getByText(/How confident are you in this answer\?/i)).toBeDefined();
    expect(screen.getByText(/Guessing/i)).toBeDefined();
    expect(screen.getByText(/Fairly sure/i)).toBeDefined();
    expect(screen.getByText(/Certain/i)).toBeDefined();

    // Selecting confidence level
    const certainBtn = screen.getByRole('button', { name: /Certain/i });
    fireEvent.click(certainBtn);
    expect(mockSocket.emit).toHaveBeenCalledWith(
      'player:set-confidence',
      { pin: '123456', level: 3 },
      expect.any(Function)
    );
  });

  it('renders maximum length question (300 chars) and options (120 chars) without truncation', async () => {
    const longQuestion = 'A'.repeat(300);
    const longOptionA = 'Option A '.padEnd(120, 'x');
    const longOptionB = 'Option B '.padEnd(120, 'y');
    const longOptionC = 'Option C '.padEnd(120, 'z');
    const longOptionD = 'Option D '.padEnd(120, 'w');

    render(
      <MemoryRouter>
        <PlayerGamePad />
      </MemoryRouter>
    );

    act(() => {
      socketHandlers['game:question-start']?.({
        questionIndex: 0,
        totalQuestions: 1,
        questionText: longQuestion,
        options: [longOptionA, longOptionB, longOptionC, longOptionD],
        phoneOptionText: 'full',
        timeLimit: 20
      });
    });

    // Both long question and options are fully rendered in the DOM
    expect(screen.getByText(longQuestion)).toBeDefined();
    expect(screen.getByText(longOptionA)).toBeDefined();
    expect(screen.getByText(longOptionB)).toBeDefined();
    expect(screen.getByText(longOptionC)).toBeDefined();
    expect(screen.getByText(longOptionD)).toBeDefined();
  });

  it('renders readable cards with reveal states, correct answer highlighted, student choice marked, and misconception insight', async () => {
    render(
      <MemoryRouter>
        <PlayerGamePad />
      </MemoryRouter>
    );

    act(() => {
      socketHandlers['game:question-start']?.({
        questionIndex: 0,
        totalQuestions: 1,
        questionText: 'What gas do plants absorb?',
        options: ['Oxygen', 'Carbon Dioxide', 'Nitrogen', 'Argon'],
        phoneOptionText: 'full',
        timeLimit: 20
      });
    });

    // Student selects Oxygen (index 0 - incorrect)
    const oxygenBtn = screen.getByRole('button', { name: /Option A \(Hexagon\): Oxygen/i });
    fireEvent.click(oxygenBtn);

    // Transition to QUESTION_REVEAL
    act(() => {
      socketHandlers['game:question-reveal']?.({
        questionIndex: 0,
        correctIndex: 1, // Carbon Dioxide
        explanation: 'Plants absorb Carbon Dioxide during photosynthesis to produce glucose.'
      });
      socketHandlers['player:result']?.({
        isCorrect: false,
        chosenIndex: 0,
        chosenRationale: 'Oxygen is actually produced by plants during photosynthesis, not absorbed.',
        conceptAnchor: 'Plants absorb Carbon Dioxide during photosynthesis to produce glucose.',
        pointsAwarded: 0,
        streakBonus: 0,
        streak: 0,
        totalScore: 0,
        rank: 2,
        totalPlayers: 2
      });
    });

    // Outcome banner
    expect(screen.getByText('Incorrect')).toBeDefined();

    // Option cards in reveal state
    expect(screen.getByText(/Correct ✓/i)).toBeDefined();
    expect(screen.getByText(/Your choice ✗/i)).toBeDefined();

    // Misconception insight
    expect(screen.getByText(/Misconception Insight/i)).toBeDefined();
    expect(screen.getByText(/Oxygen is actually produced by plants during photosynthesis/i)).toBeDefined();

    // Concept Anchor
    expect(screen.getByText(/Concept Anchor/i)).toBeDefined();
    expect(screen.getByText(/Plants absorb Carbon Dioxide during photosynthesis/i)).toBeDefined();
  });

  it('restores final ranked leaderboard on game:ended and caches to localStorage', () => {
    render(
      <MemoryRouter>
        <PlayerGamePad />
      </MemoryRouter>
    );

    act(() => {
      socketHandlers['game:ended']?.({
        rank: 1,
        score: 3500,
        totalPlayers: 2,
        finalLeaderboard: [
          { rank: 1, name: 'Student', score: 3500, correct: 2, answered: 2, accuracy: 1.0, isYou: true, left: false },
          { rank: 2, name: 'Rival', score: 2000, correct: 1, answered: 2, accuracy: 0.5, isYou: false, left: false }
        ],
        you: { rank: 1, score: 3500, correct: 2, answered: 2, accuracy: 1.0, streak: 2 },
        receiptToken: 'token-receipt-abc'
      });
    });

    expect(screen.getByText('You ranked #1 of 2')).toBeDefined();
    expect(screen.getByText('3,500 pts')).toBeDefined();
    expect(screen.getByText('Rival')).toBeDefined();

    // Verify written to localStorage cache
    const cached = localStorage.getItem('reviselive:final:123456');
    expect(cached).toBeDefined();
    expect(JSON.parse(cached).receiptToken).toBe('token-receipt-abc');
  });

  it('restores final leaderboard from reviselive:final cache on refresh after room expires', () => {
    localStorage.clear();
    // Pre-populate final cache as if room was closed
    localStorage.setItem(
      'reviselive:final:123456',
      JSON.stringify({
        totalPlayers: 3,
        you: { rank: 2, score: 2100, correct: 2, answered: 3, accuracy: 0.67 },
        leaderboard: [
          { rank: 1, name: 'Alice', score: 3000, correct: 3, answered: 3, isYou: false },
          { rank: 2, name: 'TestUser', score: 2100, correct: 2, answered: 3, isYou: true },
          { rank: 3, name: 'Bob', score: 1200, correct: 1, answered: 3, isYou: false }
        ],
        receiptToken: 'token-persisted'
      })
    );

    render(
      <MemoryRouter initialEntries={['/play?pin=123456']}>
        <PlayerGamePad />
      </MemoryRouter>
    );

    // Final leaderboard should immediately restore without needing active socket room
    expect(screen.getByText('You ranked #2 of 3')).toBeDefined();
    expect(screen.getByText('Alice')).toBeDefined();
    expect(screen.getByText('TestUser')).toBeDefined();
  });

  it('Exit button clears player session but preserves receipt token and cached final data', () => {
    localStorage.setItem(
      'reviselive:player:123456',
      JSON.stringify({ pin: '123456', playerId: 'test-player-id', reconnectToken: 'rec-tok' })
    );
    localStorage.setItem('reviselive:lastReceipt', 'token-saved-forever');
    localStorage.setItem(
      'reviselive:final:123456',
      JSON.stringify({
        totalPlayers: 1,
        you: { rank: 1, score: 1000 },
        leaderboard: [{ rank: 1, name: 'Student', score: 1000, isYou: true }]
      })
    );

    render(
      <MemoryRouter initialEntries={['/play?pin=123456']}>
        <PlayerGamePad />
      </MemoryRouter>
    );

    act(() => {
      socketHandlers['game:ended']?.({
        rank: 1,
        score: 1000,
        totalPlayers: 1,
        finalLeaderboard: [{ rank: 1, name: 'Student', score: 1000, isYou: true }],
        you: { rank: 1, score: 1000 },
        receiptToken: 'token-saved-forever'
      });
    });

    const exitBtn = screen.getByRole('button', { name: /exit game/i });
    fireEvent.click(exitBtn);

    // Player session is cleared
    expect(localStorage.getItem('reviselive:player:123456')).toBeNull();
    // Receipt token and final cache are NEVER deleted
    expect(localStorage.getItem('reviselive:lastReceipt')).toBe('token-saved-forever');
    expect(localStorage.getItem('reviselive:final:123456')).toBeDefined();
  });
});
