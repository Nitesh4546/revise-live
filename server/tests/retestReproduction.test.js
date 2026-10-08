import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { io as ClientIO } from 'socket.io-client';
import { startServer } from '../src/server.js';
import { setupTestDB, teardownTestDB } from './setup.js';
import { Quiz } from '../src/models/Quiz.js';
import { User } from '../src/models/User.js';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';
import { roomManager } from '../src/sockets/roomManager.js';

describe('P1 Reproduction Test: Room Lifecycle & Retest after FINISHED', () => {
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
      name: 'Dr. Retest Diagnostician',
      email: 'retest@school.edu',
      passwordHash: 'dummyhash123',
      role: 'teacher'
    });

    teacherToken = jwt.sign({ id: teacher._id, email: teacher.email, role: 'teacher' }, env.JWT_SECRET, {
      expiresIn: '1h'
    });

    const quiz = await Quiz.create({
      title: 'Diagnostic Test Quiz',
      topic: 'Science',
      createdBy: teacher._id,
      questions: [
        {
          questionText: 'Question 1',
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          correctIndex: 0,
          explanation: 'Concept Anchor 1',
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
  });

  function createClient(token = null) {
    return ClientIO(serverUrl, {
      auth: token ? { token } : {},
      transports: ['websocket'],
      forceNew: true
    });
  }

  it('proves room lifecycle bug: room:closed must NOT be emitted at FINISHED, room remains active for retest until host:close-room or TTL', async () => {
    const hostSocket = createClient(teacherToken);
    const p1Socket = createClient();
    await Promise.all([
      new Promise((res) => hostSocket.on('connect', res)),
      new Promise((res) => p1Socket.on('connect', res))
    ]);

    // 1. Host creates room
    const createRes = await new Promise((res) => {
      hostSocket.emit('host:create-room', { quizId }, res);
    });
    expect(createRes.ok).toBe(true);
    const pin = createRes.data.pin;

    // 2. Player joins
    const joinRes = await new Promise((res) => {
      p1Socket.emit('player:join', { pin, name: 'Student 1' }, res);
    });
    expect(joinRes.ok).toBe(true);

    // 3. Track whether room:closed is received by player
    let playerReceivedRoomClosed = false;
    p1Socket.on('room:closed', () => {
      playerReceivedRoomClosed = true;
    });

    // 4. Start question 1
    const q1Promise = new Promise((res) => hostSocket.once('game:question-start', res));
    await new Promise((res) => hostSocket.emit('host:start-question', { pin }, res));
    await q1Promise;

    // Submit answer and finalize
    const revealPromise = new Promise((res) => hostSocket.once('game:question-reveal', res));
    await new Promise((res) => p1Socket.emit('player:submit-answer', { pin, selectedIndex: 1 }, res)); // wrong answer
    await revealPromise;

    // 5. End game
    const endPromiseHost = new Promise((res) => hostSocket.once('game:ended', res));
    const endPromiseP1 = new Promise((res) => p1Socket.once('game:ended', res));
    await new Promise((res) => hostSocket.emit('host:end-game', { pin }, res));
    await Promise.all([endPromiseHost, endPromiseP1]);

    // Small delay to allow any socket broadcast to arrive
    await new Promise((res) => setTimeout(res, 100));

    // REPRODUCTION ASSERTION 1:
    // Bug: previously endGame emitted room:closed to everyone, kicking players off their screens!
    // Expected fix: room:closed must NOT have fired!
    expect(playerReceivedRoomClosed).toBe(false);

    // REPRODUCTION ASSERTION 2:
    // Room must still exist in RoomManager
    const activeRoom = roomManager.getRoom(pin);
    expect(activeRoom).not.toBeNull();
    expect(activeRoom.status).toBe('FINISHED');

    // REPRODUCTION ASSERTION 3:
    // Host must be able to start retest from FINISHED and player receives game:retest-start
    const retestPromiseP1 = new Promise((res) => p1Socket.once('game:retest-start', res));
    const startRetestRes = await new Promise((res) => {
      hostSocket.emit('host:start-retest', { pin, questionIndexes: [0] }, res);
    });
    expect(startRetestRes.ok).toBe(true);

    const retestData = await retestPromiseP1;
    expect(retestData).toBeDefined();

    // End retest / return to FINISHED
    await new Promise((res) => hostSocket.emit('host:end-game', { pin }, res));

    // REPRODUCTION ASSERTION 4:
    // Explicit host:close-room emits room:closed and tears down the room
    const closePromiseP1 = new Promise((res) => p1Socket.once('room:closed', res));
    const closeRes = await new Promise((res) => {
      hostSocket.emit('host:close-room', { pin }, res);
    });
    expect(closeRes.ok).toBe(true);

    const closedPayload = await closePromiseP1;
    expect(closedPayload).toBeDefined();
    expect(roomManager.getRoom(pin)).toBeNull();

    hostSocket.disconnect();
    p1Socket.disconnect();
  }, 20000);
});
