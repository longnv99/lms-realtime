import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { AppError } from '../../common/errors/app-error';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { PrismaService } from '../../prisma/prisma.service';
import { CoursesService } from '../courses/courses.service';

const enrollmentSelect = {
  id: true,
  userId: true,
  courseId: true,
  createdAt: true,
} as const;

@Injectable()
export class EnrollmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coursesService: CoursesService,
  ) {}

  async enroll(courseId: string, userId: string) {
    const course = await this.coursesService.findCourseOrThrow(courseId);

    if (course.status !== 'PUBLISHED') {
      throw new AppError(
        'COURSE_NOT_PUBLISHED',
        'Chi co the ghi danh khoa da publish',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      return await this.prisma.enrollment.create({
        data: { courseId, userId },
        select: enrollmentSelect,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError('ENROLL_ALREADY', 'Da ghi danh khoa hoc nay', HttpStatus.CONFLICT);
      }
      throw error;
    }
  }

  async unenroll(courseId: string, userId: string): Promise<{ deleted: true }> {
    try {
      await this.prisma.enrollment.delete({
        where: { userId_courseId: { userId, courseId } },
      });
      return { deleted: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new AppError('NOT_FOUND', 'Khong tim thay ghi danh', HttpStatus.NOT_FOUND);
      }
      throw error;
    }
  }

  async listCourseEnrollments(courseId: string, actor: AuthenticatedUser) {
    const course = await this.coursesService.findCourseOrThrow(courseId);
    this.coursesService.ensureCanManage(course, actor);

    return this.prisma.enrollment.findMany({
      where: { courseId },
      orderBy: { createdAt: 'asc' },
      select: {
        ...enrollmentSelect,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
  }

  async listMyEnrollments(userId: string) {
    return this.prisma.enrollment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        ...enrollmentSelect,
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
            description: true,
            status: true,
            instructorId: true,
            publishedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
  }
}
