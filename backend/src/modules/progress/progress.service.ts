import { HttpStatus, Injectable } from '@nestjs/common';
import type {
  CourseProgressResponse,
  InstructorCourseProgressResponse,
  LessonProgressResponse,
} from '@lms/shared';
import { AppError } from '../../common/errors/app-error';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { PrismaService } from '../../prisma/prisma.service';
import { CoursesService } from '../courses/courses.service';

@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coursesService: CoursesService,
  ) {}

  async getMine(courseId: string, user: AuthenticatedUser): Promise<CourseProgressResponse> {
    const course = await this.findCourseWithLessonsOrThrow(courseId);
    await this.ensureCanViewOwnCourseProgress(courseId, user);
    const progressRows = await this.prisma.lessonProgress.findMany({
      where: {
        userId: user.id,
        lessonId: { in: course.lessons.map((lesson) => lesson.id) },
      },
    });
    const progressByLessonId = new Map(
      progressRows.map((progress) => [progress.lessonId, progress]),
    );
    const lessons = course.lessons.map((lesson) =>
      mapLessonProgress(lesson, progressByLessonId.get(lesson.id)),
    );

    return {
      courseId,
      totalLessons: lessons.length,
      completedLessons: lessons.filter((lesson) => lesson.completedAt !== null).length,
      percent: calculatePercent(
        lessons.filter((lesson) => lesson.completedAt !== null).length,
        lessons.length,
      ),
      lessons,
    };
  }

  async getForCourse(
    courseId: string,
    actor: AuthenticatedUser,
  ): Promise<InstructorCourseProgressResponse> {
    const course = await this.findCourseWithLessonsOrThrow(courseId);
    this.coursesService.ensureCanManage(course, actor);

    const lessonIds = course.lessons.map((lesson) => lesson.id);
    const enrollments = await this.prisma.enrollment.findMany({
      where: { courseId },
      include: {
        user: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
    const progressRows = await this.prisma.lessonProgress.findMany({
      where: {
        lessonId: { in: lessonIds },
        userId: { in: enrollments.map((enrollment) => enrollment.userId) },
      },
    });

    return {
      courseId,
      totalLessons: course.lessons.length,
      students: enrollments.map((enrollment) => {
        const rows = progressRows.filter((progress) => progress.userId === enrollment.userId);
        const completedLessons = rows.filter((progress) => progress.completedAt !== null).length;
        const lastWatchedAt = rows
          .map((progress) => progress.lastWatchedAt)
          .sort((a, b) => b.getTime() - a.getTime())[0];

        return {
          userId: enrollment.userId,
          name: enrollment.user.name,
          email: enrollment.user.email,
          completedLessons,
          percent: calculatePercent(completedLessons, course.lessons.length),
          lastWatchedAt: lastWatchedAt?.toISOString() ?? null,
        };
      }),
    };
  }

  async recordHeartbeat(
    user: AuthenticatedUser,
    lessonId: string,
    positionSeconds: number,
  ): Promise<LessonProgressResponse> {
    const lesson = await this.findLessonWithCourseOrThrow(lessonId);
    await this.ensureCanViewOwnCourseProgress(lesson.courseId, user);

    const existing = await this.prisma.lessonProgress.findUnique({
      where: {
        userId_lessonId: {
          userId: user.id,
          lessonId,
        },
      },
    });
    const nextPositionSeconds = Math.max(existing?.positionSeconds ?? 0, positionSeconds);
    const completedAt =
      existing?.completedAt ??
      (lesson.durationSeconds > 0 && nextPositionSeconds >= lesson.durationSeconds
        ? new Date()
        : null);

    const progress = await this.prisma.lessonProgress.upsert({
      where: {
        userId_lessonId: {
          userId: user.id,
          lessonId,
        },
      },
      create: {
        userId: user.id,
        lessonId,
        positionSeconds: nextPositionSeconds,
        completedAt,
        lastWatchedAt: new Date(),
      },
      update: {
        positionSeconds: nextPositionSeconds,
        completedAt,
        lastWatchedAt: new Date(),
      },
    });

    return mapLessonProgress(lesson, progress);
  }

  private async findCourseWithLessonsOrThrow(courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        lessons: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!course) {
      throw new AppError('NOT_FOUND', 'Course not found', HttpStatus.NOT_FOUND);
    }

    return course;
  }

  private async findLessonWithCourseOrThrow(lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        course: {
          select: {
            instructorId: true,
          },
        },
      },
    });

    if (!lesson) {
      throw new AppError('NOT_FOUND', 'Lesson not found', HttpStatus.NOT_FOUND);
    }

    return lesson;
  }

  private async ensureCanViewOwnCourseProgress(
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

type LessonForProgress = {
  id: string;
  title: string;
  durationSeconds: number;
};

type ProgressRow = {
  positionSeconds: number;
  completedAt: Date | null;
  lastWatchedAt: Date;
};

function mapLessonProgress(
  lesson: LessonForProgress,
  progress: ProgressRow | undefined,
): LessonProgressResponse {
  return {
    lessonId: lesson.id,
    title: lesson.title,
    durationSeconds: lesson.durationSeconds,
    positionSeconds: progress?.positionSeconds ?? 0,
    completedAt: progress?.completedAt?.toISOString() ?? null,
    lastWatchedAt: progress?.lastWatchedAt?.toISOString() ?? null,
  };
}

function calculatePercent(completedLessons: number, totalLessons: number): number {
  if (totalLessons === 0) {
    return 0;
  }

  return Math.round((completedLessons / totalLessons) * 100);
}
