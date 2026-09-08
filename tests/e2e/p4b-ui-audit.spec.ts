import { expect, test } from '@playwright/test';
import { loginAs, newAuthenticatedPage, type AuthTokens } from './helpers/auth';
import { getDemoData, type DemoData } from './helpers/demo-data';

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'mobile', width: 390, height: 844 },
];

test.describe('P4b UI audit', () => {
  let instructor: AuthTokens;
  let student: AuthTokens;
  let demoData: DemoData;

  test.beforeAll(async ({ request }) => {
    instructor = await loginAs(request, 'instructor@example.com');
    student = await loginAs(request, 'student@example.com');
    demoData = await getDemoData(request, instructor);
  });

  for (const viewport of viewports) {
    test(`course catalog layout is stable at ${viewport.name}`, async ({ browser }) => {
      const page = await newAuthenticatedPage(browser, instructor, viewport);

      await page.goto('/courses', { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: 'Courses' })).toBeVisible();
      await assertNoIncoherentLayout(page, viewport.width);
      await page.context().close();
    });

    test(`instructor course detail layout is stable at ${viewport.name}`, async ({
      browser,
    }) => {
      const page = await newAuthenticatedPage(browser, instructor, viewport);

      await page.goto(`/courses/${demoData.courseId}`, { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: 'Learner progress' })).toBeVisible();
      await assertNoIncoherentLayout(page, viewport.width);
      await page.context().close();
    });

    test(`student course detail layout is stable at ${viewport.name}`, async ({ browser }) => {
      const page = await newAuthenticatedPage(browser, student, viewport);

      await page.goto(`/courses/${demoData.courseId}`, { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: 'Learning progress' })).toBeVisible();
      await assertNoIncoherentLayout(page, viewport.width);
      await page.context().close();
    });

    test(`student live room layout is stable at ${viewport.name}`, async ({ browser }) => {
      const page = await newAuthenticatedPage(browser, student, viewport);

      await page.goto(`/courses/${demoData.courseId}/sessions/${demoData.sessionId}/live`, {
        waitUntil: 'networkidle',
      });
      await expect(page.getByRole('heading', { name: 'Live room' })).toBeVisible();
      await expect(page.locator('video')).toHaveCount(1);
      await assertNoIncoherentLayout(page, viewport.width);
      await page.context().close();
    });
  }
});

async function assertNoIncoherentLayout(page: import('@playwright/test').Page, viewportWidth: number) {
  const metrics = await page.evaluate(() => {
    const documentWidth = Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
    );
    const desktopTableScroll = [
      ...document.querySelectorAll('.courses-table-wrapper, .instructor-progress-table'),
    ]
      .map((element) => ({
        className:
          typeof element.className === 'string'
            ? element.className
            : String(element.getAttribute('class') ?? ''),
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }))
      .filter((item) => window.innerWidth >= 1024 && item.scrollWidth > item.clientWidth + 1);
    const wrappedControls = [...document.querySelectorAll('button, a.button, .status-badge')]
      .map((element) => ({
        className:
          typeof element.className === 'string'
            ? element.className
            : String(element.getAttribute('class') ?? ''),
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        text: element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 80) ?? '',
      }))
      .filter((item) => item.clientHeight > 0 && item.scrollHeight > item.clientHeight + 2);

    return {
      desktopTableScroll,
      documentWidth,
      wrappedControls,
    };
  });

  expect(metrics.documentWidth, JSON.stringify(metrics, null, 2)).toBeLessThanOrEqual(
    viewportWidth + 1,
  );
  expect(metrics.desktopTableScroll, JSON.stringify(metrics, null, 2)).toHaveLength(0);
  expect(metrics.wrappedControls, JSON.stringify(metrics, null, 2)).toHaveLength(0);
}
