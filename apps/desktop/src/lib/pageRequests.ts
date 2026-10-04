/**
 * One-shot requests a foreign surface can leave for a page — "open this
 * conversation", "open this settings section" — without importing the page or
 * owning its DOM.
 *
 * The request is a plain value in a module-level ref: the palette writes it
 * before it navigates, the page watches its own key and consumes (writes null
 * back) once applied. Route query params were the alternative, but they turn a
 * private hand-off into addressable history — a reloaded settings URL would
 * jump sections forever. A ref is consumed once by definition.
 */
import { ref, watch } from 'vue'

export const pendingConversationId = ref<string | null>(null)
export const pendingSettingsSection = ref<string | null>(null)
export const pendingModelProviderId = ref<string | null>(null)

export function requestConversation(sessionId: string): void {
  pendingConversationId.value = sessionId
}

export function requestSettingsSection(section: string): void {
  pendingSettingsSection.value = section
}

export function requestModelProvider(providerId: string): void {
  pendingModelProviderId.value = providerId
}

/**
 * A page arms one consumer per request. The callback runs when a value lands
 * (including one already waiting, so navigation order never drops a request)
 * and the request clears the moment it is consumed.
 */
export function consumeRequest(target: typeof pendingSettingsSection, apply: (value: string) => void): void {
  watch(
    target,
    (value) => {
      if (!value) return
      target.value = null
      apply(value)
    },
    { immediate: true },
  )
}
