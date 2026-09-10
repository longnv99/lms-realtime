import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import type { CreateLessonNoteInput, UpdateLessonNoteInput } from '@lms/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { LessonNotesService } from './lesson-notes.service';

class CreateLessonNoteDto implements CreateLessonNoteInput {
  @IsString()
  @MaxLength(4000)
  body!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  positionSeconds?: number | null;
}

class UpdateLessonNoteDto implements UpdateLessonNoteInput {
  @IsString()
  @MaxLength(4000)
  body!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  positionSeconds?: number | null;
}

@ApiTags('learning')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller()
export class LessonNotesController {
  constructor(private readonly lessonNotesService: LessonNotesService) {}

  @Get('me/lessons/:lessonId/notes')
  listMine(@CurrentUser() user: AuthenticatedUser, @Param('lessonId') lessonId: string) {
    return this.lessonNotesService.listMine(user, lessonId);
  }

  @Post('me/lessons/:lessonId/notes')
  createMine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lessonId') lessonId: string,
    @Body() input: CreateLessonNoteDto,
  ) {
    return this.lessonNotesService.createMine(user, lessonId, input);
  }

  @Patch('me/lesson-notes/:noteId')
  updateMine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('noteId') noteId: string,
    @Body() input: UpdateLessonNoteDto,
  ) {
    return this.lessonNotesService.updateMine(user, noteId, input);
  }

  @Delete('me/lesson-notes/:noteId')
  @HttpCode(204)
  deleteMine(@CurrentUser() user: AuthenticatedUser, @Param('noteId') noteId: string) {
    return this.lessonNotesService.deleteMine(user, noteId);
  }
}
