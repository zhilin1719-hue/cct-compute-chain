import { z } from 'zod';
import { createDeepSeekService, rankKnowledge } from '../../../server/deepseek.mjs';
import { initialContent } from '../../../server/seed.mjs';
import { apiError, apiGuard, json } from '../../../server/vercel-api.mjs';

export const maxDuration = 30;

const requestSchema = z.object({
  question: z.string().trim().min(5).max(500),
  scope: z.enum(['all', 'market', 'cct', 'proposal']).default('all'),
  language: z.enum(['zh', 'en']).default('zh'),
}).strict();

const published = initialContent.map((item, index) => ({
  id: `public-${index + 1}`,
  status: 'published',
  createdAt: '2026-09-25T00:00:00.000Z',
  updatedAt: '2026-09-25T00:00:00.000Z',
  claimScope: item.claimScope || 'cct',
  evidenceLevel: item.evidenceLevel || 'internal',
  sourceLabel: item.sourceLabel || '',
  sourceUrl: item.sourceUrl || '',
  sourceDate: item.sourceDate || '',
  ...item,
}));

export async function POST(request) {
  const guard = apiGuard(request);
  if (guard.response) return guard.response;
  try {
    const input = requestSchema.parse(await request.json());
    const sources = rankKnowledge(published, input.question, input.scope);
    const service = createDeepSeekService();
    return json({ result: await service.knowledge({ ...input, sources }) });
  } catch (error) { return apiError(error); }
}
