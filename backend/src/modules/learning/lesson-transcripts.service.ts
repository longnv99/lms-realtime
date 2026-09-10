import { HttpStatus, Injectable } from '@nestjs/common';
import type { LessonTranscriptResponse, ReplaceLessonTranscriptInput } from '@lms/shared';
import { AppError } from '../../common/errors/app-error';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { PrismaService } from '../../prisma/prisma.service';

export type AuthUser = AuthenticatedUser;

const lessonTranscriptCueSelect = {
  id: true,
  lessonId: true,
  startSeconds: true,
  endSeconds: true,
  text: true,
  order: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class LessonTranscriptsService {
  constructor(private readonly prisma: PrismaService) {}

  async getTranscript(user: AuthUser, lessonId: string): Promise<LessonTranscriptResponse> {
    await this.requireAccessibleLesson(user, lessonId);

    const cues = await this.prisma.lessonTranscriptCue.findMany({
      where: { lessonId },
      orderBy: { order: 'asc' },
      select: lessonTranscriptCueSelect,
    });

    return {
      lessonId,
      cues: cues.map(mapLessonTranscriptCue),
    };
  }

  async replaceTranscript(
    user: AuthUser,
    lessonId: string,
    input: ReplaceLessonTranscriptInput,
  ): Promise<LessonTranscriptResponse> {
    const lesson = await this.requireAccessibleLesson(user, lessonId);
    this.ensureCanReplaceTranscript(user, lesson.course.instructorId);

    const cues = normalizeCues(input.cues, lesson.durationSeconds);

    const savedCues = await this.prisma.$transaction(async (tx) => {
      await tx.lessonTranscriptCue.deleteMany({ where: { lessonId } });

      if (cues.length > 0) {
        await tx.lessonTranscriptCue.createMany({
          data: cues.map((cue, index) => ({
            lessonId,
            startSeconds: cue.startSeconds,
            endSeconds: cue.endSeconds,
            text: cue.text,
            order: index + 1,
          })),
        });
      }

      return tx.lessonTranscriptCue.findMany({
        where: { lessonId },
        orderBy: { order: 'asc' },
        select: lessonTranscriptCueSelect,
      });
    });

    return {
      lessonId,
      cues: savedCues.map(mapLessonTranscriptCue),
    };
  }

  private async requireAccessibleLesson(
    user: AuthUser,
    lessonId: string,
  ): Promise<AccessibleLesson> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: {
        id: true,
        courseId: true,
        durationSeconds: true,
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

    if (user.role === 'ADMIN' || lesson.course.instructorId === user.id) {
      return lesson;
    }

    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: user.id,
          courseId: lesson.courseId,
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

    return lesson;
  }

  private ensureCanReplaceTranscript(user: AuthUser, instructorId: string): void {
    if (user.role === 'ADMIN' || user.id === instructorId) {
      return;
    }

    throw new AppError(
      'AUTH_FORBIDDEN',
      'Only admins or the course instructor can replace lesson transcripts',
      HttpStatus.FORBIDDEN,
    );
  }
}

type AccessibleLesson = {
  id: string;
  courseId: string;
  durationSeconds: number;
  course: {
    instructorId: string;
  };
};

type LessonTranscriptCueRow = {
  id: string;
  lessonId: string;
  startSeconds: number;
  endSeconds: number;
  text: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
};

type NormalizedCue = {
  startSeconds: number;
  endSeconds: number;
  text: string;
};

function normalizeCues(
  cues: ReplaceLessonTranscriptInput['cues'],
  durationSeconds: number,
): NormalizedCue[] {
  if (!Array.isArray(cues)) {
    throw new AppError(
      'VALIDATION_FAILED',
      'Transcript cues must be an array',
      HttpStatus.BAD_REQUEST,
    );
  }

  return cues.map((cue) => normalizeCue(cue, durationSeconds));
}

function normalizeCue(
  cue: ReplaceLessonTranscriptInput['cues'][number],
  durationSeconds: number,
): NormalizedCue {
  const text = cue.text.trim();

  if (text.length < 1 || text.length > 1000) {
    throw new AppError(
      'VALIDATION_FAILED',
      'Transcript cue text must be between 1 and 1000 characters',
      HttpStatus.BAD_REQUEST,
    );
  }

  if (
    !Number.isInteger(cue.startSeconds) ||
    !Number.isInteger(cue.endSeconds) ||
    cue.startSeconds < 0 ||
    cue.startSeconds >= cue.endSeconds ||
    cue.endSeconds > durationSeconds
  ) {
    throw new AppError(
      'VALIDATION_FAILED',
      'Transcript cue timing must be within the lesson duration',
      HttpStatus.BAD_REQUEST,
    );
  }

  return {
    startSeconds: cue.startSeconds,
    endSeconds: cue.endSeconds,
    text,
  };
}

function mapLessonTranscriptCue(cue: LessonTranscriptCueRow) {
  return {
    id: cue.id,
    lessonId: cue.lessonId,
    startSeconds: cue.startSeconds,
    endSeconds: cue.endSeconds,
    text: cue.text,
    order: cue.order,
    createdAt: cue.createdAt.toISOString(),
    updatedAt: cue.updatedAt.toISOString(),
  };
}
