'use strict';
/**
 * Users (account administration) controller tests
 * Tests: listUsers, createUser, updateUser
 * Access: Managing Director only — Accountant/Coordinator → 403, no token → 401.
 */

const request = require('supertest');
const { makeApp, authHeader, dbMock } = require('./setup');

const usersRouter = require('../routes/users');
const app = makeApp(['/api/users', usersRouter]);

// bcrypt is real here unless mocked — mock it to keep tests fast/deterministic
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('$hashed$'),
}));

beforeEach(() => dbMock.reset());

// ─── GET /api/users ───────────────────────────────────────────────────────────
describe('GET /api/users', () => {
  test('MD lists accounts — 200', async () => {
    dbMock.respond([
      { id: 'u1', email: 'warren@cs.com', full_name: 'Warren Lever', role: 'managing_director', is_active: true, created_at: '2026-01-01', updated_at: '2026-01-01' },
    ]);
    const res = await request(app).get('/api/users').set(authHeader('md'));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).not.toHaveProperty('password_hash');
  });

  test('Accountant → 403', async () => {
    const res = await request(app).get('/api/users').set(authHeader('accountant'));
    expect(res.status).toBe(403);
  });

  test('Coordinator → 403', async () => {
    const res = await request(app).get('/api/users').set(authHeader('coordinator'));
    expect(res.status).toBe(403);
  });

  test('No auth → 401', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/users ──────────────────────────────────────────────────────────
describe('POST /api/users', () => {
  const validBody = {
    email: 'sarah@cs.com', password: 'Pass1234', full_name: 'Sarah Thompson', role: 'construction_accountant',
  };

  test('MD creates account — 201', async () => {
    dbMock.respond([]);  // no existing user with that email
    dbMock.respond([{ id: 'u-new', email: 'sarah@cs.com', full_name: 'Sarah Thompson', role: 'construction_accountant', is_active: true, created_at: '2026-01-01' }]);

    const res = await request(app)
      .post('/api/users')
      .set(authHeader('md'))
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('sarah@cs.com');
  });

  test('Accountant → 403', async () => {
    const res = await request(app).post('/api/users').set(authHeader('accountant')).send(validBody);
    expect(res.status).toBe(403);
  });

  test('Coordinator → 403', async () => {
    const res = await request(app).post('/api/users').set(authHeader('coordinator')).send(validBody);
    expect(res.status).toBe(403);
  });

  test('No auth → 401', async () => {
    const res = await request(app).post('/api/users').send(validBody);
    expect(res.status).toBe(401);
  });

  test('Missing fields → 400', async () => {
    const res = await request(app).post('/api/users').set(authHeader('md')).send({ email: 'x@cs.com' });
    expect(res.status).toBe(400);
  });

  test('Invalid role → 400', async () => {
    const res = await request(app)
      .post('/api/users')
      .set(authHeader('md'))
      .send({ ...validBody, role: 'super_admin' });
    expect(res.status).toBe(400);
  });

  test('Password too short → 400', async () => {
    const res = await request(app)
      .post('/api/users')
      .set(authHeader('md'))
      .send({ ...validBody, password: 'short' });
    expect(res.status).toBe(400);
  });

  test('Duplicate email → 409', async () => {
    dbMock.respond([{ id: 'existing' }]);
    const res = await request(app).post('/api/users').set(authHeader('md')).send(validBody);
    expect(res.status).toBe(409);
  });
});

// ─── PATCH /api/users/:id ─────────────────────────────────────────────────────
describe('PATCH /api/users/:id', () => {
  test('MD updates another user\'s role — 200', async () => {
    dbMock.respond([{ id: 'u2' }]);  // existing check
    dbMock.respond([{ id: 'u2', email: 'sarah@cs.com', full_name: 'Sarah Thompson', role: 'construction_coordinator', is_active: true, created_at: '2026-01-01', updated_at: '2026-01-01' }]);

    const res = await request(app)
      .patch('/api/users/u2')
      .set(authHeader('md'))
      .send({ role: 'construction_coordinator' });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('construction_coordinator');
  });

  test('Accountant → 403', async () => {
    const res = await request(app).patch('/api/users/u2').set(authHeader('accountant')).send({ role: 'managing_director' });
    expect(res.status).toBe(403);
  });

  test('Coordinator → 403', async () => {
    const res = await request(app).patch('/api/users/u2').set(authHeader('coordinator')).send({ role: 'managing_director' });
    expect(res.status).toBe(403);
  });

  test('No auth → 401', async () => {
    const res = await request(app).patch('/api/users/u2').send({ role: 'managing_director' });
    expect(res.status).toBe(401);
  });

  test('User not found → 404', async () => {
    dbMock.respond([]);
    const res = await request(app).patch('/api/users/bad-id').set(authHeader('md')).send({ full_name: 'X' });
    expect(res.status).toBe(404);
  });

  test('MD cannot demote own role away from managing_director → 400', async () => {
    const res = await request(app)
      .patch(`/api/users/${require('./setup').USERS.md.id}`)
      .set(authHeader('md'))
      .send({ role: 'construction_accountant' });
    expect(res.status).toBe(400);
  });

  test('MD cannot deactivate own account → 400', async () => {
    const res = await request(app)
      .patch(`/api/users/${require('./setup').USERS.md.id}`)
      .set(authHeader('md'))
      .send({ is_active: false });
    expect(res.status).toBe(400);
  });
});
