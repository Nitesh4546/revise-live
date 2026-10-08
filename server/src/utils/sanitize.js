/**
 * Configurable severe substring list - terms that have zero legitimate occurrences
 * as substrings in common English words or surnames.
 */
export const SEVERE_SUBSTRING_LIST = ['nigger', 'nigga', 'faggot'];

/**
 * Whole-word profanity denylist - terms that are profane on their own,
 * but appear legitimately inside innocent words/surnames (e.g. Hancock, Dickinson, Scunthorpe, Classic).
 */
export const WHOLE_WORD_LIST = [
  'damn',
  'hell',
  'bastard',
  'ass',
  'asshole',
  'bitch',
  'crap',
  'dick',
  'cock',
  'piss',
  'fuck',
  'fucking',
  'shit',
  'cunt',
  'slut',
  'whore'
];

/**
 * Normalizes input text to neutralize common evasions:
 * - Lowercases and strips diacritics
 * - Converts common leetspeak substitutions
 * - Collapses 3+ repeated characters
 */
export function normalizeForProfanity(str) {
  if (!str) return '';

  // Lowercase & strip diacritics
  let norm = str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Leetspeak character mapping
  const leetMap = {
    '@': 'a',
    '4': 'a',
    '$': 's',
    '5': 's',
    '1': 'i',
    '!': 'i',
    '0': 'o',
    '3': 'e',
    '7': 't',
    '8': 'b',
    '+': 't'
  };

  norm = norm
    .split('')
    .map((ch) => leetMap[ch] || ch)
    .join('');

  // Collapse 3 or more consecutive identical characters into 1
  norm = norm.replace(/(.)\1{2,}/g, '$1');

  return norm;
}

/**
 * Checks if a normalized string contains profanities, distinguishing
 * severe non-benign substrings from whole-word occurrences.
 */
export function hasProfanity(
  rawName,
  wholeWordList = WHOLE_WORD_LIST,
  severeList = SEVERE_SUBSTRING_LIST
) {
  const norm = normalizeForProfanity(rawName);

  // 1. Severe substring check (e.g. slurs that never appear in benign words)
  const compactNorm = norm.replace(/[^a-z0-9]/g, '');
  for (const severe of severeList) {
    if (compactNorm.includes(severe)) {
      return true;
    }
  }

  // 2. Tokenize by whitespace, punctuation, and camelCase boundaries
  // Split camelCase (e.g. SuperBitch -> Super Bitch)
  const camelSplit = rawName.replace(/([a-z])([A-Z])/g, '$1 $2');
  const normalizedWords = normalizeForProfanity(camelSplit);
  const tokens = normalizedWords.split(/[^a-z0-9]+/).filter(Boolean);

  const wholeWordSet = new Set(wholeWordList.map((w) => w.toLowerCase()));

  for (const token of tokens) {
    if (wholeWordSet.has(token)) {
      return true;
    }
  }

  // 3. Check spaced single-letter evasions (e.g. "f u c k", "s h i t")
  const singleLetters = tokens.filter((t) => t.length === 1);
  if (singleLetters.length >= 3 && singleLetters.length === tokens.length) {
    const joined = singleLetters.join('');
    if (wholeWordSet.has(joined)) {
      return true;
    }
  }

  return false;
}

/**
 * Sanitizes and validates player nickname.
 * - Strips `<>`, zero-width and control characters.
 * - Does NOT HTML-escape on storage (React auto-escapes; preserves e.g. "Tom & Jerry").
 * - Runs normalized profanity check with whole-word matching.
 * - Disambiguates duplicate names with "Sarah (2)" suffixes.
 */
export function sanitizeNickname(
  rawName,
  existingNames = [],
  options = {}
) {
  if (typeof rawName !== 'string') {
    return { valid: false, error: 'Nickname must be a string' };
  }

  // Remove zero-width characters (ZWSP, ZWNJ, etc.) and ASCII control characters
  let cleaned = rawName
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '');

  // Strip ONLY `<` and `>` (prevents script injection, preserves &, ", ', etc.)
  cleaned = cleaned.replace(/[<>]/g, '');

  // Collapse consecutive whitespaces and trim
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // Validate length 1–20
  if (cleaned.length < 1) {
    return { valid: false, error: 'Nickname cannot be empty' };
  }
  if (cleaned.length > 20) {
    return { valid: false, error: 'Nickname must be 20 characters or fewer' };
  }

  // Check profanities using configurable lists
  const wholeWords = options.wholeWordList || WHOLE_WORD_LIST;
  const severeWords = options.severeList || SEVERE_SUBSTRING_LIST;

  if (hasProfanity(cleaned, wholeWords, severeWords)) {
    return { valid: false, error: 'Nickname contains disallowed words' };
  }

  // Duplicate suffix disambiguation: "Sarah (2)", "Sarah (3)"
  const normalizedExisting = (existingNames || []).map((n) => n.trim().toLowerCase());
  let candidate = cleaned;
  let counter = 2;

  while (normalizedExisting.includes(candidate.toLowerCase())) {
    candidate = `${cleaned} (${counter})`;
    counter++;
  }

  return { valid: true, sanitized: candidate };
}
