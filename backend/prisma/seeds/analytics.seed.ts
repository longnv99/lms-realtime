import { seedQuizAnswerSeeds } from './data';
import type { SeedContext, SeedPrisma, SeedUserKey } from './types';

const finishedAt = new Date('2026-09-14T00:00:00.000Z');

export async function seedAnalyticsModule(
  prisma: SeedPrisma,
  context: Partial<SeedContext>,
): Promise<void> {
  const users = context.users;
  const quiz = context.quiz;
  const session = context.session;

  if (!users || !quiz || !session) {
    throw new Error('Seed users, sessions, and quizzes before analytics');
  }

  const quizRun = await prisma.quizRun.findFirst({
    where: {
      quizId: quiz.id,
      sessionId: session.id,
    },
    select: {
      id: true,
    },
  });

  if (!quizRun) {
    throw new Error('Seed quiz run not found');
  }

  await prisma.quizRun.update({
    where: { id: quizRun.id },
    data: {
      status: 'FINISHED',
      currentQuestionIndex: null,
      questionOpenedAt: null,
      revealedAt: finishedAt,
      finishedAt,
    },
  });

  const questions = await prisma.question.findMany({
    where: {
      quizId: quiz.id,
    },
    orderBy: {
      order: 'asc',
    },
    select: {
      id: true,
      order: true,
    },
  });
  const questionByOrder = new Map(questions.map((question) => [question.order, question]));

  await Promise.all(
    seedQuizAnswerSeeds.map((answerSeed) => {
      const question = questionByOrder.get(answerSeed.questionOrder);
      const user = users[answerSeed.userKey as SeedUserKey];

      if (!question || !user) {
        throw new Error(`Invalid analytics seed answer for question ${answerSeed.questionOrder}`);
      }

      return prisma.quizAnswer.upsert({
        where: {
          runId_questionId_userId: {
            runId: quizRun.id,
            questionId: question.id,
            userId: user.id,
          },
        },
        create: {
          runId: quizRun.id,
          questionId: question.id,
          userId: user.id,
          selectedOptionId: answerSeed.selectedOptionId,
          isCorrect: answerSeed.isCorrect,
          score: answerSeed.score,
          answeredAt: new Date(answerSeed.answeredAt),
        },
        update: {
          selectedOptionId: answerSeed.selectedOptionId,
          isCorrect: answerSeed.isCorrect,
          score: answerSeed.score,
          answeredAt: new Date(answerSeed.answeredAt),
        },
      });
    }),
  );
}
