/**
 * Vitest global setup.
 *
 * happy-dom 20 ships `sessionStorage` but no `localStorage`, so tests that touch
 * persisted UI state (appearance, panel styles, Settings page) crashed on
 * `localStorage.clear()` before asserting anything. Several files worked around
 * this locally with `vi.stubGlobal`; providing the shim once here keeps the
 * environment honest for every file and lets those workarounds stay as they are.
 *
 * A plain in-memory `Storage` is enough: no test asserts cross-run persistence,
 * and `storage` events are not part of the desktop's storage model.
 */
function createMemoryStorage(): Storage {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => void store.delete(key),
    setItem: (key: string, value: string) => void store.set(key, String(value)),
  } as Storage
}

const target = typeof window === 'undefined' ? globalThis : (window as unknown as Record<string, unknown>)
if (!('localStorage' in target) || target.localStorage == null) {
  Object.defineProperty(target, 'localStorage', {
    configurable: true,
    value: createMemoryStorage(),
  })
}
