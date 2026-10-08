import { describe, it, expect } from 'vitest';
import { sanitizeNickname } from '../src/utils/sanitize.js';

describe('Nickname Sanitization & Security', () => {
  it('strips < and > characters without mangling valid characters like & or quotes', () => {
    const res = sanitizeNickname('<b>Tom & Jerry</b>');
    expect(res.valid).toBe(true);
    expect(res.sanitized).toBe('bTom & Jerry/b');
    expect(res.sanitized).not.toContain('<');
    expect(res.sanitized).not.toContain('>');
    expect(res.sanitized).toContain('&');
  });

  it('removes zero-width and control characters', () => {
    const res = sanitizeNickname('Cool\u200B\u200CGamer\x00\x1F');
    expect(res.valid).toBe(true);
    expect(res.sanitized).toBe('CoolGamer');
  });

  it('collapses multiple whitespace and trims', () => {
    const res = sanitizeNickname('   Alex     Rivera   ');
    expect(res.valid).toBe(true);
    expect(res.sanitized).toBe('Alex Rivera');
  });

  it('rejects empty or whitespace-only nicknames', () => {
    const res = sanitizeNickname('    ');
    expect(res.valid).toBe(false);
    expect(res.error).toContain('cannot be empty');
  });

  it('enforces maximum length of 20 characters', () => {
    const res = sanitizeNickname('ThisNicknameIsWayTooLongForAClassroomGame');
    expect(res.valid).toBe(false);
    expect(res.error).toContain('20 characters');
  });

  it('allows innocent false-positive names containing profanity substrings', () => {
    const falsePositives = [
      'Dickinson',
      'Hancock',
      'Cockburn',
      'Scunthorpe',
      'Classic',
      'Analyst',
      'Essex'
    ];

    for (const name of falsePositives) {
      const res = sanitizeNickname(name);
      expect(res.valid).toBe(true);
      expect(res.sanitized).toBe(name);
    }
  });

  it('blocks real evasions (spacing, leetspeak, repeated letters, compound words)', () => {
    const evasions = [
      'f u c k',
      's h i t',
      'b1tch',
      'fuuuuuck',
      'SuperBitch',
      'asshole',
      '@$$hole',
      'b!tch',
      'f.u.c.k',
      's_h_i_t',
      'b-i-t-c-h',
      'fúck',
      'shït',
      'bítch',
      'c0ck',
      'd!ck',
      'p!ss',
      '5h1t',
      'f\u200Bu\u200Cc\u200Dk',
      's\uFEFFh\u200Bi\u200Ct',
      'MegaFuck',
      'MyAsshole'
    ];

    for (const evasion of evasions) {
      const res = sanitizeNickname(evasion);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('disallowed');
    }
  });

  it('disambiguates duplicate nicknames with (2), (3) suffixes', () => {
    const existing = ['Sarah', 'Sarah (2)', 'David'];
    const res = sanitizeNickname('sarah', existing);
    expect(res.valid).toBe(true);
    expect(res.sanitized).toBe('sarah (3)');
  });
});
