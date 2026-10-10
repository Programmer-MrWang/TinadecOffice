// @vitest-environment happy-dom
import { effectScope, nextTick, ref } from 'vue'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import type { ProjectDto } from '@/api'
const execute = vi.hoisted(() => vi.fn())
vi.mock('@/api', () => ({ api: { executeCodeTool: execute } }))
const businessReady = ref(true)
vi.mock('./useConnection', () => ({ useConnection: () => ({ businessReady }) }))
import { useHomeGitStatus } from './useHomeGitStatus'

const project = (id: string): ProjectDto => ({ id, name: id, path: `C:/${id}`, storage_id: id, created_at: '' })
const success = (branch: string) => ({ status: 'completed', data: { success: true, branch, files: [], upstream: null } })
const log = { status: 'completed', data: { success: true, commits: [{ hash: '1234567890', short_hash: '1234567', subject: 'fix: status' }] } }
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await nextTick() }

describe('Home Git status read lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    businessReady.value = true
    execute.mockReset()
    execute.mockImplementation((_tool, args) => Promise.resolve(args.arguments.action === 'log' ? log : success('main')))
    vi.spyOn(document, 'hasFocus').mockReturnValue(true)
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  })
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

  it('reads just status, then stops polling when the home tab is hidden', async () => {
    const active = ref(true), scope = effectScope()
    const widget = scope.run(() => useHomeGitStatus(ref(project('a')), active))!
    await flush()
    expect(execute).toHaveBeenCalledWith('git_worktree_manager', { cwd: 'C:/a', arguments: { action: 'status' } }, expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(widget.summary.value?.branch).toBe('main')
    expect(widget.recentCommit.value?.subject).toBe('fix: status')
    await vi.advanceTimersByTimeAsync(20_000)
    expect(execute).toHaveBeenCalledTimes(3)
    active.value = false
    await nextTick()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(execute).toHaveBeenCalledTimes(3)
    active.value = true
    await nextTick()
    expect(execute).toHaveBeenCalledTimes(5)
    expect(widget.recentCommit.value?.subject).toBe('fix: status')
    scope.stop()
  })

  it('reads history separately about once a minute and keeps status after log failure', async () => {
    execute.mockImplementation((_tool, args) => args.arguments.action === 'log'
      ? Promise.reject(new Error('history service offline')) : Promise.resolve(success('main')))
    const scope = effectScope()
    const widget = scope.run(() => useHomeGitStatus(ref(project('a')), true))!
    await flush()
    expect(widget.summary.value?.branch).toBe('main')
    expect(widget.historyError.value).toBe(true)
    execute.mockImplementation((_tool, args) => Promise.resolve(args.arguments.action === 'log' ? log : success('main')))
    await vi.advanceTimersByTimeAsync(20_000)
    expect(widget.recentCommit.value?.subject).toBe('fix: status')
    expect(widget.historyError.value).toBe(false)
    await vi.advanceTimersByTimeAsync(40_000)
    expect(execute.mock.calls.filter(([, args]) => args.arguments.action === 'log')).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(20_000)
    expect(execute.mock.calls.filter(([, args]) => args.arguments.action === 'log')).toHaveLength(3)
    scope.stop()
  })

  it('distinguishes a failed Git status from a non-repository', async () => {
    const scope = effectScope()
    const widget = scope.run(() => useHomeGitStatus(ref(project('a')), true))!
    await flush()
    execute.mockImplementationOnce(() => Promise.resolve({ status: 'completed', data: { success: false, error_code: 'git_status_failed' } }))
    await widget.refresh()
    expect(widget.error.value).toBe('failed')
    expect(widget.summary.value?.branch).toBe('main')
    scope.stop()
  })

  it('recognizes a successful empty commit history without retrying every poll', async () => {
    execute.mockImplementation((_tool, args) => Promise.resolve(args.arguments.action === 'log'
      ? { status: 'completed', data: { success: true, commits: [] } } : success('main')))
    const scope = effectScope()
    const widget = scope.run(() => useHomeGitStatus(ref(project('a')), true))!
    await flush()
    expect(widget.historyLoaded.value).toBe(true)
    expect(widget.historyError.value).toBe(false)
    expect(widget.recentCommit.value).toBeNull()
    await vi.advanceTimersByTimeAsync(20_000)
    expect(execute.mock.calls.filter(([, args]) => args.arguments.action === 'log')).toHaveLength(1)
    scope.stop()
  })

  it('does not request Git in a browser preview or before a project is selected', async () => {
    businessReady.value = false
    const chosen = ref<ProjectDto | null>(null), scope = effectScope()
    const widget = scope.run(() => useHomeGitStatus(chosen, true))!
    chosen.value = project('a')
    await nextTick()
    expect(execute).not.toHaveBeenCalled()
    businessReady.value = true
    await flush()
    expect(widget.summary.value?.branch).toBe('main')
    scope.stop()
  })

  it('drops old workspace replies and aborts the old read on switch', async () => {
    let release!: (value: unknown) => void
    execute.mockImplementation((_tool, args) => args.arguments.action === 'log' ? Promise.resolve(log) : args.cwd === 'C:/a'
      ? new Promise(resolve => { release = resolve }) : Promise.resolve(success('new')))
    const chosen = ref(project('a')), scope = effectScope()
    const widget = scope.run(() => useHomeGitStatus(chosen, true))!
    const oldSignal: AbortSignal = execute.mock.calls[0][2].signal
    chosen.value = project('b')
    await flush()
    expect(widget.summary.value?.branch).toBe('new')
    release(success('old'))
    await flush()
    expect(oldSignal.aborted).toBe(true)
    expect(widget.summary.value?.branch).toBe('new')
    scope.stop()
  })

  it('preserves the last result as stale after failure and recovers on reconnect', async () => {
    const chosen = ref<ProjectDto | null>(project('a')), scope = effectScope()
    const widget = scope.run(() => useHomeGitStatus(chosen, true))!
    await flush()
    execute.mockImplementationOnce(() => Promise.reject(Object.assign(new Error('not a git worktree: C:/a'), { code: 'not_a_repo' })))
    await widget.refresh()
    expect(widget.error.value).toBe('not_a_repo')
    expect(widget.summary.value?.branch).toBe('main')
    businessReady.value = false
    await nextTick()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(execute).toHaveBeenCalledTimes(3)
    businessReady.value = true
    await flush()
    expect(widget.error.value).toBeNull()
    chosen.value = null
    await nextTick()
    expect(widget.summary.value).toBeNull()
    scope.stop()
  })

  it('does not overlap slow polls; focus/visibility transitions stop and resume reads', async () => {
    let resolve!: (value: unknown) => void
    execute.mockImplementation((_tool, args) => args.arguments.action === 'log' ? Promise.resolve(log) : new Promise(done => { resolve = done }))
    const scope = effectScope()
    const widget = scope.run(() => useHomeGitStatus(ref(project('a')), true))!
    await vi.advanceTimersByTimeAsync(60_000)
    expect(execute).toHaveBeenCalledTimes(2)
    window.dispatchEvent(new Event('blur'))
    await nextTick()
    expect(execute.mock.calls[0][2].signal.aborted).toBe(true)
    window.dispatchEvent(new Event('focus'))
    await nextTick()
    expect(execute).toHaveBeenCalledTimes(4)
    resolve(success('main'))
    await flush()
    expect(widget.summary.value?.branch).toBe('main')
    scope.stop()
  })
})
