import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const work = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/work' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    role: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()),
    featured: z.boolean().default(false),
    draft: z.boolean().default(true),
    cover: z.string().optional(),
  }),
});

export const collections = { work };
