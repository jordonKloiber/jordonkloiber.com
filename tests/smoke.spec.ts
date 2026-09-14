import { test, expect } from '@playwright/test';

// The site's real routes. /work/draft-case-study/ is deliberately excluded —
// it carries draft: true and is filtered out of getStaticPaths, so it isn't
// a route at all right now.
const routes = ['/', '/resume', '/work/'];

for (const route of routes) {
  test(`${route} returns 200 with no console errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    const response = await page.goto(route);

    expect(response?.status()).toBe(200);
    expect(errors).toEqual([]);
  });
}

test('unknown route 404s with the custom not-found page', async ({ page }) => {
  const response = await page.goto('/this-route-does-not-exist');

  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});

test('no internal link 404s', async ({ page, request }) => {
  const found = new Set<string>();

  for (const route of routes) {
    await page.goto(route);
    const hrefs = await page
      .locator('a[href]')
      .evaluateAll((as) => as.map((a) => a.getAttribute('href')));

    for (const href of hrefs) {
      if (!href) continue;
      if (href.startsWith('mailto:') || href.startsWith('#')) continue;
      if (/^https?:\/\//.test(href)) continue; // external — sameAs URLs are seo.spec's job
      found.add(href);
    }
  }

  expect(found.size).toBeGreaterThan(0); // guard against a locator regression silently finding nothing

  for (const href of found) {
    const response = await request.get(href);
    expect(response.status(), `${href} should not 404`).toBe(200);
  }
});

test('resume PDF downloads', async ({ page }) => {
  await page.goto('/resume');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download PDF' }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe('jordon-kloiber-resume.pdf');
});

test.describe('no horizontal scroll at 390×844', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const route of routes) {
    test(route, async ({ page }) => {
      await page.goto(route);
      const scrollsHorizontally = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(scrollsHorizontally).toBe(false);
    });
  }
});
