import { test, expect } from '@playwright/test';

test('reader: ruby tokens render, heading sentence renders as h2', async ({ page }) => {
  await page.goto('/import');
  await page.getByLabel('Title').fill('Reader E2E Test');
  await page.getByLabel('Content').fill('## 見出し\n\n猫が好きです。');
  await page.getByRole('button', { name: /^import$/i }).click();
  await page.waitForURL(/\/texts\/\d+/);

  await expect(page.locator('ruby').first()).toBeVisible();
  await expect(page.locator('h2')).toBeVisible();
});
