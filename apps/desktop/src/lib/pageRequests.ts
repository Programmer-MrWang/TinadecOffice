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
import { ref, watch, type Ref } from 'vue'

export const pendingConversationId = ref<string | null>(null)
export const pendingSettingsSection = ref<string | null>(null)
export const pendingModelProviderId = ref<string | null>(null)
export const pendingProjectId = ref<string | null>(null)
export interface WorkspaceFileRequest { path: string; projectId?: string }
export const pendingWorkspaceFile = ref<WorkspaceFileRequest | null>(null)
export const pendingAgentId = ref<string | null>(null)
export const pendingModeId = ref<string | null>(null)
export const pendingPromptId = ref<string | null>(null)
export const pendingToolId = ref<string | null>(null)
export const pendingToolAgentId = ref<string | null>(null)

export function requestConversation(sessionId: string): void {
  pendingConversationId.value = sessionId
}

export function requestSettingsSection(section: string): void {
  pendingSettingsSection.value = section
}

export function requestModelProvider(providerId: string): void {
  pendingModelProviderId.value = providerId
}

export function requestProject(projectId: string): void { pendingProjectId.value = projectId }
export function requestWorkspaceFile(file: WorkspaceFileRequest): void { pendingWorkspaceFile.value = file }
export function requestAgent(agentId: string): void { pendingAgentId.value = agentId }
export function requestMode(modeId: string): void { pendingModeId.value = modeId }
export function requestPrompt(promptId: string): void { pendingPromptId.value = promptId }
export function requestTool(toolId: string): void { pendingToolId.value = toolId }
export function requestToolAgent(agentId: string): void { pendingToolAgentId.value = agentId }

/**
 * A page arms one consumer per request. The callback runs when a value lands
 * (including one already waiting, so navigation order never drops a request)
 * and the request clears the moment it is consumed.
 */
export function consumeRequest<T>(target: Ref<T | null>, apply: (value: T) => void): void {
  watch(
    target,
    (value) => {
      if (value === null) return
      target.value = null
      apply(value)
    },
    { immediate: true },
  )
}
