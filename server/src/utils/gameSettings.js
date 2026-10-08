import { z } from 'zod';

export const gameSettingsZodSchema = z.object({
  scoringMode: z.enum(['speed', 'accuracy']).default('accuracy'),
  leaderboardMode: z.enum(['competitive', 'classMeter', 'hidden', 'off']).default('off'),
  leaderboardBetweenQuestions: z.boolean().default(false),
  classTarget: z.number().optional(),
  confidenceScoring: z.boolean().default(true),
  peerInstruction: z.enum(['off', 'suggest', 'auto']).default('suggest'),
  peerInstructionBounds: z
    .object({
      min: z.number().min(0).max(100).default(30),
      max: z.number().min(0).max(100).default(70)
    })
    .default({ min: 30, max: 70 }),
  peerDiscussionSeconds: z.number().min(10).max(300).default(60),
  peerRevoteSeconds: z.number().min(5).max(60).default(15),
  recallFirstSeconds: z.number().default(0),
  receiptsEnabled: z.boolean().default(true),
  autoNicknames: z.boolean().default(false),
  phoneOptionText: z.enum(['full', 'letters']).default('full'),
  finalLeaderboard: z.enum(['full', 'top10', 'self']).default('full')
});

export const PRESETS = {
  revision: {
    id: 'revision',
    name: 'Revision',
    description: 'Pedagogy-first: Accuracy scoring, confidence calibration, peer instruction, and retesting.',
    settings: {
      scoringMode: 'accuracy',
      leaderboardMode: 'off',
      leaderboardBetweenQuestions: false,
      confidenceScoring: true,
      peerInstruction: 'suggest',
      peerInstructionBounds: { min: 30, max: 70 },
      peerDiscussionSeconds: 60,
      peerRevoteSeconds: 15,
      recallFirstSeconds: 0,
      receiptsEnabled: true,
      autoNicknames: false,
      phoneOptionText: 'full',
      finalLeaderboard: 'full'
    }
  },
  quickFun: {
    id: 'quickFun',
    name: 'Quick Fun',
    description: 'High energy: Speed scoring, competitive podium & top-5 leaderboard.',
    settings: {
      scoringMode: 'speed',
      leaderboardMode: 'competitive',
      leaderboardBetweenQuestions: true,
      confidenceScoring: false,
      peerInstruction: 'off',
      peerInstructionBounds: { min: 30, max: 70 },
      peerDiscussionSeconds: 60,
      peerRevoteSeconds: 15,
      recallFirstSeconds: 0,
      receiptsEnabled: true,
      autoNicknames: false,
      phoneOptionText: 'full',
      finalLeaderboard: 'full'
    }
  },
  examPrep: {
    id: 'examPrep',
    name: 'Exam Prep',
    description: 'Rigorous recall: Accuracy scoring, recall-first delay (5s), and confidence calibration.',
    settings: {
      scoringMode: 'accuracy',
      leaderboardMode: 'off',
      leaderboardBetweenQuestions: false,
      confidenceScoring: true,
      peerInstruction: 'off',
      peerInstructionBounds: { min: 30, max: 70 },
      peerDiscussionSeconds: 60,
      peerRevoteSeconds: 15,
      recallFirstSeconds: 5,
      receiptsEnabled: true,
      autoNicknames: false,
      phoneOptionText: 'full',
      finalLeaderboard: 'full'
    }
  }
};

export const DEFAULT_SETTINGS = PRESETS.revision.settings;

export function resolveSettings(providedSettings = {}, quizDefaults = {}) {
  const merged = {
    ...DEFAULT_SETTINGS,
    ...(quizDefaults || {}),
    ...(providedSettings || {}),
    peerInstructionBounds: {
      ...DEFAULT_SETTINGS.peerInstructionBounds,
      ...(quizDefaults?.peerInstructionBounds || {}),
      ...(providedSettings?.peerInstructionBounds || {})
    }
  };

  // Migration: map legacy 'classMeter' to default 'off'
  if (merged.leaderboardMode === 'classMeter') {
    merged.leaderboardMode = 'off';
  }

  // Handle opt-in leaderboardBetweenQuestions toggle
  if (providedSettings?.leaderboardBetweenQuestions !== undefined) {
    merged.leaderboardBetweenQuestions = !!providedSettings.leaderboardBetweenQuestions;
    merged.leaderboardMode = merged.leaderboardBetweenQuestions ? 'competitive' : 'off';
  } else if (quizDefaults?.leaderboardBetweenQuestions !== undefined) {
    merged.leaderboardBetweenQuestions = !!quizDefaults.leaderboardBetweenQuestions;
    merged.leaderboardMode = merged.leaderboardBetweenQuestions ? 'competitive' : 'off';
  } else {
    merged.leaderboardBetweenQuestions = merged.leaderboardMode === 'competitive';
  }

  // Validate phoneOptionText
  if (!['full', 'letters'].includes(merged.phoneOptionText)) {
    merged.phoneOptionText = 'full';
  }

  // Validate finalLeaderboard
  if (!['full', 'top10', 'self'].includes(merged.finalLeaderboard)) {
    merged.finalLeaderboard = 'full';
  }

  // Remove classTarget if present
  delete merged.classTarget;
  delete merged.classMeter;

  return merged;
}

