import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { buildFinalLeaderboard } from '../src/sockets/gameEngine.js';
import { getRoomState } from '../src/sockets/socketHandler.js';
import express from 'express';
import request from 'supertest';
import receiptRoutes from '../src/routes/receiptRoutes.js';
import { GameSession } from '../src/models/GameSession.js';

describe('F2 - Final Ranked Leaderboard Server Tests', () => {
  it('buildFinalLeaderboard sets exactly one isYou row and removes player identifiers', () => {
    const mockRanked = [
      {
        playerId: 'p1',
        socketId: 'sock-1',
        reconnectToken: 'tok-1',
        name: 'Alice',
        score: 3000,
        rank: 1,
        left: false,
        history: [{ isCorrect: true, selectedIndex: 0 }, { isCorrect: true, selectedIndex: 1 }]
      },
      {
        playerId: 'p2',
        socketId: 'sock-2',
        reconnectToken: 'tok-2',
        name: 'Bob',
        score: 2000,
        rank: 2,
        left: true,
        history: [{ isCorrect: true, selectedIndex: 0 }, { isCorrect: false, selectedIndex: 2 }]
      },
      {
        playerId: 'p3',
        socketId: 'sock-3',
        reconnectToken: 'tok-3',
        name: 'Charlie',
        score: 1000,
        rank: 3,
        left: false,
        history: [{ isCorrect: false, selectedIndex: 0 }]
      }
    ];

    const result = buildFinalLeaderboard({
      ranked: mockRanked,
      setting: 'full',
      recipientPlayerId: 'p2',
      totalQuestions: 2
    });

    expect(result).toHaveLength(3);

    // Verify Bob is marked isYou, Alice and Charlie are false
    expect(result[0].isYou).toBe(false);
    expect(result[1].isYou).toBe(true);
    expect(result[2].isYou).toBe(false);

    // Exactly one isYou row
    const isYouRows = result.filter((r) => r.isYou);
    expect(isYouRows).toHaveLength(1);
    expect(isYouRows[0].name).toBe('Bob');

    // Bob has left: true
    expect(result[1].left).toBe(true);
    expect(result[0].left).toBe(false);

    // Verify NO player identifiers or sensitive socket tokens are present in any row
    result.forEach((row) => {
      expect(row).not.toHaveProperty('playerId');
      expect(row).not.toHaveProperty('socketId');
      expect(row).not.toHaveProperty('reconnectToken');
      expect(row).not.toHaveProperty('tokenHash');
      expect(row).toHaveProperty('rank');
      expect(row).toHaveProperty('name');
      expect(row).toHaveProperty('score');
      expect(row).toHaveProperty('correct');
      expect(row).toHaveProperty('answered');
      expect(row).toHaveProperty('accuracy');
      expect(row).toHaveProperty('isYou');
      expect(row).toHaveProperty('left');
    });
  });

  describe('Visibility Modes: full, top10, self', () => {
    // Generate 15 ranked players
    const generateRankedPlayers = (count = 15) => {
      const players = [];
      for (let i = 1; i <= count; i++) {
        players.push({
          playerId: `player-${i}`,
          name: `Student ${i}`,
          score: (count - i + 1) * 100,
          rank: i,
          history: [{ isCorrect: true, selectedIndex: 0 }]
        });
      }
      return players;
    };

    it('full mode returns all players in rank order', () => {
      const ranked = generateRankedPlayers(15);
      const result = buildFinalLeaderboard({
        ranked,
        setting: 'full',
        recipientPlayerId: 'player-5'
      });

      expect(result).toHaveLength(15);
      expect(result[0].rank).toBe(1);
      expect(result[14].rank).toBe(15);
      expect(result.find((r) => r.isYou)?.name).toBe('Student 5');
    });

    it('top10 mode returns top 10 rows when student is ranked <= 10', () => {
      const ranked = generateRankedPlayers(15);
      const result = buildFinalLeaderboard({
        ranked,
        setting: 'top10',
        recipientPlayerId: 'player-3'
      });

      expect(result).toHaveLength(10);
      expect(result.some((r) => r.isYou)).toBe(true);
      expect(result.find((r) => r.isYou)?.rank).toBe(3);
    });

    it('top10 mode appends student own row if student rank > 10', () => {
      const ranked = generateRankedPlayers(15);
      const result = buildFinalLeaderboard({
        ranked,
        setting: 'top10',
        recipientPlayerId: 'player-14'
      });

      expect(result).toHaveLength(11); // Top 10 + student's own row
      expect(result.slice(0, 10).map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      const selfRow = result[10];
      expect(selfRow.rank).toBe(14);
      expect(selfRow.name).toBe('Student 14');
      expect(selfRow.isYou).toBe(true);
    });

    it('self mode returns ONLY the student row', () => {
      const ranked = generateRankedPlayers(15);
      const result = buildFinalLeaderboard({
        ranked,
        setting: 'self',
        recipientPlayerId: 'player-7'
      });

      expect(result).toHaveLength(1);
      expect(result[0].rank).toBe(7);
      expect(result[0].name).toBe('Student 7');
      expect(result[0].isYou).toBe(true);
    });
  });

  it('handles 300-player payload efficiently without performance degradation', () => {
    const largeList = [];
    for (let i = 1; i <= 300; i++) {
      largeList.push({
        playerId: `p-${i}`,
        name: `Competitor ${i}`,
        score: 3000 - i * 5,
        rank: i,
        history: [{ isCorrect: i % 2 === 0, selectedIndex: 1 }]
      });
    }

    const t0 = performance.now();
    const result = buildFinalLeaderboard({
      ranked: largeList,
      setting: 'full',
      recipientPlayerId: 'p-150'
    });
    const duration = performance.now() - t0;

    expect(result).toHaveLength(300);
    expect(result[149].isYou).toBe(true);
    expect(result[149].name).toBe('Competitor 150');
    expect(duration).toBeLessThan(50); // Well under 50ms
  });

  describe('Rejoin after FINISHED and Cache Restoration', () => {
    it('restores final leaderboard on player:rejoin when room is FINISHED', () => {
      const room = {
        pin: '998877',
        status: 'FINISHED',
        settings: { finalLeaderboard: 'full', phoneOptionText: 'full' },
        quiz: { title: 'Math Quiz', questions: [{ text: 'Q1' }] },
        currentRound: 'main',
        players: new Map()
      };

      const player = {
        playerId: 'p-me',
        name: 'Student Me',
        score: 2500,
        rank: 1,
        streak: 3,
        connected: true,
        history: [{ isCorrect: true, selectedIndex: 0 }]
      };

      room.players.set('p-me', player);
      room.finalRanked = [player];
      room.finalPlayersSummary = [{ playerId: 'p-me', missedTopics: ['Fractions'] }];
      room.playerReceiptTokens = new Map([['p-me', 'token-abc-123']]);

      const state = getRoomState(room, player);

      expect(state.status).toBe('FINISHED');
      expect(state.finalLeaderboard).toBeDefined();
      expect(state.finalLeaderboard).toHaveLength(1);
      expect(state.finalLeaderboard[0].isYou).toBe(true);
      expect(state.receiptToken).toBe('token-abc-123');
      expect(state.receiptUrl).toBe('/r/token-abc-123');
      expect(state.you.missedTopics).toEqual(['Fractions']);
    });
  });

  describe('Receipt Endpoint GET /api/receipts/:token respects finalLeaderboard setting', () => {
    const app = express();
    app.use(express.json());
    app.use('/api/receipts', receiptRoutes);

    it('returns filtered leaderboard based on session settings', async () => {
      const rawToken = '0123456789abcdef0123456789abcdef';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const mockSession = {
        quizTitle: 'Science 101',
        createdAt: new Date(),
        playerCount: 3,
        settings: { finalLeaderboard: 'self' },
        players: [
          { name: 'Alice', finalScore: 1000, rank: 1, correctCount: 1, answeredCount: 1, receiptTokenHash: tokenHash },
          { name: 'Bob', finalScore: 800, rank: 2, correctCount: 1, answeredCount: 1, receiptTokenHash: 'hash-bob' }
        ],
        questionStats: []
      };

      // Mock GameSession.findOne
      const originalFindOne = GameSession.findOne;
      GameSession.findOne = () => ({
        exec: async () => mockSession,
        then: (fn) => fn(mockSession)
      });

      try {
        const res = await request(app).get('/api/receipts/0123456789abcdef0123456789abcdef');
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        // Setting was 'self', so only Alice's row should be returned
        expect(res.body.data.finalLeaderboard).toHaveLength(1);
        expect(res.body.data.finalLeaderboard[0].name).toBe('Alice');
        expect(res.body.data.finalLeaderboard[0].isYou).toBe(true);
      } finally {
        GameSession.findOne = originalFindOne;
      }
    });
  });
});
