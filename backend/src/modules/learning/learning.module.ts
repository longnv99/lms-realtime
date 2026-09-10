import { Module } from '@nestjs/common';
import { LessonNotesController } from './lesson-notes.controller';
import { LessonNotesService } from './lesson-notes.service';
import { LessonTranscriptsController } from './lesson-transcripts.controller';
import { LessonTranscriptsService } from './lesson-transcripts.service';

@Module({
  controllers: [LessonNotesController, LessonTranscriptsController],
  providers: [LessonNotesService, LessonTranscriptsService],
})
export class LearningModule {}
