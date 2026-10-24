// The panel body. Everything it shows comes from the host half's
// /api/router3 routes; it keeps nothing but what it last fetched.
import { useEffect, useState } from 'react';

const USDC = 1e6;
const usdc = (atomic, digits = 2) => atomic == null ? '–' : (Number(atomic) / USDC).toFixed(digits);
const tokens = (n) => { n = Number(n ?? 0); return n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k` : String(n); };
const seconds = (ms) => ms == null ? '–' : `${(Number(ms) / 1000).toFixed(Number(ms) >= 10000 ? 0 : 1)}s`;
const clock = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const monthDay = (day) => new Date(`${day}T00:00:00Z`).toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: 'UTC' });

async function api(path) {
  const response = await fetch(new URL(path, document.baseURI), { credentials: 'include', headers: { accept: 'application/json' } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.error?.message ?? `HTTP ${response.status}`), { status: response.status, code: body.error?.code });
  return body;
}

// Polls `load` every `ms` while the tab is visible.
function usePolled(load, ms, visible) {
  const [state, setState] = useState({ data: null, error: null, at: null });
  useEffect(() => {
    if (!visible) return;
    let live = true, timer;
    const tick = async () => {
      try { const data = await load(); if (live) setState({ data, error: null, at: Date.now() }); }
      catch (error) { if (live) setState((s) => ({ ...s, error })); }
      if (live) timer = setTimeout(tick, ms);
    };
    tick();
    return () => { live = false; clearTimeout(timer); };
  }, [load, ms, visible]);
  return state;
}

function useNow(ms = 5000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(i); }, [ms]);
  return now;
}

const loadSummary = () => api('api/router3/summary');
const loadUsage = () => api('api/router3/usage?days=30');
const loadRequests = () => api('api/router3/requests?limit=8');

export function Panel({ t, hooks }) {
  const info = hooks?.tabInfo ? hooks.tabInfo() : null;
  const visible = info?.tab?.visible ?? true;
  const summary = usePolled(loadSummary, 15000, visible);
  const usage = usePolled(loadUsage, 60000, visible);
  const recent = usePolled(loadRequests, 20000, visible);
  const now = useNow();

  if (summary.error && !summary.data) return <div className="r3-pane"><Failure t={t} error={summary.error} /></div>;
  if (!summary.data) return <div className="r3-pane"><div className="r3-note">{t('loading')}</div></div>;
  if (summary.data.configured === false) return <div className="r3-pane"><Setup t={t} credential={summary.data.credential} /></div>;

  const { key, pool } = summary.data;
  const ago = Math.round((now - (summary.at ?? now)) / 1000);
  return (
    <div className="r3-pane">
      <div className="r3-h"><span>{t('pool.title')}</span><span className="r3-state" data-state={pool?.state ?? 'none'}>{t(`state.${pool?.state ?? 'none'}`)}</span></div>
      <Cards t={t} keyData={key} pool={pool} />
      {usage.data && <Usage t={t} usage={usage.data} />}
      {recent.data && <Recent t={t} items={recent.data.items} />}
      {(summary.error || usage.error || recent.error) && <Failure t={t} error={summary.error ?? usage.error ?? recent.error} />}
      <div className="r3-foot">
        <span>{t('foot.key', { prefix: key.prefix })}</span>
        <span>{t('foot.updated', { ago: ago < 3 ? t('ago.now') : ago < 60 ? t('ago.seconds', { n: ago }) : t('ago.minutes', { n: Math.round(ago / 60) }) })}</span>
      </div>
    </div>
  );
}

function Cards({ t, keyData: key, pool }) {
  const limit = key.dailyLimitAtomic ?? pool?.dailyLimitAtomic ?? null;
  const spent = Number(key.spentTodayAtomic);
  const share = limit ? Math.min(100, (spent / Number(limit)) * 100) : 0;
  return (
    <div className="r3-cards">
      <div className="r3-card">
        <div className="l">{t('pool.available')}</div>
        <div className="v">{usdc(pool?.availableAtomic)}<small>USDC</small></div>
        <div className="s">{t('pool.balance', { balance: usdc(pool?.poolBalanceAtomic), owed: usdc(pool?.unsettledAtomic) })}</div>
      </div>
      <div className="r3-card">
        <div className="l">{t('pool.spentToday')}</div>
        <div className="v">{usdc(key.spentTodayAtomic)}</div>
        <div className="s">{limit ? t('pool.ofLimit', { limit: usdc(limit) }) : t('pool.noLimit')}</div>
        {limit && <div className="r3-bar"><i style={{ width: `${share}%` }} /></div>}
      </div>
      <div className="r3-card">
        <div className="l">{t('pool.allowance')}</div>
        <div className="v">{usdc(pool?.allowanceAtomic)}</div>
        <div className="s">{pool?.refillable ? t('pool.refillsTo', { target: usdc(pool.refillTargetAtomic) }) : t('pool.cannotRefill')}</div>
      </div>
      <div className="r3-card">
        <div className="l">{t('key.title', { name: key.name })}</div>
        <div className="v">{usdc(key.spentTodayAtomic)}</div>
        <div className="s">{t('key.summary', { total: usdc(key.spentAtomic), running: key.running })}</div>
      </div>
    </div>
  );
}

function Usage({ t, usage }) {
  const today = new Date().toISOString().slice(0, 10);
  const byDay = new Map(usage.daily.map((d) => [d.day, Number(d.charged_atomic)]));
  const days = Array.from({ length: usage.days }, (_, i) => { const d = new Date(Date.now() - (usage.days - 1 - i) * 86400000).toISOString().slice(0, 10); return { day: d, charged: byDay.get(d) ?? 0 }; });
  const max = Math.max(1, ...days.map((d) => d.charged));
  const total = days.reduce((s, d) => s + d.charged, 0);
  return (
    <>
      <div className="r3-h"><span>{t('usage.title', { days: usage.days, total: usdc(total) })}</span></div>
      <div className="r3-chart">{days.map((d) => <i key={d.day} className={d.day === today ? 'today' : ''} style={{ height: `${Math.max(2, (d.charged / max) * 100)}%` }} title={`${d.day} · ${usdc(d.charged, 4)}`} />)}</div>
      <div className="r3-axis"><span>{monthDay(days[0].day)}</span><span>{monthDay(days[Math.floor(days.length / 2)].day)}</span><span>{t('usage.today')}</span></div>
      {usage.models.length > 0 && (
        <>
          <div className="r3-h"><span>{t('models.title')}</span></div>
          <table className="r3-table">
            <thead><tr><th>{t('models.model')}</th><th className="r">{t('models.calls')}</th><th className="r">{t('models.tokens')}</th><th className="r">{t('models.avg')}</th><th className="r">{t('models.cost')}</th></tr></thead>
            <tbody>{usage.models.slice(0, 8).map((m) => (
              <tr key={m.model ?? '-'}><td title={m.model ?? ''}>{m.model ?? '–'}</td><td className="r">{m.requests.toLocaleString()}</td>
                <td className="r">{tokens(Number(m.input_tokens) + Number(m.output_tokens) + Number(m.reasoning_tokens))}</td>
                <td className="r">{seconds(m.avg_latency_ms)}</td><td className="r">{usdc(m.charged_atomic)}</td></tr>))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}

function Recent({ t, items }) {
  if (!items.length) return <div className="r3-note">{t('empty.usage')}</div>;
  return (
    <>
      <div className="r3-h"><span>{t('recent.title')}</span></div>
      <table className="r3-table">
        <thead><tr><th>{t('recent.time')}</th><th>{t('recent.model')}</th><th className="r">{t('recent.inOut')}</th><th className="r">{t('recent.cost')}</th></tr></thead>
        <tbody>{items.map((r) => {
          const failed = r.status !== 'completed' && r.status !== 'running';
          return (
            <tr key={r.id}>
              <td className="m">{clock(r.created_at)}</td><td title={r.model ?? ''}>{r.model ?? '–'}</td>
              <td className="r">{r.usage ? `${tokens(r.usage.inputTokens)} / ${tokens((r.usage.outputTokens ?? 0) + (r.usage.reasoningTokens ?? 0))}` : '–'}</td>
              <td className={`r${failed ? ' bad' : ''}`} title={failed ? (r.failure_code ?? r.status) : ''}>{failed ? t('recent.failed') : r.status === 'running' ? '…' : usdc(r.charged_atomic, 4)}</td>
            </tr>);
        })}</tbody>
      </table>
    </>
  );
}

function Failure({ t, error }) {
  const text = error.code === 'ROUTER3_UNREACHABLE' ? t('error.unreachable', { message: error.message })
    : error.status === 401 ? t('error.key') : t('error.other', { status: error.status ?? error.message });
  return <div className="r3-err">{text}</div>;
}

function Setup({ t, credential }) {
  return (
    <div className="r3-setup">
      <h3>{t('setup.title')}</h3>
      <p>{t('setup.body', { credential })}</p>
    </div>
  );
}
