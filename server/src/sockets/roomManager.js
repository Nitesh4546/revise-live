import crypto from 'crypto';
import { generatePin } from '../utils/pin.js';
import { sanitizeNickname } from '../utils/sanitize.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { resolveSettings } from '../utils/gameSettings.js';
import { generateFriendlyNickname } from '../utils/nicknames.js';

export class RoomManager {
  constructor() {
    this.rooms = new Map(); // pin -> Room
  }

  createRoom({ quiz, hostId, hostSocketId, settings, classId }) {
    if (this.rooms.size >= env.MAX_ACTIVE_ROOMS) {
      throw new Error('Maximum active room limit reached on server');
    }

    const existingPins = new Set(this.rooms.keys());
    const pin = generatePin(existingPins);
    const hostToken = crypto.randomUUID();
    const displayToken = crypto.randomUUID();

    // Deep clone the quiz snapshot
    const quizSnapshot = JSON.parse(JSON.stringify(quiz));
    const mergedSettings = resolveSettings(settings, quiz.defaultSettings);

    const room = {
      pin,
      hostSocketId,
      hostToken,
      displayToken,
      displaySockets: new Set(),
      hostId: hostId.toString(),
      classId: classId ? classId.toString() : null,
      quiz: quizSnapshot,
      settings: mergedSettings,
      status: 'LOBBY',
      currentRound: 'main',
      rounds: ['main'],
      currentQuestionIndex: -1,
      questionStartedAtEpoch: null,
      questionStartedAtMono: null,
      timerId: null,
      finalized: false,
      locked: false,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
      hostDisconnectedAt: null,
      players: new Map(), // playerId -> Player
      answerLog: [],
      retestAnswerLog: [],
      retestQuestionIndexes: [],
      discussionLog: []
    };

    this.rooms.set(pin, room);
    logger.info(`Room created: ${pin} by host ${hostId} with scoringMode=${mergedSettings.scoringMode}`);
    return room;
  }

  getRoom(pin) {
    if (!pin) return null;
    return this.rooms.get(pin.toString().trim()) || null;
  }

  deleteRoom(pin) {
    const room = this.getRoom(pin);
    if (room) {
      if (room.timerId) {
        clearTimeout(room.timerId);
        room.timerId = null;
      }
      this.rooms.delete(pin);
      logger.info(`Room deleted: ${pin}`);
    }
  }

  addPlayer(pin, { name, socketId }) {
    const room = this.getRoom(pin);
    if (!room) {
      return { ok: false, error: { code: 'ROOM_NOT_FOUND', message: 'Quiz room not found.' } };
    }
    if (room.locked) {
      return { ok: false, error: { code: 'ROOM_LOCKED', message: 'Room has been locked by the host.' } };
    }
    if (room.status !== 'LOBBY') {
      return { ok: false, error: { code: 'GAME_ALREADY_STARTED', message: 'Game is already in progress.' } };
    }
    if (room.players.size >= env.MAX_PLAYERS_PER_ROOM) {
      return { ok: false, error: { code: 'ROOM_FULL', message: 'Room has reached maximum capacity.' } };
    }

    const existingNames = Array.from(room.players.values()).map((p) => p.name);
    const chosenName = (room.settings?.autoNicknames || !name?.trim())
      ? generateFriendlyNickname(existingNames)
      : name;
    const sanitizeResult = sanitizeNickname(chosenName, existingNames);
    if (!sanitizeResult.valid) {
      return { ok: false, error: { code: 'INVALID_NICKNAME', message: sanitizeResult.error } };
    }

    const playerId = crypto.randomUUID();
    const reconnectToken = crypto.randomUUID();

    const player = {
      playerId,
      reconnectToken,
      socketId,
      connected: true,
      name: sanitizeResult.sanitized,
      score: 0,
      retestScore: 0,
      streak: 0,
      previousRank: null,
      joinedAt: Date.now(),
      currentAnswer: null,
      currentConfidence: null,
      revoteAnswer: null,
      history: [],
      consecutiveWrong: 0,
      consecutiveUnanswered: 0
    };

    room.players.set(playerId, player);
    room.lastActivityAt = Date.now();
    logger.info(`Player joined: ${player.name} (${playerId}) in room ${pin}`);

    return { ok: true, player, room };
  }

  reconnectDisplay(pin, { displayToken, socketId }) {
    const room = this.getRoom(pin);
    if (!room) {
      return { ok: false, error: { code: 'ROOM_NOT_FOUND', message: 'Quiz room not found' } };
    }
    if (room.displayToken !== displayToken) {
      return { ok: false, error: { code: 'UNAUTHORIZED_DISPLAY', message: 'Invalid display token' } };
    }
    room.displaySockets.add(socketId);
    room.lastActivityAt = Date.now();
    logger.info(`Display joined room ${pin}`);
    return { ok: true, room };
  }

  reconnectPlayer(pin, { playerId, reconnectToken, socketId }) {
    const room = this.getRoom(pin);
    if (!room) {
      return { ok: false, error: { code: 'ROOM_NOT_FOUND', message: 'Quiz room not found' } };
    }

    const player = room.players.get(playerId);
    if (!player) {
      return { ok: false, error: { code: 'PLAYER_NOT_FOUND', message: 'Player not found in this room' } };
    }
    if (player.left) {
      return { ok: false, error: { code: 'SEAT_ABANDONED', message: 'You have left this game and cannot rejoin this seat' } };
    }
    if (!player.reconnectToken || player.reconnectToken !== reconnectToken) {
      return { ok: false, error: { code: 'INVALID_RECONNECT_TOKEN', message: 'Session expired or invalid reconnect token' } };
    }

    player.socketId = socketId;
    player.connected = true;
    room.lastActivityAt = Date.now();
    logger.info(`Player reconnected: ${player.name} (${playerId}) in room ${pin}`);

    return { ok: true, player, room };
  }

  reconnectHost(pin, { hostToken, socketId }) {
    const room = this.getRoom(pin);
    if (!room) {
      return { ok: false, error: { code: 'ROOM_NOT_FOUND', message: 'Quiz room not found' } };
    }

    if (room.hostToken !== hostToken) {
      return { ok: false, error: { code: 'UNAUTHORIZED_HOST', message: 'Invalid host reconnect token' } };
    }

    room.hostSocketId = socketId;
    room.hostDisconnectedAt = null;
    room.lastActivityAt = Date.now();
    logger.info(`Host reconnected to room ${pin}`);

    return { ok: true, room };
  }

  findPlayerBySocketId(socketId) {
    for (const room of this.rooms.values()) {
      for (const player of room.players.values()) {
        if (player.socketId === socketId) {
          return { room, player };
        }
      }
    }
    return null;
  }

  findHostBySocketId(socketId) {
    for (const room of this.rooms.values()) {
      if (room.hostSocketId === socketId) {
        return room;
      }
    }
    return null;
  }

  cleanExpiredRooms() {
    const now = Date.now();
    const finishedTtlMs = (env.FINISHED_ROOM_TTL_MIN || 60) * 60 * 1000;
    for (const [pin, room] of this.rooms.entries()) {
      // Finished rooms older than FINISHED_ROOM_TTL_MIN
      if (room.status === 'FINISHED' && now - room.lastActivityAt > finishedTtlMs) {
        this.deleteRoom(pin);
      }
      // Idle rooms older than 2 hours
      else if (now - room.lastActivityAt > 2 * 60 * 60 * 1000) {
        this.deleteRoom(pin);
      }
      // Host disconnected longer than HOST_GRACE_MS
      else if (
        room.hostDisconnectedAt &&
        now - room.hostDisconnectedAt > env.HOST_GRACE_MS
      ) {
        logger.info(`Room ${pin} closed due to host inactivity beyond grace period`);
        this.deleteRoom(pin);
      }
    }
  }

  closeRoom(pin, io = null) {
    const room = this.getRoom(pin);
    if (!room) return false;

    if (io) {
      io.to(room.pin).emit('room:closed', { reason: 'Room closed by host.' });
    }
    this.deleteRoom(pin);
    return true;
  }
}

export const roomManager = new RoomManager();
