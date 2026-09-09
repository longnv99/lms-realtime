import { expect, test } from '@playwright/test';
import { loginAs, newAuthenticatedPage } from './helpers/auth';

test('production stack serves app, api, and authenticated dashboard', async ({
  browser,
  request,
}) => {
  const health = await request.get('/api/health');
  expect(health.ok()).toBe(true);

  const tokens = await loginAs(request, 'admin@example.com');
  const page = await newAuthenticatedPage(browser, tokens, { width: 1440, height: 900 });

  await page.goto('/courses', { waitUntil: 'networkidle' });
  await expect(page).toHaveURL(/\/courses$/);
  await expect(page.getByRole('heading', { name: 'Courses' })).toBeVisible();

  await page.context().close();
});
