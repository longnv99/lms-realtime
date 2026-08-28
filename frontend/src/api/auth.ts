import type { AuthTokensResponse, UserRole } from '@lms/shared';
import { postEnvelope, postVoidEnvelope } from './client';

export type LoginInput = {
  email: string;
  password: string;
};

export type RegisterInput = LoginInput & {
  name: string;
  role?: UserRole;
};

export async function login(input: LoginInput): Promise<AuthTokensResponse> {
  return postEnvelope<AuthTokensResponse>('/auth/login', input);
}

export async function register(input: RegisterInput): Promise<AuthTokensResponse> {
  return postEnvelope<AuthTokensResponse>('/auth/register', input);
}

export async function refresh(refreshToken: string): Promise<AuthTokensResponse> {
  return postEnvelope<AuthTokensResponse>('/auth/refresh', { refreshToken });
}

export async function logout(refreshToken: string): Promise<void> {
  await postVoidEnvelope('/auth/logout', { refreshToken });
}
