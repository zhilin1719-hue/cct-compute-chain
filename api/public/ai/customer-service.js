import { z } from 'zod';
import { createDeepSeekService } from '../../../server/deepseek.mjs';
import { initialContent } from '../../../server/seed.mjs';
import { apiError, apiGuard, json } from '../../../server/vercel-api.mjs';
import { rankCustomerServiceContent } from '../../../src/customerService.js';

export const maxDuration = 30;

const requestSchema = z.object({
  question: z.string().trim().min(2).max(400),
  context: z.string().trim().max(800).default(''),
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
  const guard = apiGuard(request, { limit: 20 });
  if (guard.response) return guard.response;
  try {
    const input = requestSchema.parse(await request.json());
    const sources = rankCustomerServiceContent(published, `${input.context}\n${input.question}`);
    const service = createDeepSeekService();
    return json({ result: await service.customerService({ ...input, sources }) });
  } catch (error) { return apiError(error); }
}
