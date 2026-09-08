import { seedCoursesModule } from './courses.seed';
import { seedEnrollmentsModule } from './enrollments.seed';
import { seedLessonsModule } from './lessons.seed';
import { seedProgressModule } from './progress.seed';
import { seedQuizzesModule } from './quizzes.seed';
import { resetSeedData } from './reset.seed';
import { seedSessionsModule } from './sessions.seed';
import type { SeedContext, SeedModule, SeedOptions, SeedPrisma } from './types';
import { seedUsersModule } from './users.seed';

export const seedModules: SeedModule[] = [
  { name: 'users', run: seedUsersModule },
  { name: 'courses', run: seedCoursesModule },
  { name: 'lessons', run: seedLessonsModule },
  { name: 'sessions', run: seedSessionsModule },
  { name: 'enrollments', run: seedEnrollmentsModule },
  { name: 'progress', run: seedProgressModule },
  { name: 'quizzes', run: seedQuizzesModule },
];

export function parseSeedOptions(args: string[]): SeedOptions {
  return {
    reset: args.includes('--reset'),
  };
}

export function getSeedModuleNames(): string[] {
  return seedModules.map((module) => module.name);
}

export async function runSeed(prisma: SeedPrisma, options: SeedOptions): Promise<SeedContext> {
  if (options.reset) {
    await resetSeedData(prisma);
  }

  const context: Partial<SeedContext> = {};

  for (const module of seedModules) {
    await module.run(prisma, context);
  }

  return assertSeedContext(context);
}

function assertSeedContext(context: Partial<SeedContext>): SeedContext {
  if (!context.users || !context.course || !context.lessons || !context.session) {
    throw new Error('Seed context is incomplete');
  }

  return context as SeedContext;
}
