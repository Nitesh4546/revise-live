import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createExpressApp } from '../src/server.js';
import { setupTestDB, teardownTestDB, clearTestDB } from './setup.js';

describe('Auth REST API', () => {
  let app;

  beforeAll(async () => {
    await setupTestDB();
    app = createExpressApp();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  it('registers a new user successfully', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Alice Teacher',
      email: 'alice@school.edu',
      password: 'password123'
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe('alice@school.edu');
    expect(res.body.user.name).toBe('Alice Teacher');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects registration with duplicate email', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Alice Teacher',
      email: 'alice@school.edu',
      password: 'password123'
    });

    const res = await request(app).post('/api/auth/register').send({
      name: 'Alice Clone',
      email: 'alice@school.edu',
      password: 'password456'
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('USER_EXISTS');
  });

  it('validates minimum password length', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Bob',
      email: 'bob@school.edu',
      password: 'short'
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('logs in an existing user and rejects wrong credentials', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Bob Teacher',
      email: 'bob@school.edu',
      password: 'password123'
    });

    // Valid login
    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'bob@school.edu',
      password: 'password123'
    });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeDefined();
    expect(loginRes.body.user.email).toBe('bob@school.edu');

    // Wrong password
    const wrongRes = await request(app).post('/api/auth/login').send({
      email: 'bob@school.edu',
      password: 'wrongpassword'
    });
    expect(wrongRes.status).toBe(401);
    expect(wrongRes.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('retrieves current user profile via /api/auth/me with Bearer token', async () => {
    const regRes = await request(app).post('/api/auth/register').send({
      name: 'Charlie Teacher',
      email: 'charlie@school.edu',
      password: 'password123'
    });

    const token = regRes.body.token;

    // With token
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe('charlie@school.edu');

    // Without token
    const unauthRes = await request(app).get('/api/auth/me');
    expect(unauthRes.status).toBe(401);
    expect(unauthRes.body.error.code).toBe('UNAUTHORIZED');
  });

  describe('User Preferences & Theme Persistence', () => {
    it('returns default preferences { theme: "system" } upon registration, login, and getMe', async () => {
      const regRes = await request(app).post('/api/auth/register').send({
        name: 'Dana Teacher',
        email: 'dana@school.edu',
        password: 'password123'
      });
      expect(regRes.status).toBe(201);
      expect(regRes.body.user.preferences).toEqual({ theme: 'system' });

      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'dana@school.edu',
        password: 'password123'
      });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.user.preferences).toEqual({ theme: 'system' });

      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${loginRes.body.token}`);
      expect(meRes.status).toBe(200);
      expect(meRes.body.user.preferences).toEqual({ theme: 'system' });
    });

    it('updates theme preference via PATCH /api/auth/preferences', async () => {
      const regRes = await request(app).post('/api/auth/register').send({
        name: 'Evan Teacher',
        email: 'evan@school.edu',
        password: 'password123'
      });
      const token = regRes.body.token;

      // Update to dark
      const patchDark = await request(app)
        .patch('/api/auth/preferences')
        .set('Authorization', `Bearer ${token}`)
        .send({ theme: 'dark' });
      expect(patchDark.status).toBe(200);
      expect(patchDark.body.preferences.theme).toBe('dark');

      // Verify in /me
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(meRes.body.user.preferences.theme).toBe('dark');

      // Update to light
      const patchLight = await request(app)
        .patch('/api/auth/preferences')
        .set('Authorization', `Bearer ${token}`)
        .send({ theme: 'light' });
      expect(patchLight.status).toBe(200);
      expect(patchLight.body.preferences.theme).toBe('light');
    });

    it('rejects invalid theme values and unauthenticated requests', async () => {
      const regRes = await request(app).post('/api/auth/register').send({
        name: 'Fiona Teacher',
        email: 'fiona@school.edu',
        password: 'password123'
      });
      const token = regRes.body.token;

      // Invalid theme
      const invalidRes = await request(app)
        .patch('/api/auth/preferences')
        .set('Authorization', `Bearer ${token}`)
        .send({ theme: 'neon' });
      expect(invalidRes.status).toBe(400);

      // Unauthenticated
      const unauthRes = await request(app)
        .patch('/api/auth/preferences')
        .send({ theme: 'dark' });
      expect(unauthRes.status).toBe(401);
    });
  });
});
