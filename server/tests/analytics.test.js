import { describe, it, expect } from 'vitest';
import { calculateQuestionStats, generateBlindspotReport } from '../src/services/analyticsService.js';

describe('Analytics & Blindspot Radar Calculations', () => {
  const sampleQuiz = {
    questions: [
      {
        questionText: 'Question 1',
        options: ['Correct', 'Wrong 1', 'Wrong 2', 'Wrong 3'],
        correctIndex: 0,
        explanation: 'Exp 1',
        topicTag: 'Biology'
      },
      {
        questionText: 'Question 2',
        options: ['Wrong 1', 'Correct', 'Wrong 2', 'Wrong 3'],
        correctIndex: 1,
        explanation: 'Exp 2',
        topicTag: 'Chemistry'
      }
    ]
  };

  it('counts non-answers as incorrect and calculates question accuracy', () => {
    const players = [
      { playerId: 'p1', name: 'Alice', history: [{ questionIndex: 0, selectedIndex: 0, isCorrect: true }] },
      { playerId: 'p2', name: 'Bob', history: [{ questionIndex: 0, selectedIndex: 1, isCorrect: false }] },
      { playerId: 'p3', name: 'Charlie', history: [] } // non-answer
    ];

    const stats = calculateQuestionStats({
      question: sampleQuiz.questions[0],
      questionIndex: 0,
      players
    });

    expect(stats.totalPlayers).toBe(3);
    expect(stats.answeredCount).toBe(2);
    expect(stats.correctCount).toBe(1);
    expect(stats.accuracy).toBe(0.333); // 1 / 3
    expect(stats.topDistractorIndex).toBe(1); // 'Wrong 1' was chosen
  });

  it('flags topics and weak questions below 50% threshold in Blindspot report', () => {
    const players = [
      {
        playerId: 'p1',
        name: 'Alice',
        score: 1000,
        rank: 1,
        history: [
          { questionIndex: 0, selectedIndex: 1, isCorrect: false }, // Missed Q1 (Biology)
          { questionIndex: 1, selectedIndex: 1, isCorrect: true } // Correct Q2 (Chemistry)
        ]
      },
      {
        playerId: 'p2',
        name: 'Bob',
        score: 0,
        rank: 2,
        history: [
          { questionIndex: 0, selectedIndex: 1, isCorrect: false }, // Missed Q1 (Biology)
          { questionIndex: 1, selectedIndex: 0, isCorrect: false } // Missed Q2 (Chemistry)
        ]
      }
    ];

    const statsQ0 = calculateQuestionStats({ question: sampleQuiz.questions[0], questionIndex: 0, players });
    const statsQ1 = calculateQuestionStats({ question: sampleQuiz.questions[1], questionIndex: 1, players });

    const { report, playersSummary } = generateBlindspotReport({
      quiz: sampleQuiz,
      players,
      questionStatsList: [statsQ0, statsQ1]
    });

    // Biology: 0/2 correct -> 0% accuracy -> flagged
    const bioTopic = report.topics.find((t) => t.topicTag === 'Biology');
    expect(bioTopic).toBeDefined();
    expect(bioTopic.accuracy).toBe(0);
    expect(bioTopic.flagged).toBe(true);

    // Q1 accuracy is 0 -> weak question flagged (< 50%)
    expect(report.weakQuestions).toHaveLength(1); // Only Q1 (< 50%)
    expect(report.weakQuestions[0].questionText).toBe('Question 1');
    expect(report.weakQuestions[0].topDistractor.text).toBe('Wrong 1');

    // Per-player missed topics
    const alice = playersSummary.find((p) => p.name === 'Alice');
    expect(alice.missedTopics).toContain('Biology');
    expect(alice.missedTopics).not.toContain('Chemistry');
  });

  it('aggregates misconception rationales and ranks confident misconceptions (C1, C2)', () => {
    const quizWithRationales = {
      questions: [
        {
          questionText: 'What generates lift?',
          options: ['Pressure difference', 'Gravity', 'Static friction', 'Buoyancy'],
          correctIndex: 0,
          distractorRationales: ['', 'Confuses gravity with upward forces', 'Confuses surface friction', 'Confuses fluid buoyancy'],
          explanation: 'Bernoulli effect and circulation produce pressure differential.',
          topicTag: 'Physics'
        }
      ]
    };

    const players = [
      {
        playerId: 'p1',
        name: 'Alice',
        score: 0,
        rank: 1,
        history: [{ questionIndex: 0, selectedIndex: 1, isCorrect: false, confidence: 3 }] // Certain & Wrong!
      },
      {
        playerId: 'p2',
        name: 'Bob',
        score: 0,
        rank: 2,
        history: [{ questionIndex: 0, selectedIndex: 1, isCorrect: false, confidence: 2 }] // Fairly sure
      },
      {
        playerId: 'p3',
        name: 'Charlie',
        score: 1000,
        rank: 3,
        history: [{ questionIndex: 0, selectedIndex: 0, isCorrect: true, confidence: 3 }]
      }
    ];

    const stats = calculateQuestionStats({
      question: quizWithRationales.questions[0],
      questionIndex: 0,
      players
    });

    expect(stats.topDistractorIndex).toBe(1);
    expect(stats.topDistractorRationale).toBe('Confuses gravity with upward forces');
    expect(stats.confidentWrongCount).toBe(1);
    expect(stats.flags).toContain('SUSPECT_KEY'); // 2 wrong on option 1 vs 1 correct

    const { report } = generateBlindspotReport({
      quiz: quizWithRationales,
      players,
      questionStatsList: [stats]
    });

    expect(report.topMisconceptions).toHaveLength(1);
    expect(report.topMisconceptions[0].rationale).toBe('Confuses gravity with upward forces');
    expect(report.confidentMisconceptions).toHaveLength(1);
    expect(report.confidentMisconceptions[0].confidentWrongCount).toBe(1);
  });
});

