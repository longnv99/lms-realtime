import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { UserRole } from '@lms/shared';
import { env } from '../../config/env';
import { AuthenticatedUser } from '../../common/types/authenticated-request';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: env.JWT_ACCESS_SECRET,
    });
  }

  validate(payload: { sub: string; email: string; role: UserRole }): AuthenticatedUser {
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
