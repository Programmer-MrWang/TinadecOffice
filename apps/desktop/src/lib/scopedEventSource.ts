import { assertHostAccess } from './hostAccess'
/** Fetch-based SSE keeps the captured storage header on reconnects. */
export class ScopedEventSource {
  private readonly events = new EventTarget()
  readonly url: string
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  readyState = 0
  private abort: AbortController | null = null
  private closed = false
  private cursor = ''
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  constructor(url: string, private readonly storageId: string, private readonly fetchImpl: typeof fetch = fetch) {
    this.url = url
    void this.connect()
  }
  close() { this.closed = true; this.readyState = 2; this.abort?.abort(); if (this.retryTimer) clearTimeout(this.retryTimer) }
  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) { this.events.addEventListener(type, listener, options) }
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions) { this.events.removeEventListener(type, listener, options) }
  dispatchEvent(event: Event) { return this.events.dispatchEvent(event) }
  private dispatchBlock(block: string) {
    let type = 'message'; const data: string[] = []
    for (const line of block.replace(/\r/g, '').split('\n')) {
      if (!line || line.startsWith(':')) continue
      const separator = line.indexOf(':'); const key = separator < 0 ? line : line.slice(0, separator)
      const value = separator < 0 ? '' : line.slice(separator + 1).replace(/^ /, '')
      if (key === 'event') type = value || 'message'
      else if (key === 'id') this.cursor = value
      else if (key === 'data') data.push(value)
    }
    if (!data.length) return
    const event = new MessageEvent(type, { data: data.join('\n'), lastEventId: this.cursor })
    if (type === 'message') this.onmessage?.(event)
    this.dispatchEvent(event)
  }
  private async connect() {
    if (this.closed) return
    const request = new AbortController()
    this.abort = request
    try {
      await assertHostAccess(this.url, request.signal)
      if (this.closed || request.signal.aborted) return
      const response = await this.fetchImpl(this.url, { signal: request.signal, headers: {
        accept: 'text/event-stream', 'x-tinadec-storage-id': this.storageId,
        ...(this.cursor ? { 'last-event-id': this.cursor } : {}),
      } })
      if (this.closed || request.signal.aborted) { await response.body?.cancel(); return }
      if (!response.ok || !response.body) throw new Error(`Event stream returned ${response.status}`)
      this.readyState = 1
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ''
      while (!this.closed && !request.signal.aborted) {
        const { done, value } = await reader.read()
        if (this.closed || request.signal.aborted) break
        buffer = (buffer + decoder.decode(value, { stream: !done })).replace(/\r\n/g, '\n')
        let boundary: number
        while ((boundary = buffer.indexOf('\n\n')) >= 0) { this.dispatchBlock(buffer.slice(0, boundary)); buffer = buffer.slice(boundary + 2) }
        if (done) { if (buffer.trim()) this.dispatchBlock(buffer); break }
      }
    } catch { if (!this.closed) this.onerror?.(new Event('error')) }
    if (!this.closed) { this.readyState = 0; this.retryTimer = setTimeout(() => void this.connect(), 1000) }
  }
}
