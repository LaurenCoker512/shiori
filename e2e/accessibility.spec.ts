import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function checkNoViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();

  const criticalOrSerious = results.violations.filter(
    v => v.impact === 'critical' || v.impact === 'serious',
  );

  if (criticalOrSerious.length > 0) {
    const summary = criticalOrSerious
      .map(v => `[${v.impact}] ${v.id}: ${v.description}\n  Nodes: ${v.nodes.map(n => n.html).join(', ')}`)
      .join('\n');
    throw new Error(`Axe found ${criticalOrSerious.length} critical/serious violations:\n${summary}`);
  }

  expect(criticalOrSerious).toHaveLength(0);
}

test('accessibility: / (dashboard) has zero critical/serious violations', async ({ page }) => {
  await page.goto('/');
  await checkNoViolations(page);
});

test('accessibility: /import has zero critical/serious violations', async ({ page }) => {
  await page.goto('/import');
  await checkNoViolations(page);
});

test('accessibility: /texts/[id] (reader) has zero critical/serious violations', async ({ page }) => {
  await page.goto('/import');
  await page.getByLabel('Title').fill('Accessibility Test');
  await page.getByLabel('Content').fill('猫が好きです。');
  await page.getByRole('button', { name: /^import$/i }).click();
  await page.waitForURL(/\/texts\/\d+/);

  await checkNoViolations(page);
});
