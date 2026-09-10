import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { UpdateLessonProgressDto } from './dto/update-lesson-progress.dto';
import { ProgressService } from './progress.service';

@ApiTags('Progress')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller()
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get('me/courses/:courseId/progress')
  getMine(@Param('courseId') courseId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.progressService.getMine(courseId, user);
  }

  @Patch('me/lessons/:lessonId/progress')
  @ApiOperation({ summary: 'Update my lesson progress' })
  updateMyLessonProgress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lessonId') lessonId: string,
    @Body() input: UpdateLessonProgressDto,
  ) {
    return this.progressService.updateLessonProgress(user, lessonId, input);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'INSTRUCTOR')
  @Get('courses/:courseId/progress')
  getForCourse(@Param('courseId') courseId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.progressService.getForCourse(courseId, user);
  }
}
