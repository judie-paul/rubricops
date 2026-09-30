import { test, expect, type Page } from '@playwright/test';
async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Workspace account').selectOption(email);
  await page
    .getByLabel('Demo password')
    .fill(process.env.DEMO_PASSWORD || 'rubricops-demo');
  await page.getByRole('button', { name: 'Enter workspace' }).click();
  await expect(
    page.getByRole('heading', {
      name: 'Good work starts with shared standards.',
    }),
  ).toBeVisible();
}
test('admin dashboard, search, rubric publication, import and adjudication', async ({
  page,
}) => {
  await login(page, 'admin@rubricops.local');
  await expect(page.getByText('Tasks in workspace')).toBeVisible();
  await page.screenshot({
    path: 'test-results/overview-desktop.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Task queue', exact: true }).click();
  await page.getByLabel('Search tasks').fill('no-such-task');
  await expect(
    page.getByRole('heading', { name: 'Nothing here right now' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Rubrics', exact: true }).click();
  await page.getByLabel('Rubric name').fill('Browser test rubric');
  await page
    .getByLabel('Scoring guidance')
    .fill('1: wrong, 3: partly correct, 5: fully correct.');
  await page.getByRole('button', { name: 'Publish immutable version' }).click();
  await expect(page.getByRole('status')).toContainText('published');
  await page
    .getByRole('button', { name: 'Data & imports', exact: true })
    .click();
  await page.getByLabel('Or paste JSON').fill(
    JSON.stringify([
      {
        externalId: `browser-${Date.now()}`,
        prompt: 'What is a rubric?',
        response: 'A scoring guide.',
        source: 'browser test',
      },
    ]),
  );
  await page.getByRole('button', { name: 'Validate & import' }).click();
  await expect(page.getByRole('status')).toContainText('1 tasks imported');
  await page
    .getByRole('button', { name: /Adjudication/ })
    .first()
    .click();
  await page
    .getByRole('button', { name: /Open synthetic/ })
    .first()
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page
    .getByLabel('Rationale')
    .fill(
      'The response is factually supported and the original evaluator provides clear evidence.',
    );
  await page.getByRole('button', { name: 'Save decision' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('evaluator claims and submits independently; role is enforced by API', async ({
  page,
}) => {
  await login(page, 'evaluator@rubricops.local');
  expect(
    (
      await page.request.post('/api/actions', {
        headers: { origin: new URL(page.url()).origin },
        data: { action: 'publish', data: {} },
      })
    ).status(),
  ).toBe(403);
  await page.getByRole('button', { name: 'Start evaluating' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Leo Mwangi')).toHaveCount(0);
  for (const field of await dialog.locator('fieldset').all())
    await field.getByRole('radio', { name: '4', exact: true }).check();
  await dialog
    .getByLabel('Rationale')
    .fill(
      'The answer addresses the request clearly and makes supported factual claims.',
    );
  await page.screenshot({
    path: 'test-results/evaluation-desktop.png',
    fullPage: true,
  });
  await dialog.getByRole('button', { name: 'Submit evaluation' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('Decision saved');
});
test('mobile reviewer can audit without horizontal page overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, 'reviewer@rubricops.local');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: 'test-results/overview-mobile.png',
    fullPage: true,
  });
  await page
    .getByRole('button', { name: /Review inbox/ })
    .first()
    .click();
  await page
    .getByRole('button', { name: /Open synthetic/ })
    .first()
    .click();
  await page
    .getByLabel('Rationale')
    .fill(
      'The paired evaluations agree and their reasoning is supported by the response.',
    );
  await page.getByRole('button', { name: 'Save decision' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('unauthenticated requests and cross-origin mutations are rejected', async ({
  page,
}) => {
  expect((await page.request.get('/api/workspace')).status()).toBe(401);
  await login(page, 'admin@rubricops.local');
  expect(
    (
      await page.request.post('/api/actions', {
        headers: { origin: 'https://invalid.example' },
        data: { action: 'claim' },
      })
    ).status(),
  ).toBe(403);
});
