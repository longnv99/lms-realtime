import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { env } from '../../config/env';
import type { AuthenticatedUser } from '../types/authenticated-request';

type AccessTokenPayload = {
  sub: string;
  email: string;
  role: AuthenticatedUser['role'];
};

@Injectable()
export class WsAuthService {
  constructor(private readonly jwtService: JwtService) {}

  async authenticate(client: Socket): Promise<AuthenticatedUser> {
    const token = client.handshake.auth?.token;

    if (typeof token !== 'string' || token.length === 0) {
      throw new UnauthorizedException('Missing websocket auth token');
    }

    const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
      secret: env.JWT_ACCESS_SECRET,
    });

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
