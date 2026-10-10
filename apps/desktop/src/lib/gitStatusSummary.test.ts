import { describe, expect, it } from 'vitest'
import type { CodeToolExecuteResultDto } from '@/api'
import { summarizeGitStatus } from './gitStatusSummary'

function status(data: Record<string, unknown>, state = 'completed'): CodeToolExecuteResultDto {
  return { tool_id: 'git_worktree_manager', status: state, summary: '', evidence: [], requires_approval: false, data }
}

describe('Home Git status projection', () => {
  it('counts file paths once and staged / unstaged sides independently', () => {
    const result = summarizeGitStatus(status({ success: true, branch: 'main', upstream: 'origin/main', ahead: 2, behind: 1, files: [
      { path: 'both.ts', staged_status: 'modified', unstaged_status: 'modified' },
      { path: 'new.ts', status: 'untracked', is_untracked: true },
      { path: 'conflict.ts', status: 'conflicted', is_conflicted: true },
    ] }))!
    expect(result).toMatchObject({ total: 3, staged: 1, unstaged: 2, untracked: 1, conflicts: 1, conflictPath: 'conflict.ts', ahead: 2, behind: 1 })
    expect(result.files.map(file => file.path)).toEqual(['conflict.ts', 'both.ts', 'new.ts'])
  })

  it('does not turn failed or incomplete tool responses into a clean repository', () => {
    expect(summarizeGitStatus(status({ success: false, files: [] }))).toBeNull()
    expect(summarizeGitStatus(status({ files: [] }))).toBeNull()
    expect(summarizeGitStatus(status({ success: true, files: [] }, 'awaiting_approval'))).toBeNull()
    expect(summarizeGitStatus(status({ success: true, branch: 'main' }))).toBeNull()
  })

  it('preserves detached/no upstream as distinct from up-to-date tracking', () => {
    expect(summarizeGitStatus(status({ success: true, detached_head: true, files: [] }))).toMatchObject({ detached: true, upstream: null, total: 0 })
  })
})

