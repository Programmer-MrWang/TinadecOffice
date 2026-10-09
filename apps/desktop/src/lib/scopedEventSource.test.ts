// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { ScopedEventSource } from './scopedEventSource'
import { setSelectedStorage } from './storageScope'
afterEach(() => vi.useRealTimers())
it('reconnects with the original storage id and replay cursor', async () => {
  vi.useFakeTimers()
  const calls: RequestInit[] = []
  const fakeFetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
    calls.push(init ?? {})
    return new Response('id: 9\nevent: tool.execution.completed\ndata: {"id":"result"}\n\n', { headers: { 'content-type': 'text/event-stream' } })
  }) as typeof fetch
  const source = new ScopedEventSource('http://gateway.local/api/v1/events', 'old-scope', fakeFetch)
  const received: string[] = []
  source.addEventListener('tool.execution.completed', event => received.push((event as MessageEvent).data))
  await vi.advanceTimersByTimeAsync(0)
  setSelectedStorage('new-scope')
  await vi.advanceTimersByTimeAsync(1000)
  source.close()
  expect(received.length).toBeGreaterThanOrEqual(1)
  expect(calls).toHaveLength(2)
  for (const call of calls) expect(new Headers(call.headers).get('x-tinadec-storage-id')).toBe('old-scope')
  expect(new Headers(calls[1]?.headers).get('last-event-id')).toBe('9')
})
it('dispatches CRLF frames whose delimiter is split across reads', async () => {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({ start(controller) {
    controller.enqueue(encoder.encode('id: 2\r\ndata: {"message":"hello"}\r'))
    controller.enqueue(encoder.encode('\n\r\n'))
  } })
  const source = new ScopedEventSource('http://gateway.local/api/v1/events', 'scope', (async () => new Response(stream)) as typeof fetch)
  const received: string[] = []
  source.onmessage = event => received.push(event.data)
  for (let i = 0; i < 8; i++) await Promise.resolve()
  source.close()
  expect(received).toEqual(['{"message":"hello"}'])
})
