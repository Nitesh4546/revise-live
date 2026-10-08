import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { io as Client } from 'socket.io-client';
import request from 'supertest';
import { startServer } from '../src/server.js';
import { setupTestDB, teardownTestDB } from './setup.js';
import { roomManager } from '../src/sockets/roomManager.js';
import { GameSession } from '../src/models/GameSession.js';

describe('Masking Invariants & Pedagogical Features (C1–C6, D7)', () => {
  let serverInstance;
  let serverPort;
  let teacherToken;
  let quizId;

  beforeAll(async () => {
    await setupTestDB();

    const result = await startServer(0);
    serverInstance = result.server;
    serverPort = serverInstance.address().port;
    const app = result.app;

    // Register Teacher
    const regRes = await request(app).post('/api/auth/register').send({
      name: 'Pedagogy Teacher',
      email: `pedagogy_${Date.now()}@school.edu`,
      password: 'password123'
    });
    teacherToken = regRes.body.token;

    // Create Quiz
    const quizRes = await request(app)
      .post('/api/quizzes')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'Pedagogy Feature Test Quiz',
        topic: 'Science',
        questions: [
          {
            questionText: 'What is the powerhouse of the cell?',
            options: ['Mitochondria', 'Nucleus', 'Ribosome', 'Vacuole'],
            correctIndex: 0,
            distractorRationales: ['', 'Confuses command center with power generation', 'Confuses protein synthesis', 'Confuses fluid storage'],
            explanation: 'Mitochondria produce ATP through cellular respiration.',
            topicTag: 'Cell Biology',
            timeLimit: 20
          },
          {
            questionText: 'Which organelle contains genetic material?',
            options: ['Nucleus', 'Mitochondria', 'Chloroplast', 'Golgi Apparatus'],
            correctIndex: 0,
            distractorRationales: ['', 'Contains small mtDNA but not genomic bulk', 'Only present in plant cells', 'Packages proteins'],
            explanation: 'The nucleus houses the genomic DNA.',
            topicTag: 'Cell Biology',
            timeLimit: 20
          }
        ]
      });
    quizId = quizRes.body.quiz._id;
  });

  afterAll(async () => {
    if (serverInstance) {
      await new Promise((resolve) => serverInstance.close(resolve));
    }
    await teardownTestDB();
  });

  const createClient = (token = null) => {
    return Client(`http://localhost:${serverPort}`, {
      auth: token ? { token } : {},
      transports: ['websocket'],
      forceNew: true
    });
  };

  it('Protocol Masking Invariant: correctIndex and explanation NEVER leak to players or display during QUESTION_ACTIVE, DISCUSSION, or REVOTE', async () => {
    const hostSocket = createClient(teacherToken);
    await new Promise((resolve) => hostSocket.on('connect', resolve));

    const createAck = await new Promise((resolve) => {
      hostSocket.emit('host:create-room', { quizId }, resolve);
    });
    expect(createAck.ok).toBe(true);
    const { pin, displayToken } = createAck.data;

    // Connect display and players
    const displaySocket = createClient();
    const playerSocket = createClient();
    const player2Socket = createClient();
    await Promise.all([
      new Promise((resolve) => displaySocket.on('connect', resolve)),
      new Promise((resolve) => playerSocket.on('connect', resolve)),
      new Promise((resolve) => player2Socket.on('connect', resolve))
    ]);

    const displayJoinAck = await new Promise((resolve) => {
      displaySocket.emit('display:join', { pin, displayToken }, resolve);
    });
    expect(displayJoinAck.ok).toBe(true);

    await Promise.all([
      new Promise((resolve) => playerSocket.emit('player:join', { pin, name: 'Student 1' }, resolve)),
      new Promise((resolve) => player2Socket.emit('player:join', { pin, name: 'Student 2' }, resolve))
    ]);

    // 1. QUESTION_ACTIVE state
    const p1QuestionStart = new Promise((resolve) => playerSocket.once('game:question-start', resolve));
    const dispQuestionStart = new Promise((resolve) => displaySocket.once('game:question-start', resolve));

    await new Promise((resolve) => hostSocket.emit('host:start-question', { pin }, resolve));

    const p1Payload = await p1QuestionStart;
    const dispPayload = await dispQuestionStart;

    // Strict Masking Checks on QUESTION_ACTIVE
    expect(p1Payload.correctIndex).toBeUndefined();
    expect(p1Payload.explanation).toBeUndefined();
    expect(p1Payload.distractorRationales).toBeUndefined();

    expect(dispPayload.correctIndex).toBeUndefined();
    expect(dispPayload.explanation).toBeUndefined();
    expect(dispPayload.distractorRationales).toBeUndefined();

    // Track leak events during active round 1, discussion, and revote
    let revealLeakCount = 0;
    let resultLeakCount = 0;
    playerSocket.on('game:question-reveal', () => { revealLeakCount++; });
    playerSocket.on('player:result', () => { resultLeakCount++; });
    displaySocket.on('game:question-reveal', () => { revealLeakCount++; });

    // Player sets confidence in round 1 (accepted in QUESTION_ACTIVE)
    const confRound1Ack = await new Promise((resolve) => playerSocket.emit('player:set-confidence', { pin, level: 2 }, resolve));
    expect(confRound1Ack.ok).toBe(true);

    // Player submits answer in round 1 (player 2 has not submitted, so room remains QUESTION_ACTIVE)
    await new Promise((resolve) => playerSocket.emit('player:submit-answer', { pin, selectedIndex: 1 }, resolve));

    // 2. Start DISCUSSION state
    const p1Discussion = new Promise((resolve) => playerSocket.once('game:discussion-start', resolve));
    const dispDiscussion = new Promise((resolve) => displaySocket.once('game:discussion-start', resolve));

    await new Promise((resolve) => hostSocket.emit('host:start-discussion', { pin, seconds: 30 }, resolve));

    const p1Disc = await p1Discussion;
    const dispDisc = await dispDiscussion;

    // Strict Masking Checks on DISCUSSION
    expect(p1Disc.correctIndex).toBeUndefined();
    expect(p1Disc.explanation).toBeUndefined();
    expect(dispDisc.correctIndex).toBeUndefined();
    expect(dispDisc.explanation).toBeUndefined();

    // Distribution is present, but NO answer leak
    expect(p1Disc.distribution).toBeDefined();
    expect(revealLeakCount).toBe(0);
    expect(resultLeakCount).toBe(0);

    // 3. Start REVOTE state
    const p1Revote = new Promise((resolve) => playerSocket.once('game:revote-start', resolve));
    const dispRevote = new Promise((resolve) => displaySocket.once('game:revote-start', resolve));

    await new Promise((resolve) => hostSocket.emit('host:skip-discussion', { pin }, resolve));

    const p1Rev = await p1Revote;
    const dispRev = await dispRevote;

    // Strict Masking Checks on REVOTE
    expect(p1Rev.correctIndex).toBeUndefined();
    expect(p1Rev.explanation).toBeUndefined();
    expect(dispRev.correctIndex).toBeUndefined();
    expect(dispRev.explanation).toBeUndefined();
    expect(revealLeakCount).toBe(0);
    expect(resultLeakCount).toBe(0);

    // In REVOTE: player can set confidence per-round
    const confRevoteAck = await new Promise((resolve) => playerSocket.emit('player:set-confidence', { pin, level: 3 }, resolve));
    expect(confRevoteAck.ok).toBe(true);

    // Attach listeners before revote submission triggers automatic finalization
    const finalRevealPromise = new Promise((resolve) => playerSocket.once('game:question-reveal', resolve));
    const finalResultPromise = new Promise((resolve) => playerSocket.once('player:result', resolve));

    // Both players submit revote (triggers automatic finalization since all players revoted)
    await Promise.all([
      new Promise((resolve) => playerSocket.emit('player:submit-revote', { pin, selectedIndex: 0 }, resolve)),
      new Promise((resolve) => player2Socket.emit('player:submit-revote', { pin, selectedIndex: 2 }, resolve))
    ]);

    const finalReveal = await finalRevealPromise;
    const finalResult = await finalResultPromise;

    expect(finalReveal.correctIndex).toBe(0);
    expect(finalReveal.peerShift).toBeDefined();
    expect(finalResult.isCorrect).toBe(true);
    expect(revealLeakCount).toBe(1);
    expect(resultLeakCount).toBe(1);

    // In QUESTION_REVEAL: player:set-confidence must be REJECTED!
    const confRevealAck = await new Promise((resolve) => playerSocket.emit('player:set-confidence', { pin, level: 1 }, resolve));
    expect(confRevealAck.ok).toBe(false);
    expect(confRevealAck.error.code).toBe('INVALID_STATE');

    // Attempting a second discussion on the same question must be rejected!
    const secondDiscAck = await new Promise((resolve) => hostSocket.emit('host:start-discussion', { pin, seconds: 30 }, resolve));
    expect(secondDiscAck.ok).toBe(false);
    expect(['ALREADY_DISCUSSED', 'INVALID_STATE']).toContain(secondDiscAck.error.code);

    hostSocket.disconnect();
    displaySocket.disconnect();
    playerSocket.disconnect();
    player2Socket.disconnect();
  });

  it('Teacher Console vs Projector Display Isolation (C5): Display socket rejects bad displayToken and never receives private stats', async () => {
    const hostSocket = createClient(teacherToken);
    await new Promise((resolve) => hostSocket.on('connect', resolve));

    const createAck = await new Promise((resolve) => {
      hostSocket.emit('host:create-room', { quizId }, resolve);
    });
    const { pin, displayToken } = createAck.data;

    // Attempt display join with bad token
    const badDisplaySocket = createClient();
    await new Promise((resolve) => badDisplaySocket.on('connect', resolve));

    const badJoin = await new Promise((resolve) => {
      badDisplaySocket.emit('display:join', { pin, displayToken: 'bad-token' }, resolve);
    });
    expect(badJoin.ok).toBe(false);
    expect(badJoin.error.code).toBe('UNAUTHORIZED_DISPLAY');

    // Valid display join
    const validDisplaySocket = createClient();
    await new Promise((resolve) => validDisplaySocket.on('connect', resolve));
    const goodJoin = await new Promise((resolve) => {
      validDisplaySocket.emit('display:join', { pin, displayToken }, resolve);
    });
    expect(goodJoin.ok).toBe(true);

    // Track events sent to display
    let displayGotLiveStats = false;
    let displayGotPreview = false;
    validDisplaySocket.on('host:live-stats', () => { displayGotLiveStats = true; });
    validDisplaySocket.on('host:question-preview', () => { displayGotPreview = true; });

    let hostGotLiveStats = false;
    hostSocket.on('host:live-stats', () => { hostGotLiveStats = true; });

    // Join a student and submit answer
    const pSocket = createClient();
    await new Promise((resolve) => pSocket.on('connect', resolve));
    await new Promise((resolve) => pSocket.emit('player:join', { pin, name: 'Alex' }, resolve));

    await new Promise((resolve) => hostSocket.emit('host:start-question', { pin }, resolve));
    await new Promise((resolve) => pSocket.emit('player:submit-answer', { pin, selectedIndex: 0 }, resolve));

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(hostGotLiveStats).toBe(true);
    expect(displayGotLiveStats).toBe(false); // Security assertion: Projector never receives live answer counts
    expect(displayGotPreview).toBe(false); // Security assertion: Projector never receives question preview

    hostSocket.disconnect();
    badDisplaySocket.disconnect();
    validDisplaySocket.disconnect();
    pSocket.disconnect();
  });

  it('Confidence Calibration (C2): Records confidence level and awards bonus when confidenceScoring is enabled', async () => {
    const hostSocket = createClient(teacherToken);
    await new Promise((resolve) => hostSocket.on('connect', resolve));

    const createAck = await new Promise((resolve) => {
      hostSocket.emit(
        'host:create-room',
        { quizId, settings: { confidenceScoring: true, scoringMode: 'accuracy' } },
        resolve
      );
    });
    const { pin } = createAck.data;

    const p1Socket = createClient();
    const p2Socket = createClient();
    await Promise.all([
      new Promise((resolve) => p1Socket.on('connect', resolve)),
      new Promise((resolve) => p2Socket.on('connect', resolve))
    ]);
    await Promise.all([
      new Promise((resolve) => p1Socket.emit('player:join', { pin, name: 'ConfidentPlayer' }, resolve)),
      new Promise((resolve) => p2Socket.emit('player:join', { pin, name: 'StudentB' }, resolve))
    ]);

    await new Promise((resolve) => hostSocket.emit('host:start-question', { pin }, resolve));

    // p1 submits answer and sets confidence to 3 (Certain)
    await new Promise((resolve) => p1Socket.emit('player:submit-answer', { pin, selectedIndex: 0 }, resolve));
    const confAck = await new Promise((resolve) => p1Socket.emit('player:set-confidence', { pin, level: 3 }, resolve));
    expect(confAck.ok).toBe(true);
    expect(confAck.level).toBe(3);

    // End question and verify score includes confidence bonus
    const resultPromise = new Promise((resolve) => p1Socket.once('player:result', resolve));
    await new Promise((resolve) => hostSocket.emit('host:end-question', { pin }, resolve));

    const result = await resultPromise;
    expect(result.isCorrect).toBe(true);
    // Accuracy (1000) + Confidence Bonus (100) = 1100
    expect(result.totalScore).toBe(1100);

    hostSocket.disconnect();
    p1Socket.disconnect();
    p2Socket.disconnect();
  });

  it('Peer Instruction Shift & Recovered Bonus (C3): Awards flat +500 recovered bonus on wrong->right revote', async () => {
    const hostSocket = createClient(teacherToken);
    await new Promise((resolve) => hostSocket.on('connect', resolve));

    const createAck = await new Promise((resolve) => {
      hostSocket.emit('host:create-room', { quizId }, resolve);
    });
    const { pin } = createAck.data;

    const p1Socket = createClient();
    const p2Socket = createClient();
    await Promise.all([
      new Promise((resolve) => p1Socket.on('connect', resolve)),
      new Promise((resolve) => p2Socket.on('connect', resolve))
    ]);
    await Promise.all([
      new Promise((resolve) => p1Socket.emit('player:join', { pin, name: 'RevolvingStudent' }, resolve)),
      new Promise((resolve) => p2Socket.emit('player:join', { pin, name: 'PeerStudent' }, resolve))
    ]);

    await new Promise((resolve) => hostSocket.emit('host:start-question', { pin }, resolve));

    // Round 1: student chooses wrong option (1)
    await new Promise((resolve) => p1Socket.emit('player:submit-answer', { pin, selectedIndex: 1 }, resolve));

    // Host starts discussion
    const discAck = await new Promise((resolve) => hostSocket.emit('host:start-discussion', { pin, seconds: 30 }, resolve));
    expect(discAck.ok).toBe(true);

    // Host skips to revote
    const skipAck = await new Promise((resolve) => hostSocket.emit('host:skip-discussion', { pin }, resolve));
    expect(skipAck.ok).toBe(true);

    // Student revotes to correct option (0)
    const resultPromise = new Promise((resolve) => p1Socket.once('player:result', resolve));
    const revoteAck = await new Promise((resolve) => p1Socket.emit('player:submit-revote', { pin, selectedIndex: 0 }, resolve));
    expect(revoteAck.ok).toBe(true);

    // PeerStudent also revotes, triggering automatic finalize
    await new Promise((resolve) => p2Socket.emit('player:submit-revote', { pin, selectedIndex: 2 }, resolve));

    const result = await resultPromise;
    expect(result.isCorrect).toBe(true);
    expect(result.recovered).toBe(true);
    expect(result.totalScore).toBe(500); // 0 in round 1 + 500 recovered bonus!

    hostSocket.disconnect();
    p1Socket.disconnect();
    p2Socket.disconnect();
  });

  it('Revision Receipt Generation & SHA-256 Hashing (C6)', async () => {
    const hostSocket = createClient(teacherToken);
    await new Promise((resolve) => hostSocket.on('connect', resolve));

    const createAck = await new Promise((resolve) => {
      hostSocket.emit('host:create-room', { quizId }, resolve);
    });
    const { pin } = createAck.data;

    const pSocket = createClient();
    await new Promise((resolve) => pSocket.on('connect', resolve));
    await new Promise((resolve) => pSocket.emit('player:join', { pin, name: 'ReceiptUser' }, resolve));

    await new Promise((resolve) => hostSocket.emit('host:start-question', { pin }, resolve));
    await new Promise((resolve) => pSocket.emit('player:submit-answer', { pin, selectedIndex: 0 }, resolve));
    await new Promise((resolve) => hostSocket.emit('host:end-question', { pin }, resolve));
    await new Promise((resolve) => hostSocket.emit('host:show-leaderboard', { pin }, resolve));

    const pEndPromise = new Promise((resolve) => pSocket.once('player:game-ended', resolve));
    await new Promise((resolve) => hostSocket.emit('host:end-game', { pin }, resolve));

    const pEnd = await pEndPromise;
    expect(pEnd.receiptToken).toBeDefined();
    expect(pEnd.receiptUrl).toMatch(/^\/r\/[a-f0-9]{32}$/);

    // Verify token is hashed in MongoDB GameSession
    const sessionDoc = await GameSession.findOne({ pin });
    expect(sessionDoc).not.toBeNull();
    const storedHash = sessionDoc.players[0].receiptTokenHash;
    expect(storedHash).toBeDefined();
    // Raw token must NOT be stored in MongoDB
    expect(storedHash).not.toBe(pEnd.receiptToken);
    expect(storedHash).toHaveLength(64); // SHA-256 hex string

    hostSocket.disconnect();
    pSocket.disconnect();
  });

  it('Retest Round (C4): Runs retest with reshuffled options and tracks retest score separately', async () => {
    const hostSocket = createClient(teacherToken);
    await new Promise((resolve) => hostSocket.on('connect', resolve));

    const createAck = await new Promise((resolve) => {
      hostSocket.emit('host:create-room', { quizId, settings: { leaderboardBetweenQuestions: true } }, resolve);
    });
    const { pin } = createAck.data;

    const pSocket = createClient();
    await new Promise((resolve) => pSocket.on('connect', resolve));
    await new Promise((resolve) => pSocket.emit('player:join', { pin, name: 'RetestStudent' }, resolve));

    // Play Main Question 0
    await new Promise((resolve) => hostSocket.emit('host:start-question', { pin }, resolve));
    await new Promise((resolve) => pSocket.emit('player:submit-answer', { pin, selectedIndex: 0 }, resolve));
    await new Promise((resolve) => hostSocket.emit('host:show-leaderboard', { pin }, resolve));

    const room = roomManager.getRoom(pin);
    const mainScore = room.players.get(Array.from(room.players.keys())[0]).score;
    expect(mainScore).toBe(1000);

    // Host starts Retest for question 0
    const retestStartPromise = new Promise((resolve) => pSocket.once('game:retest-start', resolve));
    const retestQStartPromise = new Promise((resolve) => pSocket.once('game:question-start', resolve));

    const retestAck = await new Promise((resolve) => {
      hostSocket.emit('host:start-retest', { pin, questionIndexes: [0] }, resolve);
    });
    expect(retestAck.ok).toBe(true);

    const retestStart = await retestStartPromise;
    expect(retestStart.questionIndexes).toEqual([0]);

    const qPayload = await retestQStartPromise;
    expect(qPayload.round).toBe('retest');
    expect(qPayload.questionIndex).toBe(0);

    // Answer in Retest: answer correct index for reshuffled retest question
    const retestCorrectIdx = room.retestQuestions[0].correctIndex;
    const retestResultPromise = new Promise((resolve) => pSocket.once('player:result', resolve));

    await new Promise((resolve) => pSocket.emit('player:submit-answer', { pin, selectedIndex: retestCorrectIdx }, resolve));

    const retestResult = await retestResultPromise;
    expect(retestResult.isCorrect).toBe(true);
    // Retest score is 1000
    expect(retestResult.totalScore).toBe(1000);

    // CRITICAL: Player main game score was NOT modified by retest!
    const playerObj = room.players.get(Array.from(room.players.keys())[0]);
    expect(playerObj.score).toBe(1000); // Main score untouched
    expect(playerObj.retestScore).toBe(1000); // Retest score separate
    expect(room.rounds).toEqual(['main', 'retest']);

    // Complete retest question and end game
    await new Promise((resolve) => hostSocket.emit('host:show-leaderboard', { pin }, resolve));
    const endAck = await new Promise((resolve) => hostSocket.emit('host:end-game', { pin }, resolve));
    expect(endAck.ok).toBe(true);

    // Verify retest persistence in MongoDB GameSession
    const sessionDoc = await GameSession.findOne({ pin });
    expect(sessionDoc).not.toBeNull();
    expect(sessionDoc.retest).toBeDefined();
    expect(sessionDoc.retest.questionIndexes).toEqual([0]);
    expect(sessionDoc.retest.afterAccuracy).toBe(1);

    hostSocket.disconnect();
    pSocket.disconnect();
  });

  it('Zero completed questions end-game does not persist GameSession in MongoDB (Requirement 6)', async () => {
    const hostSocket = createClient(teacherToken);
    await new Promise((resolve) => hostSocket.on('connect', resolve));

    const createAck = await new Promise((resolve) => {
      hostSocket.emit('host:create-room', { quizId }, resolve);
    });
    const { pin } = createAck.data;

    const pSocket = createClient();
    await new Promise((resolve) => pSocket.on('connect', resolve));
    await new Promise((resolve) => pSocket.emit('player:join', { pin, name: 'ZeroQPlayer' }, resolve));

    // Host ends game immediately without completing any questions
    const endAck = await new Promise((resolve) => hostSocket.emit('host:end-game', { pin }, resolve));
    expect(endAck.ok).toBe(true);
    expect(endAck.persisted).toBe(false);
    expect(endAck.sessionId).toBeNull();

    // MongoDB should have NO session for this pin
    const sessionDoc = await GameSession.findOne({ pin });
    expect(sessionDoc).toBeNull();

    hostSocket.disconnect();
    pSocket.disconnect();
  });
});
