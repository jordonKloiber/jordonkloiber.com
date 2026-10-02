import { test, expect } from '@playwright/test';
import { routes } from './routes';

// Astro's static build trailing-slashes nested pages but not the root —
// confirmed in the real dist/ output, not assumed. Canonicals are checked
// against this, not against the request path.
const canonicalPaths: Record<string, string> = {
  '/': '/',
  '/resume': '/resume/',
  '/work/': '/work/',
  '/work/microfrontend-e2e-testing/': '/work/microfrontend-e2e-testing/',
};

// Pages that rank for the name rather than a topic.
const identityRoutes = ['/', '/resume'];

for (const route of routes) {
  test(`${route} has exactly one h1 and "Jordon Kloiber" in the title`, async ({ page }) => {
    await page.goto(route);

    await expect(page.locator('h1')).toHaveCount(1);

    // Title is a ranking signal, so every page carries the name.
    const title = await page.title();
    expect(title).toContain('Jordon Kloiber');
  });

  test(`${route} has a non-empty meta description`, async ({ page }) => {
    await page.goto(route);

    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description?.trim()).toBeTruthy();

    // Description is not a ranking factor, only snippet copy, so the name
    // is asserted on identity pages only — on a case study it would spend
    // snippet budget for nothing.
    if (identityRoutes.includes(route)) {
      expect(description).toContain('Jordon Kloiber');
    }
  });

  test(`${route} canonical is absolute and self-referencing`, async ({ page }) => {
    // A route missing from the map would otherwise assert against
    // ".../undefined" instead of failing clearly.
    expect(
      canonicalPaths[route],
      `no canonical mapping for "${route}" — add one when you add the route`
    ).toBeDefined();

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


    const isLinkedInBlock = url.includes('linkedin.com') && status === 999;

    expect(
      status === 200 || isLinkedInBlock,
      `${url} returned ${status}`
    ).toBe(true);
  }
});
