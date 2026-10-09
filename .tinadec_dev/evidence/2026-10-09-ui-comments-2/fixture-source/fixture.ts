import { createApp, h } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createI18n } from 'vue-i18n'
import Root from './FixtureRoot.vue'
import zhCN from '@/locales/zh-CN'
import en from '@/locales/en'
import '@/styles.css'

// The fixture has no API credentials, no product runtime and no real project
// registration. Any accidentally introduced network call fails visibly.
function showFixtureError(error: unknown, info = 'startup') {
  let panel = document.getElementById('fixture-error')
  if (!panel) {
    panel = document.createElement('pre')
    panel.id = 'fixture-error'
    panel.setAttribute('role', 'alert')
    panel.style.cssText = 'margin:16px;padding:16px;white-space:pre-wrap;color:#ffb4b4;background:#301a1a;border:1px solid currentColor'
    document.body.prepend(panel)
  }
  panel.textContent = `Isolated fixture error (${info}):\n${error instanceof Error ? error.stack ?? error.message : String(error)}`
}
window.addEventListener('error', event => showFixtureError(event.error ?? event.message, 'window.error'))
window.addEventListener('unhandledrejection', event => showFixtureError(event.reason, 'unhandledrejection'))
window.fetch = async () => { throw new Error('Network is disabled in the isolated composer fixture') }
const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { render: () => h('span') } }] })
const app = createApp(Root)
app.config.errorHandler = (error, _instance, info) => showFixtureError(error, info)
try {
  app.use(router).use(createI18n({ legacy: false, locale: 'zh-CN', fallbackLocale: 'en', messages: { 'zh-CN': zhCN, en } })).mount('#fixture-app')
} catch (error) {
  showFixtureError(error)
}
