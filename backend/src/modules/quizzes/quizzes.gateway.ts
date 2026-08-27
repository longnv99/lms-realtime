import { UseFilters, UsePipes } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WsAuthService } from '../../common/realtime/ws-auth.service';
import { WsAllExceptionsFilter } from '../../common/realtime/ws-exception.filter';
import { wsValidationPipe } from '../../common/realtime/ws-validation.pipe';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { QuizAnswerDto } from './dto/quiz-answer.dto';
import { QuizJoinDto } from './dto/quiz-join.dto';
import { QuizzesRealtimeService } from './quizzes.realtime.service';
import { QuizzesService } from './quizzes.service';

@UseFilters(new WsAllExceptionsFilter())
@UsePipes(wsValidationPipe)
@WebSocketGateway({ namespace: '/quiz' })
export class QuizzesGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly wsAuth: WsAuthService,
    private readonly quizzesService: QuizzesService,
    private readonly realtime: QuizzesRealtimeService,
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

  @SubscribeMessage('quiz:join')
  async join(@ConnectedSocket() client: Socket, @MessageBody() dto: QuizJoinDto): Promise<void> {
    const user = client.data.user as AuthenticatedUser;
    await this.quizzesService.getQuizRunState(dto.quizRunId, user);
    await client.join(`quiz-run:${dto.quizRunId}`);
    this.realtime.emitLeaderboard(
      dto.quizRunId,
      await this.quizzesService.getLeaderboard(dto.quizRunId),
    );
  }

  @SubscribeMessage('quiz:answer')
  async answer(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: QuizAnswerDto,
  ): Promise<void> {
    const user = client.data.user as AuthenticatedUser;
    await this.quizzesService.submitAnswer(user, dto);
    this.realtime.emitLeaderboard(
      dto.quizRunId,
      await this.quizzesService.getLeaderboard(dto.quizRunId),
    );
  }
}
