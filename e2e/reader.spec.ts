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

test('reader: hover over sentence shows grammar tooltip', async ({ page }) => {
  await page.goto('/import');
  await page.getByLabel('Title').fill('Grammar E2E Test');
  await page.getByLabel('Content').fill('猫が好きです。');
  await page.getByRole('button', { name: /^import$/i }).click();
  await page.waitForURL(/\/texts\/\d+/);

  await page.locator('[data-grammar-trigger]').first().hover();

  await expect(page.locator('[aria-label="Grammar analysis"]').first()).toBeVisible({
    timeout: 10000,
  });
});

test('reader: click word opens popover', async ({ page }) => {
  await page.goto('/import');
  await page.getByLabel('Title').fill('Popover E2E Test');
  await page.getByLabel('Content').fill('猫が好きです。');
  await page.getByRole('button', { name: /^import$/i }).click();
  await page.waitForURL(/\/texts\/\d+/);

  await page.locator('ruby').first().click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();
});
