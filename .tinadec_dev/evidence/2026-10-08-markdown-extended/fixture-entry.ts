// Fixture entry for the Markdown acceptance run. It mounts the real
// MarkdownRender SFC inside the same transcript wrappers the app uses, with the
// real zh-CN locale and the real stylesheet, so the checks exercise shipped code
// rather than a re-implementation.
import { createApp, h, nextTick, reactive } from 'vue'
import { createI18n } from 'vue-i18n'
import zhCN from '../../../apps/desktop/src/locales/zh-CN'
import '../../../apps/desktop/src/styles.css'
import MarkdownRender from '../../../apps/desktop/src/components/MarkdownRender.vue'

interface QaApi {
  set(content: string, width?: number): Promise<void>
  width(width: number): Promise<void>
  theme(theme: 'dark' | 'light'): Promise<void>
  settled(): Promise<void>
}

declare global {
  interface Window {
    qa?: QaApi
    qaReady?: boolean
    qaError?: string
  }
}

const state = reactive({ content: '' })

const app = createApp({
  render: () => h('div', { class: 'message-stream-container' },
    h('div', { class: 'message-stream relative overflow-hidden' },
      h('div', { class: 'h-full w-full overflow-auto' },
        h('div', { class: 'message-stream-inner' },
          h('article', { class: 'message-wrapper assistant' },
            h('div', { class: 'assistant-message-row' },
              h('div', { class: 'message-content assistant', 'data-testid': 'assistant-body' },
                h(MarkdownRender, { content: state.content })))))))),
})

app.use(createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'zh-CN',
  messages: { 'zh-CN': zhCN as unknown as Record<string, unknown> },
}))
app.mount('#messages')

const host = document.querySelector<HTMLElement>('.conversation') as HTMLElement

async function settle() {
  await nextTick()
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
}

window.qa = {
  async set(content: string, width = 800) {
    host.style.width = `${width}px`
    host.className = `conversation${width < 560 ? ' chat-narrow' : ''}${width < 400 ? ' chat-ultra' : ''}`
    state.content = content
    await settle()
  },
  async width(width: number) {
    host.style.width = `${width}px`
    host.className = `conversation${width < 560 ? ' chat-narrow' : ''}${width < 400 ? ' chat-ultra' : ''}`
    await settle()
  },
  async theme(theme: 'dark' | 'light') {
    document.documentElement.setAttribute('data-theme', theme)
    // Let the themed transitions finish before anything is measured or captured.
    await Promise.allSettled(document.getAnimations()
      .filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity)
      .map(animation => animation.finished))
    await new Promise<void>(resolve => setTimeout(() => resolve(), 150))
    await settle()
  },
  settled: settle,
}

window.qaReady = true
