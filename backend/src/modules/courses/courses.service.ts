import { HttpStatus, Injectable } from '@nestjs/common';
import type { CourseStatus } from '@lms/shared';
import { Prisma } from '../../generated/prisma/client';
import { AppError } from '../../common/errors/app-error';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import type { PaginatedData } from '../../common/utils/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsProducer } from '../notifications/notifications.producer';
import { CreateCourseDto } from './dto/create-course.dto';
import { ListCoursesQueryDto } from './dto/list-courses-query.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

const courseSelect = {
  id: true,
  title: true,
  slug: true,
  description: true,
  status: true,
  instructorId: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type PublicCourse = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: CourseStatus;
  instructorId: string;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class CoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsProducer: NotificationsProducer,
  ) {}

  async create(instructorId: string, dto: CreateCourseDto): Promise<PublicCourse> {
    try {
      return await this.prisma.course.create({
        data: {
          title: dto.title,
          slug: dto.slug,
          description: dto.description,
          instructorId,
        },
        select: courseSelect,
      });
    } catch (error) {
      this.throwSlugTakenIfUniqueError(error);
      throw error;
    }
  }

  async findMany(query: ListCoursesQueryDto): Promise<PaginatedData<PublicCourse>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where: Prisma.CourseWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.keyword) {
      where.OR = [{ title: { contains: query.keyword } }, { slug: { contains: query.keyword } }];
    }

    const [courses, total] = await this.prisma.$transaction([
      this.prisma.course.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: courseSelect,
      }),
      this.prisma.course.count({ where }),
    ]);

    return { data: courses, meta: { page, limit, total } };
  }

  async findOne(id: string): Promise<PublicCourse> {
    return this.findCourseOrThrow(id);
  }

  async update(id: string, actor: AuthenticatedUser, dto: UpdateCourseDto): Promise<PublicCourse> {
    const course = await this.findCourseOrThrow(id);
    this.ensureCanManage(course, actor);

    try {
      return await this.prisma.course.update({
        where: { id },
        data: {
          title: dto.title,
          slug: dto.slug,
          description: dto.description,
        },
        select: courseSelect,
      });
    } catch (error) {
      this.throwSlugTakenIfUniqueError(error);
      throw error;
    }
  }

  async remove(id: string, actor: AuthenticatedUser): Promise<{ deleted: true }> {
    const course = await this.findCourseOrThrow(id);
    this.ensureCanManage(course, actor);

    await this.prisma.course.delete({ where: { id } });
    return { deleted: true };
  }

  async publish(id: string, actor: AuthenticatedUser): Promise<PublicCourse> {
    const course = await this.findCourseOrThrow(id);
    this.ensureCanManage(course, actor);

    const publishedAt = new Date();
    const updated = await this.prisma.course.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt },
      select: courseSelect,
    });
    await this.notificationsProducer.enqueueCoursePublished(updated.id, publishedAt);

    return updated;
  }

  async unpublish(id: string, actor: AuthenticatedUser): Promise<PublicCourse> {
    const course = await this.findCourseOrThrow(id);
    this.ensureCanManage(course, actor);

    return this.prisma.course.update({
      where: { id },
      data: { status: 'DRAFT', publishedAt: null },
      select: courseSelect,
    });
  }

  async findCourseOrThrow(id: string): Promise<PublicCourse> {
    const course = await this.prisma.course.findUnique({
      where: { id },
      select: courseSelect,
    });

    if (!course) {
      throw new AppError('NOT_FOUND', 'Khong tim thay khoa hoc', HttpStatus.NOT_FOUND);
    }

    return course;
  }

  ensureCanManage(course: Pick<PublicCourse, 'instructorId'>, actor: AuthenticatedUser): void {
    if (actor.role !== 'ADMIN' && course.instructorId !== actor.id) {
      throw new AppError(
        'AUTH_FORBIDDEN',
        'Khong co quyen thao tac khoa hoc nay',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private throwSlugTakenIfUniqueError(error: unknown): never | void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError('COURSE_SLUG_TAKEN', 'Slug khoa hoc da ton tai', HttpStatus.CONFLICT);
    }
  }
}
