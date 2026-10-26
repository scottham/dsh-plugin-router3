// Browser half: registers "router3" as a right-sidebar page, with an entry
// on the guide page, and its body. Styles are injected once when the module
// is materialized and removed when the plugin unloads.
import { Panel } from './panel.jsx';
import { locate } from './trajectory.js';
import { en, zh } from './locales.js';
import css from './styles.css';

const ID = 'dsh-plugin-router3';
const KIND = 'router3';
const NS = 'router3';

export const inject = ['slots', 'locale', 'sidebarRightTabs', 'uiConversation'];

export function apply(ctx) {
  const t = ctx.locale.bind(NS);
  // The session's trajectory as dsh assembles it (requests with their
  // timing, model and usage), for pairing Router3's records with dsh's.
  const trajectory = (sessionId) => { try { return ctx.uiConversation.binding(sessionId).target('trajectory'); } catch { return null; } };
  const Body = (props) => <Panel {...props} trajectory={trajectory} locate={locate} />;
  ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'router3: dictionaries');
  ctx.effect(() => {
    const style = document.createElement('style');
    style.dataset.plugin = ID;
    style.textContent = css;
    document.head.append(style);
    return () => style.remove();
  }, 'router3: styles');
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: ID, kind: KIND, priority: 'extension', keepMounted: true,
    title: () => t('type.label'),
    guide: [{ id: 'panel', order: 60, title: () => t('guide.title'), description: () => t('guide.description') }]
  }), 'router3: tab type');
  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register(
    { name: 'sidebar.right.pane.tab', key: ID, locale: NS },
    Body
  )), 'router3: tab body');
}
