import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createExpressApp } from '../src/server.js';
import { setupTestDB, teardownTestDB, clearTestDB } from './setup.js';

describe('Quiz CRUD REST API & Ownership Enforcement', () => {
  let app;
  let teacherAToken;
  let teacherBToken;

  const validQuizData = {
    title: 'Kinematics & Motion',
    topic: 'Physics',
    description: 'Revision quiz on velocity, acceleration, and displacement.',
    sourceMaterial: 'Displacement is the change in position. Velocity is rate of change of displacement.',
    difficulty: 'medium',
    questions: [
      {
        questionText: 'What is the SI unit of acceleration?',
        options: ['m/s²', 'm/s', 'kg·m/s', 'Joules'],
        correctIndex: 0,
        explanation:
          'Acceleration is the rate of change of velocity over time, measured in m/s². Students often confuse this with velocity in m/s.',
        topicTag: 'Kinematics',
        timeLimit: 20
      }
    ]
  };

  beforeAll(async () => {
    await setupTestDB();
    app = createExpressApp();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    const resA = await request(app).post('/api/auth/register').send({
      name: 'Teacher A',
      email: 'teacherA@school.edu',
      password: 'password123'
    });
    teacherAToken = resA.body.token;

    const resB = await request(app).post('/api/auth/register').send({
      name: 'Teacher B',
      email: 'teacherB@school.edu',
      password: 'password123'
    });
    teacherBToken = resB.body.token;
  });

  it('creates a quiz successfully with valid data', async () => {
    const res = await request(app)
      .post('/api/quizzes')
      .set('Authorization', `Bearer ${teacherAToken}`)
      .send(validQuizData);

    expect(res.status).toBe(201);
    expect(res.body.quiz.title).toBe('Kinematics & Motion');
    expect(res.body.quiz.questions).toHaveLength(1);
    expect(res.body.quiz.questions[0].options).toHaveLength(4);
  });

  it('rejects a question with duplicate options or invalid correctIndex', async () => {
    const invalidOptionsQuiz = {
      ...validQuizData,
      questions: [
        {
          questionText: 'Test question?',
          options: ['Option A', 'Option A', 'Option B', 'Option C'], // Duplicate
          correctIndex: 0,
          explanation: 'Valid explanation text here for test purposes.',
          topicTag: 'Test'
        }
      ]
    };

    const res = await request(app)
      .post('/api/quizzes')
      .set('Authorization', `Bearer ${teacherAToken}`)
      .send(invalidOptionsQuiz);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('lists only the authenticated user quizzes without sourceMaterial', async () => {
    // Teacher A creates quiz
    await request(app)
      .post('/api/quizzes')
      .set('Authorization', `Bearer ${teacherAToken}`)
      .send(validQuizData);

    // Teacher B creates quiz
    await request(app)
      .post('/api/quizzes')
      .set('Authorization', `Bearer ${teacherBToken}`)
      .send({ ...validQuizData, title: 'Teacher B Quiz' });

    // Teacher A queries quizzes
    const resA = await request(app)
      .get('/api/quizzes')
      .set('Authorization', `Bearer ${teacherAToken}`);

    expect(resA.status).toBe(200);
    expect(resA.body.quizzes).toHaveLength(1);
    expect(resA.body.quizzes[0].title).toBe('Kinematics & Motion');
    expect(resA.body.quizzes[0].sourceMaterial).toBeUndefined();

    // Teacher B queries quizzes
    const resB = await request(app)
      .get('/api/quizzes')
      .set('Authorization', `Bearer ${teacherBToken}`);

    expect(resB.status).toBe(200);
    expect(resB.body.quizzes).toHaveLength(1);
    expect(resB.body.quizzes[0].title).toBe('Teacher B Quiz');
  });

  it('enforces ownership: Teacher B cannot view, update, delete or duplicate Teacher A quiz', async () => {
    // Teacher A creates quiz
    const createRes = await request(app)
      .post('/api/quizzes')
      .set('Authorization', `Bearer ${teacherAToken}`)
      .send(validQuizData);

    const quizId = createRes.body.quiz._id;

    // Teacher B tries to GET
    const getRes = await request(app)
      .get(`/api/quizzes/${quizId}`)
      .set('Authorization', `Bearer ${teacherBToken}`);
    expect(getRes.status).toBe(404);
    expect(getRes.body.error.code).toBe('QUIZ_NOT_FOUND');

    // Teacher B tries to PUT
    const putRes = await request(app)
      .put(`/api/quizzes/${quizId}`)
      .set('Authorization', `Bearer ${teacherBToken}`)
      .send({ ...validQuizData, title: 'Hacked Title' });
    expect(putRes.status).toBe(404);
    expect(putRes.body.error.code).toBe('QUIZ_NOT_FOUND');

    // Teacher B tries to DUPLICATE
    const dupRes = await request(app)
      .post(`/api/quizzes/${quizId}/duplicate`)
      .set('Authorization', `Bearer ${teacherBToken}`);
    expect(dupRes.status).toBe(404);
    expect(dupRes.body.error.code).toBe('QUIZ_NOT_FOUND');

    // Teacher B tries to DELETE
    const delRes = await request(app)
      .delete(`/api/quizzes/${quizId}`)
      .set('Authorization', `Bearer ${teacherBToken}`);
    expect(delRes.status).toBe(404);
    expect(delRes.body.error.code).toBe('QUIZ_NOT_FOUND');
  });

  it('duplicates a quiz for the owner with (Copy) appended to title', async () => {
    const createRes = await request(app)
      .post('/api/quizzes')
      .set('Authorization', `Bearer ${teacherAToken}`)
      .send(validQuizData);

    const quizId = createRes.body.quiz._id;

    const dupRes = await request(app)
      .post(`/api/quizzes/${quizId}/duplicate`)
      .set('Authorization', `Bearer ${teacherAToken}`);

    expect(dupRes.status).toBe(201);
    expect(dupRes.body.quiz._id).not.toBe(quizId);
    expect(dupRes.body.quiz.title).toBe('Kinematics & Motion (Copy)');
    expect(dupRes.body.quiz.questions).toHaveLength(1);
  });
});
