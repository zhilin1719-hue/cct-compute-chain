import { initialContent, initialSettings } from '../server/seed.mjs';

const publishedAt = '2026-09-25T00:00:00.000Z';

export const staticBootstrap = {
  settings: initialSettings,
  content: initialContent.map((item, index) => ({
    id: `public-${index + 1}`,
    status: 'published',
    createdAt: publishedAt,
    updatedAt: publishedAt,
    ...item,
  })),
};
