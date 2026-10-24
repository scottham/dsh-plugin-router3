# dsh-plugin-router3

A [DeepSeek Harness (dsh)](https://github.com/deepseek-ai/deepseek-harness) plugin that adds a **Router3** panel to the right sidebar: your prepaid pool, today's spend against its limit, usage by model over the last 30 days, and the most recent calls.

It reads with the API key you already configured for the Router3 model provider. Nothing in the panel can spend, change limits, or withdraw; the key never reaches the browser.

## Install

```sh
dsh plugin --profile web add dsh-plugin-router3        # Web UI
dsh plugin --profile desktop add dsh-plugin-router3    # Desktop app
```

Then, in **Settings → Models**, add Router3 as a *Custom model API* with provider id `router3`, base URL `https://router3.ai/v1`, protocol *OpenAI Chat Completions*, and your `r3_live_…` key. The key is saved by dsh under the reference `ROUTER3_API_KEY`; the panel reads the same reference. Open the right sidebar and pick **Router3** on the guide page.

## What it shows

| Section | Source |
| --- | --- |
| Available now, balance and owed, allowance left, refill target, pool state | `GET /v1/key` → `pool` |
| Spent today against the daily limit, this key's totals and running requests | `GET /v1/key` → `key` |
| Last 30 days bar chart and the by-model table | `GET /v1/key/usage?days=30` |
| Recent calls with tokens, cost and failures | `GET /v1/key/requests` |

All three Router3 endpoints are read-only and authenticated by the API key alone; they never return the wallet address or the wallet's balance.

## How it is built

- `src/index.js` — host half. Registers `/api/router3/{summary,usage,requests}` on dsh's authenticated API channel, resolves the key through `ctx.credentials` on every call, and relays to Router3.
- `src/client/` — browser half. Registers the `router3` tab type and its body on the right sidebar.
- `build.mjs` — emits `lib/client.js` in dsh's client-module factory format (React and the UI primitives stay external) and copies the host half to `lib/index.js`.

Configuration (`cordis.patch.yml`, override in your profile):

```yaml
- id: router3
  name: dsh-plugin-router3
  config:
    baseUrl: https://router3.ai      # a self-hosted Router3 gateway
    credential: ROUTER3_API_KEY      # the credential reference to read
```

## Develop

```sh
npm install
npm run build
dsh plugin --profile web add /path/to/dsh-plugin-router3
dsh web
```

## License

MIT
