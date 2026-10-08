const ADJECTIVES = [
  'Clever', 'Swift', 'Bright', 'Brave', 'Kind', 'Calm', 'Merry', 'Wise',
  'Eager', 'Gentle', 'Curious', 'Quick', 'Bold', 'Friendly', 'Joyful',
  'Sunny', 'Quiet', 'Patient', 'Witty', 'Lucky', 'Keen', 'Spirited'
];

const ANIMALS = [
  'Otter', 'Falcon', 'Panda', 'Dolphin', 'Koala', 'Fox', 'Hawk', 'Owl',
  'Badger', 'Robin', 'Penguin', 'Gecko', 'Seal', 'Rabbit', 'Tiger',
  'Beaver', 'Lynx', 'Sparrow', 'Turtle', 'Cheetah', 'Bear', 'Finch'
];

export function generateFriendlyNickname(existingNames = []) {
  const existingSet = new Set(existingNames.map((n) => n.trim().toLowerCase()));
  for (let attempt = 0; attempt < 50; attempt++) {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    const candidate = `${adj} ${animal}`;
    if (!existingSet.has(candidate.toLowerCase())) {
      return candidate;
    }
  }
  // Fallback with number
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const num = Math.floor(10 + Math.random() * 89);
  return `${adj} ${animal} ${num}`;
}
