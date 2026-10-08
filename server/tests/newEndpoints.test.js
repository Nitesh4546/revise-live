import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { createExpressApp } from '../src/server.js';
import { setupTestDB, teardownTestDB } from './setup.js';
import { User } from '../src/models/User.js';
import { Quiz } from '../src/models/Quiz.js';
import { GameSession } from '../src/models/GameSession.js';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';

describe('New REST Endpoints: Receipts, Classes & Nicknames (C6, D5, D6)', () => {
  let app;
  let teacher;
  let teacherToken;
  let rawReceiptToken;
  let receiptHash;

  beforeAll(async () => {
    await setupTestDB();
    app = createExpressApp();

    teacher = await User.create({
      name: 'Teacher Jane',
      email: `jane_${Date.now()}@school.edu`,
      passwordHash: 'hashedpwd'
    });
    teacherToken = jwt.sign({ id: teacher._id.toString() }, env.JWT_SECRET);

    rawReceiptToken = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
    receiptHash = crypto.createHash('sha256').update(rawReceiptToken).digest('hex');

    const quiz = await Quiz.create({
      title: 'Cellular Energetics',
      topic: 'Biology',
      createdBy: teacher._id,
      questions: [
        {
          questionText: 'Where does glycolysis occur?',
          options: ['Cytoplasm', 'Mitochondrial matrix', 'Inner membrane', 'Stroma'],
          correctIndex: 0,
          distractorRationales: ['', 'Confuses Krebs cycle location', 'Confuses ETC location', 'Only found in chloroplasts'],
          explanation: 'Glycolysis takes place in the cell cytoplasm.',
          topicTag: 'Respiration',
          timeLimit: 20
        }
      ]
    });

    await GameSession.create({
      quizId: quiz._id,
      quizTitle: quiz.title,
      hostId: teacher._id,
      pin: '123999',
      playerCount: 1,
      players: [
        {
          playerId: 'p-1',
          name: 'Student Tim',
          finalScore: 850,
          rank: 1,
          correctCount: 0,
          answeredCount: 1,
          missedTopics: ['Respiration'],
          receiptTokenHash: receiptHash
        }
      ],
      questionStats: [
        {
          questionIndex: 0,
          questionText: 'Where does glycolysis occur?',
          correctIndex: 0,
          totalPlayers: 1,
          answeredCount: 1,
          correctCount: 0,
          accuracy: 0,
          optionCounts: [0, 1, 0, 0],
          topDistractorIndex: 1,
          topDistractorRationale: 'Confuses Krebs cycle location'
        }
      ],
      blindspotReport: {
        threshold: 0.5,
        overallAccuracy: 0,
        topics: [{ topicTag: 'Respiration', accuracy: 0, flagged: true }]
      }
    });
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  it('GET /api/receipts/:token returns the student revision receipt', async () => {
    const res = await request(app).get(`/api/receipts/${rawReceiptToken}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.quizTitle).toBe('Cellular Energetics');
    expect(res.body.data.name).toBe('Student Tim');
    expect(res.body.data.missedQuestions).toHaveLength(1);
    expect(res.body.data.missedQuestions[0].topDistractorRationale).toBe('Confuses Krebs cycle location');
  });

  it('GET /api/receipts/:token returns 404 for invalid or non-existent token', async () => {
    const res = await request(app).get('/api/receipts/00000000000000000000000000000000');
    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
  });

  it('Classes CRUD & Mastery Trends (D5)', async () => {
    // 1. Create Class
    const createRes = await request(app)
      .post('/api/classes')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ name: 'Period 3 Biology' });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.name).toBe('Period 3 Biology');
    const classId = createRes.body.data._id;

    // 2. List Classes
    const listRes = await request(app)
      .get('/api/classes')
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);

    // 3. Class Mastery Trends
    const trendsRes = await request(app)
      .get(`/api/classes/${classId}/trends`)
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(trendsRes.status).toBe(200);
    expect(trendsRes.body.data.className).toBe('Period 3 Biology');
  });

  it('GET /api/nicknames/random returns an innocent friendly animal nickname (D6)', async () => {
    const res = await request(app).get('/api/nicknames/random');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.nickname).toBe('string');
    expect(res.body.nickname.split(' ').length).toBeGreaterThanOrEqual(2);
  });

  it('DELETE /api/sessions/:id removes the session for the owner', async () => {
    const session = await GameSession.create({
      quizTitle: 'To Delete Session',
      hostId: teacher._id,
      pin: '998877',
      players: []
    });

    const delRes = await request(app)
      .delete(`/api/sessions/${session._id}`)
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(delRes.status).toBe(200);
    expect(delRes.body.ok).toBe(true);

    const check = await GameSession.findById(session._id);
    expect(check).toBeNull();
  });
});
