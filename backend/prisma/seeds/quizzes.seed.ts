import { seedQuestions } from './data';
import type { SeedContext, SeedPrisma } from './types';

const seedQuizTitle = 'Intro quiz';

export async function seedQuizzesModule(
  prisma: SeedPrisma,
  context: Partial<SeedContext>,
): Promise<void> {
  const lesson = context.lessons?.intro;
  const session = context.session;

  if (!lesson || !session) {
    throw new Error('Seed lessons and sessions before quizzes');
  }

  const existingQuiz = await prisma.quiz.findFirst({
    where: {
      lessonId: lesson.id,
      title: seedQuizTitle,
    },
    select: {
      id: true,
    },
  });

  const quiz = existingQuiz
    ? await prisma.quiz.update({
        where: { id: existingQuiz.id },
        data: { title: seedQuizTitle },
        select: {
          id: true,
          title: true,
        },
      })
    : await prisma.quiz.create({
        data: {
          lessonId: lesson.id,
          title: seedQuizTitle,
        },
        select: {
          id: true,
          title: true,
        },
      });

  await Promise.all(
    seedQuestions.map((question) =>
      prisma.question.upsert({
        where: {
          quizId_order: {
            quizId: quiz.id,
            order: question.order,
          },
        },
        create: {
          quizId: quiz.id,
          text: question.text,
          options: question.options,
          correctOptionId: question.correctOptionId,
          order: question.order,
        },
        update: {
          text: question.text,
          options: question.options,
          correctOptionId: question.correctOptionId,
        },
      }),
    ),
  );

  const existingRun = await prisma.quizRun.findFirst({
    where: {
      quizId: quiz.id,
      sessionId: session.id,
    },
    select: {
      id: true,
    },
  });

  if (existingRun) {
    await prisma.quizRun.update({
      where: { id: existingRun.id },
      data: {},
    });
  } else {
    await prisma.quizRun.create({
      data: {
        quizId: quiz.id,
        sessionId: session.id,
      },
    });
  }

  context.quiz = quiz;
}
