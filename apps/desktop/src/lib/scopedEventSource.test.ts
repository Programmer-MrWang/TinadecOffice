// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { ScopedEventSource } from './scopedEventSource'
import { setSelectedStorage } from './storageScope'
import { setHostAccessStatus } from './hostAccess'

const originalHost = window.tinadec
const ready = { state: 'ready' as const, managed: true }
afterEach(() => {
  vi.useRealTimers()
  Object.defineProperty(window, 'tinadec', { configurable: true, value: originalHost })
  setHostAccessStatus(ready)
})
it('reconnects with the original storage id and replay cursor', async () => {
  vi.useFakeTimers()
  const getHostStatus = vi.fn(async () => ready)
  Object.defineProperty(window, 'tinadec', { configurable: true, value: { getHostStatus } })
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
  expect(getHostStatus).toHaveBeenCalledTimes(2)
  for (const call of calls) expect(new Headers(call.headers).get('x-tinadec-storage-id')).toBe('old-scope')
  expect(new Headers(calls[1]?.headers).get('last-event-id')).toBe('9')
})
it('checks admission before the first fetch and refuses preview retries', async () => {
  vi.useFakeTimers()
  const getHostStatus = vi.fn(async () => ({ state: 'preview' as const, managed: false }))
  Object.defineProperty(window, 'tinadec', { configurable: true, value: { getHostStatus } })
  const fakeFetch = vi.fn<typeof fetch>()
  const source = new ScopedEventSource('http://gateway.local/api/v1/events', 'scope', fakeFetch)
  const errors = vi.fn(); source.onerror = errors
  await vi.advanceTimersByTimeAsync(0)
  await vi.advanceTimersByTimeAsync(1000)
  source.close()
  expect(getHostStatus).toHaveBeenCalledTimes(2)
  expect(fakeFetch).not.toHaveBeenCalled()
  expect(errors).toHaveBeenCalledTimes(2)
})
it('rechecks revoked host access on reconnect and preserves the cursor for recovery', async () => {
  vi.useFakeTimers()
  const getHostStatus = vi.fn().mockResolvedValueOnce(ready)
    .mockResolvedValueOnce({ state: 'unavailable', managed: true, error: { code: 'host_unavailable', message: 'Host disconnected' } })
    .mockResolvedValueOnce(ready)
  Object.defineProperty(window, 'tinadec', { configurable: true, value: { getHostStatus } })
  const fakeFetch = vi.fn<typeof fetch>().mockImplementation(async () => new Response('id: 9\ndata: {"id":"result"}\n\n'))
  const source = new ScopedEventSource('http://gateway.local/api/v1/events', 'original-scope', fakeFetch)
  await vi.advanceTimersByTimeAsync(0)
  expect(fakeFetch).toHaveBeenCalledOnce()
  await vi.advanceTimersByTimeAsync(1000)
  expect(fakeFetch).toHaveBeenCalledOnce()
  await vi.advanceTimersByTimeAsync(1000)
  source.close()
  expect(getHostStatus).toHaveBeenCalledTimes(3)
  expect(fakeFetch).toHaveBeenCalledTimes(2)
  const recovered = fakeFetch.mock.calls[1]?.[1]
  expect(new Headers(recovered?.headers).get('x-tinadec-storage-id')).toBe('original-scope')
  expect(new Headers(recovered?.headers).get('last-event-id')).toBe('9')
})
it('never fetches after closing while host admission is pending', async () => {
  vi.useFakeTimers()
  let finish!: (status: typeof ready) => void
  const getHostStatus = vi.fn(() => new Promise(resolve => { finish = resolve }))
  Object.defineProperty(window, 'tinadec', { configurable: true, value: { getHostStatus } })
  const fakeFetch = vi.fn<typeof fetch>()
  const source = new ScopedEventSource('http://gateway.local/api/v1/events', 'scope', fakeFetch)
  source.close(); finish(ready)
  await vi.advanceTimersByTimeAsync(2000)
  expect(getHostStatus).toHaveBeenCalledOnce()
  expect(fakeFetch).not.toHaveBeenCalled()
  expect(source.readyState).toBe(2)
})
it('cancels a late fetch body after closing without dispatching or reconnecting', async () => {
  vi.useFakeTimers()
  Object.defineProperty(window, 'tinadec', { configurable: true, value: { getHostStatus: async () => ready } })
  let finish!: (response: Response) => void
  const fakeFetch = vi.fn<typeof fetch>(() => new Promise(resolve => { finish = resolve }))
  const source = new ScopedEventSource('http://gateway.local/api/v1/events', 'scope', fakeFetch)
  const received = vi.fn(); source.onmessage = received
  await vi.advanceTimersByTimeAsync(0)
  const signal = fakeFetch.mock.calls[0]?.[1]?.signal
  source.close()
  const cancel = vi.fn()
  finish(new Response(new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode('data: {"late":true}\n\n')) },
    cancel,
  })))
  await vi.advanceTimersByTimeAsync(2000)
  expect(signal?.aborted).toBe(true)
  expect(cancel).toHaveBeenCalledOnce()
  expect(received).not.toHaveBeenCalled()
  expect(fakeFetch).toHaveBeenCalledOnce()
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
