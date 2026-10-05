// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { useHomeEntrance } from './useHomeEntrance'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}

describe('measured Home entrance', () => {
  let callbacks: Map<number, FrameRequestCallback>
  let nextId: number
  const wrappers: ReturnType<typeof mount>[] = []

  beforeEach(() => {
    callbacks = new Map()
    nextId = 0
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callbacks.set(++nextId, callback)
      return nextId
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id))
  })
  afterEach(() => {
    wrappers.forEach((wrapper) => wrapper.unmount())
    wrappers.length = 0
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  async function paint() {
    const queued = [...callbacks.values()]
    callbacks.clear()
    queued.forEach((callback) => callback(performance.now()))
    await flushPromises()
  }

  function harness(layout = Promise.resolve(), animations: () => unknown[] = () => []) {
    const ready = vi.fn()
    const wrapper = mount(defineComponent({
      setup() {
        const root = ref<HTMLElement | null>(null)
        const entry = useHomeEntrance(root, layout, ready)
        return () => h('div', {
          ref: root,
          'data-phase': entry.phase.value,
          'data-content': entry.contentReady.value,
        })
      },
    }))
    Object.defineProperty(wrapper.element, 'getAnimations', { value: animations })
    wrappers.push(wrapper)
    return { wrapper, ready }
  }

  it('holds preparation through disk loading and two measured paint opportunities', async () => {
    const layout = deferred()
    const { wrapper, ready } = harness(layout.promise)
    await flushPromises()
    expect(wrapper.attributes('data-content')).toBe('false')
    expect(callbacks.size).toBe(0)
    layout.resolve()
    await flushPromises()
    expect(wrapper.attributes('data-content')).toBe('true')
    await paint()
    expect(wrapper.attributes('data-phase')).toBe('preparing')
    expect(ready).not.toHaveBeenCalled()
    await paint()
    expect(ready).toHaveBeenCalledTimes(1)
    expect(wrapper.attributes('data-phase')).toBe('settled')
  })

  it('waits for the last actual column, even after the old 500ms budget', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const first = deferred(), last = deferred()
    const a = { animationName: 'home-up-enter', playState: 'running', finished: first.promise }
    const b = { animationName: 'home-up-enter', playState: 'running', finished: last.promise }
    const { wrapper } = harness(Promise.resolve(), () => [a, b])
    await flushPromises(); await paint(); await paint()
    first.resolve(); a.playState = 'finished'
    await flushPromises()
    vi.advanceTimersByTime(650)
    expect(wrapper.attributes('data-phase')).toBe('entering')
    last.resolve(); b.playState = 'finished'
    await flushPromises()
    expect(wrapper.attributes('data-phase')).toBe('settled')
  })

  it('keeps the columns prepared while a font swap is pending', async () => {
    const fonts = deferred()
    const original = Object.getOwnPropertyDescriptor(document, 'fonts')
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: fonts.promise } })
    try {
      const { wrapper, ready } = harness()
      await flushPromises()
      expect(wrapper.attributes('data-content')).toBe('true')
      expect(callbacks.size).toBe(0)
      expect(ready).not.toHaveBeenCalled()
      fonts.resolve()
      await flushPromises(); await paint(); await paint()
      expect(ready).toHaveBeenCalledOnce()
    } finally {
      if (original) Object.defineProperty(document, 'fonts', original)
      else Reflect.deleteProperty(document, 'fonts')
    }
  })

  it('waits for a replacement stack after the original animation is cancelled', async () => {
    const old = deferred(), replacement = deferred()
    let animations = [{ animationName: 'home-up-enter', playState: 'running', finished: old.promise }]
    const { wrapper } = harness(Promise.resolve(), () => animations)
    await flushPromises(); await paint(); await paint()
    animations = [{ animationName: 'home-up-enter', playState: 'running', finished: replacement.promise }]
    old.resolve()
    await flushPromises()
    expect(wrapper.attributes('data-phase')).toBe('entering')
    animations[0]!.playState = 'finished'; replacement.resolve()
    await flushPromises()
    expect(wrapper.attributes('data-phase')).toBe('settled')
  })

  it('settles without animation events for reduced motion, ignoring infinite card spinners', async () => {
    const spinner = { animationName: 'spin', playState: 'running', finished: new Promise(() => {}) }
    const { wrapper, ready } = harness(Promise.resolve(), () => [spinner])
    await flushPromises(); await paint(); await paint()
    expect(ready).toHaveBeenCalledTimes(1)
    expect(wrapper.attributes('data-phase')).toBe('settled')
  })

  it('does not signal readiness after unmount while loading a layout', async () => {
    const layout = deferred()
    const { wrapper, ready } = harness(layout.promise)
    wrapper.unmount(); layout.resolve()
    await flushPromises()
    expect(callbacks.size).toBe(0)
    expect(ready).not.toHaveBeenCalled()
  })

  it('cancels a pending preparation frame on unmount', async () => {
    const { wrapper, ready } = harness()
    await nextTick(); await flushPromises()
    expect(callbacks.size).toBe(1)
    wrapper.unmount()
    await flushPromises()
    expect(callbacks.size).toBe(0)
    expect(ready).not.toHaveBeenCalled()
  })
})
