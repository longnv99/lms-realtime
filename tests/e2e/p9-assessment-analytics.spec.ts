import { expect, test } from '@playwright/test';
import { loginAs, newAuthenticatedPage, type AuthTokens } from './helpers/auth';
import { getDemoData, type DemoData } from './helpers/demo-data';

test.describe('P9 assessment analytics', () => {
  test.setTimeout(60_000);

  let demoData: DemoData;
  let instructor: AuthTokens;
  let student: AuthTokens;

  test.beforeAll(async ({ request }) => {
    instructor = await loginAs(request, 'instructor@example.com');
    student = await loginAs(request, 'student@example.com');
    demoData = await getDemoData(request, instructor);
  });

  test('instructor and learner can view course analytics', async ({ browser }) => {
    const instructorPage = await newAuthenticatedPage(browser, instructor, {
      height: 900,
      width: 1440,
    });

    await instructorPage.goto(`/courses/${demoData.courseId}`, { waitUntil: 'domcontentloaded' });
    await expect(instructorPage.getByRole('heading', { name: 'Course analytics' })).toBeVisible();
    await expect(
      instructorPage.getByRole('button', { name: 'Export student analytics' }),
    ).toBeVisible();
    await expect(instructorPage.getByText('Lesson completion')).toBeVisible();
    await instructorPage.screenshot({
      fullPage: true,
      path: 'artifacts/ui-audit/p9-analytics/instructor-desktop.png',
    });

    const studentPage = await newAuthenticatedPage(browser, student, {
      height: 844,
      width: 390,
    });

    await studentPage.goto(`/courses/${demoData.courseId}`, { waitUntil: 'domcontentloaded' });
    await expect(studentPage.getByRole('heading', { name: 'Assessment analytics' })).toBeVisible();
    await expect(studentPage.getByText('Intro quiz')).toBeVisible();
    await studentPage.screenshot({
      fullPage: true,
      path: 'artifacts/ui-audit/p9-analytics/learner-mobile.png',
    });

    await instructorPage.context().close();
    await studentPage.context().close();
  });
});
