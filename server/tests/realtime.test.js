import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { io as ClientIO } from 'socket.io-client';
import request from 'supertest';
import { startServer } from '../src/server.js';
import { setupTestDB, teardownTestDB } from './setup.js';
import { GameSession } from '../src/models/GameSession.js';

describe('Real-Time Socket.io Full Game & Security Integration Tests', () => {
  let serverInstance;
  let serverPort;
  let teacherToken;
  let teacherBToken;
  let quizId;

  beforeAll(async () => {
    await setupTestDB();

    // Start server on a random free port (0)
    const result = await startServer(0);
    serverInstance = result.server;
    serverPort = serverInstance.address().port;

    // Register Teacher A
    const app = result.app;
    const regResA = await request(app).post('/api/auth/register').send({
      name: 'Teacher Realtime A',
      email: 'hostA@school.edu',
      password: 'password123'
    });
    teacherToken = regResA.body.token;

    // Register Teacher B
    const regResB = await request(app).post('/api/auth/register').send({
      name: 'Teacher Realtime B',
      email: 'hostB@school.edu',
      password: 'password123'
    });
    teacherBToken = regResB.body.token;

    // Create Quiz for Teacher A
    const quizResA = await request(app)
      .post('/api/quizzes')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'Realtime Revision Live',
        topic: 'Chemistry',
        questions: [
          {
            questionText: 'What is the pH of pure water at 25°C?',
            options: ['7.0', '1.0', '14.0', '0.0'],
            correctIndex: 0,
            explanation: 'Neutral water has [H+] = 10^-7 M giving a pH of 7.0. Acidic solutions have pH below 7.',
            topicTag: 'Acids and Bases',
            timeLimit: 20
          }
        ]
      });
    quizId = quizResA.body.quiz._id;

    // Create Quiz for Teacher B
    await request(app)
      .post('/api/quizzes')
      .set('Authorization', `Bearer ${teacherBToken}`)
      .send({
        title: 'Teacher B Chemistry',
        topic: 'Chemistry',
        questions: [
          {
            questionText: 'Sample Q?',
            options: ['A', 'B', 'C', 'D'],
            correctIndex: 0,
            explanation: 'Explanation text here.',
            topicTag: 'General',
            timeLimit: 20
          }
        ]
      });
  });

  afterAll(async () => {
    if (serverInstance) {
      serverInstance.close();
    }
    await teardownTestDB();
  });

  function createClient(token = null) {
    return ClientIO(`http://localhost:${serverPort}`, {
      auth: token ? { token } : {},
      transports: ['websocket'],
      forceNew: true
    });
  }

  it('rejects teacher attempting to host another teacher quiz', async () => {
    const hostSocket = createClient(teacherBToken);
    await new Promise((resolve) => hostSocket.on('connect', resolve));

    const ack = await new Promise((resolve) => {
      hostSocket.emit('host:create-room', { quizId }, resolve);
    });

    expect(ack.ok).toBe(false);
    expect(ack.error.code).toBe('QUIZ_NOT_FOUND');
    hostSocket.disconnect();
  });

  it('rejects student attempting to execute host events', async () => {
    const studentSocket = createClient(null); // Anonymous student
    await new Promise((resolve) => studentSocket.on('connect', resolve));

    const ack = await new Promise((resolve) => {
      studentSocket.emit('host:create-room', { quizId }, resolve);
    });

    expect(ack.ok).toBe(false);
    expect(ack.error.code).toBe('UNAUTHORIZED');
    studentSocket.disconnect();
  });

  it('allows teacher to host with token provided in create-room payload even if handshake was unauthenticated', async () => {
    const unauthenticatedSocket = createClient(null);
    await new Promise((resolve) => unauthenticatedSocket.on('connect', resolve));

    const ack = await new Promise((resolve) => {
      unauthenticatedSocket.emit('host:create-room', { quizId, token: teacherToken }, resolve);
    });

    expect(ack.ok).toBe(true);
    expect(ack.data.pin).toBeDefined();
    unauthenticatedSocket.disconnect();
  });

  it('runs complete game lifecycle with 1 host and 3 players', async () => {
    // 1. Host creates room
    const hostSocket = createClient(teacherToken);
    await new Promise((resolve) => hostSocket.on('connect', resolve));

    const createAck = await new Promise((resolve) => {
      hostSocket.emit('host:create-room', { quizId, settings: { leaderboardBetweenQuestions: true } }, resolve);
    });
    expect(createAck.ok).toBe(true);
    const pin = createAck.data.pin;
    expect(pin).toBeDefined();

    // 2. Three players join
    const p1Socket = createClient();
    const p2Socket = createClient();
    const p3Socket = createClient();

    const [join1, join2, join3] = await Promise.all([
      new Promise((resolve) => p1Socket.emit('player:join', { pin, name: 'Alice' }, resolve)),
      new Promise((resolve) => p2Socket.emit('player:join', { pin, name: 'Bob' }, resolve)),
      new Promise((resolve) => p3Socket.emit('player:join', { pin, name: 'Charlie' }, resolve))
    ]);

    expect(join1.ok).toBe(true);
    expect(join2.ok).toBe(true);
    expect(join3.ok).toBe(true);

    // 3. Host starts question
    const questionPromiseP1 = new Promise((resolve) => p1Socket.once('game:question-start', resolve));
    const startAck = await new Promise((resolve) => {
      hostSocket.emit('host:start-question', { pin }, resolve);
    });
    expect(startAck.ok).toBe(true);

    const startPayload = await questionPromiseP1;
    expect(startPayload.questionText).toBe('What is the pH of pure water at 25°C?');
    // SECURITY CHECK: Masked answer
    expect(startPayload.correctIndex).toBeUndefined();
    expect(startPayload.explanation).toBeUndefined();

    // 4. Players submit answers (Alice: Correct 0, Bob: Incorrect 1, Charlie: Correct 0)
    const revealPromiseHost = new Promise((resolve) => hostSocket.once('game:question-reveal', resolve));
    const p1ResultPromise = new Promise((resolve) => p1Socket.once('player:result', resolve));

    await Promise.all([
      new Promise((resolve) => p1Socket.emit('player:submit-answer', { pin, selectedIndex: 0 }, resolve)),
      new Promise((resolve) => p2Socket.emit('player:submit-answer', { pin, selectedIndex: 1 }, resolve)),
      new Promise((resolve) => p3Socket.emit('player:submit-answer', { pin, selectedIndex: 0 }, resolve))
    ]);

    // All connected players answered -> reveal triggered automatically
    const revealPayload = await revealPromiseHost;
    expect(revealPayload.correctIndex).toBe(0);
    expect(revealPayload.explanation).toContain('Neutral water');

    const p1Result = await p1ResultPromise;
    expect(p1Result.isCorrect).toBe(true);
    expect(p1Result.totalScore).toBeGreaterThan(0);

    // 5. Host shows leaderboard
    const leadUpdatePromise = new Promise((resolve) => hostSocket.once('game:leaderboard-update', resolve));
    const showLeadAck = await new Promise((resolve) => {
      hostSocket.emit('host:show-leaderboard', { pin }, resolve);
    });
    expect(showLeadAck.ok).toBe(true);

    const leadUpdate = await leadUpdatePromise;
    expect(leadUpdate.topPlayers).toHaveLength(3);

    // 6. Host ends game
    const hostEndPromise = new Promise((resolve) => hostSocket.once('game:ended', resolve));
    const p1EndPromise = new Promise((resolve) => p1Socket.once('game:ended', resolve));

    const endAck = await new Promise((resolve) => {
      hostSocket.emit('host:end-game', { pin }, resolve);
    });
    expect(endAck.ok).toBe(true);

    const hostEndPayload = await hostEndPromise;
    expect(hostEndPayload.podium).toHaveLength(3);
    expect(hostEndPayload.blindspotReport).toBeDefined();

    const p1EndPayload = await p1EndPromise;
    expect(p1EndPayload.you.score).toBeGreaterThan(0);

    // 7. Verify persisted GameSession document in MongoDB
    const persistedSession = await GameSession.findOne({ pin });
    expect(persistedSession).not.toBeNull();
    expect(persistedSession.playerCount).toBe(3);
    expect(persistedSession.quizTitle).toBe('Realtime Revision Live');

    // Clean sockets
    hostSocket.disconnect();
    p1Socket.disconnect();
    p2Socket.disconnect();
    p3Socket.disconnect();
  });

  it('reconnects a dropped player with reconnectToken and restores state', async () => {
    // 1. Host creates room
    const hostSocket = createClient(teacherToken);
    await new Promise((resolve) => hostSocket.on('connect', resolve));
    const createAck = await new Promise((resolve) => {
      hostSocket.emit('host:create-room', { quizId }, resolve);
    });
    const pin = createAck.data.pin;

    // 2. Player joins
    const playerSocket = createClient();
    const joinAck = await new Promise((resolve) => {
      playerSocket.emit('player:join', { pin, name: 'ReconnectingPlayer' }, resolve);
    });
    expect(joinAck.ok).toBe(true);
    const { playerId, reconnectToken } = joinAck.data;

    // 3. Start question
    await new Promise((resolve) => hostSocket.emit('host:start-question', { pin }, resolve));

    // 4. Player disconnects (simulating WiFi drop)
    playerSocket.disconnect();

    // 5. Player reconnects with a fresh socket connection
    const freshPlayerSocket = createClient();
    await new Promise((resolve) => freshPlayerSocket.on('connect', resolve));

    const rejoinAck = await new Promise((resolve) => {
      freshPlayerSocket.emit('player:rejoin', { pin, playerId, reconnectToken }, resolve);
    });

    expect(rejoinAck.ok).toBe(true);
    expect(rejoinAck.data.status).toBe('QUESTION_ACTIVE');
    expect(rejoinAck.data.you.playerId).toBe(playerId);
    expect(rejoinAck.data.you.name).toBe('ReconnectingPlayer');
    expect(rejoinAck.data.question).toBeDefined();

    hostSocket.disconnect();
    freshPlayerSocket.disconnect();
  });
});
