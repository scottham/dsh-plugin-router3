// Pairs Router3's record of a call with the request dsh made for it, and
// shows that request in dsh's own trajectory view.
//
// dsh keeps no Router3 request id, so a pair rests on evidence: the request
// started within a few seconds of the call, went to the same model, and
// (when both sides know) produced the same number of output tokens. A call
// made from another session, or another tool, pairs with nothing.
const WINDOW_MS = 20000;

// dsh's trajectory numbers requests the way its view does: every recorded
// request, plus any assistant message that has none, in sequence order.
// Returns one entry per assistant request with what the pairing needs.
export function readTrajectory(snapshot) {
  if (!snapshot) return null;
  const byStep = new Map();
  for (const node of snapshot.eventNodes ?? []) {
    if (node.kind === 'assistant' && node.step > 0) byStep.set(`${node.turn}\0${node.step}`, node);
  }
  const seen = new Set();
  const entries = [];
  for (const request of snapshot.requests ?? []) {
    const key = `${request.turn}\0${request.step}`;
    const node = request.purpose === 'assistant' ? byStep.get(key) : undefined;
    if (node) seen.add(key);
    entries.push({ seq: request.startSeq, request, node });
  }
  for (const [key, node] of byStep) if (!seen.has(key)) entries.push({ seq: node.seq, node });
  entries.sort((a, b) => a.seq - b.seq);
  const out = [];
  let rank = 0; // assistant message cells in trajectory order: the timeline's "message" spans
  entries.forEach(({ request, node }, index) => {
    if (request?.purpose === 'compaction') return;
    if (node) rank += 1;
    out.push({
      number: index + 1,
      turn: request?.turn ?? node.turn,
      step: request?.step ?? node.step,
      startedAt: request?.startedAt ?? node?.time ?? null,
      model: request?.providerMetadata?.model ?? node?.providerMetadata?.model ?? null,
      output: request?.usage?.outputTokens ?? node?.usage?.outputTokens ?? null,
      resultSeq: request?.resultSeq ?? node?.seq ?? null,
      rank: node ? rank : null
    });
  });
  return out;
}

const norm = (model) => String(model ?? '').toLowerCase();
// dsh sends the id the user configured; Router3 records the catalog name.
// They are usually identical; a bare id also matches its namespaced form.
const sameModel = (a, b) => { a = norm(a); b = norm(b); return a === b || a.endsWith(`/${b}`) || b.endsWith(`/${a}`); };

// Router3 items (as /v1/key/requests returns them) → their dsh request.
export function pair(items, requests) {
  const out = new Map();
  if (!items?.length || !requests?.length) return out;
  const taken = new Set();
  for (const item of items) {
    const at = Date.parse(item.created_at);
    const output = item.usage?.outputTokens ?? null;
    let best = null, score = Infinity;
    for (const request of requests) {
      if (taken.has(request) || request.startedAt == null || !sameModel(item.model, request.model)) continue;
      const dt = Math.abs(request.startedAt - at);
      if (dt > WINDOW_MS) continue;
      // An exact output-token match outranks any time distance.
      const s = output != null && request.output != null && output === request.output ? dt / 1000 : WINDOW_MS + dt;
      if (s < score) { score = s; best = request; }
    }
    if (best) { taken.add(best); out.set(item.id, best); }
  }
  return out;
}

// What dsh calls its trajectory view, in every language it ships.
const VIEW_LABELS = new Set(['Trajectory', '轨迹', '軌跡', 'Trayectoria', 'Trajectoire', 'Ausführungsverlauf', 'Траектория', 'Trajetória']);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Best effort, through dsh's DOM: dsh offers no API to select a request in
// another plugin's view. Switches the conversation to the trajectory view,
// then clicks the request's assistant row when it is rendered, else its
// span on the timeline (which scrolls the table to it). Resolves false when
// nothing was found; dsh's markup may change under this.
export async function locate(target) {
  const tabs = [...document.querySelectorAll('[data-conversation-tabs] [role="tab"]')];
  const tab = tabs.find((button) => VIEW_LABELS.has(button.textContent.trim()));
  if (!tab) return false;
  if (tab.getAttribute('aria-selected') !== 'true') tab.click();
  // The assistant row's key, as dsh derives it: by turn and step, else by the
  // message's sequence.
  const keys = [`assistant%00${target.turn}%00${target.step}`, `message%00seq%00${target.resultSeq}`];
  const selector = keys.map((key) => `[data-trajectory-row-key="${key}"]`).join(',');
  for (let tick = 0; tick < 30; tick++) {
    const row = document.querySelector(selector);
    if (row) { row.scrollIntoView({ block: 'center' }); row.click(); return true; }
    if (tick >= 3 && target.rank) {
      const span = document.querySelectorAll('[data-timeline-span="message"]')[target.rank - 1];
      if (span) { press(span); return true; }
    }
    await sleep(100);
  }
  return false;
}

function press(element) {
  const box = element.getBoundingClientRect();
  const init = { bubbles: true, cancelable: true, button: 0, buttons: 1, pointerId: 1, pointerType: 'mouse', isPrimary: true, clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 };
  element.dispatchEvent(new PointerEvent('pointerdown', init));
  element.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0 }));
}
