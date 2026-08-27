import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { WsAuthService } from '../../common/realtime/ws-auth.service';
import { CoursesModule } from '../courses/courses.module';
import { QuizScoringService } from './quiz-scoring.service';
import { QuizzesController } from './quizzes.controller';
import { QuizzesGateway } from './quizzes.gateway';
import { QuizzesRealtimeService } from './quizzes.realtime.service';
import { QuizzesService } from './quizzes.service';

@Module({
  imports: [CoursesModule, JwtModule.register({})],
  controllers: [QuizzesController],
  providers: [
    QuizzesService,
    QuizScoringService,
    QuizzesRealtimeService,
    QuizzesGateway,
    WsAuthService,
  ],
})
export class QuizzesModule {}
