// Reverse check for the AbortError fix: a *real* transport failure on the initial
// roster read must still surface the connection banner (the fix must not swallow
// genuine backend outages). Injects a fetch wrapper that rejects /api/v1/sessions
// with a TypeError, reloads, samples the banner, then removes the wrapper.
import { setTimeout as sleep } from 'node:timers/promises'

const CDP = 'http://127.0.0.1:9222'
const targets = await (await fetch(`${CDP}/json/list`)).json()
const page = targets.find((t) => t.type === 'page' && t.url.startsWith('http://127.0.0.1:5173'))
if (!page) throw new Error('TinadecOffice page target not found')

const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  ws.onopen = resolve
  ws.onerror = () => reject(new Error('ws connect failed'))
})

let nextId = 1
const pending = new Map()
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject, method } = pending.get(msg.id)
    pending.delete(msg.id)
    msg.error ? reject(new Error(`${method}: ${JSON.stringify(msg.error)}`)) : resolve(msg.result)
  }
}
const send = (method, params = {}) => {
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, method })
    ws.send(JSON.stringify({ id, method, params }))
  })
}

// Only the roster read fails; every other endpoint keeps working so the rest of
// the app still boots and the banner is attributable to this one failure.
const inject = String.raw`(() => {
  const origFetch = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : (input && input.url) || ''
    window.__injectHits = window.__injectHits || []
    if (url.includes('/api/v1/sessions')) {
      window.__injectHits.push('blocked ' + url)
      throw new TypeError('Failed to fetch')
    }
    return origFetch(input, init)
  }
})()`

await send('Page.enable')
await send('Runtime.enable')
const injected = await send('Page.addScriptToEvaluateOnNewDocument', { source: inject })
await send('Page.reload')
await sleep(6000)

const sample = await send('Runtime.evaluate', {
  expression: `(async () => {
    const text = document.body ? document.body.innerText : ''
    const at = text.indexOf('Cannot connect to backend')
    const failIdx = text.indexOf('加载失败')
    const url = new URL('/src/composables/useNotifications.ts', location.origin).href
    const n = (await import(url)).useNotifications()
    const snapshot = (list) => list.map((i) => ({
      key: i.key, level: i.level, title: i.title, message: i.message,
      details: (i.details || '').slice(0, 160), kind: i.kind, count: i.count,
      actions: (i.actions || (i.action ? [i.action] : [])).map((a) => a.label),
    }))
    return JSON.stringify({
      hasCannotConnect: at >= 0,
      hasLoadFailureTitle: failIdx >= 0,
      hasRetry: text.includes('重试'),
      context: at >= 0 ? text.slice(Math.max(0, at - 60), at + 160) : null,
      injectHits: window.__injectHits || [],
      wrappedFetch: String(window.fetch).slice(0, 120),
      items: snapshot(n.items.value),
      history: snapshot(n.history.value),
    })
  })()`,
  awaitPromise: true,
  returnByValue: true,
})

await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: injected.identifier })
await send('Page.reload')
await sleep(3000)

console.log(sample.result.value)
ws.close()
