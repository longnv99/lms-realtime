import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';

describe('Health endpoint (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/health returns 200 with {success: true, data: {status: "ok"}}', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((res: request.Response) => {
        expect(res.body.success).toBe(true);
        expect(res.body.data.status).toBe('ok');
        expect(typeof res.body.data.uptimeSeconds).toBe('number');
        expect(typeof res.body.data.timestamp).toBe('string');
        expect(res.body.error).toBeNull();
      });
  });

  it('GET /api/health returns envelope shape with meta=null', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((res: request.Response) => {
        expect(res.body).toHaveProperty('success');
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('error');
        expect(res.body).toHaveProperty('meta');
      });
  });

  it('GET /api/unknown returns 404 with envelope error', () => {
    return request(app.getHttpServer())
      .get('/api/unknown')
      .expect(404)
      .expect((res: request.Response) => {
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('NOT_FOUND');
        expect(res.body.data).toBeNull();
      });
  });
});
