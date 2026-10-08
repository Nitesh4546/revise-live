/**
 * Fisher-Yates array shuffle (pure function, returns new array)
 */
export function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Shuffles 4 options and updates the correctIndex accordingly
 * Permutes distractorRationales alongside options so each wrong option keeps its misconception label.
 * To eliminate LLM positional bias (e.g. LLMs defaulting to option 0 or 1).
 */
export function shuffleQuestionOptions(options, correctIndex, distractorRationales = null) {
  if (!Array.isArray(options) || options.length !== 4) {
    throw new Error('Options array must have exactly 4 items');
  }
  if (typeof correctIndex !== 'number' || correctIndex < 0 || correctIndex > 3) {
    throw new Error('correctIndex must be between 0 and 3');
  }

  const indexed = options.map((opt, idx) => ({
    text: opt,
    isCorrect: idx === correctIndex,
    rationale: (distractorRationales && distractorRationales[idx]) ? distractorRationales[idx] : ''
  }));

  const shuffled = shuffleArray(indexed);
  const newCorrectIndex = shuffled.findIndex((item) => item.isCorrect);

  const res = {
    options: shuffled.map((item) => item.text),
    correctIndex: newCorrectIndex
  };

  if (distractorRationales) {
    const rationales = shuffled.map((item) => item.rationale);
    rationales[newCorrectIndex] = '';
    res.distractorRationales = rationales;
  }

  return res;
}
