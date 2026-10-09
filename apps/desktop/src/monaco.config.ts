/**
 * Monaco Editor Vite integration helpers.
 *
 * This module sets up `self.MonacoEnvironment` so that Monaco can spawn its
 * language web workers through Vite's explicit worker imports. Import this
 * module once (for side effects) before initialising Monaco.
 *
 * The exported `monacoVitePluginConfig` object is a hint for the eventual
 * `vite.config.ts` integration — it is not consumed at runtime here.
 */

import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import TypeScriptWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'

interface MonacoEnvironment {
  getWorker?(workerId: string, label: string): Worker
  getWorkerUrl?(workerId: string, label: string): string
}

declare global {
  interface Window {
    MonacoEnvironment?: MonacoEnvironment
  }
}

function installMonacoEnvironment(): void {
  if (typeof window === 'undefined') return
  if (window.MonacoEnvironment && typeof window.MonacoEnvironment.getWorker === 'function') return

  // `import('monaco-editor')` resolves to editor.main, which registers the
  // FULL language-service clients (typescript/json/css/html). Each client
  // spawns a worker by label and issues RPCs like `getNavigationTree` — those
  // handlers only exist in the matching language worker, so routing every
  // label to the generic editor worker throws
  // "Missing requestHandler or method: …" on first use.
  //
  // A URL stored in a variable is processed as a plain asset, so small worker
  // entrypoints become data URLs with unresolved relative imports in production.
  // ?worker bundles each entrypoint and its dependencies into a runnable worker.

  window.MonacoEnvironment = {
    getWorker(_workerId: string, label: string): Worker {
      switch (label) {
        case 'typescript':
        case 'javascript':
          return new TypeScriptWorker()
        case 'json':
          return new JsonWorker()
        case 'css':
        case 'scss':
        case 'less':
          return new CssWorker()
        case 'html':
        case 'handlebars':
        case 'razor':
          return new HtmlWorker()
        default:
          // Editor core worker (diff computation, word navigation, links…).
          return new EditorWorker()
      }
    },
  }
}

installMonacoEnvironment()

/**
 * Configuration hint for `vite.config.ts`.
 *
 * The main agent can spread this into the Vite plugin array to ensure
 * `monaco-editor` ESM workers are handled correctly.
 */
export const monacoVitePluginConfig = {
  optimizeDeps: {
    include: ['monaco-editor/esm/vs/editor/editor.api'],
  },
  worker: {
    format: 'es' as const,
  },
}

export { installMonacoEnvironment }
