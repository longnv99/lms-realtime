import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../src/config/env';
import { PrismaClient } from '../src/generated/prisma/client';
import { seedTranscriptCues } from './seeds/data';
import { parseSeedOptions, runSeed } from './seeds';

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  const options = parseSeedOptions(process.argv.slice(2));
  const context = await runSeed(prisma, options);
  await seedLessonTranscriptCues(context.course.id);

  const [enrollmentCount, progressRows] = await Promise.all([
    prisma.enrollment.count({ where: { courseId: context.course.id } }),
    prisma.lessonProgress.count({
      where: {
        lessonId: {
          in: Object.values(context.lessons).map((lesson) => lesson.id),
        },
      },
    }),
  ]);

  console.log({
    mode: options.reset ? 'reset' : 'safe',
    admin: context.users.admin.email,
    instructor: context.users.instructor.email,
    student: context.users.student.email,
    studentTwo: context.users.studentTwo.email,
    course: context.course.slug,
    lessons: Object.keys(context.lessons).length,
    enrollments: enrollmentCount,
    progressRows,
  });
}

async function seedLessonTranscriptCues(courseId: string): Promise<void> {
  for (const transcriptSeed of seedTranscriptCues) {
    const lesson = await prisma.lesson.findUnique({
      where: {
        courseId_order: {
          courseId,
          order: transcriptSeed.lessonOrder,
        },
      },
      select: { id: true },
    });

    if (!lesson) {
      throw new Error(`Seed lesson ${transcriptSeed.lessonOrder} not found`);
    }

    await Promise.all(
      transcriptSeed.cues.map((cue, index) =>
        prisma.lessonTranscriptCue.upsert({
          where: {
            lessonId_order: {
              lessonId: lesson.id,
              order: index + 1,
            },
          },
          create: {
            lessonId: lesson.id,
            startSeconds: cue.startSeconds,
            endSeconds: cue.endSeconds,
            text: cue.text,
            order: index + 1,
          },
          update: {
            startSeconds: cue.startSeconds,
            endSeconds: cue.endSeconds,
            text: cue.text,
          },
        }),
      ),
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
