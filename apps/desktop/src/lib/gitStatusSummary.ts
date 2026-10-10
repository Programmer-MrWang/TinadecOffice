import type { CodeToolExecuteResultDto } from '@/api'
import { isStagedFile, isUnstagedFile, type GitStatusSides } from './gitStatusSides'

export interface GitFilePreview { path: string; mark: string; kind: 'conflict' | 'staged' | 'untracked' | 'changed' }

export interface GitStatusSummary {
  branch: string
  upstream: string | null
  detached: boolean
  ahead: number
  behind: number
  total: number
  staged: number
  unstaged: number
  untracked: number
  conflicts: number
  conflictPath: string | null
  gitRoot: string | null
  files: GitFilePreview[]
}

/** The status facade is read-only; a completed transport is not necessarily a successful Git command. */
export function summarizeGitStatus(result: CodeToolExecuteResultDto): GitStatusSummary | null {
  const data = result.data
  if (result.status !== 'completed' || data?.success !== true || !Array.isArray(data.files)) return null
  const files = data.files as Array<GitStatusSides & { path?: string; is_conflicted?: boolean }>
  const conflicts = files.filter(file => file?.is_conflicted === true)
  const previews: GitFilePreview[] = files.filter(file => typeof file?.path === 'string').map(file => {
    if (file.is_conflicted) return { path: file.path!, mark: '!', kind: 'conflict' }
    if (file.is_untracked || file.status === 'untracked' || file.status === '?') return { path: file.path!, mark: '?', kind: 'untracked' }
    const status = file.status?.toLowerCase() ?? ''
    const mark = status.includes('deleted') || status === 'd' ? 'D'
      : status.includes('renamed') || status === 'r' ? 'R'
      : status.includes('added') || status === 'a' ? 'A' : 'M'
    return { path: file.path!, mark, kind: isStagedFile(file) ? 'staged' : 'changed' }
  })
  const priority = { conflict: 0, staged: 1, changed: 2, untracked: 3 }
  previews.sort((a, b) => priority[a.kind] - priority[b.kind])
  return {
    branch: typeof data.branch === 'string' ? data.branch : '-',
    upstream: typeof data.upstream === 'string' && data.upstream ? data.upstream : null,
    detached: data.detached_head === true,
    ahead: typeof data.ahead === 'number' ? data.ahead : 0,
    behind: typeof data.behind === 'number' ? data.behind : 0,
    total: files.length, // A file can be staged AND modified again; count it only once here.
    staged: files.filter(file => file && isStagedFile(file)).length,
    unstaged: files.filter(file => file && !file.is_untracked && file.status !== 'untracked' && file.status !== '?' && isUnstagedFile(file)).length,
    untracked: files.filter(file => file && (file.is_untracked || file.status === 'untracked' || file.status === '?')).length,
    conflicts: conflicts.length,
    conflictPath: typeof conflicts[0]?.path === 'string' ? conflicts[0].path : null,
    gitRoot: typeof data.git_root === 'string' ? data.git_root : null,
    files: previews,
  }
}
