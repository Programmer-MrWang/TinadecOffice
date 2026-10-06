import { onScopeDispose, shallowRef, watch, type Ref } from 'vue'
import { api } from '@/api'
import type { GitPreviewData, GitLogCommit } from './useGitOperation'

export interface SpatialGitState { preview: GitPreviewData; commits: GitLogCommit[]; error: string; loading: boolean; loaded: boolean; cwd: string }
/** One read model shared by the canvas card and its temporary preview. */
export function useSpatialGit(cwd: Ref<string>) {
  const state = shallowRef<SpatialGitState>({ preview: {}, commits: [], error: '', loading: false, loaded: false, cwd: '' })
  let controller: AbortController | undefined
  let generation = 0
  async function refresh() {
    const path = cwd.value, read = ++generation
    controller?.abort()
    controller = new AbortController()
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(10000)])
    if (!path) { state.value = { preview: {}, commits: [], error: '', loading: false, loaded: false, cwd: '' }; return }
    state.value = { ...state.value, cwd: path, loading: true }
    try {
      const [preview, log] = await Promise.all([
        api.executeCodeTool('git_worktree_manager', { cwd: path, arguments: { action: 'diff_preview', max_files: 120, max_diff_bytes: 180000 } }, { signal }),
        api.executeCodeTool('git_worktree_manager', { cwd: path, arguments: { action: 'log', limit: 5 } }, { signal }),
      ])
      if (read !== generation) return
      if (preview.status !== 'completed' || preview.data.success === false) throw new Error(preview.summary)
      state.value = { preview: preview.data as GitPreviewData, commits: Array.isArray(log.data.commits) ? log.data.commits as GitLogCommit[] : [], error: log.status === 'completed' ? '' : log.summary, loading: false, loaded: true, cwd: path }
    } catch (error) {
      if (read === generation) state.value = { ...state.value, loading: false, error: error instanceof Error ? error.message : String(error) }
    }
  }
  watch(cwd, () => { state.value = { preview: {}, commits: [], error: '', loading: false, loaded: false, cwd: cwd.value }; void refresh() }, { immediate: true })
  onScopeDispose(() => { generation++; controller?.abort() })
  return { state, refresh }
}
