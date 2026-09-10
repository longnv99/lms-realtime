import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { registerAndLogin } from './helpers/auth';
import { cleanDatabase, prisma } from './helpers/db';

describe('Lesson transcripts (e2e)', () => {
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

  it('returns transcript cues for an enrolled learner', async () => {
    const { lessonId, studentToken } = await createLessonTranscriptsFixture();

    await request(app.getHttpServer())
      .get(`/api/lessons/${lessonId}/transcript`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.lessonId).toBe(lessonId);
        expect(body.data.cues.length).toBeGreaterThan(0);
        expect(body.data.cues[0]).toMatchObject({
          startSeconds: expect.any(Number),
          endSeconds: expect.any(Number),
          text: expect.any(String),
        });
      });
  });

  it('lets an instructor replace transcript cues for their lesson', async () => {
    const { lessonId, instructorToken } = await createLessonTranscriptsFixture();

    await request(app.getHttpServer())
      .put(`/api/lessons/${lessonId}/transcript`)
      .set('Authorization', `Bearer ${instructorToken}`)
      .send({
        cues: [
          { startSeconds: 0, endSeconds: 12, text: 'Welcome to the realtime LMS lesson.' },
          {
            startSeconds: 12,
            endSeconds: 30,
            text: 'We will connect progress, chat, and quizzes.',
          },
        ],
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.cues).toHaveLength(2);
        expect(body.data.cues[1].order).toBe(2);
      });

    const persistedCues = await prisma.lessonTranscriptCue.findMany({
      where: { lessonId },
      orderBy: { order: 'asc' },
      select: { order: true, startSeconds: true, text: true },
    });

    expect(persistedCues).toEqual([
      { order: 1, startSeconds: 0, text: 'Welcome to the realtime LMS lesson.' },
      { order: 2, startSeconds: 12, text: 'We will connect progress, chat, and quizzes.' },
    ]);
  });

  it('rejects transcript reads outside a student enrollment', async () => {
    const { studentToken, unavailableLessonId } = await createLessonTranscriptsFixture();

    await request(app.getHttpServer())
      .get(`/api/lessons/${unavailableLessonId}/transcript`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(403);
  });

  it('rejects transcript replacement by students', async () => {
    const { lessonId, studentToken } = await createLessonTranscriptsFixture();

    await request(app.getHttpServer())
      .put(`/api/lessons/${lessonId}/transcript`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        cues: [{ startSeconds: 0, endSeconds: 12, text: 'Welcome to the realtime LMS lesson.' }],
      })
      .expect(403);
  });

  it('rejects invalid transcript cue payloads', async () => {
    const { instructorToken, lessonId } = await createLessonTranscriptsFixture();

    await request(app.getHttpServer())
      .put(`/api/lessons/${lessonId}/transcript`)
      .set('Authorization', `Bearer ${instructorToken}`)
      .send({
        cues: [{ startSeconds: 0, endSeconds: 12, text: '   ' }],
      })
      .expect(400);

    await request(app.getHttpServer())
      .put(`/api/lessons/${lessonId}/transcript`)
      .set('Authorization', `Bearer ${instructorToken}`)
      .send({
        cues: [{ startSeconds: 12, endSeconds: 12, text: 'Cue timing must move forward.' }],
      })
      .expect(400);

    await request(app.getHttpServer())
      .put(`/api/lessons/${lessonId}/transcript`)
      .set('Authorization', `Bearer ${instructorToken}`)
      .send({
        cues: [{ startSeconds: 295, endSeconds: 301, text: 'Cue cannot exceed duration.' }],
      })
      .expect(400);
  });

  it('validates transcript cue text after trimming', async () => {
    const { instructorToken, lessonId } = await createLessonTranscriptsFixture();
    const maxLengthText = 'x'.repeat(1000);

    await request(app.getHttpServer())
      .put(`/api/lessons/${lessonId}/transcript`)
      .set('Authorization', `Bearer ${instructorToken}`)
      .send({
        cues: [{ startSeconds: 0, endSeconds: 12, text: ` ${maxLengthText} ` }],
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.cues[0].text).toBe(maxLengthText);
      });
  });

  async function createLessonTranscriptsFixture() {
    const instructor = await registerAndLogin(app, 'INSTRUCTOR');
    const student = await registerAndLogin(app, 'STUDENT');
    const course = await prisma.course.create({
      data: {
        title: 'Lesson transcripts course',
        slug: `lesson-transcripts-course-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        description: 'Lesson transcripts e2e fixture',
        instructorId: instructor.userId,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    const unavailableCourse = await prisma.course.create({
      data: {
        title: 'Unavailable lesson transcripts course',
        slug: `unavailable-lesson-transcripts-course-${Date.now()}-${Math.floor(
          Math.random() * 100000,
        )}`,
        description: 'Unavailable lesson transcripts e2e fixture',
        instructorId: instructor.userId,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    const [lesson, unavailableLesson] = await Promise.all([
      prisma.lesson.create({
        data: {
          courseId: course.id,
          title: 'Transcript lesson',
          order: 1,
          durationSeconds: 300,
        },
      }),
      prisma.lesson.create({
        data: {
          courseId: unavailableCourse.id,
          title: 'Unavailable transcript lesson',
          order: 1,
          durationSeconds: 90,
        },
      }),
    ]);

    await prisma.enrollment.create({
      data: {
        courseId: course.id,
        userId: student.userId,
      },
    });

    await prisma.lessonTranscriptCue.createMany({
      data: [
        {
          lessonId: lesson.id,
          order: 1,
          startSeconds: 0,
          endSeconds: 20,
          text: 'Welcome to the realtime LMS foundations course.',
        },
        {
          lessonId: lesson.id,
          order: 2,
          startSeconds: 20,
          endSeconds: 55,
          text: 'This lesson introduces the learner, instructor, and admin workflows.',
        },
      ],
    });

    return {
      instructorToken: instructor.accessToken,
      lessonId: lesson.id,
      studentToken: student.accessToken,
      unavailableLessonId: unavailableLesson.id,
    };
  }
});
