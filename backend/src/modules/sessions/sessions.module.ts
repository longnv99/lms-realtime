import { Module } from '@nestjs/common';
import { CoursesModule } from '../courses/courses.module';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

@Module({
  imports: [CoursesModule],
  controllers: [SessionsController],
  providers: [SessionsService],
})
export class SessionsModule {}
