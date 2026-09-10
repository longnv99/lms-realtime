import { HttpStatus, Injectable } from '@nestjs/common';
import type { CreateLessonNoteInput, LessonNoteResponse, UpdateLessonNoteInput } from '@lms/shared';
import { AppError } from '../../common/errors/app-error';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { PrismaService } from '../../prisma/prisma.service';

export type AuthUser = AuthenticatedUser;

const lessonNoteSelect = {
  id: true,
  userId: true,
  lessonId: true,
  body: true,
  positionSeconds: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class LessonNotesService {
  constructor(private readonly prisma: PrismaService) {}

  async listMine(user: AuthUser, lessonId: string): Promise<LessonNoteResponse[]> {
    await this.requireAccessibleLesson(user, lessonId);

    const notes = await this.prisma.lessonNote.findMany({
      where: {
        userId: user.id,
        lessonId,
      },
      orderBy: [{ positionSeconds: 'asc' }, { createdAt: 'asc' }],
      select: lessonNoteSelect,
    });

    return notes.map(mapLessonNote);
  }

  async createMine(
    user: AuthUser,
    lessonId: string,
    input: CreateLessonNoteInput,
  ): Promise<LessonNoteResponse> {
    const lesson = await this.requireAccessibleLesson(user, lessonId);
    const body = normalizeBody(input.body);
    const positionSeconds = normalizePosition(
      input.positionSeconds ?? null,
      lesson.durationSeconds,
    );

    const note = await this.prisma.lessonNote.create({
      data: {
        userId: user.id,
        lessonId,
        body,
        positionSeconds,
      },
      select: lessonNoteSelect,
    });

    return mapLessonNote(note);
  }

  async updateMine(
    user: AuthUser,
    noteId: string,
    input: UpdateLessonNoteInput,
  ): Promise<LessonNoteResponse> {
    const existing = await this.findNoteWithLessonOrThrow(noteId);
    this.ensureOwnsNote(user, existing.userId);

    const data: { body: string; positionSeconds?: number | null } = {
      body: normalizeBody(input.body),
    };

    if (Object.prototype.hasOwnProperty.call(input, 'positionSeconds')) {
      data.positionSeconds = normalizePosition(
        input.positionSeconds ?? null,
        existing.lesson.durationSeconds,
      );
    }

    const note = await this.prisma.lessonNote.update({
      where: { id: noteId },
      data,
      select: lessonNoteSelect,
    });

    return mapLessonNote(note);
  }

  async deleteMine(user: AuthUser, noteId: string): Promise<void> {
    const existing = await this.findNoteWithLessonOrThrow(noteId);
    this.ensureOwnsNote(user, existing.userId);

    await this.prisma.lessonNote.delete({ where: { id: noteId } });
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

  private async findNoteWithLessonOrThrow(noteId: string): Promise<LessonNoteWithLesson> {
    const note = await this.prisma.lessonNote.findUnique({
      where: { id: noteId },
      select: {
        id: true,
        userId: true,
        lesson: {
          select: {
            durationSeconds: true,
          },
        },
      },
    });

    if (!note) {
      throw new AppError('NOT_FOUND', 'Lesson note not found', HttpStatus.NOT_FOUND);
    }

    return note;
  }

  private ensureOwnsNote(user: AuthUser, noteUserId: string): void {
    if (noteUserId !== user.id) {
      throw new AppError(
        'AUTH_FORBIDDEN',
        'You can only change your own lesson notes',
        HttpStatus.FORBIDDEN,
      );
    }
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

type LessonNoteWithLesson = {
  id: string;
  userId: string;
  lesson: {
    durationSeconds: number;
  };
};

type LessonNoteRow = {
  id: string;
  userId: string;
  lessonId: string;
  body: string;
  positionSeconds: number | null;
  createdAt: Date;
  updatedAt: Date;
};

function normalizeBody(body: string): string {
  const trimmed = body.trim();

  if (trimmed.length < 1 || trimmed.length > 4000) {
    throw new AppError(
      'VALIDATION_FAILED',
      'Lesson note body must be between 1 and 4000 characters',
      HttpStatus.BAD_REQUEST,
    );
  }

  return trimmed;
}

function normalizePosition(positionSeconds: number | null, durationSeconds: number): number | null {
  if (positionSeconds === null) {
    return null;
  }

  if (
    !Number.isInteger(positionSeconds) ||
    positionSeconds < 0 ||
    positionSeconds > durationSeconds
  ) {
    throw new AppError(
      'VALIDATION_FAILED',
      'Lesson note position must be null or within the lesson duration',
      HttpStatus.BAD_REQUEST,
    );
  }

  return positionSeconds;
}

function mapLessonNote(note: LessonNoteRow): LessonNoteResponse {
  return {
    id: note.id,
    userId: note.userId,
    lessonId: note.lessonId,
    body: note.body,
    positionSeconds: note.positionSeconds,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}
