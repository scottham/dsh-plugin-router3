// Host half: read-only routes under /api/router3 that the panel calls.
//
// Which key to read is discovered, not configured. Every model provider the
// user set up on the Models page is a candidate: one whose base URL points at
// a Router3 gateway, or whose stored key is a Router3 key (`r3_live_…`), is a
// "source". The panel lists the sources and the user picks one; each call
// names its source with `?source=<provider id>`. The key is resolved through
// dsh's credential store at call time and stays in this process; the browser
// only ever sees the data. The routes sit on dsh's authenticated API channel,
// so they answer only a signed-in dsh page.
import Schema from '@deepseek-ai/schemastery';

export const name = 'router3';
export const inject = ['connection', 'credentials', 'llm'];

export const Config = Schema.object({
  baseUrl: Schema.string().default('https://router3.ai').description('Router3 gateway origin: providers pointing here are sources, and the fallback credential reads from here'),
  credential: Schema.string().default('ROUTER3_API_KEY').description('A credential reference offered as a source even when no model provider names it')
});

// Browser path → Router3 path, and which query parameters pass through.
const ROUTES = {
  '/api/router3/summary': { path: '/v1/key', query: [] },
  '/api/router3/usage': { path: '/v1/key/usage', query: ['days'] },
  '/api/router3/requests': { path: '/v1/key/requests', query: ['limit', 'before'] }
};
const KEY_PREFIX = 'r3_live_';
const REF = /^[A-Z_][A-Z0-9_]*$/;
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
// The Models page stores a provider's key under `<PROVIDER>_API_KEY` unless
// the profile names a reference (mirrors dsh-client-ui-settings-models).
const derivedRef = (provider) => `${provider.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_API_KEY`;
const originOf = (url) => { try { return new URL(url).origin; } catch { return null; } };
const hostOf = (url) => { try { return new URL(url).host; } catch { return null; } };

export function apply(ctx, config) {
  const base = config.baseUrl.replace(/\/+$/, '');

  async function describe(ref) {
    if (!REF.test(ref)) return { configured: false };
    try { return await ctx.credentials.describe(ref); } catch { return { configured: false }; }
  }
  async function resolve(ref) {
    if (!REF.test(ref)) return undefined;
    try { return await ctx.credentials.resolve(ref); } catch { return undefined; }
  }

  // Every configured model provider that is a Router3 key, then the
  // configured fallback reference. Computed per call, so a provider added on
  // the Models page shows up on the panel's next refresh without a restart.
  async function sources() {
    const found = [];
    const refs = new Set();
    const settings = ctx.get('settings');
    if (settings) {
      const documents = new Map(settings.describe().map((d) => [d.ns, d.value]));
      for (const provider of ctx.llm.listConfigurableProviders()) {
        const section = provider.settingsPath.reduce((value, key) => (value && typeof value === 'object' ? value[key] : undefined), documents.get(provider.settingsNs));
        if (!section || typeof section !== 'object') continue;
        const baseUrl = section.baseURL ?? provider.defaultBaseURL ?? null;
        const ref = typeof section.apiKeyEnv === 'string' && section.apiKeyEnv ? section.apiKeyEnv : derivedRef(provider.provider);
        const info = await describe(ref);
        let isRouter3 = baseUrl != null && hostOf(baseUrl) === hostOf(base);
        if (!isRouter3 && info.configured) isRouter3 = (await resolve(ref))?.value.startsWith(KEY_PREFIX) ?? false;
        if (!isRouter3) continue;
        refs.add(ref);
        found.push({ id: provider.provider, name: section.displayName ?? provider.displayName ?? provider.provider,
          ref, gateway: (baseUrl && originOf(baseUrl)) ?? base, configured: info.configured });
      }
    }
    if (config.credential && !refs.has(config.credential) && (await describe(config.credential)).configured) {
      found.push({ id: `ref:${config.credential}`, name: config.credential, ref: config.credential, gateway: base, configured: true });
    }
    return found;
  }

  // The source a call reads: the one asked for, else the first usable one.
  function pick(list, wanted) {
    const usable = list.filter((s) => s.configured);
    return (wanted && usable.find((s) => s.id === wanted)) ?? usable[0] ?? null;
  }

  async function relay(route, request) {
    const incoming = new URL(request.url);
    const list = await sources();
    const source = pick(list, incoming.searchParams.get('source'));
    const credential = source && await resolve(source.ref);
    if (!credential) return json({ configured: false, credential: source?.ref ?? config.credential, sources: list });
    const url = new URL(source.gateway + route.path);
    for (const key of route.query) if (incoming.searchParams.has(key)) url.searchParams.set(key, incoming.searchParams.get(key));
    let upstream;
    try {
      upstream = await fetch(url, { headers: { authorization: `Bearer ${credential.value}`, accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
    } catch (error) {
      return json({ error: { code: 'ROUTER3_UNREACHABLE', message: error.message } }, 502);
    }
    const text = await upstream.text();
    return new Response(text, { status: upstream.status,
      headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json', 'x-router3-source': source.id } });
  }

  ctx.effect(() => ctx.connection.fetch.register({
    path: '/api/router3/sources', methods: ['GET'], requestBody: 'buffered',
    fetch: async () => { const list = await sources(); return json({ sources: list, default: pick(list, null)?.id ?? null }); }
  }), 'router3: /api/router3/sources');
  for (const [path, route] of Object.entries(ROUTES)) {
    ctx.effect(() => ctx.connection.fetch.register({
      path, methods: ['GET'], requestBody: 'buffered',
      fetch: (request) => relay(route, request)
    }), `router3: ${path}`);
  }
}
