import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { registerAndLogin } from './helpers/auth';
import { cleanDatabase, prisma } from './helpers/db';

describe('Users (e2e)', () => {
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

  it('returns current user via GET /api/users/me', async () => {
    const auth = await registerAndLogin(app);

    const res = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      id: auth.userId,
      role: 'STUDENT',
    });
    expect(res.body.data.email).toEqual(expect.stringContaining('student-'));
    expect(res.body.data.passwordHash).toBeUndefined();
  });

  it('updates current user name via PATCH /api/users/me', async () => {
    const auth = await registerAndLogin(app);

    const res = await request(app.getHttpServer())
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ name: 'Updated Student' })
      .expect(200);

    expect(res.body.data).toMatchObject({
      id: auth.userId,
      name: 'Updated Student',
    });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: auth.userId } });
    expect(user.name).toBe('Updated Student');
  });

  it('forbids student from GET /api/users', async () => {
    const auth = await registerAndLogin(app);

    await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(403)
      .expect((res) => {
        expect(res.body.error.code).toBe('AUTH_FORBIDDEN');
      });
  });

  it('allows admin to list users with pagination meta', async () => {
    const admin = await registerAndLogin(app, 'ADMIN');
    await registerAndLogin(app, 'STUDENT');
    await registerAndLogin(app, 'INSTRUCTOR');

    const res = await request(app.getHttpServer())
      .get('/api/users?page=1&limit=2')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].passwordHash).toBeUndefined();
    expect(res.body.meta).toEqual({
      page: 1,
      limit: 2,
      total: 3,
    });
  });
});
