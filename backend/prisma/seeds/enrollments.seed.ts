import type { SeedContext, SeedPrisma } from './types';

export async function seedEnrollmentsModule(
  prisma: SeedPrisma,
  context: Partial<SeedContext>,
): Promise<void> {
  const course = context.course;
  const student = context.users?.student;
  const studentTwo = context.users?.studentTwo;

  if (!course || !student || !studentTwo) {
    throw new Error('Seed users and courses before enrollments');
  }

  await Promise.all(
    [student, studentTwo].map((user) =>
      prisma.enrollment.upsert({
        where: {
          userId_courseId: {
            userId: user.id,
            courseId: course.id,
          },
        },
        create: {
          userId: user.id,
          courseId: course.id,
        },
        update: {},
      }),
    ),
  );
}
