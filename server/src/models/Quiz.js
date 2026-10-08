import mongoose from 'mongoose';

const { Schema } = mongoose;

export const GameSettingsSchema = new Schema(
  {
    scoringMode: { type: String, enum: ['speed', 'accuracy'], default: 'accuracy' },
    leaderboardMode: { type: String, enum: ['competitive', 'classMeter', 'hidden', 'off'], default: 'off' },
    leaderboardBetweenQuestions: { type: Boolean, default: false },
    classTarget: { type: Number },
    confidenceScoring: { type: Boolean, default: true },
    peerInstruction: { type: String, enum: ['off', 'suggest', 'auto'], default: 'suggest' },
    peerInstructionBounds: {
      min: { type: Number, default: 30, min: 0, max: 100 },
      max: { type: Number, default: 70, min: 0, max: 100 }
    },
    peerDiscussionSeconds: { type: Number, default: 60, min: 10, max: 300 },
    peerRevoteSeconds: { type: Number, default: 15, min: 5, max: 60 },
    recallFirstSeconds: { type: Number, enum: [0, 5, 10, 15], default: 0 },
    receiptsEnabled: { type: Boolean, default: true },
    autoNicknames: { type: Boolean, default: false },
    phoneOptionText: { type: String, enum: ['full', 'letters'], default: 'full' },
    finalLeaderboard: { type: String, enum: ['full', 'top10', 'self'], default: 'full' }
  },
  { _id: false, strict: false }
);

export const QuestionSchema = new Schema({
  type: { type: String, enum: ['mcq', 'truefalse', 'typein'], default: 'mcq' },
  questionText: { type: String, required: true, maxlength: 300 },
  options: {
    type: [{ type: String, maxlength: 120 }],
    validate: {
      validator: function(v) {
        const qType = this.type || 'mcq';
        if (qType === 'typein') return true;
        if (qType === 'truefalse') return Array.isArray(v) && v.length === 2;
        return Array.isArray(v) && v.length === 4 && new Set(v.map((s) => s.trim().toLowerCase())).size === 4;
      },
      message: 'Invalid options for question type.'
    }
  },
  correctIndex: { type: Number, default: 0, min: 0, max: 3 },
  distractorRationales: { type: [String], default: [] },
  sourceQuote: { type: String, maxlength: 200 },
  grounded: { type: Boolean, default: true },
  acceptedAnswers: { type: [String], default: [] },
  explanation: { type: String, required: true, maxlength: 400 }, // Concept Anchor
  topicTag: { type: String, default: 'General', maxlength: 40 },
  timeLimit: { type: Number, default: 20, min: 10, max: 120 } // seconds
});

export const QuizSchema = new Schema(
  {
    title: { type: String, required: true, maxlength: 100 },
    topic: { type: String, required: true, maxlength: 100 },
    description: { type: String, maxlength: 300 },
    sourceMaterial: { type: String, maxlength: 30000 },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard', 'mixed'], default: 'mixed' },
    defaultSettings: { type: GameSettingsSchema, default: () => ({}) },
    questions: {
      type: [QuestionSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length >= 1 && v.length <= 50,
        message: 'A quiz must have between 1 and 50 questions.'
      }
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true }
  },
  { timestamps: true }
);

export const Quiz = mongoose.model('Quiz', QuizSchema);
export default Quiz;
