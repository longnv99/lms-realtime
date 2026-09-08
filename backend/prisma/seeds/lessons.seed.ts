import { seedLessons } from './data';
import type { SeedContext, SeedLessonKey, SeedPrisma } from './types';

export async function seedLessonsModule(
  prisma: SeedPrisma,
  context: Partial<SeedContext>,
): Promise<void> {
  const course = context.course;

  if (!course) {
    throw new Error('Seed courses before lessons');
  }

  const lessons = {} as SeedContext['lessons'];

  for (const lessonKey of Object.keys(seedLessons) as SeedLessonKey[]) {
    const lessonSeed = seedLessons[lessonKey];
    const mediaAsset = await prisma.mediaAsset.upsert({
      where: { key: lessonSeed.media.key },
      create: {
        key: lessonSeed.media.key,
        fileName: lessonSeed.media.fileName,
        contentType: lessonSeed.media.contentType,
        sizeBytes: lessonSeed.media.sizeBytes,
        status: 'UPLOADED',
      },
      update: {
        fileName: lessonSeed.media.fileName,
        contentType: lessonSeed.media.contentType,
        sizeBytes: lessonSeed.media.sizeBytes,
        status: 'UPLOADED',
      },
      select: {
        id: true,
      },
    });

    const lesson = await prisma.lesson.upsert({
      where: {
        courseId_order: {
          courseId: course.id,
          order: lessonSeed.order,
        },
      },
      create: {
        courseId: course.id,
        title: lessonSeed.title,
        description: lessonSeed.description,
        order: lessonSeed.order,
        durationSeconds: lessonSeed.durationSeconds,
        mediaAssetId: mediaAsset.id,
      },
      update: {
        title: lessonSeed.title,
        description: lessonSeed.description,
        durationSeconds: lessonSeed.durationSeconds,
        mediaAssetId: mediaAsset.id,
      },
      select: {
        id: true,
        durationSeconds: true,
        title: true,
      },
    });

    lessons[lessonKey] = lesson;
  }

  context.lessons = lessons;
}
