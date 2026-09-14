import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('me/courses/:courseId/analytics')
  @ApiOperation({ summary: 'Get my course assessment analytics' })
  getMyCourseAnalytics(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.analyticsService.getMyCourseAnalytics(courseId, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'INSTRUCTOR')
  @Get('courses/:courseId/analytics')
  @ApiOperation({ summary: 'Get instructor course analytics' })
  getCourseAnalytics(@Param('courseId') courseId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.analyticsService.getInstructorCourseAnalytics(courseId, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'INSTRUCTOR')
  @Get('courses/:courseId/analytics/export')
  @ApiOperation({ summary: 'Export course analytics as CSV' })
  async exportCourseAnalytics(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('kind') kind: 'students' | 'questions' = 'students',
    @Res() response: Response,
  ) {
    const csv = await this.analyticsService.exportCourseAnalyticsCsv(courseId, user, kind);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${csv.fileName}"`);
    response.send(csv.content);
  }
}
