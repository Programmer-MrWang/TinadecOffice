import { computed, onScopeDispose, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { api, type ProjectDto } from '@/api'
import { useConnection } from './useConnection'
import { summarizeGitStatus, type GitStatusSummary } from '@/lib/gitStatusSummary'

const REFRESH_MS = 20_000
const HISTORY_MS = 60_000

/** A read-only, visibility-scoped snapshot for the Home widget; never owns Git actions. */
export function useHomeGitStatus(project: MaybeRefOrGetter<ProjectDto | null | undefined>, active: MaybeRefOrGetter<boolean>) {
  const { businessReady } = useConnection()
  const visible = ref(typeof document === 'undefined' || document.visibilityState === 'visible')
  const focused = ref(typeof document === 'undefined' || document.hasFocus())
  const summary = ref<GitStatusSummary | null>(null)
  const updatedAt = ref<number | null>(null)
  const error = ref<'not_a_repo' | 'failed' | null>(null)
  const loading = ref(false)
  const busy = ref(false)
  const recentCommit = ref<{ shortHash: string; subject: string } | null>(null)
  const historyLoaded = ref(false)
  const historyError = ref(false)
  let lastHistoryRead: number | null = null
  const path = computed(() => toValue(project)?.path ?? '')
  const available = computed(() => !!path.value && toValue(active) && businessReady.value && visible.value && focused.value)
  let generation = 0
  let controller: AbortController | undefined
  let interval: ReturnType<typeof setInterval> | undefined
  let readPath = ''

  function cancel() {
    generation++
    controller?.abort()
    controller = undefined
    clearInterval(interval)
    interval = undefined
    loading.value = false
    busy.value = false
  }

  async function refresh(forceHistory = false) {
    if (!available.value || !path.value) return
    if (controller) return // Timer and manual refresh share one flight.
    const cwd = path.value
    const read = ++generation
    const abort = new AbortController()
    const signal = AbortSignal.any([abort.signal, AbortSignal.timeout(10_000)])
    controller = abort
    loading.value = true
    busy.value = true
    const readStatus = async () => {
      try {
        const result = await api.executeCodeTool('git_worktree_manager',
          { cwd, arguments: { action: 'status' } }, { signal })
        if (read !== generation) return
        const next = summarizeGitStatus(result)
        if (!next) {
          error.value = result.data?.error_code === 'not_a_repo' ? 'not_a_repo' : 'failed'
          return
        }
        summary.value = next
        updatedAt.value = Date.now()
        error.value = null
      } catch (failure) {
        if (read !== generation) return
        const code = failure && typeof failure === 'object' && 'code' in failure ? failure.code : null
        error.value = code === 'not_a_repo' || (failure instanceof Error && /^not a git worktree:/i.test(failure.message))
          ? 'not_a_repo' : 'failed'
      } finally {
        if (read === generation) loading.value = false
      }
    }
    const readHistory = async () => {
      try {
        const result = await api.executeCodeTool('git_worktree_manager',
          { cwd, arguments: { action: 'log', limit: 1 } }, { signal })
        if (read !== generation) return
        if (result.status !== 'completed' || result.data?.success !== true || !Array.isArray(result.data.commits)) throw new Error('Git log unavailable')
        const commit = result.data.commits[0] as Record<string, unknown> | undefined
        recentCommit.value = commit && typeof commit.subject === 'string' && typeof commit.hash === 'string'
          ? { subject: commit.subject, shortHash: typeof commit.short_hash === 'string' ? commit.short_hash : commit.hash.slice(0, 7) }
          : null
        historyLoaded.value = true
        historyError.value = false
        lastHistoryRead = Date.now()
      } catch {
        if (read === generation) historyError.value = true // Status can succeed even when log does not.
      }
    }
    const shouldReadHistory = forceHistory || lastHistoryRead === null || Date.now() - lastHistoryRead >= HISTORY_MS
    try {
      await Promise.all([readStatus(), ...(shouldReadHistory ? [readHistory()] : [])])
    } finally {
      if (read === generation) { controller = undefined; busy.value = false }
    }
  }

  watch([path, () => toValue(project)?.storage_id, available], ([cwd, storageId, ready]) => {
    cancel()
    const key = `${storageId ?? 'user'}\0${cwd}`
    if (key !== readPath) {
      readPath = key
      summary.value = null
      updatedAt.value = null
      error.value = null
      recentCommit.value = null
      historyLoaded.value = false
      historyError.value = false
      lastHistoryRead = null
    }
    if (ready) {
      void refresh(true)
      interval = setInterval(() => { void refresh() }, REFRESH_MS)
    }
  }, { immediate: true })

  if (typeof document !== 'undefined') {
    const onVisibility = () => { visible.value = document.visibilityState === 'visible' }
    const onFocus = () => { focused.value = true }
    const onBlur = () => { focused.value = false }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onFocus)
    window.addEventListener('blur', onBlur)
    onScopeDispose(() => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('blur', onBlur)
    })
  }
  onScopeDispose(cancel)
  return { summary, updatedAt, error, loading, busy, recentCommit, historyLoaded, historyError, businessReady, refresh }
}
