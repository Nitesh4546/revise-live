import { describe, it, expect } from 'vitest';
import { shuffleQuestionOptions } from '../src/utils/shuffle.js';

describe('shuffleQuestionOptions with distractorRationales (C1)', () => {
  it('correctly permutes options and distractorRationales together, keeping correctIndex matched', () => {
    const options = ['Correct Option', 'Distractor A', 'Distractor B', 'Distractor C'];
    const correctIndex = 0;
    const distractorRationales = ['', 'Rationale for A', 'Rationale for B', 'Rationale for C'];

    for (let i = 0; i < 20; i++) {
      const result = shuffleQuestionOptions(options, correctIndex, distractorRationales);

      expect(result.options).toHaveLength(4);
      expect(result.distractorRationales).toHaveLength(4);

      // The correct option should be at new correctIndex
      expect(result.options[result.correctIndex]).toBe('Correct Option');
      // The rationale at correctIndex must be empty string
      expect(result.distractorRationales[result.correctIndex]).toBe('');

      // Check that each distractor still has its matched rationale
      for (let j = 0; j < 4; j++) {
        const opt = result.options[j];
        const rat = result.distractorRationales[j];
        if (opt === 'Distractor A') expect(rat).toBe('Rationale for A');
        if (opt === 'Distractor B') expect(rat).toBe('Rationale for B');
        if (opt === 'Distractor C') expect(rat).toBe('Rationale for C');
      }
    }
  });

  it('works backwards-compatibly when distractorRationales is omitted', () => {
    const options = ['A', 'B', 'C', 'D'];
    const result = shuffleQuestionOptions(options, 2);
    expect(result.options[result.correctIndex]).toBe('C');
  });
});
