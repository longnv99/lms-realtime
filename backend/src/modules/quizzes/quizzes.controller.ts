import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { CreateQuizRunDto } from './dto/create-quiz-run.dto';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { QuizzesService } from './quizzes.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class QuizzesController {
  constructor(private readonly quizzesService: QuizzesService) {}

  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'INSTRUCTOR')
  @Post('lessons/:lessonId/quizzes')
  createQuiz(
    @Param('lessonId') lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateQuizDto,
  ) {
    return this.quizzesService.createQuiz(lessonId, user, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'INSTRUCTOR')
  @Patch('quizzes/:id')
  updateQuiz(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateQuizDto,
  ) {
    return this.quizzesService.updateQuiz(id, user, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'INSTRUCTOR')
  @Delete('quizzes/:id')
  deleteQuiz(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.quizzesService.deleteQuiz(id, user);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'INSTRUCTOR')
  @Post('sessions/:sessionId/quiz-runs')
  createQuizRun(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateQuizRunDto,
  ) {
    return this.quizzesService.createQuizRun(sessionId, user, dto);
  }

  @Get('quiz-runs/:id/state')
  getQuizRunState(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.quizzesService.getQuizRunState(id, user);
  }
}
