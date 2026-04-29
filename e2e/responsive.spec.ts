import { test, expect } from '@playwright/test';

test('dashboard at 375×812 renders single column', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');

  const grid = page.locator('.grid').first();
  const columns = await grid.evaluate(el =>
    window.getComputedStyle(el).gridTemplateColumns,
  );
  // Single column: one track value
  expect(columns.trim().split(/\s+/).length).toBe(1);
});

test('dashboard at 1024×768 renders two-column grid', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/');

  const grid = page.locator('.grid').first();
  const columns = await grid.evaluate(el =>
    window.getComputedStyle(el).gridTemplateColumns,
  );
  // Two columns: two track values
  expect(columns.trim().split(/\s+/).length).toBe(2);
});

test('reader at 375×812 has max-w-3xl on content wrapper', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });

  await page.goto('/import');
  await page.getByLabel('Title').fill('Responsive Test');
  await page.getByLabel('Content').fill('猫が好きです。');
  await page.getByRole('button', { name: /^import$/i }).click();
  await page.waitForURL(/\/texts\/\d+/);

  await expect(page.locator('main.max-w-3xl')).toBeVisible();
});

test('reader: all visible buttons meet 44×44px touch target minimum', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });

  await page.goto('/import');
  await page.getByLabel('Title').fill('Touch Target Test');
  await page.getByLabel('Content').fill('猫が好きです。');
  await page.getByRole('button', { name: /^import$/i }).click();
  await page.waitForURL(/\/texts\/\d+/);

  const violations = await page.evaluate(() => {
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>('button, [role="button"]'),
    );
    return elements
      .filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.width < 44 || rect.height < 44;
      })
      .map(el => ({
        label: el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 40) ?? '',
        width: Math.round(el.getBoundingClientRect().width),
        height: Math.round(el.getBoundingClientRect().height),
      }));
  });

  expect(violations, `Buttons failing 44×44px: ${JSON.stringify(violations)}`).toHaveLength(0);
});
