import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
import { env } from '../src/config/env';
import { Prisma, PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  await prisma.quizAnswer.deleteMany();
  await prisma.quizRun.deleteMany();
  await prisma.question.deleteMany();
  await prisma.quiz.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.session.deleteMany();
  await prisma.lessonProgress.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.mediaAsset.deleteMany();
  await prisma.course.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('Password123!', 12);

  const admin = await prisma.user.create({
    data: { email: 'admin@example.com', name: 'Admin', passwordHash, role: 'ADMIN' },
  });
  const instructor = await prisma.user.create({
    data: {
      email: 'instructor@example.com',
      name: 'Instructor',
      passwordHash,
      role: 'INSTRUCTOR',
    },
  });
  const student = await prisma.user.create({
    data: { email: 'student@example.com', name: 'Student', passwordHash, role: 'STUDENT' },
  });

  const course = await prisma.course.create({
    data: {
      title: 'Realtime LMS Foundations',
      slug: 'realtime-lms-foundations',
      description: 'Seed course for local P2 testing',
      status: 'PUBLISHED',
      instructorId: instructor.id,
      publishedAt: new Date(),
    },
  });

  const lesson = await prisma.lesson.create({
    data: {
      courseId: course.id,
      title: 'Intro lesson',
      description: 'First seed lesson',
      order: 1,
      durationSeconds: 600,
    },
  });

  const session = await prisma.session.create({
    data: {
      courseId: course.id,
      title: 'Live intro session',
      startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: 'SCHEDULED',
    },
  });

  await prisma.enrollment.create({ data: { courseId: course.id, userId: student.id } });

  const quiz = await prisma.quiz.create({
    data: {
      lessonId: lesson.id,
      title: 'Intro quiz',
      questions: {
        create: [
          {
            text: 'Which service stores relational LMS data?',
            options: [
              { id: 'a', text: 'PostgreSQL' },
              { id: 'b', text: 'Redis' },
            ] as Prisma.InputJsonValue,
            correctOptionId: 'a',
            order: 1,
          },
        ],
      },
    },
  });

  await prisma.quizRun.create({ data: { quizId: quiz.id, sessionId: session.id } });

  console.log({ admin: admin.email, instructor: instructor.email, student: student.email });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
