import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { io as ClientIO } from 'socket.io-client';
import { startServer } from '../src/server.js';
import { setupTestDB, teardownTestDB } from './setup.js';
import { Quiz } from '../src/models/Quiz.js';
import { User } from '../src/models/User.js';
import { GameSession } from '../src/models/GameSession.js';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';
import { roomManager } from '../src/sockets/roomManager.js';

describe('Phase 4 (F3) Retest Full Lifecycle Integration Test', () => {
  let serverInstance;
  let serverUrl;
  let teacherToken;
  let quizId;
  let rawQuestions;

  beforeAll(async () => {
    await setupTestDB();

    const result = await startServer(0);
    serverInstance = result.server;
    const port = serverInstance.address().port;
    serverUrl = `http://localhost:${port}`;

    const teacher = await User.create({
      name: 'Professor Retest',
      email: 'prof.retest@school.edu',
      passwordHash: 'hashed123',
      role: 'teacher'
    });

    teacherToken = jwt.sign({ id: teacher._id, email: teacher.email, role: 'teacher' }, env.JWT_SECRET, {
      expiresIn: '1h'
    });

    rawQuestions = [
      {
        questionText: 'What generates aerodynamic lift?',
        options: ['Pressure difference', 'Gravity', 'Static friction', 'Buoyancy'],
        correctIndex: 0,
        explanation: 'Bernoulli principle and downwash create low pressure on upper airfoil.',
        distractorRationales: [
          '',
          'Confuses gravity with upward forces',
          'Confuses surface friction',
          'Confuses fluid buoyancy'
        ],
        topicTag: 'Physics',
        timeLimit: 20
      }
    ];

    const quiz = await Quiz.create({
      title: 'Physics Mechanics',
      topic: 'Physics',
      createdBy: teacher._id,
      questions: rawQuestions
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

  it('runs complete retest lifecycle: weak question -> finished -> retest -> separate score -> session updated -> exited player excluded -> host reconnect', async () => {
    const hostSocket = createClient(teacherToken);
    const pAlice = createClient();
    const pBob = createClient();
    const pCharlie = createClient();

    // 1. Host creates room
    const createRes = await new Promise((resolve) => {
      hostSocket.emit('host:create-room', { quizId, settings: { scoringMode: 'accuracy' } }, resolve);
    });
    expect(createRes.ok).toBe(true);
    const { pin, hostToken } = createRes.data;
    const room = roomManager.getRoom(pin);
    expect(room).toBeDefined();

    // 2. Three players join: Alice, Bob, Charlie
    const aliceJoin = await new Promise((resolve) => pAlice.emit('player:join', { pin, name: 'Alice' }, resolve));
    const bobJoin = await new Promise((resolve) => pBob.emit('player:join', { pin, name: 'Bob' }, resolve));
    const charlieJoin = await new Promise((resolve) => pCharlie.emit('player:join', { pin, name: 'Charlie' }, resolve));
    expect(aliceJoin.ok).toBe(true);
    expect(bobJoin.ok).toBe(true);
    expect(charlieJoin.ok).toBe(true);

    const _aliceId = aliceJoin.data.playerId;
    const _bobId = bobJoin.data.playerId;
    const charlieId = charlieJoin.data.playerId;

    // 3. Start question 0 (Main round)
    const q0AlicePromise = new Promise((resolve) => pAlice.once('game:question-start', resolve));
    await new Promise((resolve) => hostSocket.emit('host:start-question', { pin }, resolve));
    const q0Alice = await q0AlicePromise;
    expect(q0Alice.round).toBe('main');

    // Protocol masking verification: correctIndex, explanation, distractorRationales NEVER present
    expect(q0Alice.correctIndex).toBeUndefined();
    expect(q0Alice.explanation).toBeUndefined();
    expect(q0Alice.distractorRationales).toBeUndefined();

    // Alice answers correctly (index 0), Bob & Charlie answer incorrectly (index 1)
    await new Promise((resolve) => pAlice.emit('player:submit-answer', { pin, selectedIndex: 0 }, resolve));
    await new Promise((resolve) => pBob.emit('player:submit-answer', { pin, selectedIndex: 1 }, resolve));
    await new Promise((resolve) => pCharlie.emit('player:submit-answer', { pin, selectedIndex: 1 }, resolve));

    // End question and reveal
    await new Promise((resolve) => hostSocket.emit('host:end-question', { pin }, resolve));

    // Question accuracy: 1 out of 3 = 33.3% (< 50% -> weak question flagged!)
    expect(room.answerLog[0].accuracy).toBeLessThan(0.5);

    // 4. Host ends game
    const gameEndedPromiseAlice = new Promise((resolve) => pAlice.once('game:ended', resolve));
    const gameEndedPromiseBob = new Promise((resolve) => pBob.once('game:ended', resolve));
    const gameEndedPromiseCharlie = new Promise((resolve) => pCharlie.once('game:ended', resolve));
    const hostEndRes = await new Promise((resolve) => hostSocket.emit('host:end-game', { pin }, resolve));
    expect(hostEndRes.ok).toBe(true);
    expect(room.status).toBe('FINISHED');

    const endAlice = await gameEndedPromiseAlice;
    const endBob = await gameEndedPromiseBob;
    const endCharlie = await gameEndedPromiseCharlie;
    expect(endAlice.you.score).toBe(1000);
    expect(endBob.you.score).toBe(0);
    expect(endCharlie.you.score).toBe(0);

    const initialSessionCount = await GameSession.countDocuments({ pin });
    expect(initialSessionCount).toBe(1);
    const initialSession = await GameSession.findOne({ pin });
    expect(initialSession.retest).toBeNull();

    // 5. Charlie taps Exit Game before the retest
    await new Promise((resolve) => pCharlie.emit('player:leave', { pin, playerId: charlieId }, resolve));
    const charliePlayerObj = room.players.get(charlieId);
    expect(charliePlayerObj.left).toBe(true);

    // Track events for Charlie: should NOT receive retest events
    let charlieReceivedRetestStart = false;
    pCharlie.on('game:retest-start', () => {
      charlieReceivedRetestStart = true;
    });

    // 6. Host starts retest with weak question 0
    const retestStartAlicePromise = new Promise((resolve) => pAlice.once('game:retest-start', resolve));
    const retestStartBobPromise = new Promise((resolve) => pBob.once('game:retest-start', resolve));
    const retestQStartAlicePromise = new Promise((resolve) => pAlice.once('game:question-start', resolve));

    const startRetestRes = await new Promise((resolve) => {
      hostSocket.emit('host:start-retest', { pin, questionIndexes: [0] }, resolve);
    });
    expect(startRetestRes.ok).toBe(true);

    const retestStartPayload = await retestStartAlicePromise;
    await retestStartBobPromise;
    expect(retestStartPayload.questionIndexes).toEqual([0]);
    expect(charlieReceivedRetestStart).toBe(false);

    // 7. Verify masked retest question received by active players
    const retestQPayload = await retestQStartAlicePromise;
    expect(retestQPayload.round).toBe('retest');
    expect(retestQPayload.questionIndex).toBe(0);
    expect(retestQPayload.correctIndex).toBeUndefined();
    expect(retestQPayload.explanation).toBeUndefined();
    expect(retestQPayload.distractorRationales).toBeUndefined();

    // Options reshuffled: original correct answer text ('Pressure difference') is still in options
    const retestOptions = retestQPayload.options;
    expect(retestOptions).toContain('Pressure difference');
    const newCorrectIdx = room.retestQuestions[0].correctIndex;
    expect(retestOptions[newCorrectIdx]).toBe('Pressure difference');

    // 8. In retest round, Alice and Bob answer correctly (100% accuracy in retest!)
    const aliceRetestResultPromise = new Promise((resolve) => pAlice.once('player:result', resolve));
    const bobRetestResultPromise = new Promise((resolve) => pBob.once('player:result', resolve));

    await new Promise((resolve) => pAlice.emit('player:submit-answer', { pin, selectedIndex: newCorrectIdx }, resolve));
    await new Promise((resolve) => pBob.emit('player:submit-answer', { pin, selectedIndex: newCorrectIdx }, resolve));

    // End retest question and reveal
    await new Promise((resolve) => hostSocket.emit('host:end-question', { pin }, resolve));

    const aliceRetestResult = await aliceRetestResultPromise;
    const bobRetestResult = await bobRetestResultPromise;

    expect(aliceRetestResult.isCorrect).toBe(true);
    expect(bobRetestResult.isCorrect).toBe(true);
    // Retest scores are tracked separately: both earned 1000 retest points
    expect(aliceRetestResult.totalScore).toBe(1000);
    expect(bobRetestResult.totalScore).toBe(1000);
    expect(aliceRetestResult.streak).toBe(1);
    expect(bobRetestResult.streak).toBe(1);

    // 9. Host ends retest (Space / Finish on last retest question)
    const finalRetestEndedAlicePromise = new Promise((resolve) => pAlice.once('game:ended', resolve));
    const hostEndRetestRes = await new Promise((resolve) => hostSocket.emit('host:end-game', { pin }, resolve));
    expect(hostEndRetestRes.ok).toBe(true);
    expect(room.status).toBe('FINISHED');
    expect(room.retestCompleted).toBe(true);

    const aliceFinalRetestEnd = await finalRetestEndedAlicePromise;
    expect(aliceFinalRetestEnd.retest).toBeDefined();
    expect(aliceFinalRetestEnd.retest.afterAccuracy).toBe(1); // 2/2 = 100%
    expect(aliceFinalRetestEnd.retest.headline).toContain('After re-teaching, accuracy on weak topics rose from 33% to 100%');

    // 10. Persistence verification: GameSession was UPDATED, not duplicated
    const finalSessionCount = await GameSession.countDocuments({ pin });
    expect(finalSessionCount).toBe(1);

    const updatedSession = await GameSession.findOne({ pin });
    expect(updatedSession.retest).toBeDefined();
    expect(updatedSession.retest.questionIndexes).toEqual([0]);
    expect(updatedSession.retest.beforeAccuracy).toBeCloseTo(0.333, 2);
    expect(updatedSession.retest.afterAccuracy).toBe(1);
    expect(updatedSession.retest.perQuestion).toHaveLength(1);
    expect(updatedSession.retest.perQuestion[0].improvementPct).toBe(67);
    expect(updatedSession.retest.perPlayer).toBeDefined();

    // Bob improved in retest!
    const bobRetestPlayer = updatedSession.retest.perPlayer.find((p) => p.name === 'Bob');
    expect(bobRetestPlayer.improvedCount).toBe(1);

    // Main game scores are completely preserved
    const aliceDoc = updatedSession.players.find((p) => p.name === 'Alice');
    const bobDoc = updatedSession.players.find((p) => p.name === 'Bob');
    expect(aliceDoc.finalScore).toBe(1000);
    expect(bobDoc.finalScore).toBe(0);

    // 11. Retest cannot be run again (one retest limit)
    const duplicateRetestRes = await new Promise((resolve) => {
      hostSocket.emit('host:start-retest', { pin, questionIndexes: [0] }, resolve);
    });
    expect(duplicateRetestRes.ok).toBe(false);
    expect(duplicateRetestRes.error.code).toBe('RETEST_ALREADY_COMPLETED');

    // 12. Host reconnect after FINISHED returns retest completed status and summary
    const hostReconnectSocket = createClient();
    const reconnectRes = await new Promise((resolve) => {
      hostReconnectSocket.emit('host:reconnect', { pin, hostToken }, resolve);
    });
    expect(reconnectRes.ok).toBe(true);
    expect(reconnectRes.data.status).toBe('FINISHED');
    expect(reconnectRes.data.retestCompleted).toBe(true);
    expect(reconnectRes.data.retest).toBeDefined();
    expect(reconnectRes.data.retest.headline).toContain('After re-teaching');

    // 13. Room cleanup after TTL
    // Advancing room's lastActivityAt past FINISHED_ROOM_TTL_MIN
    room.lastActivityAt = Date.now() - (env.FINISHED_ROOM_TTL_MIN * 60 * 1000 + 10000);
    roomManager.cleanExpiredRooms();
    expect(roomManager.getRoom(pin)).toBeNull();

    hostSocket.close();
    hostReconnectSocket.close();
    pAlice.close();
    pBob.close();
    pCharlie.close();
  });
});
