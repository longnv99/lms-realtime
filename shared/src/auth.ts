export type UserRole = 'ADMIN' | 'INSTRUCTOR' | 'STUDENT';

export interface AuthUserResponse {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface AuthTokensResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUserResponse;
}
