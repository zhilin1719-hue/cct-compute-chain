import { z } from 'zod';
import { createDeepSeekService } from '../../../server/deepseek.mjs';
import { apiError, apiGuard, json } from '../../../server/vercel-api.mjs';

export const maxDuration = 30;

const requestSchema = z.object({
  agentId: z.enum(['operations', 'growth', 'knowledge', 'compute']),
  goal: z.string().trim().min(5).max(300),
  context: z.string().trim().max(1000).default(''),
  language: z.enum(['zh', 'en']).default('zh'),
}).strict();

export async function POST(request) {
  const guard = apiGuard(request);
  if (guard.response) return guard.response;
  try {
    const input = requestSchema.parse(await request.json());
    const service = createDeepSeekService();
    return json({ brief: await service.agent(input) });
  } catch (error) { return apiError(error); }
}
