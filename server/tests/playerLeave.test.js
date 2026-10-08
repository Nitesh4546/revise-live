import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { io as ClientIO } from 'socket.io-client';
import request from 'supertest';
import { startServer } from '../src/server.js';
import { setupTestDB, teardownTestDB } from './setup.js';
import { roomManager } from '../src/sockets/roomManager.js';

describe('Player Leave Socket Lifecycle Tests', () => {
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
    const regRes = await request(app).post('/api/auth/register').send({
      name: 'Teacher Leaver Host',
      email: 'host-leave@school.edu',
      password: 'password123'
    });
    teacherToken = regRes.body.token;

    const quizRes = await request(app)
      .post('/api/quizzes')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'Player Leave Test Quiz',
        topic: 'Biology',
        questions: [
          {
            questionText: 'What organelle produces ATP?',
            options: ['Mitochondria', 'Ribosome', 'Nucleus', 'Golgi'],
            correctIndex: 0,
            explanation: 'Mitochondria are the powerhouses of the cell.',
            topicTag: 'Cell Biology',
            timeLimit: 20
          }
        ]
      });
    quizId = quizRes.body.quiz._id;
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

  it('leave in lobby removes the player from the room roster and broadcasts room:player-left', async () => {
    const hostSocket = createClient(teacherToken);
    await new Promise((r) => hostSocket.on('connect', r));

    const createAck = await new Promise((r) => {
      hostSocket.emit('host:create-room', { quizId }, r);
    });
    expect(createAck.ok).toBe(true);
    const pin = createAck.data.pin;

    const studentSocket = createClient();
    await new Promise((r) => studentSocket.on('connect', r));

    const joinAck = await new Promise((r) => {
      studentSocket.emit('player:join', { pin, name: 'Alice' }, r);
    });
    expect(joinAck.ok).toBe(true);
    expect(joinAck.data.playerId).toBeDefined();

    // Confirm student is in room roster
    const roomBefore = roomManager.getRoom(pin);
    expect(roomBefore.players.size).toBe(1);

    // Host listens for room:player-left
    const leftPromise = new Promise((resolve) => {
      hostSocket.once('room:player-left', (data) => {
        resolve(data);
      });
    });

    // Student leaves in lobby
    const leaveAck = await new Promise((r) => {
      studentSocket.emit('player:leave', { pin }, r);
    });
    expect(leaveAck.ok).toBe(true);
    expect(leaveAck.data.left).toBe(true);

    const leftData = await leftPromise;
    expect(leftData.count).toBe(0);
    expect(leftData.players.length).toBe(0);

    const roomAfter = roomManager.getRoom(pin);
    expect(roomAfter.players.size).toBe(0);

    hostSocket.disconnect();
    studentSocket.disconnect();
  });

  it('leave mid-game marks left=true, invalidates reconnectToken, and does not stall all-answered check', async () => {
    const hostSocket = createClient(teacherToken);
    await new Promise((r) => hostSocket.on('connect', r));

    const createAck = await new Promise((r) => {
      hostSocket.emit('host:create-room', { quizId }, r);
    });
    const pin = createAck.data.pin;

    // Student 1 (Alice)
    const s1 = createClient();
    await new Promise((r) => s1.on('connect', r));
    const join1 = await new Promise((r) => s1.emit('player:join', { pin, name: 'Alice' }, r));
    expect(join1.ok).toBe(true);

    // Student 2 (Bob)
    const s2 = createClient();
    await new Promise((r) => s2.on('connect', r));
    const join2 = await new Promise((r) => s2.emit('player:join', { pin, name: 'Bob' }, r));
    expect(join2.ok).toBe(true);
    const bobPlayerId = join2.data.playerId;
    const bobReconnectToken = join2.data.reconnectToken;

    // Host starts question
    const qStartPromiseS1 = new Promise((r) => s1.once('game:question-start', r));
    const qStartPromiseHost = new Promise((r) => hostSocket.once('game:question-start', r));

    await new Promise((r) => hostSocket.emit('host:start-question', { pin }, r));
    await Promise.all([qStartPromiseS1, qStartPromiseHost]);

    // Host listens for game:question-reveal
    const revealPromiseHost = new Promise((r) => hostSocket.once('game:question-reveal', r));

    // Alice submits answer
    const ansAck = await new Promise((r) => {
      s1.emit('player:submit-answer', { pin, selectedIndex: 0 }, r);
    });
    expect(ansAck.ok).toBe(true);

    // Bob leaves mid-game instead of answering
    const leaveAck = await new Promise((r) => {
      s2.emit('player:leave', { pin }, r);
    });
    expect(leaveAck.ok).toBe(true);
    expect(leaveAck.data.left).toBe(true);

    // The game must immediately advance to reveal because all remaining connected active players (Alice) answered!
    const revealData = await revealPromiseHost;
    expect(revealData.questionIndex).toBe(0);

    // Verify Bob's player record in room
    const room = roomManager.getRoom(pin);
    const bob = room.players.get(bobPlayerId);
    expect(bob).toBeDefined();
    expect(bob.left).toBe(true);
    expect(bob.connected).toBe(false);
    expect(bob.reconnectToken).toBeNull();

    // Verify Bob cannot rejoin with old token
    const s2Rejoin = createClient();
    await new Promise((r) => s2Rejoin.on('connect', r));
    const rejoinAck = await new Promise((r) => {
      s2Rejoin.emit('player:rejoin', { pin, playerId: bobPlayerId, reconnectToken: bobReconnectToken }, r);
    });
    expect(rejoinAck.ok).toBe(false);
    expect(rejoinAck.error.code).toBe('SEAT_ABANDONED');

    hostSocket.disconnect();
    s1.disconnect();
    s2.disconnect();
    s2Rejoin.disconnect();
  });
});
