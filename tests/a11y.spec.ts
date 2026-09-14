import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';

const routes = ['/', '/resume', '/work/'];

for (const route of routes) {
  test(`${route} has zero axe violations at WCAG 2.1 AA`, async ({ page }) => {
    await page.goto(route);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
}

test('skip link jumps focus to main content', async ({ page }) => {
  await page.goto('/');

  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
});

test('focus is always visible while tabbing through the homepage', async ({ page }) => {
  await page.goto('/');

  const focusableCount = await page
    .locator('a, button, input, [tabindex]:not([tabindex="-1"])')
    .count();

  for (let i = 0; i < focusableCount; i++) {
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toBeVisible();

    const outlineStyle = await focused.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outlineStyle, 'focused element has no visible outline').not.toBe('none');
  }
});

test('homepage tab order follows document order', async ({ page }) => {
  await page.goto('/');

  const domOrder = await page.locator('a, button, input, [tabindex]:not([tabindex="-1"])').evaluateAll(
    (els) => els.map((el) => el.textContent?.trim().slice(0, 40) || el.tagName)
  );

  const tabOrder: string[] = [];
  for (let i = 0; i < domOrder.length; i++) {
    await page.keyboard.press('Tab');
    const label = await page
      .locator(':focus')
      .evaluate((el) => el.textContent?.trim().slice(0, 40) || el.tagName);
    tabOrder.push(label);
  }

  expect(tabOrder).toEqual(domOrder);
});
