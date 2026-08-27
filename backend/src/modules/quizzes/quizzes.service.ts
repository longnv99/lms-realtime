import { HttpStatus, Injectable } from '@nestjs/common';
import type { QuizRunStatus } from '@lms/shared';
import { Prisma } from '../../generated/prisma/client';
import { AppError } from '../../common/errors/app-error';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { CoursesService } from '../courses/courses.service';
import { CreateQuizRunDto } from './dto/create-quiz-run.dto';
import { CreateQuizDto, QuizQuestionDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { QuizzesRealtimeService } from './quizzes.realtime.service';

@Injectable()
export class QuizzesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coursesService: CoursesService,
    private readonly redis: RedisService,
    private readonly realtime: QuizzesRealtimeService,
  ) {}

  async createQuiz(lessonId: string, actor: AuthenticatedUser, dto: CreateQuizDto) {
    const lesson = await this.findLessonWithCourseOrThrow(lessonId);
    this.coursesService.ensureCanManage(lesson.course, actor);
    this.ensureCorrectOptions(dto.questions);

    return this.prisma.quiz.create({
      data: {
        lessonId,
        title: dto.title,
        questions: {
          create: dto.questions.map((question, index) => ({
            text: question.text,
            options: question.options as unknown as Prisma.InputJsonValue,
            correctOptionId: question.correctOptionId,
            order: index + 1,
          })),
        },
      },
      include: { questions: { orderBy: { order: 'asc' } } },
    });
  }

  async updateQuiz(id: string, actor: AuthenticatedUser, dto: UpdateQuizDto) {
    const quiz = await this.findQuizWithCourseOrThrow(id);
    this.coursesService.ensureCanManage(quiz.lesson.course, actor);

    if (dto.questions) {
      this.ensureCorrectOptions(dto.questions);
      await this.prisma.$transaction([
        this.prisma.quiz.update({
          where: { id },
          data: { title: dto.title },
        }),
        this.prisma.question.deleteMany({ where: { quizId: id } }),
        ...dto.questions.map((question, index) =>
          this.prisma.question.create({
            data: {
              quizId: id,
              text: question.text,
              options: question.options as unknown as Prisma.InputJsonValue,
              correctOptionId: question.correctOptionId,
              order: index + 1,
            },
          }),
        ),
      ]);

      return this.findQuizWithQuestionsOrThrow(id);
    }

    return this.prisma.quiz.update({
      where: { id },
      data: { title: dto.title },
      include: { questions: { orderBy: { order: 'asc' } } },
    });
  }

  async deleteQuiz(id: string, actor: AuthenticatedUser): Promise<{ deleted: true }> {
    const quiz = await this.findQuizWithCourseOrThrow(id);
    this.coursesService.ensureCanManage(quiz.lesson.course, actor);

    await this.prisma.quiz.delete({ where: { id } });
    return { deleted: true };
  }

  async createQuizRun(
    sessionId: string,
    actor: AuthenticatedUser,
    dto: CreateQuizRunDto,
  ) {
    const session = await this.findSessionWithCourseOrThrow(sessionId);
    this.coursesService.ensureCanManage(session.course, actor);
    const quiz = await this.findQuizWithLessonOrThrow(dto.quizId);

    if (quiz.lesson.courseId !== session.courseId) {
      throw new AppError('CONFLICT', 'Quiz khong thuoc khoa hoc cua session', HttpStatus.CONFLICT);
    }

    return this.prisma.quizRun.create({
      data: { quizId: dto.quizId, sessionId },
    });
  }

  async getQuizRunState(id: string, actor: AuthenticatedUser) {
    const run = await this.prisma.quizRun.findUnique({
      where: { id },
      include: {
        session: {
          include: {
            course: {
              select: { instructorId: true },
            },
          },
        },
        quiz: {
          include: {
            questions: { orderBy: { order: 'asc' } },
          },
        },
      },
    });

    if (!run) {
      throw new AppError('NOT_FOUND', 'Khong tim thay quiz run', HttpStatus.NOT_FOUND);
    }

    await this.ensureCanViewSession(run.session, actor);

    const question = run.currentQuestionIndex
      ? run.quiz.questions[run.currentQuestionIndex - 1]
      : null;

    return {
      id: run.id,
      status: run.status as QuizRunStatus,
      currentQuestionIndex: run.currentQuestionIndex,
      question: question
        ? {
            id: question.id,
            text: question.text,
            options: question.options,
          }
        : null,
    };
  }

  async openNextQuestion(id: string, actor: AuthenticatedUser) {
    const run = await this.findRunWithQuizSessionOrThrow(id);
    this.coursesService.ensureCanManage(run.session.course, actor);

    if (run.status === 'FINISHED') {
      throw new AppError('QUIZ_RUN_LOCKED', 'QuizRun da ket thuc', HttpStatus.BAD_REQUEST);
    }

    const nextIndex = (run.currentQuestionIndex ?? 0) + 1;
    const question = run.quiz.questions[nextIndex - 1];

    if (!question) {
      throw new AppError('CONFLICT', 'Khong con cau hoi tiep theo', HttpStatus.CONFLICT);
    }

    const updated = await this.prisma.quizRun.update({
      where: { id },
      data: {
        currentQuestionIndex: nextIndex,
        status: 'OPEN',
        questionOpenedAt: new Date(),
      },
    });
    const payload = {
      currentQuestionIndex: nextIndex,
      question: {
        id: question.id,
        text: question.text,
        options: question.options as Array<{ id: string; text: string }>,
      },
    };

    this.realtime.emitQuestion(id, payload);

    return { ...updated, ...payload };
  }

  async closeQuestion(id: string, actor: AuthenticatedUser) {
    const run = await this.findRunWithQuizSessionOrThrow(id);
    this.coursesService.ensureCanManage(run.session.course, actor);

    if (run.status !== 'OPEN' || !run.currentQuestionIndex) {
      throw new AppError('CONFLICT', 'Khong co cau hoi dang mo', HttpStatus.CONFLICT);
    }

    const question = run.quiz.questions[run.currentQuestionIndex - 1];
    const answerCount = Number(
      (await this.redis
        .getClient()
        .get(`quiz-run:${id}:q:${run.currentQuestionIndex}:count`)) ?? 0,
    );
    const updated = await this.prisma.quizRun.update({
      where: { id },
      data: { status: 'CLOSED' },
    });

    this.realtime.emitQuestionClosed(id, { questionId: question.id, answerCount });

    return { ...updated, questionId: question.id, answerCount };
  }

  async revealQuestion(id: string, actor: AuthenticatedUser) {
    const run = await this.findRunWithQuizSessionOrThrow(id);
    this.coursesService.ensureCanManage(run.session.course, actor);

    if (run.status !== 'CLOSED' || !run.currentQuestionIndex) {
      throw new AppError('CONFLICT', 'Chi reveal sau khi dong cau hoi', HttpStatus.CONFLICT);
    }

    const question = run.quiz.questions[run.currentQuestionIndex - 1];
    const correctCount = await this.prisma.quizAnswer.count({
      where: { runId: id, questionId: question.id, isCorrect: true },
    });
    const updated = await this.prisma.quizRun.update({
      where: { id },
      data: { status: 'REVEALED' },
    });

    this.realtime.emitReveal(id, {
      questionId: question.id,
      correctOptionId: question.correctOptionId,
      correctCount,
    });

    return {
      ...updated,
      questionId: question.id,
      correctOptionId: question.correctOptionId,
      correctCount,
    };
  }

  async finishRun(id: string, actor: AuthenticatedUser) {
    const run = await this.findRunWithQuizSessionOrThrow(id);
    this.coursesService.ensureCanManage(run.session.course, actor);

    const updated = await this.prisma.quizRun.update({
      where: { id },
      data: { status: 'FINISHED' },
    });
    const countKeys = await this.redis.getClient().keys(`quiz-run:${id}:q:*:count`);
    await this.redis.getClient().del(`quiz-run:${id}:leaderboard`, ...countKeys);

    this.realtime.emitFinished(id, { summaryUrl: `/api/quiz-runs/${id}/state` });

    return updated;
  }

  private ensureCorrectOptions(questions: QuizQuestionDto[]): void {
    for (const question of questions) {
      if (!question.options.some((option) => option.id === question.correctOptionId)) {
        throw new AppError(
          'VALIDATION_FAILED',
          'correctOptionId phai ton tai trong options',
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }

  private async ensureCanViewSession(
    session: { courseId: string; course: { instructorId: string } },
    actor: AuthenticatedUser,
  ): Promise<void> {
    if (actor.role === 'ADMIN' || session.course.instructorId === actor.id) {
      return;
    }

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: actor.id, courseId: session.courseId } },
      select: { id: true },
    });

    if (!enrollment) {
      throw new AppError(
        'AUTH_FORBIDDEN',
        'Khong co quyen xem trang thai quiz run',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private async findLessonWithCourseOrThrow(id: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
      include: { course: { select: { instructorId: true } } },
    });

    if (!lesson) {
      throw new AppError('NOT_FOUND', 'Khong tim thay lesson', HttpStatus.NOT_FOUND);
    }

    return lesson;
  }

  private async findQuizWithLessonOrThrow(id: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      include: { lesson: { select: { courseId: true } } },
    });

    if (!quiz) {
      throw new AppError('NOT_FOUND', 'Khong tim thay quiz', HttpStatus.NOT_FOUND);
    }

    return quiz;
  }

  private async findQuizWithCourseOrThrow(id: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      include: { lesson: { include: { course: { select: { instructorId: true } } } } },
    });

    if (!quiz) {
      throw new AppError('NOT_FOUND', 'Khong tim thay quiz', HttpStatus.NOT_FOUND);
    }

    return quiz;
  }

  private async findQuizWithQuestionsOrThrow(id: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      include: { questions: { orderBy: { order: 'asc' } } },
    });

    if (!quiz) {
      throw new AppError('NOT_FOUND', 'Khong tim thay quiz', HttpStatus.NOT_FOUND);
    }

    return quiz;
  }

  private async findSessionWithCourseOrThrow(id: string) {
    const session = await this.prisma.session.findUnique({
      where: { id },
      include: { course: { select: { instructorId: true } } },
    });

    if (!session) {
      throw new AppError('NOT_FOUND', 'Khong tim thay session', HttpStatus.NOT_FOUND);
    }

    return session;
  }

  private async findRunWithQuizSessionOrThrow(id: string) {
    const run = await this.prisma.quizRun.findUnique({
      where: { id },
      include: {
        session: { include: { course: { select: { instructorId: true } } } },
        quiz: { include: { questions: { orderBy: { order: 'asc' } } } },
      },
    });

    if (!run) {
      throw new AppError('NOT_FOUND', 'Khong tim thay quiz run', HttpStatus.NOT_FOUND);
    }

    return run;
  }
}
