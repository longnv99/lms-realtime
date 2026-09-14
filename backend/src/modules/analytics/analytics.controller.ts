import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('me/courses/:courseId/analytics')
  getMyCourseAnalytics(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.analyticsService.getMyCourseAnalytics(courseId, user);
  }
}
