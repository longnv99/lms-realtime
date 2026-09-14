import { HttpStatus, Injectable } from '@nestjs/common';
import type { LearnerCourseAnalyticsResponse, LearnerQuizAttemptAnalytics } from '@lms/shared';
import { AppError } from '../../common/errors/app-error';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CoursesService } from '../courses/courses.service';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coursesService: CoursesService,
  ) {}

  async getMyCourseAnalytics(
    courseId: string,
    user: AuthenticatedUser,
  ): Promise<LearnerCourseAnalyticsResponse> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        lessons: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!course) {
      throw new AppError('NOT_FOUND', 'Course not found', HttpStatus.NOT_FOUND);
    }

    await this.ensureCanViewCourseAnalytics(courseId, user);

    const lessonIds = course.lessons.map((lesson) => lesson.id);
    const [progressRows, quizRuns] = await this.prisma.$transaction([
      this.prisma.lessonProgress.findMany({
        where: {
          userId: user.id,
          lessonId: { in: lessonIds },
        },
      }),
      this.prisma.quizRun.findMany({
        where: {
          status: 'FINISHED',
          quiz: {
            lesson: {
              courseId,
            },
          },
          answers: {
            some: {
              userId: user.id,
            },
          },
        },
        include: {
          answers: true,
          quiz: {
            include: {
              lesson: {
                select: {
                  id: true,
                  title: true,
                },
              },
              questions: {
                select: {
                  id: true,
                },
                orderBy: {
                  order: 'asc',
                },
              },
            },
          },
        },
        orderBy: {
          finishedAt: 'desc',
        },
      }),
    ]);

    const completedLessons = progressRows.filter(
      (progress) => progress.completedAt !== null,
    ).length;
    const quizAttempts = quizRuns.map((run) => mapLearnerQuizAttempt(run, user.id));
    const quizScores = quizAttempts.map((attempt) => attempt.totalScore);
    const lastProgressAt = latestDate(progressRows.map((progress) => progress.lastWatchedAt));
    const lastQuizAt = latestDate(
      quizRuns.flatMap((run) => [
        ...(run.finishedAt ? [run.finishedAt] : []),
        ...run.answers
          .filter((answer) => answer.userId === user.id)
          .map((answer) => answer.answeredAt),
      ]),
    );

    return {
      courseId,
      completedLessons,
      totalLessons: course.lessons.length,
      completionPercent: calculatePercent(completedLessons, course.lessons.length),
      quizRunsTaken: quizAttempts.length,
      averageQuizScore: average(quizScores),
      bestQuizScore: Math.max(0, ...quizScores),
      lastActivityAt: latestDate([lastProgressAt, lastQuizAt])?.toISOString() ?? null,
      quizAttempts,
    };
  }

  private async ensureCanViewCourseAnalytics(
    courseId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const course = await this.coursesService.findCourseOrThrow(courseId);

    if (user.role === 'ADMIN' || course.instructorId === user.id) {
      return;
    }

    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: user.id,
          courseId,
        },
      },
      select: { id: true },
    });

    if (!enrollment) {
      throw new AppError(
        'AUTH_FORBIDDEN',
        'You are not enrolled in this course',
        HttpStatus.FORBIDDEN,
      );
    }
  }
}

type LearnerQuizRun = Prisma.QuizRunGetPayload<{
  include: {
    answers: true;
    quiz: {
      include: {
        lesson: {
          select: {
            id: true;
            title: true;
          };
        };
        questions: {
          select: {
            id: true;
          };
        };
      };
    };
  };
}>;

function mapLearnerQuizAttempt(run: LearnerQuizRun, userId: string): LearnerQuizAttemptAnalytics {
  const userAnswers = run.answers.filter((answer) => answer.userId === userId);
  const totalScore = sum(userAnswers.map((answer) => answer.score));
  const correctCount = userAnswers.filter((answer) => answer.isCorrect).length;
  const participantScores = Array.from(groupScoresByUserId(run.answers).values()).sort(
    (a, b) => b - a,
  );

  return {
    quizRunId: run.id,
    quizTitle: run.quiz.title,
    lessonId: run.quiz.lesson.id,
    lessonTitle: run.quiz.lesson.title,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    totalScore,
    correctCount,
    questionCount: run.quiz.questions.length,
    percentCorrect: calculatePercent(correctCount, run.quiz.questions.length),
    rank: participantScores.indexOf(totalScore) + 1,
    participantCount: participantScores.length,
  };
}

type QuizAnswerForScore = {
  userId: string;
  score: number;
};

function groupScoresByUserId(answers: QuizAnswerForScore[]): Map<string, number> {
  const scores = new Map<string, number>();

  for (const answer of answers) {
    scores.set(answer.userId, (scores.get(answer.userId) ?? 0) + answer.score);
  }

  return scores;
}

function calculatePercent(value: number, total: number): number {
  if (total === 0) {
    return 0;
  }

  return Math.round((value / total) * 100);
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return Math.round(sum(values) / values.length);
}

function latestDate(values: Array<Date | null | undefined>): Date | null {
  const dates = values.filter((value): value is Date => value instanceof Date);

  if (dates.length === 0) {
    return null;
  }

  return dates.sort((a, b) => b.getTime() - a.getTime())[0];
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
