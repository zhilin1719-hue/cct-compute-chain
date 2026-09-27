const buckets = globalThis.__cctAiRateBuckets || new Map();
globalThis.__cctAiRateBuckets = buckets;

export function apiGuard(request, { limit = 12, windowMs = 15 * 60 * 1000 } = {}) {
  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  if (!origin || origin !== url.origin) return { response: json({ error: '请求来源验证失败。请从本站页面重试。' }, 403) };
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return { response: json({ error: '请求需要使用 application/json。' }, 415) };
  const key = (request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown').split(',')[0].trim();
  const now = Date.now();
  const current = buckets.get(key);
  const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
  bucket.count += 1;
  buckets.set(key, bucket);
  if (buckets.size > 2000) for (const [candidate, value] of buckets) if (value.resetAt <= now) buckets.delete(candidate);
  if (bucket.count > limit) return { response: json({ error: '请求过于频繁，请稍后重试。' }, 429, { 'Retry-After': String(Math.ceil((bucket.resetAt - now) / 1000)) }) };
  return { key };
}

export function json(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      ...extraHeaders,
    },
  });
}

export function apiError(error) {
  if (error?.name === 'ZodError') return json({ error: '请检查提交的信息。', fields: error.flatten().fieldErrors }, 400);
  return json({ error: '服务暂时无法处理此请求，请稍后重试。' }, 500);
}
