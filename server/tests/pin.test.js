import { describe, it, expect } from 'vitest';
import { generatePin } from '../src/utils/pin.js';

describe('PIN Generation', () => {
  it('generates a 6-digit numeric string', () => {
    const pin = generatePin();
    expect(pin).toMatch(/^[0-9]{6}$/);
    expect(pin.length).toBe(6);
  });

  it('avoids collision with existing active PINs', () => {
    const existing = new Set(['123456', '654321', '999999']);
    const pin = generatePin(existing);
    expect(existing.has(pin)).toBe(false);
  });
});
