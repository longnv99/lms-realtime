import { expect, test } from '@playwright/test';
import { loginAs, newAuthenticatedPage, type AuthTokens } from './helpers/auth';
import { getDemoData, type DemoData } from './helpers/demo-data';

test.describe('P8 media management', () => {
  let demoData: DemoData;
  let instructor: AuthTokens;

  test.beforeAll(async ({ request }) => {
    instructor = await loginAs(request, 'instructor@example.com');
    demoData = await getDemoData(request, instructor);
  });

  test('instructor manages lesson media from the course detail page', async ({ browser }) => {
    const page = await newAuthenticatedPage(browser, instructor, { height: 900, width: 1440 });

    await page.goto(`/courses/${demoData.courseId}`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Lessons' })).toBeVisible();
    await expect(page.getByRole('button', { name: /open media library/i }).first()).toBeVisible();

    await page.getByRole('button', { name: /open media library/i }).first().click();
    await expect(page.locator('#media-library-title')).toHaveText('Media library');
    await expect(page.getByRole('button', { name: 'Unused' })).toBeVisible();

    await page.context().close();
  });
});
