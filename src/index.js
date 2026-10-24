// Host half: three read-only routes under /api/router3 that the panel calls.
// Each one resolves the Router3 API key through dsh's credential store at
// call time (the key you saved on the Models page as ROUTER3_API_KEY, or the
// environment variable of that name), asks Router3, and passes the answer
// on. The key stays in this process; the browser only ever sees the data.
// The routes are registered on dsh's authenticated API channel, so they
// answer only a signed-in dsh page.
import Schema from '@deepseek-ai/schemastery';

export const name = 'router3';
export const inject = ['connection', 'credentials'];

export const Config = Schema.object({
  baseUrl: Schema.string().default('https://router3.ai').description('Router3 gateway origin'),
  credential: Schema.string().default('ROUTER3_API_KEY').description('Credential reference holding the Router3 API key')
});

// Browser path → Router3 path, and which query parameters pass through.
const ROUTES = {
  '/api/router3/summary': { path: '/v1/key', query: [] },
  '/api/router3/usage': { path: '/v1/key/usage', query: ['days'] },
  '/api/router3/requests': { path: '/v1/key/requests', query: ['limit', 'before'] }
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export function apply(ctx, config) {
  const base = config.baseUrl.replace(/\/+$/, '');

  async function relay(route, request) {
    const credential = await ctx.credentials.resolve(config.credential);
    if (!credential) return json({ configured: false, credential: config.credential });
    const url = new URL(base + route.path);
    const incoming = new URL(request.url);
    for (const key of route.query) if (incoming.searchParams.has(key)) url.searchParams.set(key, incoming.searchParams.get(key));
    let upstream;
    try {
      upstream = await fetch(url, { headers: { authorization: `Bearer ${credential.value}`, accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
    } catch (error) {
      return json({ error: { code: 'ROUTER3_UNREACHABLE', message: error.message } }, 502);
    }
    const text = await upstream.text();
    return new Response(text, { status: upstream.status, headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' } });
  }

  for (const [path, route] of Object.entries(ROUTES)) {
    ctx.effect(() => ctx.connection.fetch.register({
      path, methods: ['GET'], requestBody: 'buffered',
      fetch: (request) => relay(route, request)
    }), `router3: ${path}`);
  }
}
