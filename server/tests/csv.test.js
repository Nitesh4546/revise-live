import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { sanitizeCsvCell } from '../src/services/csvService.js';
import { createExpressApp } from '../src/server.js';
import { setupTestDB, teardownTestDB } from './setup.js';
import { GameSession } from '../src/models/GameSession.js';

describe('CSV Service & Injection Hardening', () => {
  let app;
  let teacherToken;
  let sessionId;

  beforeAll(async () => {
    await setupTestDB();
    app = createExpressApp();

    const regRes = await request(app).post('/api/auth/register').send({
      name: 'CSV Teacher',
      email: 'csvteacher@school.edu',
      password: 'password123'
    });
    teacherToken = regRes.body.token;

    const sessionDoc = await GameSession.create({
      quizTitle: 'Malicious =1+1 Quiz',
      hostId: regRes.body.user.id,
      pin: '555123',
      startedAt: new Date(),
      endedAt: new Date(),
      playerCount: 1,
      players: [
        {
          name: '=cmd|’ /C calc’!A0', // Injection payload
          finalScore: 1000,
          rank: 1,
          correctCount: 1,
          answeredCount: 1,
          missedTopics: []
        }
      ],
      questionStats: [],
      blindspotReport: { overallAccuracy: 1, topics: [], weakQuestions: [] }
    });
    sessionId = sessionDoc._id.toString();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  it('prefixes dangerous formula characters (=, +, -, @) with a single quote', () => {
    expect(sanitizeCsvCell('=1+1')).toBe(`"'=1+1"`);
    expect(sanitizeCsvCell('+cmd|')).toBe(`"'+cmd|"`);
    expect(sanitizeCsvCell('-SUM(A1:A10)')).toBe(`"'-SUM(A1:A10)"`);
    expect(sanitizeCsvCell('@HYPERLINK("http://evil.com")')).toBe(`"'@HYPERLINK(""http://evil.com"")"`);
  });

  it('leaves benign strings untouched except for RFC 4180 quote wrapping', () => {
    expect(sanitizeCsvCell('Normal Student')).toBe(`"Normal Student"`);
    expect(sanitizeCsvCell('Contains "Quotes"')).toBe(`"Contains ""Quotes"""`);
  });

  it('serves CSV via GET /api/sessions/:id/export.csv protected against injection', async () => {
    const res = await request(app)
      .get(`/api/sessions/${sessionId}/export.csv`)
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain(`"'=cmd|’ /C calc’!A0"`);
  });
});
