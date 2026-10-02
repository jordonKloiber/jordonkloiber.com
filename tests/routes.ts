// Every published route, shared by all three spec files so publishing a
// case study is one edit instead of three. Paths are written as a visitor
// would type them; seo.spec maps them to the canonicals the build emits.
// /work/draft-case-study/ is absent because draft: true keeps it unbuilt.
export const routes = [
  '/',
  '/resume',
  '/work/',
  '/work/microfrontend-e2e-testing/',
];
