import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { io as ClientIO } from 'socket.io-client';
import { startServer } from '../src/server.js';
import { setupTestDB, teardownTestDB } from './setup.js';
import { Quiz } from '../src/models/Quiz.js';
import { User } from '../src/models/User.js';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';

describe('Full Multi-Actor E2E Flow: 1 Console, 1 Display, 3 Players (Space Bar Driven)', () => {
  let serverInstance;
  let serverUrl;
  let teacherToken;
  let quizId;

  beforeAll(async () => {
    await setupTestDB();

    const result = await startServer(0);
    serverInstance = result.server;
    const port = serverInstance.address().port;
    serverUrl = `http://localhost:${port}`;

    const teacher = await User.create({
      name: 'Professor Space',
      email: 'space@school.edu',
      passwordHash: 'dummyhash123',
      role: 'teacher'
    });

    teacherToken = jwt.sign({ id: teacher._id, email: teacher.email, role: 'teacher' }, env.JWT_SECRET, {
      expiresIn: '1h'
    });

    const quiz = await Quiz.create({
      title: 'Solar System Live',
      topic: 'Astronomy',
      createdBy: teacher._id,
      questions: [
        {
          questionText: 'Which planet is closest to the Sun?',
          options: ['Mercury', 'Venus', 'Earth', 'Mars'],
          correctIndex: 0,
          explanation: 'Mercury is the innermost planet.',
          topicTag: 'Planets',
          timeLimit: 20
        },
        {
          questionText: 'What is the largest planet in our solar system?',
          options: ['Jupiter', 'Saturn', 'Uranus', 'Neptune'],
          correctIndex: 0,
          explanation: 'Jupiter is the most massive planet.',
          topicTag: 'Planets',
          timeLimit: 20
        }
      ]
    });
    quizId = quiz._id.toString();
  });

  afterAll(async () => {
    if (serverInstance) {
      serverInstance.closeAllConnections?.();
      await new Promise((resolve) => serverInstance.close(resolve));
    }
    await teardownTestDB();
  }, 20000);

  function createClient(token = null) {
    return ClientIO(serverUrl, {
      auth: token ? { token } : {},
      transports: ['websocket'],
      forceNew: true
    });
  }

  it('runs complete quiz with 1 console, 1 display, 3 players using direct reveal-to-question Space bar flow', async () => {
    // 1. Host Console connects
    const hostSocket = createClient(teacherToken);
    await new Promise((resolve) => hostSocket.on('connect', resolve));

    const createRes = await new Promise((resolve) => {
      hostSocket.emit('host:create-room', { quizId }, resolve);
    });
    expect(createRes.ok).toBe(true);
    const pin = createRes.data.pin;
    const displayToken = createRes.data.displayToken;
    expect(pin).toBeDefined();

    // 2. Projector Display connects
    const displaySocket = createClient();
    await new Promise((resolve) => displaySocket.on('connect', resolve));
    const displayJoinRes = await new Promise((resolve) => {
      displaySocket.emit('display:join', { pin, displayToken }, resolve);
    });
    expect(displayJoinRes.ok).toBe(true);

    // 3. Three student mobile gamepads connect (Alice, Bob, Charlie)
    const p1 = createClient();
    const p2 = createClient();
    const p3 = createClient();
    await Promise.all([
      new Promise((res) => p1.on('connect', res)),
      new Promise((res) => p2.on('connect', res)),
      new Promise((res) => p3.on('connect', res))
    ]);

    const joins = await Promise.all([
      new Promise((res) => p1.emit('player:join', { pin, name: 'Alice' }, res)),
      new Promise((res) => p2.emit('player:join', { pin, name: 'Bob' }, res)),
      new Promise((res) => p3.emit('player:join', { pin, name: 'Charlie' }, res))
    ]);
    expect(joins.every((j) => j.ok)).toBe(true);

    // ==========================================
    // QUESTION 1 (Driven by Host Space)
    // ==========================================

    // Host presses Space in LOBBY -> host:start-question
    const q1StartPromiseHost = new Promise((res) => hostSocket.once('game:question-start', res));
    const q1StartPromiseDisplay = new Promise((res) => displaySocket.once('game:question-start', res));
    const q1StartPromiseP1 = new Promise((res) => p1.once('game:question-start', res));

    const startAck1 = await new Promise((res) => {
      hostSocket.emit('host:start-question', { pin }, res);
    });
    expect(startAck1.ok).toBe(true);

    const q1Data = await q1StartPromiseHost;
    await q1StartPromiseDisplay;
    const p1Data = await q1StartPromiseP1;
    expect(q1Data.questionIndex).toBe(0);
    expect(p1Data.correctIndex).toBeUndefined(); // Masked

    // All 3 students submit answers
    const revealPromiseHost1 = new Promise((res) => hostSocket.once('game:question-reveal', res));
    const revealPromiseDisplay1 = new Promise((res) => displaySocket.once('game:question-reveal', res));
    const p1ResultPromise = new Promise((res) => p1.once('player:result', res));

    const submitAcks = await Promise.all([
      new Promise((res) => p1.emit('player:submit-answer', { pin, selectedIndex: 0 }, res)),
      new Promise((res) => p2.emit('player:submit-answer', { pin, selectedIndex: 0 }, res)),
      new Promise((res) => p3.emit('player:submit-answer', { pin, selectedIndex: 1 }, res))
    ]);
    expect(submitAcks.every((s) => s.ok)).toBe(true);

    // All answered -> automatic transition to QUESTION_REVEAL
    const revealData1 = await revealPromiseHost1;
    await revealPromiseDisplay1;
    const p1Result = await p1ResultPromise;
    expect(revealData1.correctIndex).toBe(0);
    expect(p1Result.isCorrect).toBe(true);

    // Track whether any LEADERBOARD event is emitted
    let leaderboardEmitted = false;
    hostSocket.on('game:leaderboard-update', () => {
      leaderboardEmitted = true;
    });

    // ==========================================
    // QUESTION 2: Space in QUESTION_REVEAL advances DIRECTLY to next question
    // ==========================================
    const q2StartPromiseHost = new Promise((res) => hostSocket.once('game:question-start', res));
    const q2StartPromiseDisplay = new Promise((res) => displaySocket.once('game:question-start', res));

    const startAck2 = await new Promise((res) => {
      hostSocket.emit('host:start-question', { pin }, res);
    });
    expect(startAck2.ok).toBe(true);

    const q2Data = await q2StartPromiseHost;
    await q2StartPromiseDisplay;
    expect(q2Data.questionIndex).toBe(1);

    // CRITICAL: LEADERBOARD was never entered!
    expect(leaderboardEmitted).toBe(false);

    // All 3 students submit answers for Question 2
    const revealPromiseHost2 = new Promise((res) => hostSocket.once('game:question-reveal', res));
    const blindspotPromiseHost = new Promise((res) => hostSocket.once('host:blindspot-preview', res));

    await Promise.all([
      new Promise((res) => p1.emit('player:submit-answer', { pin, selectedIndex: 0 }, res)),
      new Promise((res) => p2.emit('player:submit-answer', { pin, selectedIndex: 0 }, res)),
      new Promise((res) => p3.emit('player:submit-answer', { pin, selectedIndex: 0 }, res))
    ]);

    await revealPromiseHost2;

    // Blindspot preview emitted at final reveal for host retest preparation
    const blindspotPreview = await blindspotPromiseHost;
    expect(blindspotPreview).toBeDefined();

    // ==========================================
    // FINISH: Space on final QUESTION_REVEAL ends game
    // ==========================================
    const endPromiseHost = new Promise((res) => hostSocket.once('game:ended', res));
    const endPromiseDisplay = new Promise((res) => displaySocket.once('game:ended', res));
    const endPromiseP1 = new Promise((res) => p1.once('game:ended', res));

    const endAck = await new Promise((res) => {
      hostSocket.emit('host:end-game', { pin }, res);
    });
    expect(endAck.ok).toBe(true);

    const endHostData = await endPromiseHost;
    const endDisplayData = await endPromiseDisplay;
    const endP1Data = await endPromiseP1;

    expect(endHostData.podium).toHaveLength(3);
    expect(endDisplayData.podium).toHaveLength(3);
    expect(endP1Data.podium).toHaveLength(3);
    expect(endHostData.blindspotReport).toBeDefined();

    // Retest round remains reachable from FINISHED
    const retestAck = await new Promise((res) => {
      hostSocket.emit('host:start-retest', { pin, questionIndexes: [0] }, res);
    });
    expect(retestAck.ok).toBe(true);

    // Disconnect clients
    hostSocket.disconnect();
    displaySocket.disconnect();
    p1.disconnect();
    p2.disconnect();
    p3.disconnect();
  }, 25000);
});
