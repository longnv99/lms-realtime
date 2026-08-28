import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { ReorderLessonsDto } from './dto/reorder-lessons.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { LessonsService } from './lessons.service';

@ApiTags('Lessons')
@Controller()
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles('ADMIN', 'INSTRUCTOR')
  @Post('courses/:courseId/lessons')
  create(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLessonDto,
  ) {
    return this.lessonsService.create(courseId, user, dto);
  }

  @Get('courses/:courseId/lessons')
  findMany(@Param('courseId') courseId: string) {
    return this.lessonsService.findMany(courseId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles('ADMIN', 'INSTRUCTOR')
  @Patch('courses/:courseId/lessons/reorder')
  reorder(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReorderLessonsDto,
  ) {
    return this.lessonsService.reorder(courseId, user, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles('ADMIN', 'INSTRUCTOR')
  @Patch('lessons/:id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateLessonDto,
  ) {
    return this.lessonsService.update(id, user, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles('ADMIN', 'INSTRUCTOR')
  @Delete('lessons/:id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.lessonsService.remove(id, user);
  }
}
