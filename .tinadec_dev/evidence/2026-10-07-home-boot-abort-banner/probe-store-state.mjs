// Reads the live notification store through the Vite dev module graph and
// verifies module identity by raising a probe notification and looking for it
// in the island DOM, then dismissing it again.
const CDP = 'http://127.0.0.1:9222'
const targets = await (await fetch(`${CDP}/json/list`)).json()
const page = targets.find((t) => t.type === 'page' && t.url.startsWith('http://127.0.0.1:5173'))
if (!page) throw new Error('page target not found')

const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = () => reject(new Error('ws failed')) })
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

const expression = String.raw`(async () => {
  const out = {}
  out.href = location.href
  out.title = document.title
  out.appChildren = Array.from(document.querySelectorAll('#app > *')).map((el) => el.tagName + '.' + el.className).slice(0, 8)
  out.bodyChildren = Array.from(document.body.children).map((el) => el.tagName + '.' + el.className).slice(0, 8)
  out.outerHtmlHead = document.documentElement.outerHTML.slice(0, 300)
  const main = document.querySelector('.main-content')
  out.mainContentText = (main?.innerText ?? '').replace(/\s+/g, ' ').slice(0, 200)
  out.mainContentChildren = Array.from(main?.children ?? []).map((el) => el.tagName + '.' + el.className).slice(0, 10)
  const splash = document.querySelector('.app-splash')
  out.splashClasses = splash ? splash.className : null
  out.islandNodes = document.querySelectorAll('[class*="island-"]').length
  out.islandish = Array.from(document.querySelectorAll('[class*="island"], [class*="Island"], [class*="notification"]'))
    .slice(0, 12).map((el) => el.tagName + '.' + el.className)
  out.htmlHasFailText = document.body.innerHTML.includes('加载失败')
  out.bodyHasFailText = document.body.innerText.includes('加载失败')
  out.bodyHasCannotConnect = document.body.innerText.includes('Cannot connect to backend')
  const url = new URL('/src/composables/useNotifications.ts', location.origin).href
  const mod = await import(url)
  const n = mod.useNotifications()
  const snapshot = (list) => list.map((i) => ({
    key: i.key, level: i.level, title: i.title, message: i.message,
    details: (i.details || '').slice(0, 120), kind: i.kind, count: i.count,
  }))
  out.items = snapshot(n.items.value)
  out.history = snapshot(n.history.value)
  const c = (await import(new URL('/src/controllers/HomeController.ts', location.origin).href)).homeController
  out.controller = {
    projects: c.projects.value.length,
    sessions: c.sessions.value.length,
    selectedProjectId: c.selectedProjectId.value,
    selectedSessionId: c.selectedSessionId.value,
    busy: c.busy.value,
  }
  // identity check: raise a transient notification through the imported module
  const marker = 'probe-identity-' + Date.now()
  const id = n.notify.info({ message: marker })
  await new Promise((r) => setTimeout(r, 250))
  out.markerVisibleInDom = document.body.innerText.includes(marker)
  out.markerInStore = n.items.value.some((i) => i.message === marker)
  n.dismiss(id)
  return JSON.stringify(out)
})()`

const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
if (res.exceptionDetails) console.log(JSON.stringify(res.exceptionDetails, null, 2))
else console.log(res.result.value)
ws.close()
