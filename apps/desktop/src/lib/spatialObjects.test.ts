import { describe, expect, it } from 'vitest'
import { projectSpatialObjects } from './spatialObjects'
import type { MessageDto, OrchestrationSnapshotDto, SessionTopologyDto } from '@/api'

describe('spatial runtime projection', () => {
  const input = { sessionId: 's', messages: [] as MessageDto[], topology: null as SessionTopologyDto | null, orchestration: null, turns: {}, streamingReply: '' }
  it('keeps a new space empty until actual activity arrives', () => {
    const result = projectSpatialObjects(input)
    expect(result).toEqual([])
    expect(result.every(o => !o.status && !o.tool)).toBe(true)
  })
  it('puts a message in the single meeting queue without pre-creating execution controls', () => {
    const messages = [{ id: 'm', session_id: 's', role: 'user', content: 'hello', created_at: '' }] as MessageDto[]
    expect(projectSpatialObjects({ ...input, messages, hasGitChanges: true }).map(o => o.kind)).toEqual(['meeting'])
  })
  it('shows approvals only for the current session when a real request arrives', () => {
    const approval = { id: 'a', session_id: 's' } as import('@/api').ApprovalDto
    expect(projectSpatialObjects({ ...input, approvals: [approval] }).map(o => o.kind)).toEqual(['approval'])
    expect(projectSpatialObjects({ ...input, approvals: [{ ...approval, session_id: 'other' }] })).toEqual([])
  })
  it('isolates a late topology response and messages from another session', () => {
    const topology: SessionTopologyDto = { session_id: 'other', runs: [], leases: [], members: [], runs_truncated: false, leases_truncated: false, members_truncated: false, generated_at: '' }
    const messages = [{ id: 'm', session_id: 'other', role: 'user', content: 'Private', created_at: '' }] as MessageDto[]
    expect(projectSpatialObjects({ ...input, messages, topology }).some(o => o.kind === 'message')).toBe(false)
  })
  it('retains object identity across genuine task status updates', () => {
    const topology: SessionTopologyDto = { session_id: 's', runs: [{ run_id: 'r', status: 'running', tasks: [{ task_id: 'task', task_key: 'task', title: 'Real work', status: 'running', dependencies: [], write_scope: [] }], instances: [], tasks_truncated: false, instances_truncated: false }], leases: [], members: [], runs_truncated: false, leases_truncated: false, members_truncated: false, generated_at: '' }
    const before = projectSpatialObjects({ ...input, topology }).find(o => o.kind === 'task')!
    topology.runs[0].tasks[0].status = 'completed'
    const after = projectSpatialObjects({ ...input, topology }).find(o => o.kind === 'task')!
    expect(after.id).toBe(before.id)
    expect(after.status).toBe('completed')
  })
  it('shows the current summary when no reply is available', () => {
    const orchestration: OrchestrationSnapshotDto = { run: { id: 'r2', session_id: 's', status: 'running', summary: 'Second task', created_at: '', updated_at: '' }, nodes: [], lanes: [], assignments: [], step_results: [], context_packs: [], supervision_findings: [] }
    const result = projectSpatialObjects({ ...input, orchestration, streamingRunId: null, streamingReply: '' })
    expect(result.find(o => o.id === 'meeting:s')?.body).toBe('Second task')
    expect(result.some(o => o.kind === 'plan')).toBe(false)
  })
  it('keeps one meeting across parallel runs, with a deduplicated queue and dependency edges', () => {
    const messages = [{ id: 'm', session_id: 's', role: 'user', content: 'first', run_id: 'r' }] as MessageDto[]
    const topology = { session_id: 's', runs: [
      { run_id: 'r', status: 'running', tasks: [
        { task_id: 'a', task_key: 'a', title: 'build', status: 'running', dependencies: [] },
        { task_id: 'b', task_key: 'b', title: 'test', status: 'pending', dependencies: ['a'] },
      ] }, { run_id: 'r2', status: 'completed', tasks: [] },
    ] } as unknown as SessionTopologyDto
    const result = projectSpatialObjects({ ...input, messages, topology, queuedMessages: [{ id: 'm', content: 'first' }, { id: 'q', content: 'next' }] })
    expect(result.filter(o => o.kind === 'meeting')).toHaveLength(1)
    expect(result.some(o => o.kind === 'message')).toBe(false)
    expect(result.find(o => o.kind === 'meeting')?.queue).toEqual([
      { id: 'm', content: 'first', status: 'running' }, { id: 'q', content: 'next', status: 'queued' },
    ])
    expect(result.find(o => o.id === 'tasks:r')?.parentIds).toEqual(['meeting:s'])
    expect(result.find(o => o.id === 'task:r:b')?.parentIds).toEqual(['task:r:a'])
  })

})
