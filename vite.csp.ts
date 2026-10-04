import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Plugin } from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const TAURI_CONF_PATH = path.resolve(rootDir, 'src-tauri/tauri.conf.json');
const APP_ENTRIES = new Set(['main.html', 'overlay.html', 'hud.html']);

type DirectiveMap = Record<string, string | string[]>;

const serializePolicy = (directives: DirectiveMap): string =>
  Object.entries(directives)
    .map(([name, sources]) =>
      [name, ...(Array.isArray(sources) ? sources : [sources])].join(' ')
    )
    .join('; ');

const readDevPolicy = (): string => {
  const conf = JSON.parse(readFileSync(TAURI_CONF_PATH, 'utf8')) as {
    app: { security: { devCsp: DirectiveMap } };
  };

  return serializePolicy(conf.app.security.devCsp);
};

/**
 * Tauri injects `devCsp` only into pages it serves itself. On desktop the dev
 * windows load straight from Vite, so without this the policy would be
 * checked in release builds alone and a violation would surface only there.
 * The app windows' entries only: `remote.html` gets its policy as a header from
 * the remote server, and a second policy here would be enforced on top of it.
 */
export const devContentSecurityPolicy = (): Plugin => ({
  name: 'marble-trace:dev-csp',
  apply: 'serve',
  transformIndexHtml: {
    order: 'pre',
    handler: (_html, context) => {
      if (!APP_ENTRIES.has(path.basename(context.filename))) {
        return [];
      }

      return [
        {
          tag: 'meta',
          attrs: {
            'http-equiv': 'Content-Security-Policy',
            content: readDevPolicy(),
          },
          injectTo: 'head-prepend',
        },
      ];
    },
  },
});
