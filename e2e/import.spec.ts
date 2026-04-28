import { test, expect } from '@playwright/test';

test('import page: fill form, submit, redirect to reader', async ({ page }) => {
  await page.goto('/import');

  await page.getByLabel('Title').fill('テスト');
  await page.getByLabel('Content').fill('猫が好きです。');
  await page.getByRole('button', { name: /^import$/i }).click();

  await expect(page).toHaveURL(/\/texts\/\d+/);
});
