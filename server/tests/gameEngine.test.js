import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { GameEngine } from '../src/sockets/gameEngine.js';
import { setupTestDB, teardownTestDB } from './setup.js';

describe('GameEngine State Machine & Timers', () => {
  let mockRoom;

  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(() => {
    vi.useFakeTimers();

    mockRoom = {
      pin: '123456',
      status: 'LOBBY',
      currentQuestionIndex: -1,
      timerId: null,
      finalized: false,
      quiz: {
        title: 'Physics Test',
        questions: [
          {
            questionText: 'What is force?',
            options: ['Mass x Acceleration', 'Mass / Velocity', 'Energy x Time', 'Power / Work'],
            correctIndex: 0,
            explanation: 'F=ma is Newton second law. Velocity is speed with direction.',
            topicTag: 'Forces',
            timeLimit: 20
          },
          {
            questionText: 'What is kinetic energy formula?',
            options: ['0.5 m v^2', 'm g h', 'F d', 'P t'],
            correctIndex: 0,
            explanation: 'Kinetic energy is 1/2 mv^2.',
            topicTag: 'Energy',
            timeLimit: 20
          }
        ]
      },
      players: new Map([
        [
          'p1',
          {
            playerId: 'p1',
            name: 'Alice',
            connected: true,
            score: 0,
            streak: 0,
            previousRank: null,
            currentAnswer: null,
            history: []
          }
        ],
        [
          'p2',
          {
            playerId: 'p2',
            name: 'Bob',
            connected: true,
            score: 0,
            streak: 0,
            previousRank: null,
            currentAnswer: null,
            history: []
          }
        ]
      ]),
      answerLog: []
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('prohibits starting question with zero connected players', () => {
    mockRoom.players.get('p1').connected = false;
    mockRoom.players.get('p2').connected = false;

    const res = GameEngine.startQuestion(mockRoom, null);
    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('NO_PLAYERS');
    expect(mockRoom.status).toBe('LOBBY');
  });

  it('masks answer: question-start payload provably omits correctIndex and explanation', () => {
    const res = GameEngine.startQuestion(mockRoom, null);
    expect(res.ok).toBe(true);
    expect(mockRoom.status).toBe('QUESTION_ACTIVE');
    expect(mockRoom.currentQuestionIndex).toBe(0);

    const payload = res.questionPayload;
    expect(payload.questionText).toBe('What is force?');
    expect(payload.options).toHaveLength(4);
    expect(payload.timeLimit).toBe(20);

    // CRITICAL SECURITY ASSERTIONS
    expect(payload.correctIndex).toBeUndefined();
    expect(payload.explanation).toBeUndefined();
  });

  it('rejects illegal state transitions', () => {
    // Attempting showLeaderboard while still in QUESTION_ACTIVE
    mockRoom.status = 'QUESTION_ACTIVE';
    const leadRes = GameEngine.showLeaderboard(mockRoom, null);
    expect(leadRes.ok).toBe(false);
    expect(leadRes.error.code).toBe('INVALID_STATE');

    // Attempting startQuestion while in DISCUSSION
    mockRoom.status = 'DISCUSSION';
    const startRes = GameEngine.startQuestion(mockRoom, null);
    expect(startRes.ok).toBe(false);
    expect(startRes.error.code).toBe('INVALID_STATE');
  });

  it('allows startQuestion from QUESTION_REVEAL directly without entering LEADERBOARD', () => {
    // Start question 0
    GameEngine.startQuestion(mockRoom, null);
    expect(mockRoom.status).toBe('QUESTION_ACTIVE');
    expect(mockRoom.currentQuestionIndex).toBe(0);

    // Finalize to QUESTION_REVEAL
    GameEngine.finalizeQuestion(mockRoom, null);
    expect(mockRoom.status).toBe('QUESTION_REVEAL');

    // Advancing directly from QUESTION_REVEAL to next question is legal
    const nextQ = GameEngine.startQuestion(mockRoom, null);
    expect(nextQ.ok).toBe(true);
    expect(mockRoom.status).toBe('QUESTION_ACTIVE');
    expect(mockRoom.currentQuestionIndex).toBe(1);
  });

  it('never enters LEADERBOARD when between-question leaderboard setting is off', () => {
    mockRoom.settings = { leaderboardBetweenQuestions: false, leaderboardMode: 'off' };
    mockRoom.status = 'QUESTION_REVEAL';

    const res = GameEngine.showLeaderboard(mockRoom, null);
    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('LEADERBOARD_DISABLED');
    expect(mockRoom.status).toBe('QUESTION_REVEAL');
  });

  it('allows entering LEADERBOARD when opt-in leaderboardBetweenQuestions is true', () => {
    mockRoom.settings = { leaderboardBetweenQuestions: true, leaderboardMode: 'competitive' };
    mockRoom.status = 'QUESTION_REVEAL';

    const res = GameEngine.showLeaderboard(mockRoom, null);
    expect(res.ok).toBe(true);
    expect(mockRoom.status).toBe('LEADERBOARD');
  });

  it('locks player on first answer and silently ignores second answer', () => {
    GameEngine.startQuestion(mockRoom, null);

    const first = GameEngine.submitAnswer(mockRoom, 'p1', 0, null);
    expect(first.ok).toBe(true);
    expect(mockRoom.players.get('p1').currentAnswer.index).toBe(0);

    const second = GameEngine.submitAnswer(mockRoom, 'p1', 1, null);
    expect(second.ok).toBe(true);
    expect(second.alreadyAnswered).toBe(true);
    // Answer was NOT changed to 1
    expect(mockRoom.players.get('p1').currentAnswer.index).toBe(0);
  });

  it('triggers reveal automatically when all connected players have answered (ignoring disconnected)', () => {
    // Disconnect Bob
    mockRoom.players.get('p2').connected = false;
    GameEngine.startQuestion(mockRoom, null);

    // Alice answers
    GameEngine.submitAnswer(mockRoom, 'p1', 0, null);

    // Because only Alice is connected, all connected have answered -> should transition to QUESTION_REVEAL
    expect(mockRoom.status).toBe('QUESTION_REVEAL');
    expect(mockRoom.finalized).toBe(true);
  });

  it('guarantees finalizeQuestion idempotency under racing triggers', () => {
    GameEngine.startQuestion(mockRoom, null);

    const res1 = GameEngine.finalizeQuestion(mockRoom, null);
    expect(res1.ok).toBe(true);
    expect(mockRoom.status).toBe('QUESTION_REVEAL');

    // Second call (e.g. timeout racing with all-answered) is safely rejected
    const res2 = GameEngine.finalizeQuestion(mockRoom, null);
    expect(res2.ok).toBe(false);
    expect(res2.error.code).toBe('ALREADY_FINALIZED');
    // Scores and answerLog are calculated only once
    expect(mockRoom.answerLog).toHaveLength(1);
  });

  it('executes full legal cycle with skipped leaderboard: LOBBY -> QUESTION_ACTIVE -> QUESTION_REVEAL -> FINISHED', async () => {
    // Default settings: leaderboard is off
    mockRoom.settings = { leaderboardBetweenQuestions: false, leaderboardMode: 'off' };

    // 1. Start question 0
    const q1 = GameEngine.startQuestion(mockRoom, null);
    expect(q1.ok).toBe(true);
    expect(mockRoom.status).toBe('QUESTION_ACTIVE');

    // 2. Submit answers
    GameEngine.submitAnswer(mockRoom, 'p1', 0, null); // Correct
    GameEngine.submitAnswer(mockRoom, 'p2', 1, null); // Wrong

    // State is now QUESTION_REVEAL
    expect(mockRoom.status).toBe('QUESTION_REVEAL');

    // 3. Advance directly to Question 1 from QUESTION_REVEAL without LEADERBOARD
    const q2 = GameEngine.startQuestion(mockRoom, null);
    expect(q2.ok).toBe(true);
    expect(mockRoom.status).toBe('QUESTION_ACTIVE');
    expect(mockRoom.currentQuestionIndex).toBe(1);

    // Answer Question 1
    GameEngine.submitAnswer(mockRoom, 'p1', 0, null);
    GameEngine.submitAnswer(mockRoom, 'p2', 0, null);
    expect(mockRoom.status).toBe('QUESTION_REVEAL');

    // 4. End game directly from final QUESTION_REVEAL
    const endRes = await GameEngine.endGame(mockRoom, null);
    expect(endRes.ok).toBe(true);
    expect(mockRoom.status).toBe('FINISHED');
    expect(endRes.podium).toHaveLength(2);
    expect(endRes.blindspotReport).toBeDefined();

    // 5. Retest remains reachable from FINISHED
    const retestRes = GameEngine.startRetest(mockRoom, [0], null);
    expect(retestRes.ok).toBe(true);
    expect(mockRoom.currentRound).toBe('retest');
    expect(mockRoom.status).toBe('QUESTION_ACTIVE');
  });

  it('never automatically advances beyond QUESTION_REVEAL on timer expiry or all answered (F8)', () => {
    // 1. Timer expiry scenario
    GameEngine.startQuestion(mockRoom, null);
    expect(mockRoom.status).toBe('QUESTION_ACTIVE');
    expect(mockRoom.currentQuestionIndex).toBe(0);

    // Fast forward timer past question duration + grace
    vi.advanceTimersByTime(20000 + 500);

    // State is strictly QUESTION_REVEAL, not next question
    expect(mockRoom.status).toBe('QUESTION_REVEAL');
    expect(mockRoom.currentQuestionIndex).toBe(0);

    // Even if more time passes, status never changes automatically
    vi.advanceTimersByTime(30000);
    expect(mockRoom.status).toBe('QUESTION_REVEAL');
    expect(mockRoom.currentQuestionIndex).toBe(0);

    // 2. All players answered scenario (on question 1)
    GameEngine.startQuestion(mockRoom, null);
    expect(mockRoom.status).toBe('QUESTION_ACTIVE');
    expect(mockRoom.currentQuestionIndex).toBe(1);

    GameEngine.submitAnswer(mockRoom, 'p1', 0, null);
    GameEngine.submitAnswer(mockRoom, 'p2', 0, null);

    // Transitioned immediately to QUESTION_REVEAL
    expect(mockRoom.status).toBe('QUESTION_REVEAL');
    expect(mockRoom.currentQuestionIndex).toBe(1);

    // Further passage of time never auto-advances
    vi.advanceTimersByTime(30000);
    expect(mockRoom.status).toBe('QUESTION_REVEAL');
    expect(mockRoom.currentQuestionIndex).toBe(1);
  });
});
