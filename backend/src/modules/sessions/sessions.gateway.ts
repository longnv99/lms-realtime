import { HttpStatus, UseFilters, UsePipes } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AppError } from '../../common/errors/app-error';
import { WsAllExceptionsFilter } from '../../common/realtime/ws-exception.filter';
import { WsAuthService } from '../../common/realtime/ws-auth.service';
import { wsValidationPipe } from '../../common/realtime/ws-validation.pipe';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { ProgressHeartbeatDto } from '../progress/dto/progress-heartbeat.dto';
import { ProgressProducer } from '../progress/progress.producer';
import { ChatSendDto } from './dto/chat-send.dto';
import { SessionJoinDto } from './dto/session-join.dto';
import { SessionsRealtimeService } from './sessions.realtime.service';

@UseFilters(new WsAllExceptionsFilter())
@UsePipes(wsValidationPipe)
@WebSocketGateway({ namespace: '/sessions' })
export class SessionsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly wsAuth: WsAuthService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly realtime: SessionsRealtimeService,
    private readonly progressProducer: ProgressProducer,
  ) {}

  afterInit(server: Server): void {
    this.realtime.registerServer(server);
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      client.data.user = await this.wsAuth.authenticate(client);
    } catch {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const user = client.data.user as AuthenticatedUser | undefined;
    const sessionIds = (client.data.sessionIds ?? []) as string[];

    if (!user) {
      return;
    }

    for (const sessionId of sessionIds) {
      try {
        await this.redis.getClient().srem(this.participantsKey(sessionId), user.id);
        await this.emitState(sessionId);
      } catch {
        // The app may be shutting down while Socket.IO disconnect handlers are flushing.
      }
    }
  }

  @SubscribeMessage('session:join')
  async join(@ConnectedSocket() client: Socket, @MessageBody() dto: SessionJoinDto): Promise<void> {
    const user = client.data.user as AuthenticatedUser;
    const session = await this.findLiveSessionForUser(dto.sessionId, user);

    await client.join(`session:${session.id}`);
    if (user.role === 'ADMIN' || session.course.instructorId === user.id) {
      await client.join(`course:${session.courseId}:instructors`);
    }
    client.data.sessionIds = [...new Set([...(client.data.sessionIds ?? []), session.id])];
    await this.redis.getClient().sadd(this.participantsKey(session.id), user.id);
    await this.emitState(session.id);
  }

  @SubscribeMessage('chat:send')
  async sendChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: ChatSendDto,
  ): Promise<void> {
    const user = client.data.user as AuthenticatedUser;
    await this.findLiveSessionForUser(dto.sessionId, user);

    const message = await this.prisma.chatMessage.create({
      data: { sessionId: dto.sessionId, userId: user.id, content: dto.content.trim() },
      include: { user: { select: { name: true } } },
    });

    this.realtime.emitChatMessage(dto.sessionId, {
      id: message.id,
      sessionId: message.sessionId,
      userId: message.userId,
      name: message.user.name,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    });
  }

  @SubscribeMessage('progress:heartbeat')
  async recordProgressHeartbeat(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: ProgressHeartbeatDto,
  ): Promise<void> {
    const user = client.data.user as AuthenticatedUser;
    const { lesson, session } = await this.findJoinedLiveSessionForLesson(
      client,
      user,
      dto.lessonId,
    );
    const key = this.progressKey(user.id, dto.lessonId);
    const redisClient = this.redis.getClient();
    const existingProgress = await redisClient.hgetall(key);
    const existingPositionSeconds = Number(existingProgress.positionSeconds ?? 0);
    const nextPositionSeconds = Math.max(existingPositionSeconds, dto.positionSeconds);

    await redisClient.hset(key, {
      courseId: lesson.courseId,
      sessionId: session.id,
      positionSeconds: String(nextPositionSeconds),
      updatedAt: new Date().toISOString(),
    });
    await this.progressProducer.enqueueProgressFlush(user.id, dto.lessonId);
    await this.emitCompletionProgressIfNeeded(
      lesson,
      user,
      nextPositionSeconds,
      existingProgress.completionEmittedAt,
    );
  }

  private async emitState(sessionId: string): Promise<void> {
    const session = await this.prisma.session.findUniqueOrThrow({
      where: { id: sessionId },
      select: { id: true, status: true },
    });
    const participantCount = await this.redis.getClient().scard(this.participantsKey(sessionId));

    this.realtime.emitSessionState(sessionId, {
      id: session.id,
      status: session.status,
      participantCount,
    });
  }

  private async findLiveSessionForUser(sessionId: string, user: AuthenticatedUser) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { course: { select: { instructorId: true } } },
    });

    if (!session || session.status !== 'LIVE') {
      throw new AppError('CONFLICT', 'Session chua live', HttpStatus.CONFLICT);
    }

    if (user.role === 'ADMIN' || session.course.instructorId === user.id) {
      return session;
    }

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: user.id, courseId: session.courseId } },
      select: { id: true },
    });

    if (!enrollment) {
      throw new AppError('AUTH_FORBIDDEN', 'Khong co quyen vao session', HttpStatus.FORBIDDEN);
    }

    return session;
  }

  private async findJoinedLiveSessionForLesson(
    client: Socket,
    user: AuthenticatedUser,
    lessonId: string,
  ) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { course: { select: { instructorId: true } } },
    });

    if (!lesson) {
      throw new AppError('NOT_FOUND', 'Lesson not found', HttpStatus.NOT_FOUND);
    }

    const sessionIds = (client.data.sessionIds ?? []) as string[];
    const session = await this.prisma.session.findFirst({
      where: {
        id: { in: sessionIds },
        courseId: lesson.courseId,
        status: 'LIVE',
      },
      select: { id: true, courseId: true },
    });

    if (!session) {
      throw new AppError(
        'CONFLICT',
        'Join a live session before sending progress',
        HttpStatus.CONFLICT,
      );
    }

    if (user.role === 'ADMIN' || lesson.course.instructorId === user.id) {
      return { lesson, session };
    }

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: user.id, courseId: lesson.courseId } },
      select: { id: true },
    });

    if (!enrollment) {
      throw new AppError(
        'AUTH_FORBIDDEN',
        'You are not enrolled in this course',
        HttpStatus.FORBIDDEN,
      );
    }

    return { lesson, session };
  }

  private async emitCompletionProgressIfNeeded(
    lesson: { id: string; courseId: string; durationSeconds: number },
    user: AuthenticatedUser,
    positionSeconds: number,
    completionEmittedAt?: string,
  ): Promise<void> {
    if (
      lesson.durationSeconds <= 0 ||
      positionSeconds < lesson.durationSeconds ||
      completionEmittedAt
    ) {
      return;
    }

    const existingProgress = await this.prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId: user.id, lessonId: lesson.id } },
      select: { completedAt: true },
    });

    if (existingProgress?.completedAt) {
      return;
    }

    const [totalLessons, completedRows] = await Promise.all([
      this.prisma.lesson.count({ where: { courseId: lesson.courseId } }),
      this.prisma.lessonProgress.findMany({
        where: {
          userId: user.id,
          completedAt: { not: null },
          lesson: { courseId: lesson.courseId },
        },
        select: { lessonId: true },
      }),
    ]);
    const completedLessonIds = new Set(completedRows.map((progress) => progress.lessonId));
    completedLessonIds.add(lesson.id);
    const percent =
      totalLessons === 0 ? 0 : Math.round((completedLessonIds.size / totalLessons) * 100);

    await this.redis.getClient().hset(this.progressKey(user.id, lesson.id), {
      completionEmittedAt: new Date().toISOString(),
    });
    this.realtime.emitProgressUpdated(lesson.courseId, {
      courseId: lesson.courseId,
      lessonId: lesson.id,
      userId: user.id,
      percent,
    });
  }

  private participantsKey(sessionId: string): string {
    return `session:${sessionId}:participants`;
  }

  private progressKey(userId: string, lessonId: string): string {
    return `progress:${userId}:${lessonId}`;
  }
}
