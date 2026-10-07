// One-shot CDP probe: reload the Electron renderer and record
// (a) aborted /api/v1 fetches, (b) when the "Cannot connect to backend" banner
// text is actually rendered (innerText), (c) whether its 重试 button exists.
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
const netFailures = []
const consoleEvents = []
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject, method } = pending.get(msg.id)
    pending.delete(msg.id)
    msg.error ? reject(new Error(`${method}: ${JSON.stringify(msg.error)}`)) : resolve(msg.result)
    return
  }
  if (msg.method === 'Network.loadingFailed') {
    netFailures.push({ errorText: msg.params.errorText, canceled: msg.params.canceled, ts: Date.now() })
  }
  if (msg.method === 'Network.requestWillBeSent') {
    const u = msg.params.request.url
    if (u.includes('/api/v1/')) netFailures.push({ sent: u.replace(/^http:\/\/127\.0\.0\.1:\d+/, ''), ts: Date.now() })
  }
  if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) {
    consoleEvents.push({
      type: msg.params.type,
      text: msg.params.args.map((a) => a.value ?? a.description ?? a.type).join(' ').slice(0, 500),
    })
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails
    consoleEvents.push({
      type: 'exception',
      text: `${d.exception?.description ?? d.text}`.slice(0, 500),
      stack: (d.stackTrace?.callFrames ?? []).slice(0, 6).map((f) => `${f.functionName || '<anon>'}@${f.url.split('/').pop()}:${f.lineNumber + 1}`),
    })
  }
}
const send = (method, params = {}) => {
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, method })
    ws.send(JSON.stringify({ id, method, params }))
  })
}

const probeSource = String.raw`(() => {
  const w = window
  w.__probe = { fetches: [], banner: [], statusBroadcasts: [], t0: performance.now() }
  const now = () => Math.round(performance.now() - w.__probe.t0)
  const bridge = w.tinadec
  if (bridge && typeof bridge.broadcastStatusNotification === 'function') {
    const origBroadcast = bridge.broadcastStatusNotification.bind(bridge)
    const wrapper = (payload) => {
      w.__probe.statusBroadcasts.push({ at: now(), payload })
      return origBroadcast(payload)
    }
    try { bridge.broadcastStatusNotification = wrapper } catch (e) { w.__probe.wrapError = String(e) }
    w.__probe.wrapApplied = bridge.broadcastStatusNotification === wrapper
    w.__probe.bridgeFrozen = Object.isFrozen(bridge)
  } else {
    w.__probe.statusBroadcasts.push({ at: now(), error: 'window.tinadec bridge missing' })
  }
  const origFetch = w.fetch.bind(w)
  w.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : (input && input.url) || ''
    const signal = (init && init.signal) || (typeof input === 'object' && input && input.signal) || null
    const rec = { url: url.replace(/^http:\/\/127\.0\.0\.1:\d+/, ''), at: now(), abortAt: null, status: null, err: null }
    if (rec.url.includes('/api/v1/sessions')) {
      rec.stack = new Error('site').stack.split('\n').slice(1, 8).map((l) => l.trim().replace(/https?:\/\/127\.0\.0\.1:\d+\//, ''))
    }
    if (url.includes('/api/v1/')) w.__probe.fetches.push(rec)
    if (signal) signal.addEventListener('abort', () => { rec.abortAt = now() }, { once: true })
    try {
      const res = await origFetch(input, init)
      rec.status = res.status
      return res
    } catch (e) {
      rec.err = (e && e.name) + ': ' + (e && e.message)
      throw e
    }
  }
  const check = () => {
    const text = document.body ? document.body.innerText : ''
    const html = document.body ? document.body.innerHTML : ''
    const idx = text.indexOf('Cannot connect to backend')
    const failIdx = text.indexOf('加载失败')
    const failInHtml = html.includes('加载失败')
    const islandNodes = document.querySelectorAll('[class*="island-"]').length
    const hasRetry = text.includes('重试')
    const last = w.__probe.banner[w.__probe.banner.length - 1]
    if (idx >= 0 || failIdx >= 0 || failInHtml) {
      const at = failIdx >= 0 ? failIdx : idx
      const ctx = at >= 0 ? text.slice(Math.max(0, at - 40), at + 160) : '(hidden in innerHTML only)'
      if (!last || last.gone !== null) {
        w.__probe.banner.push({ shownAt: now(), hasDetails: idx >= 0, failInHtml, islandNodes, hasRetry, ctx, gone: null })
      }
      else if (hasRetry && !last.retryButton) last.retryButton = true
    } else if (last && last.gone === null) {
      last.gone = now()
    }
  }
  const boot = () => {
    check()
    new MutationObserver(check).observe(document.documentElement, { subtree: true, childList: true, characterData: true })
    setInterval(check, 50)
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot)
  else boot()
})()`

await send('Page.enable')
await send('Network.enable')
await send('Runtime.enable')
const injected = await send('Page.addScriptToEvaluateOnNewDocument', { source: probeSource })
await send('Page.reload')
await sleep(12000)

const evalRes = await send('Runtime.evaluate', { expression: 'JSON.stringify(window.__probe)', returnByValue: true })
const probe = JSON.parse(evalRes.result.value ?? 'null')

// leave the renderer clean for the user
await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: injected.identifier })
await send('Page.reload')
await sleep(3000)

const sessions = (probe?.fetches ?? []).filter((f) => f.url.includes('/api/v1/sessions'))
const aborted = sessions.filter((f) => f.abortAt !== null)
console.log(JSON.stringify({
  sessionsRequests: sessions,
  abortedCount: aborted.length,
  bridgeWrap: { applied: probe?.wrapApplied ?? null, frozen: probe?.bridgeFrozen ?? null, error: probe?.wrapError ?? null },
  bannerEpisodes: probe?.banner ?? [],
  statusBroadcasts: probe?.statusBroadcasts ?? [],
  otherApiErrors: (probe?.fetches ?? []).filter((f) => f.err || (f.status && f.status >= 400)),
  consoleEvents,
  netFailures,
}, null, 2))
ws.close()
