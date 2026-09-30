# jordonkloiber.com

Source for [jordonkloiber.com](https://jordonkloiber.com), the personal site of
Jordon Kloiber, Senior QA Engineer / SDET in Pittsburgh, PA.

## About this project

This site doubles as a portfolio piece. It's built and maintained by hand rather
than generated from a template, so the repo itself is evidence of the kind of
work I do: 
- A deliberate stack choice
- A build and deploy pipeline I set up and
understand
- Code I can walk through in a technical interview. 

If you're reviewing this as part of a job application, feel free to look through the
commit history and structure, not just the live site.

## Stack

- [Astro](https://astro.build), static output, no client-side JavaScript
- Custom CSS, no UI framework
- `@astrojs/sitemap` for sitemap generation

## Develop

```sh
npm install
npm run dev        # http://localhost:4321
```

## Build

```sh
npm run build      # static output to ./dist/
npm run preview    # serve the production build locally
```

## License

© Jordon Kloiber. All rights reserved. You're welcome to read the source; please
don't reuse it as a template or redistribute it without permission.
