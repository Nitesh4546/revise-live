import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createExpressApp } from '../src/server.js';

describe('GET /api/health', () => {
  it('returns ok: true with status 200', async () => {
    const app = createExpressApp();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.aiMock).toBe('boolean');
  });
});
