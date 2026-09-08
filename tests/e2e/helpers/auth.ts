import { expect, type APIRequestContext, type Browser, type Page } from '@playwright/test';

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  user: {
    email: string;
    id: string;
    name: string;
    role: string;
  };
};

const apiBaseUrl = process.env.E2E_API_URL ?? 'http://localhost:4000/api';

export async function loginAs(
  request: APIRequestContext,
  email: string,
): Promise<AuthTokens> {
  const response = await request.post(`${apiBaseUrl}/auth/login`, {
    data: {
      email,
      password: 'Password123!',
    },
  });

  expect(response.ok()).toBe(true);
  const payload = await response.json();
  expect(payload.success).toBe(true);

  return payload.data as AuthTokens;
}

export async function newAuthenticatedPage(
  browser: Browser,
  tokens: AuthTokens,
  viewport: { height: number; width: number },
): Promise<Page> {
  const context = await browser.newContext({ viewport });
  await context.addInitScript((authTokens: AuthTokens) => {
    localStorage.setItem('lms.accessToken', authTokens.accessToken);
    localStorage.setItem('lms.refreshToken', authTokens.refreshToken);
    localStorage.setItem('lms.user', JSON.stringify(authTokens.user));
  }, tokens);

  return context.newPage();
}
