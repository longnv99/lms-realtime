import { Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { EnrollmentsService } from './enrollments.service';

@ApiTags('Enrollments')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller()
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Post('courses/:courseId/enroll')
  enroll(@Param('courseId') courseId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.enrollmentsService.enroll(courseId, user.id);
  }

  @Delete('courses/:courseId/enroll')
  unenroll(@Param('courseId') courseId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.enrollmentsService.unenroll(courseId, user.id);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'INSTRUCTOR')
  @Get('courses/:courseId/enrollments')
  listCourseEnrollments(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.enrollmentsService.listCourseEnrollments(courseId, user);
  }

  @Get('me/enrollments')
  listMyEnrollments(@CurrentUser() user: AuthenticatedUser) {
    return this.enrollmentsService.listMyEnrollments(user.id);
  }
}
