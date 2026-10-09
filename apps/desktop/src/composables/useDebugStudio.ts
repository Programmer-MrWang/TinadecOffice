import { readonly, ref } from 'vue'

// One host-owned preference feeds navigation and direct-route admission.
const enabled = ref(false)
const loaded = ref(false)
const error = ref<unknown>(null)
let pending: Promise<boolean> | null = null
let listening = false
let revision = 0
let refreshRequested = false

export function loadDebugStudioPreference(): Promise<boolean> {
  if (pending) return pending
  if (!listening && window.tinadec?.onDebugStudioEnabledChanged) {
    window.tinadec.onDebugStudioEnabledChanged(() => {
      revision++
      refreshRequested = true
      void loadDebugStudioPreference()
    })
    listening = true
  }
  pending = (async () => {
    do {
      refreshRequested = false
      const readRevision = revision
      try {
        const config = await window.tinadec?.getAppConfig?.()
        if (readRevision === revision) {
          enabled.value = config?.debug_studio_enabled === true
          error.value = null
        }
      } catch (cause) {
        if (readRevision === revision) {
          enabled.value = false
          error.value = cause
        }
      } finally { loaded.value = true }
    } while (refreshRequested)
    return enabled.value
  })().finally(() => { pending = null })
  return pending
}

async function saveEnabled(value: boolean): Promise<void> {
  revision++
  const config = await window.tinadec.saveDebugStudioEnabled(value)
  revision++
  enabled.value = config.debug_studio_enabled === true
  loaded.value = true
  error.value = null
}

export function useDebugStudio() {
  return { enabled: readonly(enabled), loaded: readonly(loaded), error: readonly(error), load: loadDebugStudioPreference, saveEnabled }
}
