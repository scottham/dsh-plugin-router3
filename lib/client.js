window.__ModuleLoader__.load({ id: "dsh-plugin-router3", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.jsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/panel.jsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var USDC = 1e6;
var usdc = (atomic, digits = 2) => atomic == null ? "\u2013" : (Number(atomic) / USDC).toFixed(digits);
var tokens = (n) => {
  n = Number(n ?? 0);
  return n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k` : String(n);
};
var seconds = (ms) => ms == null ? "\u2013" : `${(Number(ms) / 1e3).toFixed(Number(ms) >= 1e4 ? 0 : 1)}s`;
var clock = (iso) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
var monthDay = (day) => (/* @__PURE__ */ new Date(`${day}T00:00:00Z`)).toLocaleDateString([], { month: "short", day: "numeric", timeZone: "UTC" });
async function api(path) {
  const response = await fetch(new URL(path, document.baseURI), { credentials: "include", headers: { accept: "application/json" } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.error?.message ?? `HTTP ${response.status}`), { status: response.status, code: body.error?.code });
  return body;
}
function usePolled(load, ms, visible) {
  const [state, setState] = (0, import_react.useState)({ data: null, error: null, at: null });
  (0, import_react.useEffect)(() => {
    if (!visible) return;
    let live = true, timer;
    const tick = async () => {
      try {
        const data = await load();
        if (live) setState({ data, error: null, at: Date.now() });
      } catch (error) {
        if (live) setState((s) => ({ ...s, error }));
      }
      if (live) timer = setTimeout(tick, ms);
    };
    tick();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [load, ms, visible]);
  return state;
}
function useNow(ms = 5e3) {
  const [now, setNow] = (0, import_react.useState)(Date.now());
  (0, import_react.useEffect)(() => {
    const i = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(i);
  }, [ms]);
  return now;
}
var loadSummary = () => api("api/router3/summary");
var loadUsage = () => api("api/router3/usage?days=30");
var loadRequests = () => api("api/router3/requests?limit=8");
function Panel({ t, hooks }) {
  const info = hooks?.tabInfo ? hooks.tabInfo() : null;
  const visible = info?.tab?.visible ?? true;
  const summary = usePolled(loadSummary, 15e3, visible);
  const usage = usePolled(loadUsage, 6e4, visible);
  const recent = usePolled(loadRequests, 2e4, visible);
  const now = useNow();
  if (summary.error && !summary.data) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "r3-pane", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Failure, { t, error: summary.error }) });
  if (!summary.data) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "r3-pane", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "r3-note", children: t("loading") }) });
  if (summary.data.configured === false) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "r3-pane", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Setup, { t, credential: summary.data.credential }) });
  const { key, pool } = summary.data;
  const ago = Math.round((now - (summary.at ?? now)) / 1e3);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "r3-pane", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "r3-h", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("pool.title") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "r3-state", "data-state": pool?.state ?? "none", children: t(`state.${pool?.state ?? "none"}`) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cards, { t, keyData: key, pool }),
    usage.data && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Usage, { t, usage: usage.data }),
    recent.data && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Recent, { t, items: recent.data.items }),
    (summary.error || usage.error || recent.error) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Failure, { t, error: summary.error ?? usage.error ?? recent.error }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "r3-foot", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("foot.key", { prefix: key.prefix }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("foot.updated", { ago: ago < 3 ? t("ago.now") : ago < 60 ? t("ago.seconds", { n: ago }) : t("ago.minutes", { n: Math.round(ago / 60) }) }) })
    ] })
  ] });
}
function Cards({ t, keyData: key, pool }) {
  const limit = key.dailyLimitAtomic ?? pool?.dailyLimitAtomic ?? null;
  const spent = Number(key.spentTodayAtomic);
  const share = limit ? Math.min(100, spent / Number(limit) * 100) : 0;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "r3-cards", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "r3-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "l", children: t("pool.available") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "v", children: [
        usdc(pool?.availableAtomic),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "USDC" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "s", children: t("pool.balance", { balance: usdc(pool?.poolBalanceAtomic), owed: usdc(pool?.unsettledAtomic) }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "r3-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "l", children: t("pool.spentToday") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "v", children: usdc(key.spentTodayAtomic) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "s", children: limit ? t("pool.ofLimit", { limit: usdc(limit) }) : t("pool.noLimit") }),
      limit && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "r3-bar", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { style: { width: `${share}%` } }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "r3-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "l", children: t("pool.allowance") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "v", children: usdc(pool?.allowanceAtomic) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "s", children: pool?.refillable ? t("pool.refillsTo", { target: usdc(pool.refillTargetAtomic) }) : t("pool.cannotRefill") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "r3-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "l", children: t("key.title", { name: key.name }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "v", children: usdc(key.spentTodayAtomic) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "s", children: t("key.summary", { total: usdc(key.spentAtomic), running: key.running }) })
    ] })
  ] });
}
function Usage({ t, usage }) {
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const byDay = new Map(usage.daily.map((d) => [d.day, Number(d.charged_atomic)]));
  const days = Array.from({ length: usage.days }, (_, i) => {
    const d = new Date(Date.now() - (usage.days - 1 - i) * 864e5).toISOString().slice(0, 10);
    return { day: d, charged: byDay.get(d) ?? 0 };
  });
  const max = Math.max(1, ...days.map((d) => d.charged));
  const total = days.reduce((s, d) => s + d.charged, 0);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "r3-h", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("usage.title", { days: usage.days, total: usdc(total) }) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "r3-chart", children: days.map((d) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { className: d.day === today ? "today" : "", style: { height: `${Math.max(2, d.charged / max * 100)}%` }, title: `${d.day} \xB7 ${usdc(d.charged, 4)}` }, d.day)) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "r3-axis", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: monthDay(days[0].day) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: monthDay(days[Math.floor(days.length / 2)].day) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("usage.today") })
    ] }),
    usage.models.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "r3-h", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("models.title") }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", { className: "r3-table", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: t("models.model") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { className: "r", children: t("models.calls") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { className: "r", children: t("models.tokens") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { className: "r", children: t("models.avg") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { className: "r", children: t("models.cost") })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: usage.models.slice(0, 8).map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { title: m.model ?? "", children: m.model ?? "\u2013" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { className: "r", children: m.requests.toLocaleString() }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { className: "r", children: tokens(Number(m.input_tokens) + Number(m.output_tokens) + Number(m.reasoning_tokens)) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { className: "r", children: seconds(m.avg_latency_ms) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { className: "r", children: usdc(m.charged_atomic) })
        ] }, m.model ?? "-")) })
      ] })
    ] })
  ] });
}
function Recent({ t, items }) {
  if (!items.length) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "r3-note", children: t("empty.usage") });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "r3-h", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("recent.title") }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", { className: "r3-table", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: t("recent.time") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: t("recent.model") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { className: "r", children: t("recent.inOut") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { className: "r", children: t("recent.cost") })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: items.map((r) => {
        const failed = r.status !== "completed" && r.status !== "running";
        return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { className: "m", children: clock(r.created_at) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { title: r.model ?? "", children: r.model ?? "\u2013" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { className: "r", children: r.usage ? `${tokens(r.usage.inputTokens)} / ${tokens((r.usage.outputTokens ?? 0) + (r.usage.reasoningTokens ?? 0))}` : "\u2013" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { className: `r${failed ? " bad" : ""}`, title: failed ? r.failure_code ?? r.status : "", children: failed ? t("recent.failed") : r.status === "running" ? "\u2026" : usdc(r.charged_atomic, 4) })
        ] }, r.id);
      }) })
    ] })
  ] });
}
function Failure({ t, error }) {
  const text = error.code === "ROUTER3_UNREACHABLE" ? t("error.unreachable", { message: error.message }) : error.status === 401 ? t("error.key") : t("error.other", { status: error.status ?? error.message });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "r3-err", children: text });
}
function Setup({ t, credential }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "r3-setup", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: t("setup.title") }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: t("setup.body", { credential }) })
  ] });
}

// src/client/locales.js
var en = {
  "type.label": "Router3",
  "guide.title": "Router3",
  "guide.description": "Balance, spend and recent calls on your Router3 key",
  "pool.title": "Prepaid pool",
  "pool.available": "Available now",
  "pool.balance": "balance {balance} \xB7 owed {owed}",
  "pool.spentToday": "Spent today",
  "pool.ofLimit": "of {limit} daily limit",
  "pool.noLimit": "no daily limit",
  "pool.allowance": "Allowance left",
  "pool.refillsTo": "refills to {target} from wallet",
  "pool.cannotRefill": "wallet cannot refill",
  "key.title": "This key \xB7 {name}",
  "key.summary": "today \xB7 {total} total \xB7 {running} running",
  "state.active": "Active \xB7 auto-refill on",
  "state.paused": "Paused \xB7 refills off",
  "state.pending": "Setting up\u2026",
  "state.withdrawing": "Withdrawing",
  "state.none": "No prepaid pool",
  "usage.title": "Last {days} days \xB7 {total} USDC",
  "usage.today": "Today",
  "models.title": "By model",
  "models.model": "Model",
  "models.calls": "Calls",
  "models.tokens": "Tokens",
  "models.avg": "Avg",
  "models.cost": "USDC",
  "recent.title": "Recent calls",
  "recent.time": "Time",
  "recent.model": "Model",
  "recent.inOut": "In / Out",
  "recent.cost": "USDC",
  "recent.failed": "failed",
  "foot.key": "Key {prefix}\u2026 \xB7 read-only",
  "foot.updated": "updated {ago}",
  "ago.now": "just now",
  "ago.seconds": "{n}s ago",
  "ago.minutes": "{n}m ago",
  "empty.usage": "No calls yet.",
  "loading": "Loading\u2026",
  "error.unreachable": "Router3 is unreachable: {message}",
  "error.key": "Router3 rejected the API key. Check it on the Models page.",
  "error.other": "Router3 answered {status}.",
  "setup.title": "Connect Router3",
  "setup.body": 'Add Router3 as a custom model API on the Models page with provider id "router3" and base URL https://router3.ai/v1, and paste your API key there. This panel reads the same key ({credential}).',
  "setup.open": "Open Models settings"
};
var zh = {
  "type.label": "Router3",
  "guide.title": "Router3",
  "guide.description": "Router3 Key \u7684\u4F59\u989D\u3001\u82B1\u8D39\u4E0E\u6700\u8FD1\u8C03\u7528",
  "pool.title": "\u9884\u4ED8\u6C60",
  "pool.available": "\u5F53\u524D\u53EF\u7528",
  "pool.balance": "\u4F59\u989D {balance} \xB7 \u5F85\u6263 {owed}",
  "pool.spentToday": "\u4ECA\u65E5\u82B1\u8D39",
  "pool.ofLimit": "\u6BCF\u65E5\u4E0A\u9650 {limit}",
  "pool.noLimit": "\u65E0\u6BCF\u65E5\u4E0A\u9650",
  "pool.allowance": "\u5269\u4F59\u6388\u6743",
  "pool.refillsTo": "\u4ECE\u94B1\u5305\u8865\u5145\u5230 {target}",
  "pool.cannotRefill": "\u94B1\u5305\u65E0\u6CD5\u8865\u5145",
  "key.title": "\u672C Key \xB7 {name}",
  "key.summary": "\u4ECA\u65E5 \xB7 \u7D2F\u8BA1 {total} \xB7 \u8FDB\u884C\u4E2D {running}",
  "state.active": "\u6B63\u5E38 \xB7 \u81EA\u52A8\u8865\u5145\u5F00\u542F",
  "state.paused": "\u5DF2\u6682\u505C \xB7 \u8865\u5145\u5173\u95ED",
  "state.pending": "\u5F00\u901A\u4E2D\u2026",
  "state.withdrawing": "\u53D6\u56DE\u4E2D",
  "state.none": "\u672A\u5F00\u901A\u9884\u4ED8\u6C60",
  "usage.title": "\u6700\u8FD1 {days} \u5929 \xB7 {total} USDC",
  "usage.today": "\u4ECA\u5929",
  "models.title": "\u6309\u6A21\u578B",
  "models.model": "\u6A21\u578B",
  "models.calls": "\u8C03\u7528",
  "models.tokens": "Token",
  "models.avg": "\u5E73\u5747",
  "models.cost": "USDC",
  "recent.title": "\u6700\u8FD1\u8C03\u7528",
  "recent.time": "\u65F6\u95F4",
  "recent.model": "\u6A21\u578B",
  "recent.inOut": "\u8F93\u5165 / \u8F93\u51FA",
  "recent.cost": "USDC",
  "recent.failed": "\u5931\u8D25",
  "foot.key": "Key {prefix}\u2026 \xB7 \u53EA\u8BFB",
  "foot.updated": "{ago}\u66F4\u65B0",
  "ago.now": "\u521A\u521A",
  "ago.seconds": "{n} \u79D2\u524D",
  "ago.minutes": "{n} \u5206\u949F\u524D",
  "empty.usage": "\u8FD8\u6CA1\u6709\u8C03\u7528\u3002",
  "loading": "\u52A0\u8F7D\u4E2D\u2026",
  "error.unreachable": "\u8FDE\u4E0D\u4E0A Router3\uFF1A{message}",
  "error.key": "Router3 \u62D2\u7EDD\u4E86\u8FD9\u4E2A API Key\uFF0C\u8BF7\u5230\u300C\u6A21\u578B\u300D\u9875\u68C0\u67E5\u3002",
  "error.other": "Router3 \u8FD4\u56DE {status}\u3002",
  "setup.title": "\u8FDE\u63A5 Router3",
  "setup.body": "\u5728\u300C\u6A21\u578B\u300D\u9875\u65B0\u5EFA Custom model API\uFF1AProvider ID \u586B router3\uFF0CBase URL \u586B https://router3.ai/v1\uFF0C\u518D\u7C98\u8D34 API Key\u3002\u672C\u9762\u677F\u8BFB\u53D6\u540C\u4E00\u628A Key\uFF08{credential}\uFF09\u3002",
  "setup.open": "\u6253\u5F00\u6A21\u578B\u8BBE\u7F6E"
};

// src/client/styles.css
var styles_default = '.r3-pane { padding: 12px; font-size: 12px; line-height: 1.4; color: var(--dsw-alias-label-primary); font-variant-numeric: tabular-nums; overflow: auto; height: 100%; box-sizing: border-box; }\n.r3-pane * { box-sizing: border-box; }\n.r3-h { display: flex; justify-content: space-between; align-items: baseline; font-size: 11px; font-weight: 600; letter-spacing: .5px; text-transform: uppercase; color: var(--dsw-alias-label-tertiary); margin: 16px 0 8px; }\n.r3-h:first-child { margin-top: 0; }\n.r3-state { font-weight: 400; text-transform: none; letter-spacing: 0; color: var(--dsw-alias-label-secondary); }\n.r3-state::before { content: ""; display: inline-block; width: 6px; height: 6px; border-radius: 50%; corner-shape: round; background: var(--dsw-alias-label-tertiary); margin-right: 5px; vertical-align: middle; }\n.r3-state[data-state="active"]::before { background: #4caf87; }\n.r3-state[data-state="withdrawing"]::before, .r3-state[data-state="paused"]::before { background: #c9a04a; }\n.r3-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }\n.r3-card { background: var(--dsw-alias-bg-layer-1); border: 0.5px solid var(--dsw-alias-border-l3); border-radius: var(--dsw-radius-md, 8px); padding: 9px 11px; min-width: 0; }\n.r3-card .l { color: var(--dsw-alias-label-secondary); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n.r3-card .v { font-size: 17px; font-weight: 500; margin-top: 2px; }\n.r3-card .v small { font-size: 11px; font-weight: 400; color: var(--dsw-alias-label-secondary); margin-left: 3px; }\n.r3-card .s { color: var(--dsw-alias-label-secondary); font-size: 11px; margin-top: 2px; }\n.r3-bar { height: 4px; background: var(--dsw-alias-border-l3); border-radius: 2px; margin-top: 8px; overflow: hidden; }\n.r3-bar i { display: block; height: 100%; background: var(--dsw-alias-label-tertiary); }\n.r3-chart { display: flex; align-items: flex-end; gap: 2px; height: 44px; border-bottom: 0.5px solid var(--dsw-alias-border-l3); }\n.r3-chart i { flex: 1; background: var(--dsw-alias-border-l3); border-radius: 2px 2px 0 0; min-height: 1px; }\n.r3-chart i.today { background: #4caf87; }\n.r3-axis { display: flex; justify-content: space-between; color: var(--dsw-alias-label-tertiary); font-size: 10px; margin-top: 4px; }\n.r3-table { width: 100%; border-collapse: collapse; }\n.r3-table th { text-align: left; color: var(--dsw-alias-label-tertiary); font-weight: 500; font-size: 11px; padding: 3px 0; border-bottom: 0.5px solid var(--dsw-alias-border-l3); }\n.r3-table td { padding: 4px 0; border-bottom: 0.5px solid var(--dsw-alias-border-l3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 0; }\n.r3-table td.r, .r3-table th.r { text-align: right; }\n.r3-table .m { color: var(--dsw-alias-label-secondary); }\n.r3-table .bad { color: #d9736f; }\n.r3-foot { margin-top: 14px; color: var(--dsw-alias-label-tertiary); font-size: 11px; display: flex; justify-content: space-between; gap: 8px; }\n.r3-note { color: var(--dsw-alias-label-secondary); padding: 8px 0; }\n.r3-setup h3 { font-size: 13px; margin: 0 0 6px; font-weight: 600; }\n.r3-setup p { margin: 0 0 10px; color: var(--dsw-alias-label-secondary); }\n.r3-setup code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }\n.r3-err { color: #d9736f; padding: 6px 0; }\n';

// src/client/index.jsx
var ID = "dsh-plugin-router3";
var KIND = "router3";
var NS = "router3";
var inject = ["slots", "locale", "sidebarRightTabs"];
function apply(ctx) {
  const t = ctx.locale.bind(NS);
  ctx.effect(() => ctx.locale.register(NS, { en, zh }), "router3: dictionaries");
  ctx.effect(() => {
    const style = document.createElement("style");
    style.dataset.plugin = ID;
    style.textContent = styles_default;
    document.head.append(style);
    return () => style.remove();
  }, "router3: styles");
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: ID,
    kind: KIND,
    priority: "extension",
    keepMounted: true,
    title: () => t("type.label"),
    guide: [{ id: "panel", order: 60, title: () => t("guide.title"), description: () => t("guide.description") }]
  }), "router3: tab type");
  ctx.effect(() => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register(
    { name: "sidebar.right.pane.tab", key: ID, locale: NS },
    Panel
  )), "router3: tab body");
}
return module.exports; } });
