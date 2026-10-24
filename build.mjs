// Builds the two halves. The host half is plain ESM copied as is. The browser
// half must be in dsh's lazy-CJS factory format: one script that hands the
// page's module loader the package name and a factory(require); the modules
// the shell already seeds (React, Cordis, the UI primitives) stay external
// and arrive through that require.
import { build } from 'esbuild';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
mkdirSync('lib', { recursive: true });
copyFileSync('src/index.js', 'lib/index.js');
await build({
  entryPoints: ['src/client/index.jsx'],
  outfile: 'lib/client.js',
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  loader: { '.css': 'text' },
  external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/cordis', 'zod',
    '@deepseek-ai/dsh-client-store', '@deepseek-ai/dsh-client-ui-slots', '@deepseek-ai/dsh-client-ui-primitives', '@deepseek-ai/dsh-client-ui-dockkit'],
  banner: { js: `window.__ModuleLoader__.load({ id: ${JSON.stringify(pkg.name)}, factory: (require) => {\nvar module = { exports: {} }; var exports = module.exports;` },
  footer: { js: 'return module.exports; } });' },
  logLevel: 'info'
});
