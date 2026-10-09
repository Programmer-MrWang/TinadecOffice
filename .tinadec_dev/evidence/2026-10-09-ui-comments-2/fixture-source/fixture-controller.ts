import { ref } from 'vue'
export const homeController = {
  queuedMessages: ref([]), activeRuns: ref([]), invokeError: ref(null),
  updateDraft: (_value: string) => {},
  steerQueuedMessage: () => {}, promoteQueuedMessage: () => {}, editQueuedMessage: () => {}, dismissQueuedMessage: () => {},
  sendMessage: async () => {}, createSession: async () => {}, ensureComposerSession: async () => 'fixture-only-session',
}
