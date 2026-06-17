'use strict';
/**
 * Auth controller tests
 * Tests: login, signup, logout, /me, forgot-password, verify-otp, reset-password
 */

const request = require('supertest');
const express = require('express');

// Must be before requiring controllers (sets up mocks)
const { authHeader } = require('./setup');

const authRouter = require('../routes/auth');

// Mock bcrypt so we don't do real hashing
jest.mock('bcryptjs', () => ({
  hash:    jest.fn().mockResolvedValue('$hashed$'),
  compare: jest.fn().mockResolvedValue(true),
}));

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  sign:   jest.fn().mockReturnValue('fake.jwt.token'),
  verify: jest.fn().mockReturnValue({ id: 'user-001', role: 'managing_director' }),
}));

function makeAuthApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  return app;
}

const app = makeAuthApp();

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  beforeEach(() => dbMock.reset());

  test('returns 200 with tokens on valid credentials', async () => {
    dbMock.respond({
      rows: [{ id: 'user-001', email: 'warren@cs.com', full_name: 'Warren', role: 'managing_director', password_hash: '$hashed$', is_active: true }],
    });
    dbMock.respond({ rows: [] }); // refresh token insert

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'warren@cs.com', password: 'secret' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('access_token');
    expect(res.body).toHaveProperty('refresh_token');
    expect(res.body.user.role).toBe('managing_director');
  });

  test('returns 400 when email or password missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'warren@cs.com' });
    expect(res.status).toBe(400);
  });

  test('returns 401 when user not found', async () => {
    dbMock.respond({ rows: [] });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@cs.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  test('returns 403 when user is inactive', async () => {
    dbMock.respond({
      rows: [{ id: 'u1', email: 'x@cs.com', password_hash: '$hashed$', is_active: false, role: 'managing_director' }],
    });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'x@cs.com', password: 'secret' });
    expect(res.status).toBe(403);
  });
});

// ─── POST /api/auth/signup ────────────────────────────────────────────────────
// Signup is not public — only an authenticated MD may create new accounts.
describe('POST /api/auth/signup', () => {
  beforeEach(() => dbMock.reset());

  test('MD creates account — returns 201', async () => {
    dbMock.respond({ rows: [] });           // check existing user → none
    dbMock.respond({
      rows: [{ id: 'u-new', email: 'new@cs.com', full_name: 'New User', role: 'construction_coordinator', is_active: true }],
    });

    const res = await request(app)
      .post('/api/auth/signup')
      .set(authHeader('md'))
      .send({ email: 'new@cs.com', password: 'Pass123!', full_name: 'New User', role: 'construction_coordinator' });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('new@cs.com');
  });

  test('returns 400 when required fields missing', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .set(authHeader('md'))
      .send({ email: 'x@cs.com' });
    expect(res.status).toBe(400);
  });

  test('Accountant → 403 (only MD may create accounts)', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .set(authHeader('accountant'))
      .send({ email: 'x@cs.com', password: 'Pass123!', full_name: 'X', role: 'construction_coordinator' });
    expect(res.status).toBe(403);
  });

  test('Coordinator → 403 (only MD may create accounts)', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .set(authHeader('coordinator'))
      .send({ email: 'x@cs.com', password: 'Pass123!', full_name: 'X', role: 'construction_coordinator' });
    expect(res.status).toBe(403);
  });

  test('No auth → 401', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'x@cs.com', password: 'Pass123!', full_name: 'X', role: 'construction_coordinator' });
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
describe('GET /api/auth/me', () => {
  beforeEach(() => dbMock.reset());

  test('returns 401 with no token', async () => {
    // Real auth middleware would reject — but in tests auth is mocked.
    // This tests the DB query path (user not found → 401).
    dbMock.respond({ rows: [] });
    const jwt = require('jsonwebtoken');
    jwt.verify.mockImplementationOnce(() => { throw new Error('no token'); });

    const res = await request(app).get('/api/auth/me');
    expect([401, 403]).toContain(res.status);
  });

  test('returns user when token valid', async () => {
    dbMock.respond({
      rows: [{ id: 'u1', email: 'warren@cs.com', full_name: 'Warren', role: 'managing_director', is_active: true }],
    });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer fake.jwt.token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('user');
  });
});
