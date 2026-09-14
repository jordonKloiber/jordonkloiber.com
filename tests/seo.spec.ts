import { test, expect } from '@playwright/test';

const routes = ['/', '/resume', '/work/'];

// Astro's static build trailing-slashes nested pages but not the root —
// confirmed in the real dist/ output, not assumed. Canonicals are checked
// against this, not against the request path.
const canonicalPaths: Record<string, string> = {
  '/': '/',
  '/resume': '/resume/',
  '/work/': '/work/',
};

for (const route of routes) {
  test(`${route} has exactly one h1, with "Jordon Kloiber" in title and description`, async ({
    page,
  }) => {
    await page.goto(route);

    await expect(page.locator('h1')).toHaveCount(1);

    const title = await page.title();
    expect(title).toContain('Jordon Kloiber');

    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description).toContain('Jordon Kloiber');
  });

  test(`${route} canonical is absolute and self-referencing`, async ({ page }) => {
    await page.goto(route);

    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical).toBe(new URL(canonicalPaths[route], 'https://jordonkloiber.com').toString());
  });
}

test('homepage JSON-LD parses and every sameAs URL is live', async ({ page, request }) => {
  await page.goto('/');

  const raw = await page.locator('script[type="application/ld+json"]').textContent();
  expect(raw).toBeTruthy();

  const jsonLd = JSON.parse(raw!);
  expect(jsonLd['@type']).toBe('Person');
  expect(jsonLd.name).toBe('Jordon Kloiber');
  expect(Array.isArray(jsonLd.sameAs)).toBe(true);
  expect(jsonLd.sameAs.length).toBeGreaterThan(0);

  for (const url of jsonLd.sameAs) {
    const response = await request.get(url);
    const status = response.status();

    // LinkedIn returns 999 to any unauthenticated client — confirmed via
    // curl with a real browser User-Agent and a real headless-Chromium
    // page.goto(), both blocked identically. It's LinkedIn's anti-scraping
    // response, not a dead link; a genuinely removed profile 404s instead.
    const isLinkedInBlock = url.includes('linkedin.com') && status === 999;

    expect(
      status === 200 || isLinkedInBlock,
      `${url} returned ${status}`
    ).toBe(true);
  }
});
