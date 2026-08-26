import request from 'supertest';
import type { INestApplication } from '@nestjs/common';

export async function registerAndLogin(
  app: INestApplication,
  role: 'ADMIN' | 'INSTRUCTOR' | 'STUDENT' = 'STUDENT',
): Promise<{ accessToken: string; refreshToken: string; userId: string }> {
  const email = `${role.toLowerCase()}-${Date.now()}-${Math.random()}@example.com`;
  const registered = await request(app.getHttpServer())
    .post('/api/auth/register')
    .send({ email, password: 'Password123!', name: `${role} User` })
    .expect(201);

  if (role !== 'STUDENT') {
    await import('./db').then(({ prisma }) =>
      prisma.user.update({ where: { id: registered.body.data.user.id }, data: { role } }),
    );
  }

  const loggedIn = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password: 'Password123!' })
    .expect(201);

  return {
    accessToken: loggedIn.body.data.accessToken,
    refreshToken: loggedIn.body.data.refreshToken,
    userId: registered.body.data.user.id,
  };
}
