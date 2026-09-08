import { expect, type APIRequestContext } from '@playwright/test';
import type { AuthTokens } from './auth';

export type DemoData = {
  courseId: string;
  sessionId: string;
};

const apiBaseUrl = process.env.E2E_API_URL ?? 'http://localhost:4000/api';

export async function getDemoData(
  request: APIRequestContext,
  tokens: AuthTokens,
): Promise<DemoData> {
  const coursesResponse = await request.get(`${apiBaseUrl}/courses`, {
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
    },
  });
  expect(coursesResponse.ok()).toBe(true);
  const coursesPayload = await coursesResponse.json();
  const course =
    coursesPayload.data.find(
      (item: { slug: string }) => item.slug === 'realtime-lms-foundations',
    ) ?? coursesPayload.data[0];

  expect(course).toBeTruthy();

  const sessionsResponse = await request.get(`${apiBaseUrl}/courses/${course.id}/sessions`, {
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
    },
  });
  expect(sessionsResponse.ok()).toBe(true);
  const sessionsPayload = await sessionsResponse.json();
  const session =
    sessionsPayload.data.find((item: { status: string }) => item.status === 'LIVE') ??
    sessionsPayload.data[0];

  expect(session).toBeTruthy();

  return {
    courseId: course.id,
    sessionId: session.id,
  };
}
