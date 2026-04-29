import { test, expect } from '@playwright/test';

test('dashboard: chart renders, comprehension list shows entry after import, word browser shows words', async ({ page }) => {
  await page.goto('/import');
  await page.getByLabel('Title').fill('Dashboard E2E Test');
  await page.getByLabel('Content').fill('猫が好きです。');
  await page.getByRole('button', { name: /^import$/i }).click();
  await page.waitForURL(/\/texts\/\d+/);

  await page.goto('/');

  await expect(page.locator('[aria-label="Vocabulary progress chart"]')).toBeVisible();
  await expect(page.getByText('Dashboard E2E Test')).toBeVisible();
  await expect(page.locator('table')).toBeVisible();
});
