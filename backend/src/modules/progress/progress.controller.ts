import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'INSTRUCTOR')
  @Get('courses/:courseId/progress')
  getForCourse(@Param('courseId') courseId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.progressService.getForCourse(courseId, user);
  }
}
