import { seedCourse } from './data';
import type { SeedContext, SeedPrisma } from './types';

export async function seedCoursesModule(
  prisma: SeedPrisma,
  context: Partial<SeedContext>,
): Promise<void> {
  const instructor = context.users?.instructor;

  if (!instructor) {
    throw new Error('Seed users before courses');
  }

  const course = await prisma.course.upsert({
    where: { slug: seedCourse.slug },
    create: {
      title: seedCourse.title,
      slug: seedCourse.slug,
      description: seedCourse.description,
      status: seedCourse.status,
      instructorId: instructor.id,
      publishedAt: new Date(),
    },
    update: {
      title: seedCourse.title,
      description: seedCourse.description,
      status: seedCourse.status,
      instructorId: instructor.id,
      publishedAt: new Date(),
    },
    select: {
      id: true,
      slug: true,
    },
  });

  context.course = course;
}
