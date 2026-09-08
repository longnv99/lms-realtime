import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthTokensResponse, AuthUserResponse, UserRole } from '@lms/shared';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import type { StringValue } from 'ms';
import { AppError } from '../../common/errors/app-error';
import { env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import type { RefreshToken, User } from '../../generated/prisma/client';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

type RefreshTokenWithUser = RefreshToken & { user: User };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthTokensResponse> {
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        name: dto.name,
      },
    });

    return this.issueTokenPair(user);
  }

  async login(dto: LoginDto): Promise<AuthTokensResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new AppError(
        'AUTH_INVALID_CREDENTIALS',
        'Email hoac mat khau khong dung',
        HttpStatus.UNAUTHORIZED,
      );
    }

    return this.issueTokenPair(user);
  }

  async refresh(refreshToken: string): Promise<AuthTokensResponse> {
    const candidates = await this.prisma.refreshToken.findMany({
      where: { expiresAt: { gt: new Date() } },
      include: { user: true },
    });
    const matched = await this.findMatchingRefreshToken(refreshToken, candidates);

    if (!matched) {
      throw new AppError(
        'AUTH_UNAUTHENTICATED',
        'Refresh token khong hop le',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (matched.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: matched.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new AppError(
        'AUTH_REFRESH_REUSED',
        'Refresh token da bi thu hoi',
        HttpStatus.UNAUTHORIZED,
      );
    }

    await this.prisma.refreshToken.update({
      where: { id: matched.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokenPair(matched.user);
  }

  async logout(userId: string, refreshToken: string): Promise<{ revoked: true }> {
    const candidates = await this.prisma.refreshToken.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      include: { user: true },
    });
    const matched = await this.findMatchingRefreshToken(refreshToken, candidates);

    if (matched && !matched.revokedAt) {
      await this.prisma.refreshToken.update({
        where: { id: matched.id },
        data: { revokedAt: new Date() },
      });
    }

    return { revoked: true };
  }

  private async issueTokenPair(user: User): Promise<AuthTokensResponse> {
    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, email: user.email, role: user.role },
      { secret: env.JWT_ACCESS_SECRET, expiresIn: env.JWT_ACCESS_EXPIRES_IN as StringValue },
    );
    const refreshToken = randomBytes(48).toString('base64url');
    const tokenHash = await bcrypt.hash(refreshToken, 12);
    const expiresAt = new Date(Date.now() + env.JWT_REFRESH_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    return { accessToken, refreshToken, user: this.toAuthUser(user) };
  }

  private async findMatchingRefreshToken(
    refreshToken: string,
    candidates: RefreshTokenWithUser[],
  ): Promise<RefreshTokenWithUser | null> {
    for (const candidate of candidates) {
      if (await bcrypt.compare(refreshToken, candidate.tokenHash)) {
        return candidate;
      }
    }
    return null;
  }

  private toAuthUser(user: User): AuthUserResponse {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
    };
  }
}
