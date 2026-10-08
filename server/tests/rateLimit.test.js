import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createExpressApp } from '../src/server.js';
import { roomManager } from '../src/sockets/roomManager.js';
import { failedPinTracker } from '../src/middleware/rateLimit.js';

describe('Real-Classroom Rate Limiting (Part A2)', () => {
  let app;
  const testPin = '654321';

  beforeEach(() => {
    app = createExpressApp();
    failedPinTracker.reset();

    // Create a mock active room
    roomManager.rooms.set(testPin, {
      pin: testPin,
      status: 'LOBBY',
      locked: false,
      quiz: { title: 'Classroom Test Quiz', questions: [] },
      players: new Map()
    });
  });

  it('allows 300 successful lookups for a valid PIN from the same IP without throttling', async () => {
    for (let i = 0; i < 300; i++) {
      const res = await request(app)
        .get(`/api/rooms/${testPin}`)
        .set('X-Forwarded-For', '192.168.1.100');

      expect(res.status).toBe(200);
      expect(res.body.exists).toBe(true);
    }
  });

  it('throttles wrong-PIN brute force attempts after 100 failed guesses for untrusted IP', async () => {
    const wrongIp = '192.168.1.200';
    let failedCount = 0;
    let throttledCount = 0;

    for (let i = 0; i < 150; i++) {
      const res = await request(app)
        .get(`/api/rooms/999999`)
        .set('X-Forwarded-For', wrongIp);

      if (res.status === 200 && res.body.exists === false) {
        failedCount++;
      } else if (res.status === 429) {
        throttledCount++;
      }
    }

    // First 100 attempts record failure, remaining 50 attempts are throttled with 429
    expect(failedCount).toBe(100);
    expect(throttledCount).toBe(50);
  });

  it('provides a larger budget (500) for IPs with a recent successful join in the last 10 minutes', async () => {
    const schoolNatIp = '192.168.1.250';
    // Simulate a successful student join from this school NAT IP
    failedPinTracker.recordSuccessfulJoin(schoolNatIp);

    let failedCount = 0;
    let throttledCount = 0;

    // Send 150 failed guesses (which would normally throttle at 100)
    for (let i = 0; i < 150; i++) {
      const res = await request(app)
        .get(`/api/rooms/999999`)
        .set('X-Forwarded-For', schoolNatIp);

      if (res.status === 200 && res.body.exists === false) {
        failedCount++;
      } else if (res.status === 429) {
        throttledCount++;
      }
    }

    // All 150 failed attempts are absorbed under the trusted 500 budget without throttling
    expect(failedCount).toBe(150);
    expect(throttledCount).toBe(0);
  });
});
