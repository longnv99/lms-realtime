import { expect, test } from '@playwright/test';
import { loginAs, newAuthenticatedPage, type AuthTokens } from './helpers/auth';
import { getDemoData, type DemoData } from './helpers/demo-data';

test.describe('P6 learning UX', () => {
  let demoData: DemoData;
  let student: AuthTokens;

  test.beforeAll(async ({ request }) => {
    student = await loginAs(request, 'student@example.com');
    demoData = await getDemoData(request, student);
  });

  test('student can use the learning workspace', async ({ browser }) => {
    const page = await newAuthenticatedPage(browser, student, { height: 900, width: 1440 });
    const noteText = `Review this section before the live quiz ${Date.now()}.`;

    await page.goto('/courses', { waitUntil: 'networkidle' });
    await page.getByRole('link', { name: /Realtime LMS Foundations/i }).click();
    await expect(page.getByRole('heading', { name: 'Learning progress' })).toBeVisible();
    await page.getByRole('link', { name: /Continue learning/i }).click();
    await expect(page).toHaveURL(new RegExp(`/courses/${demoData.courseId}/learn$`));
    await expect(page.getByRole('heading', { name: /Learning workspace/i })).toBeVisible();
    const markCompleteButton = page.getByRole('button', { name: /Mark complete/i });
    await expect(markCompleteButton).toBeVisible();

    if (await markCompleteButton.isEnabled()) {
      await markCompleteButton.click();
    }
    await expect(page.getByText('Completed').first()).toBeVisible();

    await page.getByRole('tab', { name: /Transcript/i }).click();
    await expect(page.getByText(/Welcome to the realtime LMS foundations course/i)).toBeVisible();

    await page.getByRole('tab', { name: /Notes/i }).click();
    await page.getByRole('textbox', { name: /New note/i }).fill(noteText);
    await page.getByRole('button', { name: /Save note/i }).click();
    await expect(page.getByText(noteText)).toBeVisible();

    await page.getByRole('tab', { name: /Quiz review/i }).click();
    await expect(page.getByText(/Quiz review/i)).toBeVisible();

    await page.context().close();
  });
});
