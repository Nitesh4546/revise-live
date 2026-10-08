import crypto from 'crypto';

/**
 * Generates a 6-digit numeric PIN string (100000 - 999999).
 * Checks against existing PINs to guarantee collision-free generation.
 */
export function generatePin(existingPins = new Set()) {
  const maxAttempts = 10000;
  for (let i = 0; i < maxAttempts; i++) {
    const num = crypto.randomInt(100000, 1000000);
    const pin = num.toString();
    if (!existingPins.has(pin)) {
      return pin;
    }
  }
  throw new Error('Unable to generate unique PIN: room capacity reached');
}
