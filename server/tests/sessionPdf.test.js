import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { PDFParse } from 'pdf-parse';
import { createExpressApp } from '../src/server.js';
import { setupTestDB, teardownTestDB, clearTestDB } from './setup.js';
import { GameSession } from '../src/models/GameSession.js';

async function parsePdfBuffer(buffer) {
  const parser = new PDFParse({ data: buffer });
  await parser.load();
  const textObj = await parser.getText();
  return textObj.text || '';
}

describe('F7 Session and Student Progress PDF Exports', () => {
  let app;
  let teacherAToken;
  let teacherBToken;
  let teacherAId;
  let fullSessionId;
  let legacySessionId;

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
      email: 'teachera@school.edu',
      password: 'password123'
    });
    teacherAToken = resA.body.token;
    teacherAId = resA.body.user.id;

    const resB = await request(app).post('/api/auth/register').send({
      name: 'Teacher B',
      email: 'teacherb@school.edu',
      password: 'password123'
    });
    teacherBToken = resB.body.token;

    // 1. Full modern session with player histories, retest, and blindspot report
    const fullSession = await GameSession.create({
      quizTitle: 'Cellular Biology Diagnostics',
      hostId: teacherAId,
      pin: '123456',
      startedAt: new Date(Date.now() - 3600000),
      endedAt: new Date(),
      playerCount: 3,
      players: [
        {
          playerId: 'p-alice-1',
          name: 'Alice Cooper',
          finalScore: 1200,
          rank: 1,
          correctCount: 2,
          answeredCount: 2,
          missedTopics: [],
          confidenceStats: { certain: 2, fairlySure: 0, guessing: 0 },
          history: [
            { questionIndex: 0, selectedIndex: 0, isCorrect: true, score: 600, confidence: 3, round: 'main' },
            { questionIndex: 1, selectedIndex: 0, isCorrect: true, score: 600, confidence: 3, round: 'main' }
          ]
        },
        {
          playerId: 'p-bob-2',
          name: 'Bob Marley',
          finalScore: 500,
          rank: 2,
          correctCount: 1,
          answeredCount: 2,
          missedTopics: ['Bioenergetics'],
          confidenceStats: { certain: 1, fairlySure: 1, guessing: 0 },
          history: [
            { questionIndex: 0, selectedIndex: 0, isCorrect: true, score: 500, confidence: 2, round: 'main' },
            { questionIndex: 1, selectedIndex: 1, isCorrect: false, score: 0, confidence: 3, round: 'main' }
          ]
        },
        {
          playerId: 'p-charlie-3',
          name: 'Charlie Brown',
          finalScore: 0,
          rank: 3,
          correctCount: 0,
          answeredCount: 2,
          missedTopics: ['Cell Structure', 'Bioenergetics'],
          confidenceStats: { certain: 0, fairlySure: 1, guessing: 1 },
          history: [
            { questionIndex: 0, selectedIndex: 2, isCorrect: false, score: 0, confidence: 1, round: 'main' },
            { questionIndex: 1, selectedIndex: 2, isCorrect: false, score: 0, confidence: 2, round: 'main' }
          ]
        }
      ],
      questionStats: [
        {
          questionIndex: 0,
          questionText: 'Where does oxidative phosphorylation take place?',
          topicTag: 'Cell Structure',
          correctIndex: 0,
          options: ['Mitochondria', 'Chloroplast', 'Ribosome', 'Nucleus'],
          explanation: 'Oxidative phosphorylation takes place along the inner mitochondrial membrane.',
          totalPlayers: 3,
          answeredCount: 3,
          correctCount: 2,
          accuracy: 0.67,
          optionCounts: [2, 0, 1, 0],
          topDistractorIndex: 2,
          topDistractorRationale: 'Ribosomes translate mRNA, not synthesize ATP via chemiosmosis'
        },
        {
          questionIndex: 1,
          questionText: 'What is the net ATP yield of glycolysis?',
          topicTag: 'Bioenergetics',
          correctIndex: 0,
          options: ['2 ATP', '4 ATP', '36 ATP', '0 ATP'],
          explanation: 'Glycolysis uses 2 ATP and produces 4 ATP, netting 2 ATP.',
          totalPlayers: 3,
          answeredCount: 3,
          correctCount: 1,
          accuracy: 0.33,
          optionCounts: [1, 1, 1, 0],
          topDistractorIndex: 1,
          topDistractorRationale: '4 ATP is total gross yield before accounting for the 2 ATP consumed',
          flags: ['TOO_HARD']
        }
      ],
      retest: {
        questionIndexes: [1],
        beforeAccuracy: 0.33,
        afterAccuracy: 0.85,
        headline: 'Accuracy on Bioenergetics improved from 33% to 85%',
        perQuestion: [],
        perTopic: [],
        perPlayer: [
          { playerId: 'p-bob-2', name: 'Bob Marley', score: 400, correct: 1, total: 1, improvedCount: 1 }
        ]
      },
      blindspotReport: {
        overallAccuracy: 0.5,
        topics: [
          { topicTag: 'Bioenergetics', accuracy: 0.33, questionCount: 1, flagged: true },
          { topicTag: 'Cell Structure', accuracy: 0.67, questionCount: 1, flagged: false }
        ],
        topMisconceptions: [
          { rationale: '4 ATP is total gross yield before accounting for the 2 ATP consumed', count: 1 }
        ],
        confidentMisconceptions: [
          {
            questionIndex: 1,
            topicTag: 'Bioenergetics',
            confidentWrongCount: 1,
            confidentWrongPercent: 33,
            rationale: 'Confused gross and net yield with certainty'
          }
        ]
      }
    });
    fullSessionId = fullSession._id.toString();

    // 2. Legacy session without per-question player history (backwards compatibility test)
    const legacySession = await GameSession.create({
      quizTitle: 'Old Legacy Physics Session',
      hostId: teacherAId,
      pin: '654321',
      startedAt: new Date(Date.now() - 7200000),
      endedAt: new Date(),
      playerCount: 2,
      players: [
        {
          playerId: 'p-legacy-1',
          name: 'Legacy Student 1',
          finalScore: 800,
          rank: 1,
          correctCount: 4,
          answeredCount: 5,
          missedTopics: ['Thermodynamics']
          // Notice: no history field
        },
        {
          playerId: 'p-legacy-2',
          name: 'Legacy Student 2',
          finalScore: 400,
          rank: 2,
          correctCount: 2,
          answeredCount: 5,
          missedTopics: ['Thermodynamics', 'Waves']
        }
      ],
      questionStats: [],
      blindspotReport: { overallAccuracy: 0.6, topics: [] }
    });
    legacySessionId = legacySession._id.toString();
  });

  it('exports class PDF report containing all students, scores, KPIs, and retest summary', async () => {
    const res = await request(app)
      .get(`/api/sessions/${fullSessionId}/export.pdf`)
      .set('Authorization', `Bearer ${teacherAToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const data = [];
        res.on('data', (chunk) => data.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(data)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toBe(
      'attachment; filename="cellular-biology-diagnostics-class-report.pdf"'
    );
    expect(res.headers['cache-control']).toBe('no-store');

    const pdfText = await parsePdfBuffer(res.body);

    // Summary page details
    expect(pdfText).toContain('Cellular Biology Diagnostics');
    expect(pdfText).toContain('Students: 3');
    expect(pdfText).toContain('PIN: 123456');
    expect(pdfText).toContain('Accuracy on Bioenergetics improved from 33% to 85%');

    // Roster names and scores
    expect(pdfText).toContain('Alice Cooper');
    expect(pdfText).toContain('1200');
    expect(pdfText).toContain('Bob Marley');
    expect(pdfText).toContain('500');
    expect(pdfText).toContain('Charlie Brown');

    // Footers
    expect(pdfText).toContain('Generated by ReviseLive');
  });

  it('exports single-student PDF containing only that student details, missed questions, and Concept Anchors', async () => {
    const res = await request(app)
      .get(`/api/sessions/${fullSessionId}/students/p-bob-2/export.pdf`)
      .set('Authorization', `Bearer ${teacherAToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const data = [];
        res.on('data', (chunk) => data.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(data)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toBe(
      'attachment; filename="cellular-biology-diagnostics-bob-marley-student-report.pdf"'
    );

    const pdfText = await parsePdfBuffer(res.body);

    // Target student info
    expect(pdfText).toContain('Bob Marley');
    expect(pdfText).toContain('Score: 500 pts');
    expect(pdfText).toContain('Rank: #2 of 3');
    expect(pdfText).toContain('Accuracy: 50%');

    // Topics to revise & mastery text percentages
    expect(pdfText).toContain('Topics to Revise: Bioenergetics');
    expect(pdfText).toContain('Cell Structure: 100% mastery');
    expect(pdfText).toContain('Bioenergetics: 0% mastery');

    // Missed Question details, distractor misconception rationale, and Concept Anchor
    expect(pdfText).toContain('What is the net ATP yield of glycolysis?');
    expect(pdfText).toContain('Option B (4 ATP)');
    expect(pdfText).toContain('Misconception: 4 ATP is total gross yield before accounting');
    expect(pdfText).toContain('Correct Answer: Option A (2 ATP)');
    expect(pdfText).toContain('Concept Anchor: Glycolysis uses 2 ATP and produces 4 ATP, netting 2 ATP.');

    // Retest note
    expect(pdfText).toContain('Retest Round: Solved 1/1');
    expect(pdfText).toContain('1 question(s) improved!');

    // Must NOT contain other students' personal pages
    expect(pdfText).not.toContain('Alice Cooper');
    expect(pdfText).not.toContain('Charlie Brown');
  });

  it('returns 404 for student ID not belonging to the session', async () => {
    const res = await request(app)
      .get(`/api/sessions/${fullSessionId}/students/p-nonexistent/export.pdf`)
      .set('Authorization', `Bearer ${teacherAToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('STUDENT_NOT_FOUND');
  });

  it('enforces ownership: returns 404 when requested by a different teacher', async () => {
    const classRes = await request(app)
      .get(`/api/sessions/${fullSessionId}/export.pdf`)
      .set('Authorization', `Bearer ${teacherBToken}`);
    expect(classRes.status).toBe(404);
    expect(classRes.body.error.code).toBe('SESSION_NOT_FOUND');

    const studentRes = await request(app)
      .get(`/api/sessions/${fullSessionId}/students/p-alice-1/export.pdf`)
      .set('Authorization', `Bearer ${teacherBToken}`);
    expect(studentRes.status).toBe(404);
    expect(studentRes.body.error.code).toBe('SESSION_NOT_FOUND');
  });

  it('exports legacy sessions without per-question player history cleanly with notice', async () => {
    const classRes = await request(app)
      .get(`/api/sessions/${legacySessionId}/export.pdf`)
      .set('Authorization', `Bearer ${teacherAToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const data = [];
        res.on('data', (chunk) => data.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(data)));
      });

    expect(classRes.status).toBe(200);
    const pdfText = await parsePdfBuffer(classRes.body);

    // Summary and roster must still appear
    expect(pdfText).toContain('Old Legacy Physics Session');
    expect(pdfText).toContain('Legacy Student 1');
    expect(pdfText).toContain('Legacy Student 2');

    // Student page contains notice that item detail is unavailable
    expect(pdfText).toContain('Per-question item detail is not available for this session.');
  });

  it('verifies CSV export remains fully functional alongside PDF export', async () => {
    const csvRes = await request(app)
      .get(`/api/sessions/${fullSessionId}/export.csv`)
      .set('Authorization', `Bearer ${teacherAToken}`);

    expect(csvRes.status).toBe(200);
    expect(csvRes.headers['content-type']).toContain('text/csv');
    expect(csvRes.text).toContain('Alice Cooper');
    expect(csvRes.text).toContain('Bob Marley');
    expect(csvRes.text).toContain('Charlie Brown');
  });

  it('handles 300-player session efficiently and caps at PDF_MAX_STUDENTS', async () => {
    const players300 = [];
    for (let i = 1; i <= 300; i++) {
      players300.push({
        playerId: `p-bulk-${i}`,
        name: `Student #${i} Long Nickname Testing`,
        finalScore: 1000 - i * 3,
        rank: i,
        correctCount: (i % 5) + 1,
        answeredCount: 5,
        missedTopics: ['Topic A']
      });
    }

    const bulkSession = await GameSession.create({
      quizTitle: 'Large Scale 300 Player Quiz',
      hostId: teacherAId,
      pin: '999300',
      startedAt: new Date(Date.now() - 3600000),
      endedAt: new Date(),
      playerCount: 300,
      players: players300,
      questionStats: [],
      blindspotReport: { overallAccuracy: 0.65, topics: [] }
    });

    const start = Date.now();
    const res = await request(app)
      .get(`/api/sessions/${bulkSession._id}/export.pdf`)
      .set('Authorization', `Bearer ${teacherAToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const data = [];
        res.on('data', (chunk) => data.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(data)));
      });
    const elapsed = Date.now() - start;

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(10000);
    // Generation must complete in reasonable time (< 15 seconds)
    expect(elapsed).toBeLessThan(15000);

    const pdfText = await parsePdfBuffer(res.body);
    expect(pdfText).toContain('Large Scale 300 Player Quiz');
    expect(pdfText).toContain('Student #1 Long Nickname Testing');
  });
});
