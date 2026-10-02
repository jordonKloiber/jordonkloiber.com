import { test, expect } from '@playwright/test';
import { routes } from './routes';

const OWN_ORIGIN = 'https://jordonkloiber.com';

// Network-dependent, so tagged out of the per-PR run; see `npm run test:links`.
test('external links resolve', { tag: '@external' }, async ({ page, request }) => {
  const urls = new Set<string>();

  for (const route of routes) {
    await page.goto(route);
    const hrefs = await page
      .locator('a[href^="http"]')
      .evaluateAll((as) => as.map((a) => a.getAttribute('href')!));

    for (const href of hrefs) {
      const url = new URL(href);
      url.hash = '';
      if (url.origin !== OWN_ORIGIN) urls.add(url.toString());
    }
  }

  expect(urls.size, 'found no external links to check').toBeGreaterThan(0);

  const failures: string[] = [];
  await Promise.all(
    [...urls].map(async (url) => {
      try {
        const status = (await request.get(url, { timeout: 15_000 })).status();
        // LinkedIn answers 999 to every unauthenticated client.
        const ok = (status >= 200 && status < 400) || (url.includes('linkedin.com') && status === 999);
        if (!ok) failures.push(`${status}  ${url}`);
      } catch (err) {
        failures.push(`ERR  ${url}  (${(err as Error).message.split('\n')[0]})`);
      }
    })
  );

  expect(failures.sort(), 'dead external links').toEqual([]);
});
