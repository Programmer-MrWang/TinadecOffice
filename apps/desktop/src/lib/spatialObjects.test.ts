import { describe, expect, it } from 'vitest'
import { projectSpatialObjects } from './spatialObjects'
import type { MessageDto, SessionTopologyDto } from '@/api'

describe('spatial runtime projection', () => {
  const input = { sessionId: 's', messages: [] as MessageDto[], topology: null as SessionTopologyDto | null, orchestration: null, turns: {}, streamingReply: '' }
  it('an empty session contains only empty real surfaces, no pretend progress or files', () => {
    const result = projectSpatialObjects(input)
    expect(result.map(o => o.kind)).toEqual(['meeting', 'plan', 'git', 'approval'])
    expect(result.every(o => !o.status && !o.tool)).toBe(true)
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
})
