import type { SeedContext, SeedPrisma } from './types';

export async function seedProgressModule(
  prisma: SeedPrisma,
  context: Partial<SeedContext>,
): Promise<void> {
  const student = context.users?.student;
  const studentTwo = context.users?.studentTwo;
  const lessons = context.lessons;

  if (!student || !studentTwo || !lessons) {
    throw new Error('Seed users and lessons before progress');
  }

  const now = new Date();
  const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60 * 1000);

  await Promise.all([
    upsertProgress(prisma, student.id, lessons.intro.id, lessons.intro.durationSeconds, {
      completedAt: minutesAgo(90),
      lastWatchedAt: minutesAgo(90),
    }),
    upsertProgress(prisma, student.id, lessons.realtimeRoom.id, 420, {
      lastWatchedAt: minutesAgo(25),
    }),
    upsertProgress(prisma, studentTwo.id, lessons.intro.id, lessons.intro.durationSeconds, {
      completedAt: minutesAgo(180),
      lastWatchedAt: minutesAgo(180),
    }),
    upsertProgress(
      prisma,
      studentTwo.id,
      lessons.realtimeRoom.id,
      lessons.realtimeRoom.durationSeconds,
      {
        completedAt: minutesAgo(60),
        lastWatchedAt: minutesAgo(60),
      },
    ),
    upsertProgress(prisma, studentTwo.id, lessons.quiz.id, 360, {
      lastWatchedAt: minutesAgo(10),
    }),
  ]);
}

async function upsertProgress(
  prisma: SeedPrisma,
  userId: string,
  lessonId: string,
  positionSeconds: number,
  dates: { completedAt?: Date; lastWatchedAt: Date },
) {
  const existing = await prisma.lessonProgress.findUnique({
    where: {
      userId_lessonId: {
        userId,
        lessonId,
      },
    },
    select: {
      positionSeconds: true,
      completedAt: true,
      lastWatchedAt: true,
    },
  });
  const nextProgress = resolveProgressSeedRow(existing, {
    positionSeconds,
    completedAt: dates.completedAt,
    lastWatchedAt: dates.lastWatchedAt,
  });

  return prisma.lessonProgress.upsert({
    where: {
      userId_lessonId: {
        userId,
        lessonId,
      },
    },
    create: {
      userId,
      lessonId,
      positionSeconds: nextProgress.positionSeconds,
      completedAt: nextProgress.completedAt,
      lastWatchedAt: nextProgress.lastWatchedAt,
    },
    update: {
      positionSeconds: nextProgress.positionSeconds,
      completedAt: nextProgress.completedAt,
      lastWatchedAt: nextProgress.lastWatchedAt,
    },
  });
}

export function resolveProgressSeedRow(
  existing: { positionSeconds: number; completedAt: Date | null; lastWatchedAt: Date } | null,
  seed: { positionSeconds: number; completedAt?: Date; lastWatchedAt: Date },
) {
  if (!existing) {
    return {
      positionSeconds: seed.positionSeconds,
      completedAt: seed.completedAt ?? null,
      lastWatchedAt: seed.lastWatchedAt,
    };
  }

  return {
    positionSeconds: Math.max(existing.positionSeconds, seed.positionSeconds),
    completedAt: existing.completedAt ?? seed.completedAt ?? null,
    lastWatchedAt:
      existing.lastWatchedAt.getTime() > seed.lastWatchedAt.getTime()
        ? existing.lastWatchedAt
        : seed.lastWatchedAt,
  };
}
