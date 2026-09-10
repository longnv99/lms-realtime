import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsString, Min, ValidateNested } from 'class-validator';
import type { ReplaceLessonTranscriptInput } from '@lms/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { LessonTranscriptsService } from './lesson-transcripts.service';

type ReplaceLessonTranscriptCueInput = ReplaceLessonTranscriptInput['cues'][number];

class ReplaceLessonTranscriptCueDto implements ReplaceLessonTranscriptCueInput {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  startSeconds!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  endSeconds!: number;

  @IsString()
  text!: string;
}

class ReplaceLessonTranscriptDto implements ReplaceLessonTranscriptInput {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReplaceLessonTranscriptCueDto)
  cues!: ReplaceLessonTranscriptCueDto[];
}

@ApiTags('learning')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller('lessons/:lessonId/transcript')
export class LessonTranscriptsController {
  constructor(private readonly lessonTranscriptsService: LessonTranscriptsService) {}

  @Get()
  getTranscript(@CurrentUser() user: AuthenticatedUser, @Param('lessonId') lessonId: string) {
    return this.lessonTranscriptsService.getTranscript(user, lessonId);
  }

  @Put()
  replaceTranscript(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lessonId') lessonId: string,
    @Body() input: ReplaceLessonTranscriptDto,
  ) {
    return this.lessonTranscriptsService.replaceTranscript(user, lessonId, input);
  }
}
