import bcrypt from 'bcrypt';
import { seedPassword, seedUsers } from './data';
import type { SeedContext, SeedPrisma } from './types';

export async function seedUsersModule(
  prisma: SeedPrisma,
  context: Partial<SeedContext>,
): Promise<void> {
  const passwordHash = await bcrypt.hash(seedPassword, 12);

  const [admin, instructor, student, studentTwo] = await Promise.all([
    upsertUser(prisma, seedUsers.admin, passwordHash),
    upsertUser(prisma, seedUsers.instructor, passwordHash),
    upsertUser(prisma, seedUsers.student, passwordHash),
    upsertUser(prisma, seedUsers.studentTwo, passwordHash),
  ]);

  context.users = {
    admin,
    instructor,
    student,
    studentTwo,
  };
}

async function upsertUser(
  prisma: SeedPrisma,
  user: (typeof seedUsers)[keyof typeof seedUsers],
  passwordHash: string,
) {
  return prisma.user.upsert({
    where: { email: user.email },
    create: {
      email: user.email,
      name: user.name,
      passwordHash,
      role: user.role,
    },
    update: {
      name: user.name,
      passwordHash,
      role: user.role,
    },
    select: {
      id: true,
      email: true,
    },
  });
}
