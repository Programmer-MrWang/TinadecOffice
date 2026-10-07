// Clicks the live 重试 action on the home-load notification and records:
// how many /api/v1/sessions requests it fires, whether they succeed, and
// whether the notification item is cleared afterwards.
const CDP = 'http://127.0.0.1:9222'
const targets = await (await fetch(`${CDP}/json/list`)).json()
const page = targets.find((t) => t.type === 'page' && t.url.startsWith('http://127.0.0.1:5173'))
if (!page) throw new Error('page target not found')

const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = () => reject(new Error('ws failed')) })
let nextId = 1
const pending = new Map()
const sessionsCalls = []
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject, method } = pending.get(msg.id)
    pending.delete(msg.id)
    msg.error ? reject(new Error(`${method}: ${JSON.stringify(msg.error)}`)) : resolve(msg.result)
    return
  }
  if (msg.method === 'Network.requestWillBeSent' && msg.params.request.url.includes('/api/v1/sessions')) {
    sessionsCalls.push({ sent: Date.now(), method: msg.params.request.method })
  }
  if (msg.method === 'Network.responseReceived' && msg.params.response.url.includes('/api/v1/sessions')) {
    const last = sessionsCalls[sessionsCalls.length - 1]
    if (last) last.status = msg.params.response.status
  }
}
const send = (method, params = {}) => {
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, method })
    ws.send(JSON.stringify({ id, method, params }))
  })
}

const expression = String.raw`(async () => {
  const out = {}
  const n = (await import(new URL('/src/composables/useNotifications.ts', location.origin).href)).useNotifications()
  out.before = n.items.value.map((i) => ({ key: i.key, title: i.title, hasAction: !!i.action, actionLabel: i.action?.label }))
  const item = n.items.value.find((i) => i.key === 'home-load')
  if (!item) return JSON.stringify({ ...out, error: 'home-load item missing' })
  await n.runAction(item.id)
  await new Promise((r) => setTimeout(r, 1500))
  out.after = n.items.value.map((i) => ({ key: i.key, title: i.title }))
  out.historyTop = n.history.value.slice(0, 3).map((h) => ({ key: h.key, title: h.title, message: h.message }))
  return JSON.stringify(out)
})()`

await send('Network.enable')
const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
if (res.exceptionDetails) console.log(JSON.stringify(res.exceptionDetails, null, 2))
else console.log(res.result.value)
console.log(JSON.stringify({ sessionsCalls }, null, 2))
ws.close()
