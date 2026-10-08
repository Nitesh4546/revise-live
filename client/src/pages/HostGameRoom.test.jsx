import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HostGameRoom from './HostGameRoom.jsx';

// Polyfill storage
const createStorageMock = () => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; }
  };
};

const sessionStorageMock = createStorageMock();
Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true
});
Object.defineProperty(globalThis, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true
});

const mockNavigate = vi.fn();
let mockParams = { id: '987654' };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
    useLocation: () => ({ state: null })
  };
});

let socketHandlers = {};
let mockSocket = {
  emit: vi.fn(),
  on: vi.fn((event, handler) => {
    socketHandlers[event] = handler;
  }),
  off: vi.fn((event) => {
    delete socketHandlers[event];
  }),
  auth: {}
};

vi.mock('../context/SocketContext.jsx', () => ({
  useSocket: () => ({
    socket: mockSocket,
    connected: true
  })
}));

describe('HostGameRoom - Flow & Space Bar Controls Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorageMock.clear();
    socketHandlers = {};
    mockParams = { id: '987654' };
    sessionStorageMock.setItem('reviselive:host:987654', 'token-abc');

    mockSocket.emit = vi.fn((event, payload, cb) => {
      if (event === 'host:reconnect') {
        if (typeof cb === 'function') {
          cb({
            ok: true,
            data: {
              pin: '987654',
              status: 'LOBBY',
              players: [{ playerId: 'p1', name: 'Alice', connected: true, left: false }],
              quizTitle: 'Biology 101',
              totalQuestions: 2,
              currentQuestionIndex: 0
            }
          });
        }
      } else if (typeof cb === 'function') {
        cb({ ok: true });
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('asserts no dead Settings button exists in host lobby', async () => {
    render(
      <MemoryRouter>
        <HostGameRoom />
      </MemoryRouter>
    );

    await screen.findByTestId('host-primary-action-button');
    expect(screen.queryByRole('button', { name: /settings/i })).toBeNull();
    expect(screen.queryByText(/game settings/i)).toBeNull();
  });

  it('renders docked button in LOBBY and prevents rapid double-clicks (<400ms)', async () => {
    render(
      <MemoryRouter>
        <HostGameRoom />
      </MemoryRouter>
    );

    const button = await screen.findByTestId('host-primary-action-button');
    expect(button.textContent).toContain('Start game');
    expect(button.className).toContain('fixed');

    fireEvent.click(button);
    fireEvent.click(button);

    const startCalls = mockSocket.emit.mock.calls.filter(([event]) => event === 'host:start-question');
    expect(startCalls.length).toBe(1);
  });

  it('does NOT render docked button during QUESTION_ACTIVE, DISCUSSION, or REVOTE, but keeps header controls & histogram', async () => {
    render(
      <MemoryRouter>
        <HostGameRoom />
      </MemoryRouter>
    );

    await screen.findByTestId('host-primary-action-button');

    // 1. Transition to QUESTION_ACTIVE
    act(() => {
      socketHandlers['game:question-start']?.({
        questionIndex: 0,
        totalQuestions: 2,
        questionText: 'What is photosynthesis?',
        options: ['A', 'B', 'C', 'D'],
        timeLimit: 20
      });
    });

    // Docked button must NOT be rendered
    expect(screen.queryByTestId('host-primary-action-button')).toBeNull();

    // Header controls and histogram MUST be rendered
    expect(screen.getByText(/Answered:/i)).toBeDefined();
    expect(screen.getByText(/Discuss/i)).toBeDefined();
    expect(screen.getByText(/End Question \(E\)/i)).toBeDefined();
    expect(screen.getByText(/Teacher Preview/i)).toBeDefined();
    expect(screen.getByText(/Live Response Histogram/i)).toBeDefined();

    // 2. Transition to DISCUSSION
    act(() => {
      socketHandlers['game:discussion-start']?.({
        questionIndex: 0,
        questionText: 'What is photosynthesis?',
        options: ['A', 'B', 'C', 'D'],
        seconds: 60
      });
    });
    expect(screen.queryByTestId('host-primary-action-button')).toBeNull();

    // 3. Transition to REVOTE
    act(() => {
      socketHandlers['game:revote-start']?.({
        questionIndex: 0,
        questionText: 'What is photosynthesis?',
        options: ['A', 'B', 'C', 'D'],
        seconds: 15
      });
    });
    expect(screen.queryByTestId('host-primary-action-button')).toBeNull();

    // 4. Transition to QUESTION_REVEAL -> Docked button reappears with 'Next question →'
    act(() => {
      socketHandlers['game:question-reveal']?.({
        questionIndex: 0,
        correctIndex: 0,
        optionCounts: [1, 0, 0, 0]
      });
    });

    const revealBtn = await screen.findByTestId('host-primary-action-button');
    expect(revealBtn.textContent).toContain('Next question →');
  });

  it('Space bar triggers the correct action across states and skips LEADERBOARD', async () => {
    render(
      <MemoryRouter>
        <HostGameRoom />
      </MemoryRouter>
    );

    await screen.findByTestId('host-primary-action-button');

    let currentTime = 1000000;
    const dateSpy = vi.spyOn(Date, 'now').mockImplementation(() => currentTime);

    // In LOBBY: Space starts game
    currentTime += 500;
    fireEvent.keyDown(window, { code: 'Space', key: ' ' });
    expect(mockSocket.emit).toHaveBeenCalledWith('host:start-question', { pin: '987654' }, expect.any(Function));

    // Transition to QUESTION_ACTIVE
    act(() => {
      socketHandlers['game:question-start']?.({
        questionIndex: 0,
        totalQuestions: 2,
        questionText: 'Q1',
        options: ['A', 'B', 'C', 'D'],
        timeLimit: 20
      });
    });

    // In QUESTION_ACTIVE: Space ends question early
    currentTime += 500;
    fireEvent.keyDown(window, { code: 'Space', key: ' ' });
    expect(mockSocket.emit).toHaveBeenCalledWith('host:end-question', { pin: '987654' }, expect.any(Function));

    // Transition to DISCUSSION
    act(() => {
      socketHandlers['game:discussion-start']?.({
        questionIndex: 0,
        questionText: 'Q1',
        options: ['A', 'B', 'C', 'D'],
        seconds: 60
      });
    });

    // In DISCUSSION: Space skips discussion
    currentTime += 500;
    fireEvent.keyDown(window, { code: 'Space', key: ' ' });
    expect(mockSocket.emit).toHaveBeenCalledWith('host:skip-discussion', { pin: '987654' }, expect.any(Function));

    // Transition to REVOTE
    act(() => {
      socketHandlers['game:revote-start']?.({
        questionIndex: 0,
        questionText: 'Q1',
        options: ['A', 'B', 'C', 'D'],
        seconds: 15
      });
    });

    // In REVOTE: Space ends question early
    currentTime += 500;
    fireEvent.keyDown(window, { code: 'Space', key: ' ' });
    expect(mockSocket.emit).toHaveBeenCalledWith('host:end-question', { pin: '987654' }, expect.any(Function));

    // Transition to QUESTION_REVEAL (first question of two)
    currentTime += 500;
    act(() => {
      socketHandlers['game:question-reveal']?.({
        questionIndex: 0,
        correctIndex: 0,
        optionCounts: [1, 0, 0, 0]
      });
    });

    // Within 1000ms dwell: Space is IGNORED to prevent accidental skipping
    currentTime += 500;
    fireEvent.keyDown(window, { code: 'Space', key: ' ' });
    const callsDuringDwell = mockSocket.emit.mock.calls.filter(([event]) => event === 'host:start-question');
    expect(callsDuringDwell.length).toBe(1); // Only the 1 call from lobby, no new call!

    // After 1000ms dwell: Space directly starts next question (skips LEADERBOARD!)
    currentTime += 1100;
    fireEvent.keyDown(window, { code: 'Space', key: ' ' });
    const callsAfterDwell = mockSocket.emit.mock.calls.filter(([event]) => event === 'host:start-question');
    expect(callsAfterDwell.length).toBe(2);

    // Advance to final question (index 1 of 2)
    currentTime += 500;
    act(() => {
      socketHandlers['game:question-start']?.({
        questionIndex: 1,
        totalQuestions: 2,
        questionText: 'Q2',
        options: ['A', 'B', 'C', 'D'],
        timeLimit: 20
      });
    });

    currentTime += 500;
    act(() => {
      socketHandlers['game:question-reveal']?.({
        questionIndex: 1,
        correctIndex: 1,
        optionCounts: [1, 0, 0, 0]
      });
    });

    // On last question's reveal, button reads 'Finish'
    const finishBtn = await screen.findByTestId('host-primary-action-button');
    expect(finishBtn.textContent).toContain('Finish');

    // After 1000ms dwell, Space finishes game and calls host:end-game
    currentTime += 1200;
    fireEvent.keyDown(window, { code: 'Space', key: ' ' });
    expect(mockSocket.emit).toHaveBeenCalledWith('host:end-game', { pin: '987654' }, expect.any(Function));

    dateSpy.mockRestore();
  });

  it('ignores Space on key repeat and when focus is inside an input element', async () => {
    render(
      <MemoryRouter>
        <HostGameRoom />
      </MemoryRouter>
    );

    await screen.findByTestId('host-primary-action-button');

    // 1. Key repeat event should be ignored
    fireEvent.keyDown(window, { code: 'Space', key: ' ', repeat: true });
    expect(mockSocket.emit).not.toHaveBeenCalledWith('host:start-question', { pin: '987654' }, expect.any(Function));

    // 2. Space inside an input should be ignored
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    fireEvent.keyDown(input, { code: 'Space', key: ' ', repeat: false });
    expect(mockSocket.emit).not.toHaveBeenCalledWith('host:start-question', { pin: '987654' }, expect.any(Function));

    document.body.removeChild(input);
  });

  it('Retest Panel (F3): Start retest emits selected indexes, error acknowledgement shows visible message', async () => {
    render(
      <MemoryRouter>
        <HostGameRoom />
      </MemoryRouter>
    );

    await screen.findByTestId('host-primary-action-button');

    // Transition to FINISHED with weak question
    act(() => {
      socketHandlers['game:ended']?.({
        sessionId: 'sess-123',
        podium: [{ name: 'Alice', score: 1000, rank: 1 }],
        finalLeaderboard: [{ name: 'Alice', score: 1000, rank: 1 }],
        blindspotReport: {
          questionAccuracy: [
            {
              questionIndex: 0,
              questionText: 'What is photosynthesis?',
              accuracy: 0.25,
              topDistractorRationale: 'Confuses respiration'
            }
          ]
        }
      });
    });

    // 1. Click "Re-teach, then Retest" button
    const retestBtn = await screen.findByRole('button', { name: /re-teach, then retest/i });
    fireEvent.click(retestBtn);

    // Modal opens, preselected flagged question is visible
    expect(screen.getAllByText(/re-teach, then retest/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('What is photosynthesis?')).toBeDefined();
    expect(screen.getByText('25% acc')).toBeDefined();
    expect(screen.getByText(/misconception: confuses respiration/i)).toBeDefined();

    // 2. Mock error response on host:start-retest
    mockSocket.emit = vi.fn((event, payload, cb) => {
      if (event === 'host:start-retest') {
        cb?.({ ok: false, error: { message: 'Network glitch in retest start' } });
      }
    });

    const startRetestBtn = screen.getByRole('button', { name: /start retest \(1\)/i });
    fireEvent.click(startRetestBtn);

    expect(mockSocket.emit).toHaveBeenCalledWith(
      'host:start-retest',
      { pin: '987654', questionIndexes: [0] },
      expect.any(Function)
    );

    // Error is rendered in the visible role="alert" banner without calling window.alert
    const errorAlert = await screen.findByRole('alert');
    expect(errorAlert.textContent).toContain('Network glitch in retest start');
  });

  it('Retest Panel (F3): displays "Nothing fell below 50%" callout when all questions passed', async () => {
    render(
      <MemoryRouter>
        <HostGameRoom />
      </MemoryRouter>
    );

    await screen.findByTestId('host-primary-action-button');

    // Transition to FINISHED with high accuracy questions
    act(() => {
      socketHandlers['game:ended']?.({
        sessionId: 'sess-456',
        podium: [],
        finalLeaderboard: [],
        blindspotReport: {
          questionAccuracy: [
            {
              questionIndex: 0,
              questionText: 'What is H2O?',
              accuracy: 0.85
            },
            {
              questionIndex: 1,
              questionText: 'What is CO2?',
              accuracy: 0.9
            }
          ]
        }
      });
    });

    const retestBtn = await screen.findByRole('button', { name: /re-teach, then retest/i });
    fireEvent.click(retestBtn);

    // Callout visible
    expect(screen.getByText(/nothing fell below 50% accuracy/i)).toBeDefined();

    // Both questions are shown for manual picking
    expect(screen.getByText('What is H2O?')).toBeDefined();
    expect(screen.getByText('What is CO2?')).toBeDefined();

    // Initially 0 selected -> Start retest button is disabled
    const startBtn = screen.getByRole('button', { name: /start retest \(0\)/i });
    expect(startBtn.hasAttribute('disabled')).toBe(true);

    // Click "Select all"
    const selectAllBtn = screen.getByRole('button', { name: /select all/i });
    fireEvent.click(selectAllBtn);

    // Now 2 selected -> Start retest button is enabled
    const enabledStartBtn = screen.getByRole('button', { name: /start retest \(2\)/i });
    expect(enabledStartBtn.hasAttribute('disabled')).toBe(false);
  });
});
