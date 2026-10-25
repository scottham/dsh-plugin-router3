# dsh-plugin-router3

A [DeepSeek Harness (dsh)](https://github.com/deepseek-ai/deepseek-harness) plugin that adds a **Router3** panel to the right sidebar: your prepaid pool, today's spend against its limit, usage by model over the last 30 days, and the most recent calls.

It reads with the API key you already configured for a Router3 model provider: every provider on the Models page whose base URL points at Router3, or whose key is an `r3_live_…` key, is found by itself. With several, the panel gets a picker and the choice sticks per browser. Nothing in the panel can spend, change limits, or withdraw; the key never reaches the browser.

## Install

```sh
dsh plugin --profile web add github:scottham/dsh-plugin-router3        # Web UI
dsh plugin --profile desktop add github:scottham/dsh-plugin-router3    # Desktop app
```

Then, in **Settings → Models**, add Router3 as a *Custom model API* with any provider id, base URL `https://router3.ai/v1`, protocol *OpenAI Chat Completions*, and your `r3_live_…` key. Open the right sidebar and pick **Router3** on the guide page. A provider added later shows up on the panel's next refresh; no restart.

## What it shows

| Section | Source |
| --- | --- |
| Key picker (shown with two or more Router3 keys) | `GET /api/router3/sources` on the dsh host, from the Models page configuration |
| Available now, balance and owed, allowance left, refill target, pool state | `GET /v1/key` → `pool` |
| Spent today against the daily limit, this key's totals and running requests | `GET /v1/key` → `key` |
| Last 30 days bar chart and the by-model table | `GET /v1/key/usage?days=30` |
| Recent calls with tokens, cost and failures | `GET /v1/key/requests` |

All three Router3 endpoints are read-only and authenticated by the API key alone; they never return the wallet address or the wallet's balance.

## How it is built

- `src/index.js` — host half. Registers `/api/router3/{sources,summary,usage,requests}` on dsh's authenticated API channel. `sources` walks dsh's configurable model providers (`ctx.llm`) and their stored settings (`ctx.settings`), keeps those whose base URL host is the configured Router3 host or whose credential starts with `r3_live_`, and names each one's credential reference (the profile's `apiKeyEnv`, else `<PROVIDER>_API_KEY` as the Models page stores it). The data routes take `?source=<provider id>`, resolve that reference through `ctx.credentials` on every call, and relay to that provider's gateway origin.
- `src/client/` — browser half. Registers the `router3` tab type and its body on the right sidebar.
- `build.mjs` — emits `lib/client.js` in dsh's client-module factory format (React and the UI primitives stay external) and copies the host half to `lib/index.js`. `lib/` is committed so a `github:` install needs no build step.

Configuration (`cordis.patch.yml`, override in your profile):

```yaml
- id: router3
  name: dsh-plugin-router3
  config:
    baseUrl: https://router3.ai      # providers pointing here are sources; a self-hosted gateway goes here
    credential: ROUTER3_API_KEY      # a reference offered as a source even when no provider names it
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
