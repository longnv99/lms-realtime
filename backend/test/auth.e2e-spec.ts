import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { cleanDatabase, prisma } from './helpers/db';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('registers a student and returns tokens without passwordHash', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'student@example.com', password: 'Password123!', name: 'Student One' })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.refreshToken).toEqual(expect.any(String));
    expect(res.body.data.user).toMatchObject({
      email: 'student@example.com',
      name: 'Student One',
      role: 'STUDENT',
    });
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('rejects invalid credentials', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'missing@example.com', password: 'Password123!' })
      .expect(401)
      .expect((res) => {
        expect(res.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
      });
  });

  it('rotates refresh tokens and rejects reuse', async () => {
    const registered = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'reuse@example.com', password: 'Password123!', name: 'Reuse User' })
      .expect(201);

    const oldRefresh = registered.body.data.refreshToken;
    const refreshed = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: oldRefresh })
      .expect(201);

    expect(refreshed.body.data.refreshToken).not.toBe(oldRefresh);

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: oldRefresh })
      .expect(401)
      .expect((res) => {
        expect(res.body.error.code).toBe('AUTH_REFRESH_REUSED');
      });

    const activeTokens = await prisma.refreshToken.findMany({ where: { revokedAt: null } });
    expect(activeTokens).toHaveLength(0);
  });
});
