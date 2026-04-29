import { test, expect } from '@playwright/test';

test('reader: rename text persists after page reload', async ({ page }) => {
  await page.goto('/import');
  await page.getByLabel('Title').fill('Original Title');
  await page.getByLabel('Content').fill('猫が好きです。');
  await page.getByRole('button', { name: /^import$/i }).click();
  await page.waitForURL(/\/texts\/\d+/);

  await page.getByRole('button', { name: /more options/i }).click();
  await page.getByRole('menuitem', { name: /rename/i }).click();

  const input = page.getByRole('textbox', { name: /text title/i });
  await input.clear();
  await input.fill('Updated Title');
  await page.getByRole('button', { name: /^save$/i }).click();

  await expect(page.getByRole('heading', { name: 'Updated Title' })).toBeVisible();

  await page.reload();

  await expect(page.getByRole('heading', { name: 'Updated Title' })).toBeVisible();
});

test('reader: delete text redirects to / and text no longer in comprehension list', async ({ page }) => {
  await page.goto('/import');
  await page.getByLabel('Title').fill('Text To Delete');
  await page.getByLabel('Content').fill('犬が好きです。');
  await page.getByRole('button', { name: /^import$/i }).click();
  await page.waitForURL(/\/texts\/\d+/);

  await page.getByRole('button', { name: /more options/i }).click();
  await page.getByRole('menuitem', { name: /delete/i }).click();
  await page.getByRole('button', { name: /^confirm$/i }).click();

  await page.waitForURL('/');

  await expect(page.getByText('Text To Delete')).not.toBeVisible();
});
