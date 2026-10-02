import { test, expect } from '@playwright/test';
import { routes } from './routes';

const caseStudies = routes.filter((r) => r.startsWith('/work/') && r !== '/work/');

async function indexLinks(page: import('@playwright/test').Page) {
  await page.goto('/work/');
  return page
    .locator('main li > a')
    .evaluateAll((as) =>
      as.map((a) => ({ href: a.getAttribute('href'), text: a.textContent?.trim() }))
    );
}

test('work index links to every published case study and nothing else', async ({ page }) => {
  const hrefs = (await indexLinks(page)).map((l) => l.href).sort();
  expect(hrefs).toEqual([...caseStudies].sort());
});

test('each work index link opens a page titled with the link text', async ({ page }) => {
  const links = await indexLinks(page);
  expect(links.length).toBeGreaterThan(0);

  for (const { href, text } of links) {
    await page.goto('/work/');
    await page.locator(`main li > a[href="${href}"]`).click();

    await expect(page).toHaveURL(href!);
    await expect(page.locator('h1')).toHaveText(text!);
  }
});

for (const route of caseStudies) {
  test(`${route} links back to the work index`, async ({ page }) => {
    await page.goto(route);
    await page.getByRole('link', { name: /All work/ }).click();

    await expect(page).toHaveURL('/work/');
    await expect(page.locator('h1')).toHaveText('Work');
  });
}
