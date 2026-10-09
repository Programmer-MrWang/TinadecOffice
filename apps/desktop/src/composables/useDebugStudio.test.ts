// @vitest-environment happy-dom
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (cause: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function appConfig(debug?: unknown) {
  return { gateway_url: 'http://127.0.0.1:48700', source: 'default' as const, managed: false,
    ...(debug === undefined ? {} : { debug_studio_enabled: debug }) }
}

let preference: typeof import('./useDebugStudio')
let changed: (() => void) | undefined
let host: {
  getAppConfig: ReturnType<typeof vi.fn>
  saveDebugStudioEnabled: ReturnType<typeof vi.fn>
  onDebugStudioEnabledChanged: ReturnType<typeof vi.fn>
}

beforeEach(async () => {
  vi.resetModules()
  changed = undefined
  host = {
    getAppConfig: vi.fn().mockResolvedValue(appConfig()),
    saveDebugStudioEnabled: vi.fn().mockImplementation(async (value: boolean) => ({ debug_studio_enabled: value })),
    onDebugStudioEnabledChanged: vi.fn((callback: () => void) => { changed = callback; return vi.fn() }),
  }
  Object.defineProperty(window, 'tinadec', { configurable: true, value: host })
  preference = await import('./useDebugStudio')
})

afterEach(() => {
  Reflect.deleteProperty(window, 'tinadec')
  vi.restoreAllMocks()
})

describe('host-owned Debug Studio preference', () => {
  it('starts hidden and merges simultaneous reads across consumers', async () => {
    const read = deferred<ReturnType<typeof appConfig>>()
    host.getAppConfig.mockReturnValue(read.promise)
    const a = preference.useDebugStudio(), b = preference.useDebugStudio()
    expect(a.enabled.value).toBe(false)
    expect(a.loaded.value).toBe(false)
    const first = a.load(), second = b.load()
    expect(first).toBe(second)
    expect(host.getAppConfig).toHaveBeenCalledOnce()
    expect(host.onDebugStudioEnabledChanged).toHaveBeenCalledOnce()
    read.resolve(appConfig(true))
    await expect(first).resolves.toBe(true)
    expect(a.loaded.value).toBe(true)
    expect(b.enabled.value).toBe(true)
    expect(a.error.value).toBeNull()
  })

  it.each([undefined, false, 'true', 1])('does not enable for a missing or non-true host value: %s', async value => {
    host.getAppConfig.mockResolvedValue(appConfig(value))
    await expect(preference.loadDebugStudioPreference()).resolves.toBe(false)
    expect(preference.useDebugStudio().enabled.value).toBe(false)
    expect(preference.useDebugStudio().loaded.value).toBe(true)
  })

  it('stays hidden when no Electron host is available', async () => {
    Reflect.deleteProperty(window, 'tinadec')
    await expect(preference.loadDebugStudioPreference()).resolves.toBe(false)
    expect(preference.useDebugStudio().loaded.value).toBe(true)
  })

  it('fails closed after a read error and recovers from a later successful read', async () => {
    host.getAppConfig.mockResolvedValueOnce(appConfig(true))
    const state = preference.useDebugStudio()
    await state.load()
    expect(state.enabled.value).toBe(true)
    const failure = new Error('host configuration could not be read')
    host.getAppConfig.mockRejectedValueOnce(failure)
    await expect(state.load()).resolves.toBe(false)
    expect(state.enabled.value).toBe(false)
    expect(state.loaded.value).toBe(true)
    expect(state.error.value).toBe(failure)
    host.getAppConfig.mockResolvedValueOnce(appConfig(true))
    await state.load()
    expect(state.enabled.value).toBe(true)
    expect(state.error.value).toBeNull()
    expect(host.onDebugStudioEnabledChanged).toHaveBeenCalledOnce()
  })

  it('commits only the host save result and keeps the last state on save failure', async () => {
    const state = preference.useDebugStudio()
    await state.load()
    const save = deferred<{ debug_studio_enabled: boolean }>()
    host.saveDebugStudioEnabled.mockReturnValueOnce(save.promise)
    const saving = state.saveEnabled(true)
    expect(host.saveDebugStudioEnabled).toHaveBeenCalledWith(true)
    expect(state.enabled.value).toBe(false)
    save.resolve({ debug_studio_enabled: true })
    await saving
    expect(state.enabled.value).toBe(true)
    host.saveDebugStudioEnabled.mockRejectedValueOnce(new Error('disk full'))
    await expect(state.saveEnabled(false)).rejects.toThrow('disk full')
    expect(state.enabled.value).toBe(true)
    expect(state.loaded.value).toBe(true)
  })

  it('re-reads the host on a cross-window change rather than toggling a local guess', async () => {
    const state = preference.useDebugStudio()
    await state.load()
    host.getAppConfig.mockResolvedValueOnce(appConfig(true))
    changed!()
    await flushPromises()
    expect(host.getAppConfig).toHaveBeenCalledTimes(2)
    expect(state.enabled.value).toBe(true)
    host.getAppConfig.mockRejectedValueOnce(new Error('configuration became unavailable'))
    changed!()
    await flushPromises()
    expect(state.enabled.value).toBe(false)
    expect(state.error.value).toBeInstanceOf(Error)
  })

  it('does not lose a cross-window change received during an older pending read', async () => {
    const oldRead = deferred<ReturnType<typeof appConfig>>()
    host.getAppConfig.mockReturnValueOnce(oldRead.promise).mockResolvedValueOnce(appConfig(true))
    const state = preference.useDebugStudio()
    const loading = state.load()
    changed!()
    oldRead.resolve(appConfig(false))
    await loading
    await flushPromises()
    expect(host.getAppConfig).toHaveBeenCalledTimes(2)
    expect(state.enabled.value).toBe(true)
  })

  it('does not overwrite a completed save with an older read result', async () => {
    const oldRead = deferred<ReturnType<typeof appConfig>>()
    host.getAppConfig.mockReturnValueOnce(oldRead.promise)
    const state = preference.useDebugStudio()
    const loading = state.load()
    await state.saveEnabled(true)
    expect(state.enabled.value).toBe(true)
    oldRead.resolve(appConfig(false))
    await loading
    expect(state.enabled.value).toBe(true)
  })

  it('reads the latest host state after a queued change and a completed save', async () => {
    const oldRead = deferred<ReturnType<typeof appConfig>>()
    const save = deferred<{ debug_studio_enabled: boolean }>()
    host.getAppConfig.mockReturnValueOnce(oldRead.promise).mockResolvedValueOnce(appConfig(true))
    host.saveDebugStudioEnabled.mockReturnValueOnce(save.promise)
    const state = preference.useDebugStudio()
    const loading = state.load()
    const saving = state.saveEnabled(false)
    changed!()
    save.resolve({ debug_studio_enabled: false })
    await saving
    expect(state.enabled.value).toBe(false)
    oldRead.resolve(appConfig(false))
    await loading
    expect(host.getAppConfig).toHaveBeenCalledTimes(2)
    expect(state.enabled.value).toBe(true)
  })
})

// Route component modules stay light; the real router, beforeEach and enabled
// watcher execute against the real preference module and the mocked Electron host.
vi.mock('../pages/HomePage.vue', () => ({ default: { name: 'HomeTestPage', template: '<div />' } }))
vi.mock('../pages/SpatialPage.vue', () => ({ default: { name: 'SpatialTestPage', template: '<div />' } }))
vi.mock('../pages/DebugStudioPage.vue', () => ({ default: { name: 'DebugTestPage', template: '<div />' } }))

describe('Debug Studio route admission', () => {
  let router: typeof import('../router')['default'] | undefined

  beforeEach(() => { window.history.replaceState(null, '', '/') })
  afterEach(() => {
    router?.options.history.destroy()
    router = undefined
  })

  it('redirects direct navigation to home while the host preference is disabled', async () => {
    host.getAppConfig.mockResolvedValue(appConfig(false))
    router = (await import('../router')).default
    await router.push('/debug-studio')
    expect(router.currentRoute.value.name).toBe('home')
    expect(router.currentRoute.value.fullPath).toBe('/')
    expect(host.getAppConfig).toHaveBeenCalledOnce()
  })

  it('refuses direct navigation when the host config read fails', async () => {
    host.getAppConfig.mockRejectedValue(new Error('unreadable host configuration'))
    router = (await import('../router')).default
    await router.push('/debug-studio')
    expect(router.currentRoute.value.name).toBe('home')
    expect(preference.useDebugStudio().enabled.value).toBe(false)
  })

  it('admits an enabled route then leaves it after the host disables Debug Studio', async () => {
    host.getAppConfig.mockResolvedValueOnce(appConfig(true)).mockResolvedValueOnce(appConfig(false))
    router = (await import('../router')).default
    await router.push('/debug-studio')
    expect(router.currentRoute.value.name).toBe('debug-studio')
    changed!()
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('home')
    expect(host.getAppConfig).toHaveBeenCalledTimes(2)
  })

  it('keeps the legacy workbench URL as the space redirect without consulting Debug settings', async () => {
    router = (await import('../router')).default
    await router.push('/workbench')
    expect(router.currentRoute.value.name).toBe('space')
    expect(router.currentRoute.value.fullPath).toBe('/space')
    expect(host.getAppConfig).not.toHaveBeenCalled()
  })
})
