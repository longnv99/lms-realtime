import { HttpStatus, Injectable } from '@nestjs/common';
import type { SessionStatus } from '@lms/shared';
import { AppError } from '../../common/errors/app-error';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { PrismaService } from '../../prisma/prisma.service';
import { CoursesService } from '../courses/courses.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { SessionsRealtimeService } from './sessions.realtime.service';

const sessionSelect = {
  id: true,
  courseId: true,
  title: true,
  startsAt: true,
  endsAt: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

type PublicSession = {
  id: string;
  courseId: string;
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  status: SessionStatus;
  createdAt: Date;
  updatedAt: Date;
};

type SessionWithCourse = PublicSession & {
  course: {
    instructorId: string;
  };
};

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coursesService: CoursesService,
    private readonly sessionsRealtime: SessionsRealtimeService,
  ) {}

  async create(
    courseId: string,
    actor: AuthenticatedUser,
    dto: CreateSessionDto,
  ): Promise<PublicSession> {
    const course = await this.coursesService.findCourseOrThrow(courseId);
    this.coursesService.ensureCanManage(course, actor);

    return this.prisma.session.create({
      data: {
        courseId,
        title: dto.title,
        startsAt: new Date(dto.startsAt),
      },
      select: sessionSelect,
    });
  }

  async update(
    id: string,
    actor: AuthenticatedUser,
    dto: UpdateSessionDto,
  ): Promise<PublicSession> {
    const session = await this.findSessionWithCourseOrThrow(id);
    this.coursesService.ensureCanManage(session.course, actor);

    if (dto.status === 'CANCELLED' && session.status !== 'SCHEDULED') {
      this.throwInvalidTransition();
    }

    return this.prisma.session.update({
      where: { id },
      data: {
        title: dto.title,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        status: dto.status,
      },
      select: sessionSelect,
    });
  }

  async remove(id: string, actor: AuthenticatedUser): Promise<{ deleted: true }> {
    const session = await this.findSessionWithCourseOrThrow(id);
    this.coursesService.ensureCanManage(session.course, actor);

    await this.prisma.session.delete({ where: { id } });
    return { deleted: true };
  }

  async start(id: string, actor: AuthenticatedUser): Promise<PublicSession> {
    const session = await this.findSessionWithCourseOrThrow(id);
    this.coursesService.ensureCanManage(session.course, actor);

    if (session.status !== 'SCHEDULED') {
      this.throwInvalidTransition();
    }

    const updated = await this.prisma.session.update({
      where: { id },
      data: { status: 'LIVE' },
      select: sessionSelect,
    });
    this.sessionsRealtime.emitSessionState(updated.id, {
      id: updated.id,
      status: updated.status,
      participantCount: 0,
    });

    return updated;
  }

  async end(id: string, actor: AuthenticatedUser): Promise<PublicSession> {
    const session = await this.findSessionWithCourseOrThrow(id);
    this.coursesService.ensureCanManage(session.course, actor);

    if (session.status !== 'LIVE') {
      this.throwInvalidTransition();
    }

    const updated = await this.prisma.session.update({
      where: { id },
      data: { status: 'ENDED', endsAt: new Date() },
      select: sessionSelect,
    });
    this.sessionsRealtime.emitSessionState(updated.id, {
      id: updated.id,
      status: updated.status,
      participantCount: 0,
    });

    return updated;
  }

  async getState(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<{ id: string; status: SessionStatus; participantCount: 0 }> {
    const session = await this.findSessionWithCourseOrThrow(id);
    await this.ensureCanViewState(session, actor);

    return {
      id: session.id,
      status: session.status,
      participantCount: 0,
    };
  }

  private async ensureCanViewState(
    session: SessionWithCourse,
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
        'Khong co quyen xem trang thai session',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private async findSessionWithCourseOrThrow(id: string): Promise<SessionWithCourse> {
    const session = await this.prisma.session.findUnique({
      where: { id },
      include: {
        course: {
          select: { instructorId: true },
        },
      },
    });

    if (!session) {
      throw new AppError('NOT_FOUND', 'Khong tim thay session', HttpStatus.NOT_FOUND);
    }

    return session as SessionWithCourse;
  }

  private throwInvalidTransition(): never {
    throw new AppError('CONFLICT', 'Trang thai session khong hop le', HttpStatus.CONFLICT);
  }
}
