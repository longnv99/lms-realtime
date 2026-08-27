import { HttpStatus, Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { PrismaService } from '../../prisma/prisma.service';
import { CoursesService } from '../courses/courses.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { ReorderLessonsDto } from './dto/reorder-lessons.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';

const lessonSelect = {
  id: true,
  courseId: true,
  title: true,
  description: true,
  order: true,
  durationSeconds: true,
  mediaAssetId: true,
  createdAt: true,
  updatedAt: true,
} as const;

type PublicLesson = {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  order: number;
  durationSeconds: number;
  mediaAssetId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class LessonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coursesService: CoursesService,
  ) {}

  async create(
    courseId: string,
    actor: AuthenticatedUser,
    dto: CreateLessonDto,
  ): Promise<PublicLesson> {
    const course = await this.coursesService.findCourseOrThrow(courseId);
    this.coursesService.ensureCanManage(course, actor);
    await this.ensureMediaAssetReady(dto.mediaAssetId);

    const max = await this.prisma.lesson.aggregate({
      where: { courseId },
      _max: { order: true },
    });
    const nextOrder = (max._max.order ?? 0) + 1;

    return this.prisma.lesson.create({
      data: {
        courseId,
        title: dto.title,
        description: dto.description,
        durationSeconds: dto.durationSeconds ?? 0,
        mediaAssetId: dto.mediaAssetId,
        order: nextOrder,
      },
      select: lessonSelect,
    });
  }

  async findMany(courseId: string): Promise<PublicLesson[]> {
    await this.coursesService.findCourseOrThrow(courseId);

    return this.prisma.lesson.findMany({
      where: { courseId },
      orderBy: { order: 'asc' },
      select: lessonSelect,
    });
  }

  async update(
    id: string,
    actor: AuthenticatedUser,
    dto: UpdateLessonDto,
  ): Promise<PublicLesson> {
    const lesson = await this.findLessonWithCourseOrThrow(id);
    this.coursesService.ensureCanManage(lesson.course, actor);
    await this.ensureMediaAssetReady(dto.mediaAssetId);

    return this.prisma.lesson.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        durationSeconds: dto.durationSeconds,
        mediaAssetId: dto.mediaAssetId,
      },
      select: lessonSelect,
    });
  }

  async remove(id: string, actor: AuthenticatedUser): Promise<{ deleted: true }> {
    const lesson = await this.findLessonWithCourseOrThrow(id);
    this.coursesService.ensureCanManage(lesson.course, actor);

    await this.prisma.lesson.delete({ where: { id } });
    return { deleted: true };
  }

  async reorder(
    courseId: string,
    actor: AuthenticatedUser,
    dto: ReorderLessonsDto,
  ): Promise<PublicLesson[]> {
    const course = await this.coursesService.findCourseOrThrow(courseId);
    this.coursesService.ensureCanManage(course, actor);

    const ids = dto.items.map((item) => item.id);
    const lessons = await this.prisma.lesson.findMany({
      where: { id: { in: ids } },
      select: { id: true, courseId: true },
    });

    if (lessons.length !== ids.length || lessons.some((lesson) => lesson.courseId !== courseId)) {
      throw new AppError('NOT_FOUND', 'Khong tim thay lesson trong khoa hoc', HttpStatus.NOT_FOUND);
    }

    const offset = Math.max(...dto.items.map((item) => item.order)) + dto.items.length + 1;
    await this.prisma.$transaction([
      ...dto.items.map((item, index) =>
        this.prisma.lesson.update({
          where: { id: item.id },
          data: { order: offset + index },
        }),
      ),
      ...dto.items.map((item) =>
        this.prisma.lesson.update({
          where: { id: item.id },
          data: { order: item.order },
        }),
      ),
    ]);

    return this.findMany(courseId);
  }

  private async findLessonWithCourseOrThrow(id: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
      include: {
        course: {
          select: {
            instructorId: true,
          },
        },
      },
    });

    if (!lesson) {
      throw new AppError('NOT_FOUND', 'Khong tim thay lesson', HttpStatus.NOT_FOUND);
    }

    return lesson;
  }

  private async ensureMediaAssetReady(mediaAssetId: string | undefined): Promise<void> {
    if (!mediaAssetId) {
      return;
    }

    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: mediaAssetId },
      select: { status: true },
    });

    if (asset?.status !== 'UPLOADED') {
      throw new AppError(
        'LESSON_MEDIA_NOT_READY',
        'Media cua lesson chua san sang',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
