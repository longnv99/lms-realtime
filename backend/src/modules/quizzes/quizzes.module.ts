import { Module } from '@nestjs/common';
import { CoursesModule } from '../courses/courses.module';
import { QuizScoringService } from './quiz-scoring.service';
import { QuizzesController } from './quizzes.controller';
import { QuizzesRealtimeService } from './quizzes.realtime.service';
import { QuizzesService } from './quizzes.service';

@Module({
  imports: [CoursesModule],
  controllers: [QuizzesController],
  providers: [QuizzesService, QuizScoringService, QuizzesRealtimeService],
})
export class QuizzesModule {}
