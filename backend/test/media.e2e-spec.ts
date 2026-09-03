import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { EnvelopeInterceptor } from '../src/common/interceptors/envelope.interceptor';
import { S3StorageService } from '../src/media/s3-storage.service';
import { registerAndLogin } from './helpers/auth';
import { cleanDatabase, prisma } from './helpers/db';

const TWO_GB = 2 * 1024 * 1024 * 1024;

describe('Media uploads (e2e)', () => {
  let app: INestApplication;
  const s3Storage = {
    createUploadUrl: jest.fn(),
    createPlaybackUrl: jest.fn(),
    headObject: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(S3StorageService)
      .useValue(s3Storage)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new EnvelopeInterceptor());
    await app.init();
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    s3Storage.createUploadUrl.mockResolvedValue('http://localhost:9000/lms-media/upload');
    s3Storage.createPlaybackUrl.mockResolvedValue('http://localhost:9000/lms-media/playback');
    await cleanDatabase();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('allows instructors to create a presigned video upload', async () => {
    const instructor = await registerAndLogin(app, 'INSTRUCTOR');

    const res = await request(app.getHttpServer())
      .post('/api/media/uploads')
      .set('Authorization', `Bearer ${instructor.accessToken}`)
      .send({
        fileName: 'lesson-intro.mp4',
        contentType: 'video/mp4',
        sizeBytes: 1_024_000,
      })
      .expect(201);

    expect(res.body.data).toMatchObject({
      assetId: expect.any(String),
      key: expect.stringMatching(/^videos\/.+\.mp4$/),
      uploadUrl: 'http://localhost:9000/lms-media/upload',
      expiresInSeconds: 900,
    });
    expect(s3Storage.createUploadUrl).toHaveBeenCalledWith(res.body.data.key, 'video/mp4');
  });

  it('rejects unsupported upload content types', async () => {
    const instructor = await registerAndLogin(app, 'INSTRUCTOR');

    await request(app.getHttpServer())
      .post('/api/media/uploads')
      .set('Authorization', `Bearer ${instructor.accessToken}`)
      .send({
        fileName: 'slides.pdf',
        contentType: 'application/pdf',
        sizeBytes: 2000,
      })
      .expect(400)
      .expect((res) => {
        expect(res.body.error.code).toBe('MEDIA_INVALID_TYPE');
      });
  });

  it('rejects uploads larger than 2GB', async () => {
    const instructor = await registerAndLogin(app, 'INSTRUCTOR');

    await request(app.getHttpServer())
      .post('/api/media/uploads')
      .set('Authorization', `Bearer ${instructor.accessToken}`)
      .send({
        fileName: 'long-session.webm',
        contentType: 'video/webm',
        sizeBytes: TWO_GB + 1,
      })
      .expect(413)
      .expect((res) => {
        expect(res.body.error.code).toBe('MEDIA_TOO_LARGE');
      });
  });

  it('rejects complete when uploaded object metadata does not match', async () => {
    const instructor = await registerAndLogin(app, 'INSTRUCTOR');
    const asset = await prisma.mediaAsset.create({
      data: {
        key: 'videos/manual.mp4',
        fileName: 'manual.mp4',
        contentType: 'video/mp4',
        sizeBytes: 10_000,
      },
    });
    s3Storage.headObject.mockResolvedValue({
      contentLength: 9999,
      contentType: 'video/mp4',
    });

    await request(app.getHttpServer())
      .post(`/api/media/uploads/${asset.id}/complete`)
      .set('Authorization', `Bearer ${instructor.accessToken}`)
      .send({})
      .expect(400)
      .expect((res) => {
        expect(res.body.error.code).toBe('MEDIA_SIZE_MISMATCH');
      });
  });

  it('marks a media asset uploaded when object metadata matches', async () => {
    const instructor = await registerAndLogin(app, 'INSTRUCTOR');
    const asset = await prisma.mediaAsset.create({
      data: {
        key: 'videos/ready.webm',
        fileName: 'ready.webm',
        contentType: 'video/webm',
        sizeBytes: 20_000,
      },
    });
    s3Storage.headObject.mockResolvedValue({
      contentLength: 20_000,
      contentType: 'video/webm',
    });

    const res = await request(app.getHttpServer())
      .post(`/api/media/uploads/${asset.id}/complete`)
      .set('Authorization', `Bearer ${instructor.accessToken}`)
      .send({})
      .expect(201);

    expect(res.body.data).toMatchObject({
      id: asset.id,
      status: 'UPLOADED',
    });
  });

  it('returns playback URLs only for uploaded media assets', async () => {
    const student = await registerAndLogin(app, 'STUDENT');
    const pending = await prisma.mediaAsset.create({
      data: {
        key: 'videos/pending.mp4',
        fileName: 'pending.mp4',
        contentType: 'video/mp4',
        sizeBytes: 15_000,
      },
    });

    await request(app.getHttpServer())
      .get(`/api/media/assets/${pending.id}/playback`)
      .set('Authorization', `Bearer ${student.accessToken}`)
      .expect(400)
      .expect((res) => {
        expect(res.body.error.code).toBe('LESSON_MEDIA_NOT_READY');
      });

    const uploaded = await prisma.mediaAsset.update({
      where: { id: pending.id },
      data: { status: 'UPLOADED' },
    });

    const res = await request(app.getHttpServer())
      .get(`/api/media/assets/${uploaded.id}/playback`)
      .set('Authorization', `Bearer ${student.accessToken}`)
      .expect(200);

    expect(res.body.data).toEqual({
      assetId: uploaded.id,
      playbackUrl: 'http://localhost:9000/lms-media/playback',
      expiresInSeconds: 1800,
    });
    expect(s3Storage.createPlaybackUrl).toHaveBeenCalledWith(uploaded.key);
  });
});
