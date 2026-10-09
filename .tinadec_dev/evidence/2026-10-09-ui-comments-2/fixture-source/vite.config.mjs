import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const fixtureRoot = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(fixtureRoot, '../../..')
const desktopRoot = path.join(repositoryRoot, 'apps/desktop')
export default defineConfig({
  root: fixtureRoot, base: './', publicDir: false,
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: [
      { find: /^@\/controllers\/HomeController$/, replacement: path.join(fixtureRoot, 'fixture-controller.ts') },
      { find: /^@\/api$/, replacement: path.join(fixtureRoot, 'fixture-api.ts') },
      { find: /^@\/composables\/usePanelStyles$/, replacement: path.join(fixtureRoot, 'fixture-panel.ts') },
      { find: '@', replacement: path.join(desktopRoot, 'src') },
      { find: '@tinadec/ui', replacement: path.join(repositoryRoot, 'apps/TinadecUI/src/index.ts') },
      { find: 'vue', replacement: path.join(desktopRoot, 'src/lib/vue-shim.ts') },
      { find: '@vue/reactivity', replacement: path.join(repositoryRoot, 'node_modules/@vue/reactivity/dist/reactivity.esm-bundler.js') },
      { find: '@vue/runtime-dom', replacement: path.join(repositoryRoot, 'node_modules/@vue/runtime-dom/dist/runtime-dom.esm-bundler.js') },
      { find: '@vue/runtime-vapor', replacement: path.join(repositoryRoot, 'node_modules/@vue/runtime-vapor/dist/runtime-vapor.esm-bundler.js') },
    ],
    dedupe: ['vue', '@vue/reactivity', '@vue/runtime-dom', '@vue/runtime-vapor'],
  },
  build: { outDir: path.join(fixtureRoot, 'dist'), emptyOutDir: true },
})
