import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { AppError } from '../../common/errors/app-error';
import type { PaginatedData } from '../../common/utils/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} as const;

type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findMe(userId: string): Promise<PublicUser> {
    return this.findUserOrThrow(userId);
  }

  async updateMe(userId: string, dto: UpdateMeDto): Promise<PublicUser> {
    return this.updateUserRecord(userId, { name: dto.name });
  }

  async listUsers(query: ListUsersQueryDto): Promise<PaginatedData<PublicUser>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
        select: userSelect,
      }),
      this.prisma.user.count(),
    ]);

    return {
      data: users,
      meta: { page, limit, total },
    };
  }

  async updateUser(id: string, dto: UpdateUserDto): Promise<PublicUser> {
    return this.updateUserRecord(id, {
      name: dto.name,
      role: dto.role,
    });
  }

  async deleteUser(id: string): Promise<{ deleted: true }> {
    try {
      await this.prisma.user.delete({ where: { id } });
      return { deleted: true };
    } catch (error) {
      this.throwNotFoundIfMissing(error);
      throw error;
    }
  }

  private async findUserOrThrow(id: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });

    if (!user) {
      throw new AppError('NOT_FOUND', 'Khong tim thay nguoi dung', HttpStatus.NOT_FOUND);
    }

    return user;
  }

  private async updateUserRecord(
    id: string,
    data: { name?: string; role?: UpdateUserDto['role'] },
  ): Promise<PublicUser> {
    try {
      return await this.prisma.user.update({
        where: { id },
        data,
        select: userSelect,
      });
    } catch (error) {
      this.throwNotFoundIfMissing(error);
      throw error;
    }
  }

  private throwNotFoundIfMissing(error: unknown): never | void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw new AppError('NOT_FOUND', 'Khong tim thay nguoi dung', HttpStatus.NOT_FOUND);
    }
  }
}
