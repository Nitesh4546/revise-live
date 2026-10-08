import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { roomManager } from './roomManager.js';
import { GameEngine, computeLiveOptionCounts, computeNudgeList, buildFinalLeaderboard } from './gameEngine.js';
import { Quiz } from '../models/Quiz.js';
import { failedPinTracker } from '../middleware/rateLimit.js';

import { resolveSettings } from '../utils/gameSettings.js';

// Zod schemas for incoming socket payloads
const createRoomSchema = z.object({
  quizId: z.string().trim(),
  token: z.string().trim().optional(),
  settings: z
    .object({
      scoringMode: z.enum(['speed', 'accuracy']).optional(),
      leaderboardMode: z.enum(['competitive', 'classMeter', 'hidden', 'off']).optional(),
      leaderboardBetweenQuestions: z.boolean().optional(),
      classTarget: z.number().optional(),
      confidenceScoring: z.boolean().optional(),
      peerInstruction: z.enum(['off', 'suggest', 'auto']).optional(),
      peerInstructionBounds: z
        .object({
          min: z.number().min(0).max(100),
          max: z.number().min(0).max(100)
        })
        .optional(),
      peerDiscussionSeconds: z.number().min(10).max(300).optional(),
      peerRevoteSeconds: z.number().min(5).max(60).optional(),
      recallFirstSeconds: z.number().optional(),
      receiptsEnabled: z.boolean().optional(),
      autoNicknames: z.boolean().optional(),
      phoneOptionText: z.enum(['full', 'letters']).optional(),
      finalLeaderboard: z.enum(['full', 'top10', 'self']).optional()
    })
    .nullable()
    .optional(),
  classId: z.string().trim().nullable().optional()
});

const updateSettingsSchema = z.object({
  pin: z.string().trim(),
  settings: z.object({
    scoringMode: z.enum(['speed', 'accuracy']).optional(),
    leaderboardMode: z.enum(['competitive', 'classMeter', 'hidden', 'off']).optional(),
    leaderboardBetweenQuestions: z.boolean().optional(),
    confidenceScoring: z.boolean().optional(),
    peerInstruction: z.enum(['off', 'suggest', 'auto']).optional(),
    peerInstructionBounds: z
      .object({
        min: z.number().min(0).max(100),
        max: z.number().min(0).max(100)
      })
      .optional(),
    peerDiscussionSeconds: z.number().min(10).max(300).optional(),
    peerRevoteSeconds: z.number().min(5).max(60).optional(),
    recallFirstSeconds: z.number().optional(),
    receiptsEnabled: z.boolean().optional(),
    autoNicknames: z.boolean().optional(),
    phoneOptionText: z.enum(['full', 'letters']).optional(),
    finalLeaderboard: z.enum(['full', 'top10', 'self']).optional()
  })
});

const hostReconnectSchema = z.object({ pin: z.string().trim(), hostToken: z.string().trim() });
const displayJoinSchema = z.object({ pin: z.string().trim(), displayToken: z.string().trim() });
const pinOnlySchema = z.object({ pin: z.string().trim() });
const lockRoomSchema = z.object({ pin: z.string().trim(), locked: z.boolean() });
const kickPlayerSchema = z.object({ pin: z.string().trim(), playerId: z.string().trim() });
const playerJoinSchema = z.object({ pin: z.string().trim(), name: z.string().trim().optional().default('') });
const playerRejoinSchema = z.object({
  pin: z.string().trim(),
  playerId: z.string().trim(),
  reconnectToken: z.string().trim()
});
const playerLeaveSchema = z.object({
  pin: z.string().trim(),
  playerId: z.string().trim().optional()
});
const submitAnswerSchema = z.object({
  pin: z.string().trim(),
  selectedIndex: z.number().int().min(0).max(3)
});
const confidenceSchema = z.object({
  pin: z.string().trim(),
  level: z.number().int().min(1).max(3)
});
const startDiscussionSchema = z.object({
  pin: z.string().trim(),
  seconds: z.number().min(10).max(300).optional()
});
const startRetestSchema = z.object({
  pin: z.string().trim(),
  questionIndexes: z.array(z.number().int().min(0))
});

/**
 * Token bucket rate limiter per socket connection (10 events/sec, capacity 15)
 */
class SocketRateLimiter {
  constructor(rate = 10, capacity = 15) {
    this.rate = rate;
    this.capacity = capacity;
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  consume() {
    const now = Date.now();
    const elapsedSec = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsedSec * this.rate);
    this.lastRefill = now;

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }
}

/**
 * Builds personalized room state snapshot for (re)connecting clients
 */
export function getRoomState(room, player = null, isDisplay = false) {
  const isHost = !player && !isDisplay;
  const qIdx = room.currentQuestionIndex;
  const questionList = room.currentRound === 'retest' ? (room.retestQuestions || []) : room.quiz.questions;
  const currentQ = qIdx >= 0 && questionList[qIdx] ? questionList[qIdx] : null;

  let activeQuestionData = null;
  if (currentQ && (room.status === 'QUESTION_ACTIVE' || room.status === 'DISCUSSION' || room.status === 'REVOTE' || room.status === 'QUESTION_REVEAL')) {
    const timeLimitMs = (currentQ.timeLimit || 20) * 1000;
    const endsAt = (room.questionStartedAtEpoch || Date.now()) + timeLimitMs;

    activeQuestionData = {
      round: room.currentRound || 'main',
      questionIndex: qIdx,
      totalQuestions: questionList.length,
      questionText: currentQ.questionText,
      options: currentQ.options,
      topicTag: currentQ.topicTag || 'General',
      timeLimit: currentQ.timeLimit || 20,
      endsAt,
      serverNow: Date.now(),
      phoneOptionText: room.settings?.phoneOptionText || 'full'
    };

    if (room.status === 'DISCUSSION') {
      activeQuestionData.distribution = computeLiveOptionCounts(room);
    }

    if (room.status === 'QUESTION_REVEAL') {
      const stats = (room.currentRound === 'retest' ? room.retestAnswerLog : room.answerLog)[qIdx] || {};
      activeQuestionData.correctIndex = currentQ.correctIndex;
      activeQuestionData.explanation = currentQ.explanation;
      activeQuestionData.optionCounts = stats.optionCounts || [0, 0, 0, 0];
      activeQuestionData.topDistractorIndex = stats.topDistractorIndex ?? null;
      activeQuestionData.topDistractorRationale = stats.topDistractorRationale || '';
      activeQuestionData.confidentWrongCount = stats.confidentWrongCount || 0;
      activeQuestionData.peerShift = stats.peerShift || null;
    }
  }

  if (isHost) {
    const playerList = Array.from(room.players.values()).map((p) => ({
      playerId: p.playerId,
      name: p.name,
      connected: p.connected,
      score: p.score,
      retestScore: p.retestScore,
      streak: p.streak
    }));

    return {
      pin: room.pin,
      hostToken: room.hostToken,
      displayToken: room.displayToken,
      status: room.status,
      locked: room.locked,
      currentRound: room.currentRound || 'main',
      currentQuestionIndex: room.currentQuestionIndex,
      totalQuestions: questionList.length,
      quizTitle: room.quiz.title,
      settings: room.settings,
      question: activeQuestionData,
      previewCorrectIndex: currentQ?.correctIndex,
      previewExplanation: currentQ?.explanation,
      liveHistogram: computeLiveOptionCounts(room),
      nudgeList: computeNudgeList(room),
      players: playerList,
      count: playerList.length,
      sessionId: room.sessionId || null,
      blindspotReport: room.finalBlindspotReport || null,
      retest: room.finalRetestData || null,
      retestCompleted: !!room.retestCompleted
    };
  } else if (isDisplay) {
    const displayPlayers = Array.from(room.players.values()).map((p) => ({
      playerId: p.playerId,
      name: p.name,
      connected: p.connected,
      score: p.score
    }));

    return {
      pin: room.pin,
      status: room.status,
      currentRound: room.currentRound || 'main',
      currentQuestionIndex: room.currentQuestionIndex,
      totalQuestions: questionList.length,
      quizTitle: room.quiz.title,
      settings: {
        leaderboardMode: room.settings?.leaderboardMode || 'competitive',
        classTarget: room.settings?.classTarget || 80
      },
      question: activeQuestionData,
      players: displayPlayers,
      count: displayPlayers.length
    };
  } else {
    if (room.status === 'FINISHED' && room.finalRanked) {
      const pSummary = (room.finalPlayersSummary || []).find((s) => s.playerId === player.playerId);
      const rawReceiptToken = room.playerReceiptTokens?.get(player.playerId) || null;
      const playerLeaderboard = buildFinalLeaderboard({
        ranked: room.finalRanked,
        setting: room.settings?.finalLeaderboard || 'full',
        recipientPlayerId: player.playerId,
        totalQuestions: questionList.length
      });
      const pCorrect = (player.history || []).filter((h) => (!h.round || h.round === 'main') && h.isCorrect).length;
      const pAnswered = (player.history || []).filter(
        (h) => (!h.round || h.round === 'main') && h.selectedIndex !== null && h.selectedIndex !== undefined
      ).length;
      const pAccuracy = pAnswered > 0 ? Number((pCorrect / pAnswered).toFixed(3)) : 0;
      const pRetestItem = room.finalRetestData?.perPlayer?.find((item) => item.playerId === player.playerId) || null;

      return {
        pin: room.pin,
        status: room.status,
        currentRound: room.currentRound || 'main',
        totalQuestions: questionList.length,
        quizTitle: room.quiz.title,
        totalPlayers: room.finalRanked.length,
        finalLeaderboard: playerLeaderboard,
        podium: room.finalRanked.slice(0, 3).map((p) => ({
          name: p.name,
          score: p.score,
          rank: p.rank
        })),
        receiptToken: rawReceiptToken,
        receiptUrl: rawReceiptToken ? `/r/${rawReceiptToken}` : null,
        you: {
          playerId: player.playerId,
          name: player.name,
          rank: player.rank,
          score: player.score,
          correct: pCorrect,
          answered: pAnswered,
          totalQuestions: questionList.length,
          accuracy: pAccuracy,
          streak: player.streak,
          missedTopics: pSummary?.missedTopics || []
        },
        retest: room.finalRetestData
          ? {
              beforeAccuracy: room.finalRetestData.beforeAccuracy,
              afterAccuracy: room.finalRetestData.afterAccuracy,
              headline: room.finalRetestData.headline,
              perQuestion: room.finalRetestData.perQuestion,
              perTopic: room.finalRetestData.perTopic,
              score: pRetestItem?.score || player.retestScore || 0,
              correct: pRetestItem?.correct || 0,
              total: pRetestItem?.total || (room.retestQuestionIndexes?.length || 0),
              improvedCount: pRetestItem?.improvedCount || 0
            }
          : null
      };
    }

    return {
      pin: room.pin,
      status: room.status,
      currentRound: room.currentRound || 'main',
      currentQuestionIndex: room.currentQuestionIndex,
      totalQuestions: questionList.length,
      quizTitle: room.quiz.title,
      question: activeQuestionData,
      you: {
        playerId: player.playerId,
        name: player.name,
        score: room.currentRound === 'retest' ? player.retestScore : player.score,
        streak: player.streak,
        answeredCurrent: player.currentAnswer !== null,
        currentConfidence: player.currentConfidence,
        revotedCurrent: player.revoteAnswer !== null
      }
    };
  }
}

export function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    const limiter = new SocketRateLimiter(10, 15);

    const checkRateLimit = () => {
      if (!limiter.consume()) {
        socket.emit('error:event', { code: 'RATE_LIMITED', message: 'Too many socket requests. Slow down.' });
        return false;
      }
      return true;
    };

    const safeAck = (ack, result) => {
      if (typeof ack === 'function') {
        ack(result);
      }
    };

    const verifyHostAuth = (rawPayload) => {
      const token = socket.handshake.auth?.token || rawPayload?.token;
      if (!token) {
        return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication token required for host actions.' } };
      }
      try {
        const decoded = jwt.verify(token, env.JWT_SECRET);
        if (!socket.handshake.auth) {
          socket.handshake.auth = {};
        }
        socket.handshake.auth.token = token;
        return { ok: true, userId: decoded.id };
      } catch {
        return { ok: false, error: { code: 'INVALID_TOKEN', message: 'Invalid or expired host token.' } };
      }
    };

    // ==========================================
    // HOST EVENTS
    // ==========================================

    socket.on('host:create-room', async (rawPayload, ack) => {
      if (!checkRateLimit()) return;
      const auth = verifyHostAuth(rawPayload);
      if (!auth.ok) return safeAck(ack, auth);

      const parsed = createRoomSchema.safeParse(rawPayload);
      if (!parsed.success) {
        return safeAck(ack, { ok: false, error: { code: 'INVALID_PAYLOAD', message: 'Invalid payload for host:create-room' } });
      }

      try {
        const quiz = await Quiz.findOne({ _id: parsed.data.quizId, createdBy: auth.userId });
        if (!quiz) {
          return safeAck(ack, { ok: false, error: { code: 'QUIZ_NOT_FOUND', message: 'Quiz not found or not owned by you.' } });
        }

        const room = roomManager.createRoom({
          quiz,
          hostId: auth.userId,
          hostSocketId: socket.id,
          settings: parsed.data.settings,
          classId: parsed.data.classId
        });

        socket.join(room.pin);
        socket.join(`${room.pin}:host`);

        safeAck(ack, {
          ok: true,
          data: {
            pin: room.pin,
            hostToken: room.hostToken,
            displayToken: room.displayToken,
            settings: room.settings
          }
        });
      } catch (err) {
        safeAck(ack, { ok: false, error: { code: 'CREATE_ROOM_FAILED', message: err.message } });
      }
    });

    socket.on('host:reconnect', (rawPayload, ack) => {
      if (!checkRateLimit()) return;
      const parsed = hostReconnectSchema.safeParse(rawPayload);
      if (!parsed.success) {
        return safeAck(ack, { ok: false, error: { code: 'INVALID_PAYLOAD', message: 'Invalid payload' } });
      }

      const { pin, hostToken } = parsed.data;
      const result = roomManager.reconnectHost(pin, { hostToken, socketId: socket.id });
      if (!result.ok) {
        return safeAck(ack, result);
      }

      socket.join(pin);
      socket.join(`${pin}:host`);

      const state = getRoomState(result.room);
      safeAck(ack, { ok: true, data: state });
    });

    socket.on('host:start-question', (rawPayload, ack) => {
      if (!checkRateLimit()) return;
      const parsed = pinOnlySchema.safeParse(rawPayload);
      if (!parsed.success) return safeAck(ack, { ok: false, error: { code: 'INVALID_PAYLOAD', message: 'Invalid pin' } });

      const room = roomManager.getRoom(parsed.data.pin);
      if (!room || room.hostSocketId !== socket.id) {
        return safeAck(ack, { ok: false, error: { code: 'UNAUTHORIZED_HOST', message: 'Not host of this room' } });
      }

      const result = GameEngine.startQuestion(room, io);
      safeAck(ack, result);
    });

    socket.on('host:end-question', (rawPayload, ack) => {
      if (!checkRateLimit()) return;
      const parsed = pinOnlySchema.safeParse(rawPayload);
      if (!parsed.success) return safeAck(ack, { ok: false, error: { code: 'INVALID_PAYLOAD', message: 'Invalid pin' } });

      const room = roomManager.getRoom(parsed.data.pin);
      if (!room || room.hostSocketId !== socket.id) {
        return safeAck(ack, { ok: false, error: { code: 'UNAUTHORIZED_HOST', message: 'Not host of this room' } });
      }

      const result = GameEngine.finalizeQuestion(room, io);
      safeAck(ack, result);
    });

    socket.on('host:start-discussion', (rawPayload, ack) => {
      if (!checkRateLimit()) return;
      const parsed = startDiscussionSchema.safeParse(rawPayload);
      if (!parsed.success) return safeAck(ack, { ok: false, error: { code: 'INVALID_PAYLOAD', message: 'Invalid payload' } });

      const room = roomManager.getRoom(parsed.data.pin);
      if (!room || room.hostSocketId !== socket.id) {
        return safeAck(ack, { ok: false, error: { code: 'UNAUTHORIZED_HOST', message: 'Not host of this room' } });
      }

      const result = GameEngine.startDiscussion(room, io, parsed.data.seconds);
      safeAck(ack, result);
    });

    socket.on('host:skip-discussion', (rawPayload, ack) => {
      if (!checkRateLimit()) return;
      const parsed = pinOnlySchema.safeParse(rawPayload);
      if (!parsed.success) return safeAck(ack, { ok: false, error: { code: 'INVALID_PAYLOAD', message: 'Invalid pin' } });

      const room = roomManager.getRoom(parsed.data.pin);
      if (!room || room.hostSocketId !== socket.id) {
        return safeAck(ack, { ok: false, error: { code: 'UNAUTHORIZED_HOST', message: 'Not host of this room' } });
      }

      const result = GameEngine.startRevote(room, io);
      safeAck(ack, result);
    });

    socket.on('host:show-leaderboard', (rawPayload, ack) => {
      if (!checkRateLimit()) return;
      const parsed = pinOnlySchema.safeParse(rawPayload);
      if (!parsed.success) return safeAck(ack, { ok: false, error: { code: 'INVALID_PAYLOAD', message: 'Invalid pin' } });

      const room = roomManager.getRoom(parsed.data.pin);
      if (!room || room.hostSocketId !== socket.id) {
        return safeAck(ack, { ok: false, error: { code: 'UNAUTHORIZED_HOST', message: 'Not host of this room' } });
      }

      const result = GameEngine.showLeaderboard(room, io);
      safeAck(ack, result);
    });

    socket.on('host:start-retest', (rawPayload, ack) => {
      if (!checkRateLimit()) return;
      const parsed = startRetestSchema.safeParse(rawPayload);
      if (!parsed.success) return safeAck(ack, { ok: false, error: { code: 'INVALID_PAYLOAD', message: 'Invalid question indexes' } });

      const room = roomManager.getRoom(parsed.data.pin);
      if (!room || room.hostSocketId !== socket.id) {
        return safeAck(ack, { ok: false, error: { code: 'UNAUTHORIZED_HOST', message: 'Not host of this room' } });
      }

      const result = GameEngine.startRetest(room, parsed.data.questionIndexes, io);
      safeAck(ack, result);
    });

    socket.on('host:end-game', async (rawPayload, ack) => {
      if (!checkRateLimit()) return;
      const parsed = pinOnlySchema.safeParse(rawPayload);
      if (!parsed.success) return safeAck(ack, { ok: false, error: { code: 'INVALID_PAYLOAD', message: 'Invalid pin' } });

      const room = roomManager.getRoom(parsed.data.pin);
      if (!room || room.hostSocketId !== socket.id) {
        return safeAck(ack, { ok: false, error: { code: 'UNAUTHORIZED_HOST', message: 'Not host of this room' } });
      }

      const result = await GameEngine.endGame(room, io);
      safeAck(ack, result);
    });

    socket.on('host:close-room', (rawPayload, ack) => {
      if (!checkRateLimit()) return;
      const parsed = pinOnlySchema.safeParse(rawPayload);
      if (!parsed.success) return safeAck(ack, { ok: false, error: { code: 'INVALID_PAYLOAD', message: 'Invalid pin' } });

      const room = roomManager.getRoom(parsed.data.pin);
      if (!room || room.hostSocketId !== socket.id) {
        return safeAck(ack, { ok: false, error: { code: 'UNAUTHORIZED_HOST', message: 'Not host of this room' } });
      }

      roomManager.closeRoom(room.pin, io);
      safeAck(ack, { ok: true, data: { closed: true } });
    });

    socket.on('host:lock-room', (rawPayload, ack) => {
      if (!checkRateLimit()) return;
      const parsed = lockRoomSchema.safeParse(rawPayload);
      if (!parsed.success) return safeAck(ack, { ok: false, error: { code: 'INVALID_PAYLOAD', message: 'Invalid payload' } });

      const room = roomManager.getRoom(parsed.data.pin);
      if (!room || room.hostSocketId !== socket.id) {
        return safeAck(ack, { ok: false, error: { code: 'UNAUTHORIZED_HOST', message: 'Not host of this room' } });
      }

      room.locked = parsed.data.locked;
      safeAck(ack, { ok: true, data: { locked: room.locked } });
    });

    socket.on('host:update-settings', (rawPayload, ack) => {
      if (!checkRateLimit()) return;
      const parsed = updateSettingsSchema.safeParse(rawPayload);
      if (!parsed.success) {
        return safeAck(ack, { ok: false, error: { code: 'INVALID_PAYLOAD', message: 'Invalid settings payload' } });
      }

      const { pin, settings } = parsed.data;
      const room = roomManager.getRoom(pin);
      if (!room || room.hostSocketId !== socket.id) {
        return safeAck(ack, { ok: false, error: { code: 'UNAUTHORIZED_HOST', message: 'Not host of this room' } });
      }

      if (room.status !== 'LOBBY') {
        return safeAck(ack, { ok: false, error: { code: 'INVALID_STATE', message: 'Settings can only be changed in LOBBY' } });
      }

      const mergedSettings = resolveSettings(settings, room.quiz.defaultSettings);
      room.settings = mergedSettings;
      logger.info(`Host updated settings for room ${pin}: phoneOptionText=${mergedSettings.phoneOptionText}`);
      safeAck(ack, { ok: true, data: { settings: room.settings } });
    });

    socket.on('host:kick-player', (rawPayload, ack) => {
      if (!checkRateLimit()) return;
      const parsed = kickPlayerSchema.safeParse(rawPayload);
      if (!parsed.success) return safeAck(ack, { ok: false, error: { code: 'INVALID_PAYLOAD', message: 'Invalid payload' } });

      const room = roomManager.getRoom(parsed.data.pin);
      if (!room || room.hostSocketId !== socket.id) {
        return safeAck(ack, { ok: false, error: { code: 'UNAUTHORIZED_HOST', message: 'Not host of this room' } });
      }

      const targetPlayer = room.players.get(parsed.data.playerId);
      if (targetPlayer) {
        if (targetPlayer.socketId) {
          io.to(targetPlayer.socketId).emit('player:kicked', { reason: 'You have been removed by the host.' });
        }
        room.players.delete(parsed.data.playerId);

        const activePlayers = Array.from(room.players.values()).map((p) => ({
          playerId: p.playerId,
          name: p.name,
          connected: p.connected
        }));
        io.to(`${room.pin}:host`).emit('room:player-left', {
          players: activePlayers,
          count: activePlayers.length
        });
      }

      safeAck(ack, { ok: true });
    });

    // ==========================================
    // DISPLAY PROJECTOR EVENTS (C5)
    // ==========================================

    socket.on('display:join', (rawPayload, ack) => {
      if (!checkRateLimit()) return;
      const parsed = displayJoinSchema.safeParse(rawPayload);
      if (!parsed.success) return safeAck(ack, { ok: false, error: { code: 'INVALID_PAYLOAD', message: 'Invalid display payload' } });

      const { pin, displayToken } = parsed.data;
      const result = roomManager.reconnectDisplay(pin, { displayToken, socketId: socket.id });
      if (!result.ok) {
        return safeAck(ack, result);
      }

      socket.join(pin);
      socket.join(`${pin}:display`);

      const state = getRoomState(result.room, null, true);
      safeAck(ack, { ok: true, data: state });
    });

    // ==========================================
    // PLAYER EVENTS
    // ==========================================

    socket.on('player:join', (rawPayload, ack) => {
      if (!checkRateLimit()) return;
      const parsed = playerJoinSchema.safeParse(rawPayload);
      if (!parsed.success) {
        return safeAck(ack, { ok: false, error: { code: 'INVALID_PAYLOAD', message: 'Invalid pin or nickname' } });
      }

      const clientIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
      if (failedPinTracker.isBlocked(clientIp)) {
        return safeAck(ack, { ok: false, error: { code: 'PIN_BLOCKED', message: 'Too many failed PIN attempts. Please wait.' } });
      }

      const { pin, name } = parsed.data;
      const result = roomManager.addPlayer(pin, { name, socketId: socket.id });
      if (!result.ok) {
        if (result.error?.code === 'ROOM_NOT_FOUND') {
          failedPinTracker.recordFailure(clientIp);
        }
        return safeAck(ack, result);
      }

      const { player, room } = result;
      failedPinTracker.recordSuccessfulJoin(clientIp);
      socket.join(pin);
      socket.join(`${pin}:players`);

      const playerList = Array.from(room.players.values()).map((p) => ({
        playerId: p.playerId,
        name: p.name,
        connected: p.connected
      }));

      io.to(`${pin}:host`).emit('room:player-joined', {
        players: playerList,
        count: playerList.length
      });
      io.to(`${pin}:display`).emit('room:player-joined', {
        players: playerList,
        count: playerList.length
      });

      safeAck(ack, {
        ok: true,
        data: {
          playerId: player.playerId,
          reconnectToken: player.reconnectToken,
          name: player.name
        }
      });
    });

    socket.on('player:rejoin', (rawPayload, ack) => {
      if (!checkRateLimit()) return;
      const parsed = playerRejoinSchema.safeParse(rawPayload);
      if (!parsed.success) {
        return safeAck(ack, { ok: false, error: { code: 'INVALID_PAYLOAD', message: 'Invalid payload' } });
      }

      const { pin, playerId, reconnectToken } = parsed.data;
      const result = roomManager.reconnectPlayer(pin, { playerId, reconnectToken, socketId: socket.id });
      if (!result.ok) {
        return safeAck(ack, result);
      }

      socket.join(pin);
      socket.join(`${pin}:players`);

      const state = getRoomState(result.room, result.player);

      const playerList = Array.from(result.room.players.values()).map((p) => ({
        playerId: p.playerId,
        name: p.name,
        connected: p.connected
      }));
      io.to(`${pin}:host`).emit('room:player-joined', {
        players: playerList,
        count: playerList.length
      });

      safeAck(ack, { ok: true, data: state });
    });

    socket.on('player:leave', (rawPayload, ack) => {
      if (!checkRateLimit()) return;
      const parsed = playerLeaveSchema.safeParse(rawPayload || {});
      if (!parsed.success) {
        return safeAck(ack, { ok: false, error: { code: 'INVALID_PAYLOAD', message: 'Invalid pin' } });
      }

      const { pin, playerId: explicitPlayerId } = parsed.data;
      const room = roomManager.getRoom(pin);
      if (!room) {
        return safeAck(ack, { ok: true, data: { left: true } });
      }

      let player = null;
      if (explicitPlayerId && room.players.has(explicitPlayerId)) {
        player = room.players.get(explicitPlayerId);
      } else {
        for (const p of room.players.values()) {
          if (p.socketId === socket.id) {
            player = p;
            break;
          }
        }
      }

      if (!player) {
        return safeAck(ack, { ok: true, data: { left: true } });
      }

      if (room.status === 'LOBBY') {
        room.players.delete(player.playerId);
        logger.info(`Player ${player.name} left lobby in room ${pin}`);

        const activePlayers = Array.from(room.players.values()).filter((p) => !p.left).map((p) => ({
          playerId: p.playerId,
          name: p.name,
          connected: p.connected,
          left: false
        }));

        io.to(`${pin}:host`).emit('room:player-left', {
          players: activePlayers,
          count: activePlayers.length
        });
        io.to(`${pin}:display`).emit('room:player-left', {
          players: activePlayers,
          count: activePlayers.length
        });
      } else {
        player.left = true;
        player.connected = false;
        player.reconnectToken = null;
        logger.info(`Player ${player.name} left mid-game in room ${pin}`);

        const allPlayers = Array.from(room.players.values()).map((p) => ({
          playerId: p.playerId,
          name: p.name,
          connected: p.connected && !p.left,
          left: !!p.left
        }));
        const activeCount = allPlayers.filter((p) => p.connected && !p.left).length;

        io.to(`${pin}:host`).emit('room:player-left', {
          players: allPlayers,
          count: activeCount
        });
        io.to(`${pin}:display`).emit('room:player-left', {
          players: allPlayers,
          count: activeCount
        });

        if (room.status === 'QUESTION_ACTIVE') {
          const connectedPlayers = Array.from(room.players.values()).filter((p) => p.connected && !p.left);
          const answeredCount = connectedPlayers.filter((p) => p.currentAnswer !== null).length;
          const totalConnected = connectedPlayers.length;

          io.to(`${pin}:host`).emit('host:player-answered', {
            answeredCount,
            totalPlayers: totalConnected
          });

          if (answeredCount >= totalConnected && totalConnected > 0) {
            GameEngine.finalizeQuestion(room, io);
          }
        }
      }

      try {
        socket.leave(pin);
        socket.leave(`${pin}:players`);
      } catch {}

      safeAck(ack, { ok: true, data: { left: true } });
    });

    socket.on('player:submit-answer', (rawPayload, ack) => {
      if (!checkRateLimit()) return;
      const parsed = submitAnswerSchema.safeParse(rawPayload);
      if (!parsed.success) {
        return safeAck(ack, { ok: false, error: { code: 'INVALID_PAYLOAD', message: 'Invalid answer index or pin' } });
      }

      const room = roomManager.getRoom(parsed.data.pin);
      if (!room) {
        return safeAck(ack, { ok: false, error: { code: 'ROOM_NOT_FOUND', message: 'Room not found' } });
      }

      const playerEntry = roomManager.findPlayerBySocketId(socket.id);
      if (!playerEntry || playerEntry.room.pin !== room.pin) {
        return safeAck(ack, { ok: false, error: { code: 'PLAYER_NOT_FOUND', message: 'Player not recognized in room' } });
      }

      const result = GameEngine.submitAnswer(room, playerEntry.player.playerId, parsed.data.selectedIndex, io);
      safeAck(ack, result);
    });

    socket.on('player:set-confidence', (rawPayload, ack) => {
      if (!checkRateLimit()) return;
      const parsed = confidenceSchema.safeParse(rawPayload);
      if (!parsed.success) return safeAck(ack, { ok: false, error: { code: 'INVALID_PAYLOAD', message: 'Invalid confidence level' } });

      const room = roomManager.getRoom(parsed.data.pin);
      if (!room) return safeAck(ack, { ok: false, error: { code: 'ROOM_NOT_FOUND', message: 'Room not found' } });

      const playerEntry = roomManager.findPlayerBySocketId(socket.id);
      if (!playerEntry || playerEntry.room.pin !== room.pin) {
        return safeAck(ack, { ok: false, error: { code: 'PLAYER_NOT_FOUND', message: 'Player not recognized in room' } });
      }

      if (room.status !== 'QUESTION_ACTIVE' && room.status !== 'REVOTE') {
        return safeAck(ack, { ok: false, error: { code: 'INVALID_STATE', message: 'Confidence can only be set during active question or revote' } });
      }

      const { player } = playerEntry;
      player.currentConfidence = parsed.data.level;

      const lastHist = player.history[player.history.length - 1];
      if (lastHist && lastHist.questionIndex === room.currentQuestionIndex) {
        lastHist.confidence = parsed.data.level;
        if (room.settings?.confidenceScoring && lastHist.isCorrect && parsed.data.level === 3) {
          player.score += 100;
          lastHist.points = (lastHist.points || 0) + 100;
        }
      }
      safeAck(ack, { ok: true, level: parsed.data.level });
    });

    socket.on('player:submit-revote', (rawPayload, ack) => {
      if (!checkRateLimit()) return;
      const parsed = submitAnswerSchema.safeParse(rawPayload);
      if (!parsed.success) return safeAck(ack, { ok: false, error: { code: 'INVALID_PAYLOAD', message: 'Invalid revote index' } });

      const room = roomManager.getRoom(parsed.data.pin);
      if (!room) return safeAck(ack, { ok: false, error: { code: 'ROOM_NOT_FOUND', message: 'Room not found' } });

      const playerEntry = roomManager.findPlayerBySocketId(socket.id);
      if (!playerEntry || playerEntry.room.pin !== room.pin) {
        return safeAck(ack, { ok: false, error: { code: 'PLAYER_NOT_FOUND', message: 'Player not recognized in room' } });
      }

      const result = GameEngine.submitRevote(room, playerEntry.player.playerId, parsed.data.selectedIndex, io);
      safeAck(ack, result);
    });

    // ==========================================
    // DISCONNECT
    // ==========================================

    socket.on('disconnect', () => {
      const hostRoom = roomManager.findHostBySocketId(socket.id);
      if (hostRoom) {
        hostRoom.hostDisconnectedAt = Date.now();
        logger.info(`Host disconnected from room ${hostRoom.pin}`);
        return;
      }

      const playerEntry = roomManager.findPlayerBySocketId(socket.id);
      if (playerEntry) {
        const { room, player } = playerEntry;
        player.connected = false;
        logger.info(`Player ${player.name} disconnected from room ${room.pin}`);

        if (room.status === 'LOBBY') {
          setTimeout(() => {
            if (!player.connected && room.status === 'LOBBY') {
              room.players.delete(player.playerId);
              const activePlayers = Array.from(room.players.values()).map((p) => ({
                playerId: p.playerId,
                name: p.name,
                connected: p.connected
              }));
              io.to(`${room.pin}:host`).emit('room:player-left', {
                players: activePlayers,
                count: activePlayers.length
              });
            }
          }, 60000);
        }
      }
    });
  });
}
