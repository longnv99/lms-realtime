import { seedSession } from './data';
import type { SeedContext, SeedPrisma } from './types';

export async function seedSessionsModule(
  prisma: SeedPrisma,
  context: Partial<SeedContext>,
): Promise<void> {
  const course = context.course;

  if (!course) {
    throw new Error('Seed courses before sessions');
  }

  const startsAt = new Date(Date.now() + seedSession.startsInHours * 60 * 60 * 1000);
  const existingSession = await prisma.session.findFirst({
    where: {
      courseId: course.id,
      title: seedSession.title,
    },
    select: {
      id: true,
      title: true,
    },
  });

  const session = existingSession
    ? await prisma.session.update({
        where: { id: existingSession.id },
        data: {
          startsAt,
          status: seedSession.status,
        },
        select: {
          id: true,
          title: true,
        },
      })
    : await prisma.session.create({
        data: {
          courseId: course.id,
          title: seedSession.title,
          startsAt,
          status: seedSession.status,
        },
        select: {
          id: true,
          title: true,
        },
      });

  context.session = session;
}
