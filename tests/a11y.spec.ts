import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';

const routes = ['/', '/resume', '/work/'];

// Relative luminance / contrast math. WCAG 1.4.11 (non-text contrast)
// needs 3:1, not the 4.5:1 / 7:1 text thresholds, so this is separate
// from the text-contrast checks. Only the focus indicator test uses
// it, so it's kept local instead of living in a shared module.
function relativeLuminance(rgb: string) {
  const [r, g, b] = rgb
    .match(/\d+/g)!
    .slice(0, 3)
    .map(Number)
    .map((c) => c / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(rgbA: string, rgbB: string) {
  const [l1, l2] = [relativeLuminance(rgbA), relativeLuminance(rgbB)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}

for (const route of routes) {
  test(`${route} has zero axe violations at WCAG 2.2 AA`, async ({ page }) => {
    await page.goto(route);

    // wcag22aa adds axe's target-size rule (SC 2.5.8) on top of the 2.1
    // tag set. Confirmed with a manual probe that the rule actually runs
    // against these pages, since it wasn't running before this.
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });

  test(`${route} has no skipped heading levels (WCAG 1.3.1 / 2.4.6)`, async ({ page }) => {
    await page.goto(route);

    const levels = await page
      .locator('h1, h2, h3, h4, h5, h6')
      .evaluateAll((els) => els.map((el) => Number(el.tagName[1])));

    expect(levels[0], 'first heading on the page should be an h1').toBe(1);

    for (let i = 1; i < levels.length; i++) {
      expect(
        levels[i] - levels[i - 1],
        `heading jumps from h${levels[i - 1]} to h${levels[i]} without an h${levels[i - 1] + 1} between them`
      ).toBeLessThanOrEqual(1);
    }
  });

  test(`${route} has no interactive target under 24×24px (WCAG 2.5.8)`, async ({ page }) => {
    await page.goto(route);

    // Backs up axe's target-size rule above with a plain geometry check,
    // which is stricter than axe's heuristics. Scoped to the site's
    // actual deliberate-target classes (.nav-link, .rows li > a,
    // .skip-link) plus aria-labelled icon links, not every <a> on the
    // page. SC 2.5.8 explicitly exempts a link inline within a sentence
    // of running text (e.g. work/index.astro's "see the resume for a
    // full history"), and those were never meant to be 24px targets.
    const sizes = await page
      .locator('.skip-link, .nav-link, .rows li > a, a[aria-label]')
      .evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          return { label: el.textContent?.trim().slice(0, 40) || el.tagName, w: r.width, h: r.height };
        })
      );

    for (const { label, w, h } of sizes) {
      expect(w, `"${label}" is ${w}×${h}, narrower than 24px`).toBeGreaterThanOrEqual(24);
      expect(h, `"${label}" is ${w}×${h}, shorter than 24px`).toBeGreaterThanOrEqual(24);
    }
  });

  test(`${route} has no horizontal scroll at the WCAG 1.4.10 reflow width (320px)`, async ({
    page,
  }) => {
    // Distinct from smoke.spec's 390×844 device check. 320 CSS px is
    // the literal width the SC's own technique (C32) tests at (400%
    // zoom on a 1280px viewport).
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto(route);

    const scrollsHorizontally = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(scrollsHorizontally).toBe(false);
  });
}

test('icon-only links have a non-empty accessible name (WCAG 2.4.4 / 4.1.2)', async ({ page }) => {
  await page.goto('/');

  // The "What people say" testimonials are icon-only links with no
  // visible text, so their accessible name comes entirely from aria-label.
  const links = page.locator('a[aria-label="View recommendation on LinkedIn"]');
  await expect(links).toHaveCount(2);

  for (const link of await links.all()) {
    const name = await link.evaluate((el) => el.getAttribute('aria-label'));
    expect(name).toBeTruthy();
  }
});

test('focus indicator meets non-text contrast (WCAG 1.4.11, 3:1)', async ({ page }) => {
  await page.goto('/');

  await page.keyboard.press('Tab');
  const { outlineColor, backgroundColor, outlineStyle } = await page.evaluate(() => {
    const el = document.activeElement!;
    const cs = getComputedStyle(el);
    return {
      outlineColor: cs.outlineColor,
      outlineStyle: cs.outlineStyle,
      backgroundColor: getComputedStyle(document.body).backgroundColor,
    };
  });

  expect(outlineStyle).not.toBe('none');
  const ratio = contrastRatio(outlineColor, backgroundColor);
  expect(ratio, `focus outline ${outlineColor} vs background ${backgroundColor} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
});

test('transitions respect prefers-reduced-motion (WCAG 2.3.3 intent)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  // `a` has a real hover transition in global.css. This confirms the
  // @media (prefers-reduced-motion: reduce) override actually collapses
  // it, not just that the rule exists in the stylesheet.
  const duration = await page
    .locator('a')
    .first()
    .evaluate((el) => getComputedStyle(el).transitionDuration);

  // Browsers format sub-millisecond durations inconsistently (e.g.
  // "1e-05s" vs "0.00001s"), so parse it instead of string-matching.
  expect(parseFloat(duration)).toBeLessThan(0.001);
});

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
