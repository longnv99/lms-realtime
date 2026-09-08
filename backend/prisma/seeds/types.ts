import type { PrismaClient } from '../../src/generated/prisma/client';

export type SeedPrisma = PrismaClient;

export type SeedOptions = {
  reset: boolean;
};

export type SeedUserKey = 'admin' | 'instructor' | 'student' | 'studentTwo';
export type SeedLessonKey = 'intro' | 'realtimeRoom' | 'quiz' | 'progress';

export type SeedContext = {
  users: Record<SeedUserKey, { id: string; email: string }>;
  course: { id: string; slug: string };
  lessons: Record<SeedLessonKey, { id: string; durationSeconds: number; title: string }>;
  session: { id: string; title: string };
  quiz?: { id: string; title: string };
};

export type SeedModule = {
  name: string;
  run: (prisma: SeedPrisma, context: Partial<SeedContext>) => Promise<void>;
};
