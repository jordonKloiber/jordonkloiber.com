import fs from 'node:fs';
import path from 'node:path';
import { test, expect, type APIRequestContext } from '@playwright/test';
import { routes } from './routes';

const workDir = path.join(process.cwd(), 'src/content/work');

// Read from the collection so a new draft is guarded the day it's added.
function draftSlugs(): string[] {
  return fs
    .readdirSync(workDir)
    .filter((f) => f.endsWith('.md'))
    .filter((f) => {
      const raw = fs.readFileSync(path.join(workDir, f), 'utf8');
      const frontmatter = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
      return /^\s*draft:\s*true\s*$/m.test(frontmatter);
    })
    .map((f) => f.replace(/\.md$/, ''));
}

async function sitemapUrls(request: APIRequestContext): Promise<string[]> {
  const index = await (await request.get('/sitemap-index.xml')).text();
  // Paths only: absolute URLs bypass baseURL and would hit production.
  const children = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  expect(children.length, 'sitemap index listed no child sitemaps').toBeGreaterThan(0);

  const bodies = await Promise.all(
    children.map(async (url) => (await request.get(url)).text())
  );
  return bodies.flatMap((body) =>
    [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname)
  );
}

const workRoutes = routes.filter((r) => r.startsWith('/work/') && r !== '/work/');

// The per-draft tests below are generated from frontmatter, so publishing
// a draft deletes them instead of failing them. This one compares the
// sitemap to routes.ts in both directions, so it can't disappear.
test('published case studies are the ones declared in routes.ts', async ({ request }) => {
  const published = (await sitemapUrls(request))
    .filter((p) => p.startsWith('/work/') && p !== '/work/')
    .sort();

  expect(published).toEqual([...workRoutes].sort());
});

test.describe('draft case studies never appear in front of users', () => {
  test.skip(draftSlugs().length === 0, 'no draft entries in src/content/work');

  for (const slug of draftSlugs()) {
    test(`/work/${slug}/ is not routable`, async ({ request }) => {
      expect((await request.get(`/work/${slug}/`)).status()).toBe(404);
    });

    test(`/work/${slug}/ is not linked from the work index`, async ({ page }) => {
      await page.goto('/work/');
      await expect(page.locator(`a[href*="${slug}"]`)).toHaveCount(0);
    });
  }
});
