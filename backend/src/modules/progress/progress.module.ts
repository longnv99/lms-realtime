import { Module } from '@nestjs/common';
import { CoursesModule } from '../courses/courses.module';
import { env } from '../../config/env';
import { ProgressController } from './progress.controller';
import { ProgressProcessor } from './progress.processor';
import { ProgressProducer } from './progress.producer';
import { ProgressService } from './progress.service';

const progressProducerProvider =
  env.NODE_ENV === 'test'
    ? {
        provide: ProgressProducer,
        useValue: {
          enqueueProgressFlush: async () => undefined,
        },
      }
    : ProgressProducer;

const providers = [
  ProgressService,
  progressProducerProvider,
  ...(env.NODE_ENV === 'test' ? [] : [ProgressProcessor]),
];

@Module({
  imports: [CoursesModule],
  controllers: [ProgressController],
  providers,
  exports: [ProgressProducer, ProgressService],
})
export class ProgressModule {}
