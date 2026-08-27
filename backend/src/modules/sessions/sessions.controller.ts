import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { SessionsService } from './sessions.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'INSTRUCTOR')
  @Post('courses/:courseId/sessions')
  create(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSessionDto,
  ) {
    return this.sessionsService.create(courseId, user, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'INSTRUCTOR')
  @Patch('sessions/:id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSessionDto,
  ) {
    return this.sessionsService.update(id, user, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'INSTRUCTOR')
  @Delete('sessions/:id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.remove(id, user);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'INSTRUCTOR')
  @Post('sessions/:id/start')
  start(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.start(id, user);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'INSTRUCTOR')
  @Post('sessions/:id/end')
  end(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.end(id, user);
  }

  @Get('sessions/:id/state')
  getState(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.getState(id, user);
  }
}
