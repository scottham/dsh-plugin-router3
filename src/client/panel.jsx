// The panel body. Everything it shows comes from the host half's
// /api/router3 routes; it keeps nothing but what it last fetched.
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { pair, readTrajectory } from './trajectory.js';

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

const loadSources = () => api('api/router3/sources');
const CHOICE = 'dsh-plugin-router3.source';
const remembered = () => { try { return localStorage.getItem(CHOICE); } catch { return null; } };
const remember = (id) => { try { localStorage.setItem(CHOICE, id); } catch { /* per-viewer convenience only */ } };

// Which Router3 key to read: the host lists every configured model provider
// that holds one (`sources`); the viewer's pick is remembered in this
// browser, and falls back to the host's default when it is gone.
function useSource(visible) {
  const sources = usePolled(loadSources, 60000, visible);
  const [chosen, setChosen] = useState(remembered);
  const list = sources.data?.sources ?? [];
  const usable = list.filter((s) => s.configured);
  const current = usable.find((s) => s.id === chosen)?.id ?? sources.data?.default ?? null;
  return { list, usable, current, loaded: sources.data != null, error: sources.error, choose: (id) => { remember(id); setChosen(id); } };
}

const noSubscribe = () => () => {};
const noSnapshot = () => undefined;

// The current session's trajectory as dsh assembles it, read live so a call
// made a moment ago pairs as soon as both sides know about it.
function useRequests(trajectory, sessionId) {
  const observable = useMemo(() => (trajectory && sessionId ? trajectory(sessionId) : null), [trajectory, sessionId]);
  const subscribe = useCallback((listener) => (observable ? observable.subscribe(listener) : noSubscribe()), [observable]);
  const snapshot = useSyncExternalStore(subscribe, observable ? () => observable.getSnapshot() : noSnapshot);
  return useMemo(() => readTrajectory(snapshot), [snapshot]);
}

export function Panel({ t, hooks, sessionId, trajectory, locate }) {
  const info = hooks?.tabInfo ? hooks.tabInfo() : null;
  const visible = info?.tab?.visible ?? true;
  const source = useSource(visible);
  const requests = useRequests(trajectory, sessionId);
  const q = source.current ? `&source=${encodeURIComponent(source.current)}` : '';
  const loadSummary = useMemo(() => () => api(`api/router3/summary?${q.slice(1)}`), [q]);
  const loadUsage = useMemo(() => () => api(`api/router3/usage?days=30${q}`), [q]);
  const loadRequests = useMemo(() => () => api(`api/router3/requests?limit=8${q}`), [q]);
  const summary = usePolled(loadSummary, 15000, visible);
  const usage = usePolled(loadUsage, 60000, visible);
  const recent = usePolled(loadRequests, 20000, visible);
  const now = useNow();

  if (summary.error && !summary.data) return <div className="r3-pane"><Failure t={t} error={summary.error} /></div>;
  if (!summary.data) return <div className="r3-pane"><div className="r3-note">{t('loading')}</div></div>;
  if (summary.data.configured === false) return <div className="r3-pane"><Setup t={t} sources={summary.data.sources ?? source.list} /></div>;

  const { key, pool } = summary.data;
  const ago = Math.round((now - (summary.at ?? now)) / 1000);
  return (
    <div className="r3-pane">
      {source.usable.length > 1 && (
        <div className="r3-source">
          <label htmlFor="r3-source">{t('source.label')}</label>
          <select id="r3-source" value={source.current ?? ''} onChange={(e) => source.choose(e.target.value)}>
            {source.usable.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}
      <div className="r3-h"><span>{t('pool.title')}</span><span className="r3-state" data-state={pool?.state ?? 'none'}>{t(`state.${pool?.state ?? 'none'}`)}</span></div>
      <Cards t={t} keyData={key} pool={pool} />
      {usage.data && <Usage t={t} usage={usage.data} />}
      {recent.data && <Recent t={t} items={recent.data.items} requests={requests} locate={locate} />}
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
          <Table t={t} id="models" columns={[
            { key: 'model', label: t('models.model') }, { key: 'calls', label: t('models.calls'), width: '3.4em', className: 'r' }, { key: 'tokens', label: t('models.tokens'), width: '3.8em', className: 'r' },
            { key: 'avg', label: t('models.avg'), width: '3.4em', className: 'r' }, { key: 'cost', label: t('models.cost'), width: '4em', className: 'r' }]}>
            {usage.models.slice(0, 8).map((m) => (
              <tr key={m.model ?? '-'}><td title={m.model ?? ''}>{m.model ?? '–'}</td><td className="r">{m.requests.toLocaleString()}</td>
                <td className="r">{tokens(Number(m.input_tokens) + Number(m.output_tokens) + Number(m.reasoning_tokens))}</td>
                <td className="r">{seconds(m.avg_latency_ms)}</td><td className="r">{usdc(m.charged_atomic)}</td></tr>))}
          </Table>
        </>
      )}
    </>
  );
}

// Each call this session made shows its dsh request number; clicking the row
// shows that request in the trajectory view. Calls from elsewhere show none.
function Recent({ t, items, requests, locate }) {
  const paired = useMemo(() => pair(items, requests), [items, requests]);
  if (!items.length) return <div className="r3-note">{t('empty.usage')}</div>;
  const numbered = paired.size > 0;
  return (
    <>
      <div className="r3-h"><span>{t('recent.title')}</span></div>
      <Table t={t} id="recent" columns={[
        numbered && { key: 'n', label: '#', width: '2.4em', className: 'n' }, { key: 'time', label: t('recent.time'), width: '6.4em' }, { key: 'model', label: t('recent.model') },
        { key: 'io', label: t('recent.inOut'), width: '6.2em', className: 'r' }, { key: 'cost', label: t('recent.cost'), width: '4em', className: 'r' }]}>
        {items.map((r) => {
          const failed = r.status !== 'completed' && r.status !== 'running';
          const match = paired.get(r.id);
          const hint = match ? t('recent.locate', { number: match.number, turn: match.turn, step: match.step }) : undefined;
          return (
            <tr key={r.id} className={match ? 'link' : undefined} title={hint} onClick={match && locate ? () => { locate(match); } : undefined}>
              {numbered && <td className="n">{match ? match.number : ''}</td>}
              <td className="m">{clock(r.created_at)}</td><td title={r.model ?? ''}>{r.model ?? '–'}</td>
              <td className="r">{r.usage ? `${tokens(r.usage.inputTokens)} / ${tokens((r.usage.outputTokens ?? 0) + (r.usage.reasoningTokens ?? 0))}` : '–'}</td>
              <td className={`r${failed ? ' bad' : ''}`} title={failed ? (r.failure_code ?? r.status) : ''}>{failed ? t('recent.failed') : r.status === 'running' ? '…' : usdc(r.charged_atomic, 4)}</td>
            </tr>);
        })}
      </Table>
    </>
  );
}

// A fixed-layout table whose column widths the user sets by dragging the
// divider at the right of a header cell. One column (no `width`) takes what
// the others leave; its divider resizes the column after it. Widths stick
// per browser under the table's id; a double-click on a divider resets them.
const COLS = 'router3.columns.';
const MIN_PX = 24;
const sizes = (id) => { try { const stored = JSON.parse(localStorage.getItem(COLS + id)); return stored && typeof stored === 'object' ? stored : {}; } catch { return {}; } };
function Table({ t, id, columns, children }) {
  const cols = columns.filter(Boolean);
  const [custom, setCustom] = useState(() => sizes(id));
  const width = (c) => custom[c.key] ?? c.width;
  const flexAt = cols.findIndex((c) => c.width == null);
  const onDown = (event, index) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const row = event.currentTarget.closest('tr');
    const cells = [...row.children];
    // The divider after the flexible column resizes its neighbour instead, the
    // other way round, so the neighbour's edge is what follows the pointer.
    const target = index === flexAt ? index + 1 : index;
    const sign = index === flexAt ? -1 : 1;
    const start = cells[target].getBoundingClientRect().width;
    const room = flexAt < 0 ? Infinity : cells[flexAt].getBoundingClientRect().width - MIN_PX;
    const x0 = event.clientX;
    const grip = event.currentTarget;
    grip.setPointerCapture(event.pointerId);
    grip.classList.add('on');
    let next = custom;
    const move = (e) => { const px = Math.round(Math.max(MIN_PX, Math.min(start + room, start + sign * (e.clientX - x0)))); next = { ...custom, [cols[target].key]: px }; setCustom(next); };
    const up = () => {
      grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); grip.removeEventListener('pointercancel', up);
      grip.classList.remove('on');
      try { localStorage.setItem(COLS + id, JSON.stringify(next)); } catch { /* per-viewer convenience only */ }
    };
    grip.addEventListener('pointermove', move); grip.addEventListener('pointerup', up); grip.addEventListener('pointercancel', up);
  };
  const reset = () => { setCustom({}); try { localStorage.removeItem(COLS + id); } catch { /* ignore */ } };
  return (
    <table className="r3-table">
      <colgroup>{cols.map((c) => { const w = width(c); return <col key={c.key} style={w == null ? undefined : { width: typeof w === 'number' ? `${w}px` : w }} />; })}</colgroup>
      <thead><tr>{cols.map((c, i) => (
        <th key={c.key} className={c.className}>{c.label}
          {i < cols.length - 1 && <span className="grip" title={t('columns.grip')} onPointerDown={(e) => onDown(e, i)} onDoubleClick={reset} />}
        </th>))}</tr></thead>
      <tbody>{children}</tbody>
    </table>
  );
}

function Failure({ t, error }) {
  const text = error.code === 'ROUTER3_UNREACHABLE' ? t('error.unreachable', { message: error.message })
    : error.status === 401 ? t('error.key') : t('error.other', { status: error.status ?? error.message });
  return <div className="r3-err">{text}</div>;
}

// No usable key. Providers that point at Router3 but hold no key are named,
// so the fix is one paste on the Models page.
function Setup({ t, sources }) {
  const empty = sources.filter((s) => !s.configured);
  return (
    <div className="r3-setup">
      <h3>{t('setup.title')}</h3>
      {empty.length > 0
        ? <p>{t('setup.missingKey', { names: empty.map((s) => s.name).join(', ') })}</p>
        : <p>{t('setup.body')}</p>}
    </div>
  );
}
