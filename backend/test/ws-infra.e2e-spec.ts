import request from 'supertest';
import { createWsTestApp } from './helpers/ws-app';

describe('WebSocket infrastructure (e2e)', () => {
  it('boots the app with websocket adapter and keeps REST health available', async () => {
    const { app, url } = await createWsTestApp();

    try {
      expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
      await request(app.getHttpServer()).get('/api/health').expect(200);
    } finally {
      await app.close();
    }
  });
});
