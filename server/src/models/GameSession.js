import mongoose from 'mongoose';
import { GameSettingsSchema } from './Quiz.js';
import { env } from '../config/env.js';

const { Schema } = mongoose;

const PlayerQuestionHistorySchema = new Schema(
  {
    questionIndex: { type: Number, required: true },
    selectedIndex: { type: Number, default: null },
    isCorrect: { type: Boolean, default: false },
    score: { type: Number, default: 0 },
    confidence: { type: Number, default: null },
    responseTimeMs: { type: Number, default: null },
    round: { type: String, enum: ['main', 'retest'], default: 'main' }
  },
  { _id: false }
);

const PlayerSummarySchema = new Schema(
  {
    playerId: { type: String },
    name: { type: String, required: true },
    finalScore: { type: Number, default: 0 },
    rank: { type: Number, default: 1 },
    correctCount: { type: Number, default: 0 },
    answeredCount: { type: Number, default: 0 },
    missedTopics: { type: [String], default: [] },
    receiptTokenHash: { type: String },
    confidenceStats: {
      guessing: { type: Number, default: 0 },
      fairlySure: { type: Number, default: 0 },
      certain: { type: Number, default: 0 }
    },
    recoveredCount: { type: Number, default: 0 },
    retestScore: { type: Number, default: 0 },
    history: [PlayerQuestionHistorySchema]
  },
  { _id: false }
);

const QuestionStatSchema = new Schema(
  {
    questionIndex: { type: Number, required: true },
    questionText: { type: String, required: true },
    topicTag: { type: String, default: 'General' },
    correctIndex: { type: Number, required: true },
    explanation: { type: String, default: '' },
    options: { type: [String], default: [] },
    totalPlayers: { type: Number, default: 0 },
    answeredCount: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
    accuracy: { type: Number, default: 0 },
    optionCounts: { type: [Number], default: [0, 0, 0, 0] },
    topDistractorIndex: { type: Number, default: null },
    topDistractorRationale: { type: String, default: '' },
    confidentWrongCount: { type: Number, default: 0 },
    peerShift: {
      wrongToRight: { type: Number, default: 0 },
      rightToWrong: { type: Number, default: 0 },
      wrongToWrong: { type: Number, default: 0 },
      rightToRight: { type: Number, default: 0 }
    },
    flags: { type: [String], default: [] },
    discriminationIndex: { type: Number, default: null },
    clusters: [Schema.Types.Mixed]
  },
  { _id: false }
);

const GameSessionSchema = new Schema(
  {
    quizId: { type: Schema.Types.Mixed, index: true },
    quizTitle: { type: String, required: true },
    hostId: { type: Schema.Types.Mixed, index: true },
    classId: { type: Schema.Types.ObjectId, ref: 'Class', index: true },
    pin: { type: String, required: true, index: true },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: Date.now },
    playerCount: { type: Number, default: 0 },
    settings: { type: GameSettingsSchema, default: () => ({}) },
    players: [PlayerSummarySchema],
    questionStats: [QuestionStatSchema],
    retest: {
      type: new Schema(
        {
          questionIndexes: [Number],
          beforeAccuracy: { type: Number, default: 0 },
          afterAccuracy: { type: Number, default: 0 },
          headline: { type: String, default: '' },
          perQuestion: [Schema.Types.Mixed],
          perTopic: [Schema.Types.Mixed],
          perPlayer: [Schema.Types.Mixed],
          results: [Schema.Types.Mixed]
        },
        { _id: false }
      ),
      default: null
    },
    blindspotReport: {
      threshold: { type: Number, default: 0.5 },
      overallAccuracy: { type: Number, default: 0 },
      topics: [Schema.Types.Mixed],
      weakQuestions: [Schema.Types.Mixed],
      questionAccuracy: [Schema.Types.Mixed],
      topMisconceptions: [Schema.Types.Mixed],
      confidentMisconceptions: [Schema.Types.Mixed]
    }
  },
  { timestamps: true }
);

if (env.SESSION_RETENTION_DAYS && env.SESSION_RETENTION_DAYS > 0) {
  GameSessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: env.SESSION_RETENTION_DAYS * 86400 });
}

export const GameSession = mongoose.model('GameSession', GameSessionSchema);
export default GameSession;
