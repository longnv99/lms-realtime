import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { setupSwagger } from '../src/swagger';
import { createTestApp } from './helpers/app';

describe('Swagger (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp(setupSwagger);
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves OpenAPI JSON for the REST API', async () => {
    const res = await request(app.getHttpServer()).get('/api/docs-json').expect(200);

    expect(res.body.info.title).toBe('LMS Realtime API');
    expect(res.body.paths['/api/auth/login']).toBeDefined();
    expect(res.body.paths['/api/courses']).toBeDefined();
    expect(res.body.components.securitySchemes['access-token']).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });
  });
});
