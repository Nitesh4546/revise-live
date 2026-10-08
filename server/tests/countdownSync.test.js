import { describe, it, expect } from 'vitest';
import { GameEngine } from '../src/sockets/gameEngine.js';

describe('Countdown Sync Protocol (Part A4)', () => {
  it('includes endsAt and serverNow in game:question-start payload', () => {
    const mockRoom = {
      pin: '123456',
      status: 'LOBBY',
      currentQuestionIndex: -1,
      quiz: {
        title: 'Sync Test',
        questions: [
          {
            questionText: 'Sync test question?',
            options: ['A', 'B', 'C', 'D'],
            correctIndex: 0,
            explanation: 'Concept anchor sentence 1. Misconception sentence 2.',
            topicTag: 'Timing',
            timeLimit: 25
          }
        ]
      },
      players: new Map([['p1', { playerId: 'p1', connected: true }]])
    };

    const res = GameEngine.startQuestion(mockRoom, null);
    expect(res.ok).toBe(true);
    expect(res.questionPayload).toBeDefined();
    expect(typeof res.questionPayload.endsAt).toBe('number');
    expect(typeof res.questionPayload.serverNow).toBe('number');
    expect(res.questionPayload.timeLimit).toBe(25);
    expect(res.questionPayload.endsAt).toBeGreaterThan(res.questionPayload.serverNow);
    expect(res.questionPayload.endsAt - res.questionPayload.serverNow).toBe(25000);
  });
});
