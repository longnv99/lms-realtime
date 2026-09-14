import { HttpStatus, Injectable } from '@nestjs/common';
import type {
  InstructorCourseAnalyticsResponse,
  InstructorQuestionPerformanceAnalytics,
  InstructorStudentAnalyticsSummary,
  LearnerCourseAnalyticsResponse,
  LearnerQuizAttemptAnalytics,
} from '@lms/shared';
import { AppError } from '../../common/errors/app-error';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CoursesService } from '../courses/courses.service';
import type { CsvFile } from './csv';
import { toCsv } from './csv';

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

  async getInstructorCourseAnalytics(
    courseId: string,
    user: AuthenticatedUser,
  ): Promise<InstructorCourseAnalyticsResponse> {
    const course = await this.coursesService.findCourseOrThrow(courseId);
    this.coursesService.ensureCanManage(course, user);

    const [enrollments, lessons, quizRuns] = await this.prisma.$transaction([
      this.prisma.enrollment.findMany({
        where: { courseId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.lesson.findMany({
        where: { courseId },
        orderBy: { order: 'asc' },
        select: {
          id: true,
          title: true,
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
                  text: true,
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

    const enrolledUserIds = enrollments.map((enrollment) => enrollment.userId);
    const progressRows = await this.prisma.lessonProgress.findMany({
      where: {
        lessonId: { in: lessons.map((lesson) => lesson.id) },
        userId: { in: enrolledUserIds },
      },
    });
    const courseAnswers = quizRuns.flatMap((run) =>
      run.answers.filter((answer) => enrolledUserIds.includes(answer.userId)),
    );
    const studentSummaries = enrollments.map((enrollment) =>
      mapInstructorStudentSummary({
        lessonCount: lessons.length,
        progressRows: progressRows.filter((progress) => progress.userId === enrollment.userId),
        quizRuns,
        user: enrollment.user,
      }),
    );
    const lessonCompletions = lessons.map((lesson) => {
      const lessonProgressRows = progressRows.filter((progress) => progress.lessonId === lesson.id);
      const positions = enrolledUserIds.map(
        (userId) =>
          lessonProgressRows.find((progress) => progress.userId === userId)?.positionSeconds ?? 0,
      );
      const completedStudents = lessonProgressRows.filter(
        (progress) => progress.completedAt !== null,
      ).length;

      return {
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        completedStudents,
        totalStudents: enrollments.length,
        completionPercent: calculatePercent(completedStudents, enrollments.length),
        averagePositionSeconds: average(positions),
      };
    });

    return {
      courseId,
      totalStudents: enrollments.length,
      activeStudents: studentSummaries.filter((student) => student.lastActivityAt !== null).length,
      averageCompletionPercent: average(
        studentSummaries.map((student) => student.completionPercent),
      ),
      completedStudents: studentSummaries.filter(
        (student) => lessons.length > 0 && student.completedLessons === lessons.length,
      ).length,
      averageQuizScore: average(studentSummaries.map((student) => student.averageQuizScore)),
      quizParticipationRate: calculatePercent(
        new Set(courseAnswers.map((answer) => answer.userId)).size,
        enrollments.length,
      ),
      lessonCompletions,
      questionPerformance: quizRuns.flatMap(mapQuestionPerformance),
      studentSummaries,
    };
  }

  async exportCourseAnalyticsCsv(
    courseId: string,
    user: AuthenticatedUser,
    kind: 'students' | 'questions',
  ): Promise<CsvFile> {
    const analytics = await this.getInstructorCourseAnalytics(courseId, user);

    if (kind === 'questions') {
      return {
        fileName: 'course-analytics-questions.csv',
        content: toCsv(
          ['Quiz', 'Question', 'Answers', 'Correct answers', 'Correct %', 'Quiz run'],
          analytics.questionPerformance.map((question) => [
            question.quizTitle,
            question.questionText,
            question.answerCount,
            question.correctCount,
            question.correctPercent,
            question.quizRunId,
          ]),
        ),
      };
    }

    return {
      fileName: 'course-analytics-students.csv',
      content: toCsv(
        [
          'Name',
          'Email',
          'Completion %',
          'Completed lessons',
          'Quiz runs',
          'Average quiz score',
          'Last activity',
        ],
        analytics.studentSummaries.map((student) => [
          student.name,
          student.email,
          student.completionPercent,
          student.completedLessons,
          student.quizRunsTaken,
          student.averageQuizScore,
          student.lastActivityAt,
        ]),
      ),
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

type InstructorQuizRun = Prisma.QuizRunGetPayload<{
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
            text: true;
          };
        };
      };
    };
  };
}>;

type InstructorProgressRow = {
  completedAt: Date | null;
  lastWatchedAt: Date;
  lessonId: string;
  positionSeconds: number;
  userId: string;
};

type InstructorUser = {
  id: string;
  name: string;
  email: string;
};

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

function mapInstructorStudentSummary(input: {
  lessonCount: number;
  progressRows: InstructorProgressRow[];
  quizRuns: InstructorQuizRun[];
  user: InstructorUser;
}): InstructorStudentAnalyticsSummary {
  const completedLessons = input.progressRows.filter(
    (progress) => progress.completedAt !== null,
  ).length;
  const attempts = input.quizRuns
    .map((run) => {
      const answers = run.answers.filter((answer) => answer.userId === input.user.id);

      return {
        answeredAt: latestDate(answers.map((answer) => answer.answeredAt)),
        score: sum(answers.map((answer) => answer.score)),
      };
    })
    .filter((attempt) => attempt.answeredAt !== null);

  return {
    userId: input.user.id,
    name: input.user.name,
    email: input.user.email,
    completionPercent: calculatePercent(completedLessons, input.lessonCount),
    completedLessons,
    quizRunsTaken: attempts.length,
    averageQuizScore: average(attempts.map((attempt) => attempt.score)),
    lastActivityAt:
      latestDate([
        ...input.progressRows.map((progress) => progress.lastWatchedAt),
        ...attempts.map((attempt) => attempt.answeredAt),
      ])?.toISOString() ?? null,
  };
}

function mapQuestionPerformance(run: InstructorQuizRun): InstructorQuestionPerformanceAnalytics[] {
  return run.quiz.questions.map((question) => {
    const answers = run.answers.filter((answer) => answer.questionId === question.id);
    const correctCount = answers.filter((answer) => answer.isCorrect).length;

    return {
      quizId: run.quizId,
      quizTitle: run.quiz.title,
      quizRunId: run.id,
      questionId: question.id,
      questionText: question.text,
      correctCount,
      answerCount: answers.length,
      correctPercent: calculatePercent(correctCount, answers.length),
    };
  });
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
