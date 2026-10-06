import type { MessageDto, OrchestrationSnapshotDto, SessionTopologyDto } from '@/api'
import type { ToolCall, TurnActivity } from '@/composables/useAgentActivity'

export interface SpatialObject {
  id: string
  groupId: string
  kind: 'message' | 'meeting' | 'plan' | 'task' | 'tool' | 'git' | 'approval'
  title?: string
  status?: string
  body?: string
  rows?: { id: string; title: string; status: string; detail?: string }[]
  tool?: ToolCall
}

/** A read projection: statuses and ownership always come from Core records. */
export function projectSpatialObjects(input: {
  sessionId: string
  messages: MessageDto[]
  topology: SessionTopologyDto | null
  orchestration: OrchestrationSnapshotDto | null
  turns: Record<string, TurnActivity>
  streamingReply: string
}): SpatialObject[] {
  const { sessionId, messages, turns, streamingReply } = input
  const snapshot = input.orchestration?.run?.session_id === sessionId ? input.orchestration : null
  const topology = input.topology?.session_id === sessionId ? input.topology : null
  const runs = new Map<string, { status: string; tasks: NonNullable<SessionTopologyDto>['runs'][number]['tasks'] }>()
  for (const run of topology?.runs ?? []) runs.set(run.run_id, { status: run.status, tasks: run.tasks })
  if (snapshot?.run && !runs.has(snapshot.run.id)) runs.set(snapshot.run.id, { status: snapshot.run.status, tasks: snapshot.nodes.map(n => ({ task_id: n.id, task_key: n.id, title: n.title, status: n.status, dependencies: n.dependencies, write_scope: [] })) })
  const result: SpatialObject[] = []
  for (const m of messages.filter(m => m.session_id === sessionId && m.role === 'user')) {
    const runId = m.run_id ?? (snapshot?.run?.user_message_id === m.id ? snapshot.run.id : undefined)
    result.push({ id: `message:${m.id}`, groupId: runId ?? `message:${m.id}`, kind: 'message', body: m.content })
  }
  for (const [runId, run] of runs) {
    const reply = messages.filter(m => m.session_id === sessionId && m.role === 'assistant' && m.run_id === runId).map(m => m.content).join('\n\n')
    result.push({ id: `meeting:${runId}`, groupId: runId, kind: 'meeting', status: run.status,
      body: reply || (snapshot?.run?.id === runId ? streamingReply || snapshot.run.summary : '') })
    result.push({ id: `tasks:${runId}`, groupId: runId, kind: 'plan', rows: run.tasks.map(task => ({ id: task.task_id, title: task.title, status: task.status, detail: task.handle ?? task.agent_slug ?? undefined })) })
    for (const task of run.tasks) result.push({ id: `task:${runId}:${task.task_id}`, groupId: runId, kind: 'task', title: task.handle ?? task.agent_slug ?? task.title, status: task.status, body: task.title + (task.result_summary ? '\n\n' + task.result_summary : '') })
  }
  for (const [runId, turn] of Object.entries(turns)) {
    for (const plan of turn.thinkingSteps?.filter(s => s.type === 'plan') ?? []) result.push({ id: `plan:${runId}:${plan.id}`, groupId: runId, kind: 'plan', title: plan.title, body: plan.description })
    for (const tool of turn.toolCalls ?? []) result.push({ id: `tool:${runId}:${tool.id}`, groupId: runId, kind: 'tool', title: tool.toolName, status: tool.status, tool })
  }
  if (!runs.size) result.push({ id: `meeting:${sessionId}`, groupId: 'overview', kind: 'meeting' })
  if (!result.some(o => o.kind === 'plan')) result.push({ id: `plan:${sessionId}`, groupId: 'overview', kind: 'plan', rows: [] })
  result.push({ id: `git:${sessionId}`, groupId: 'overview', kind: 'git' }, { id: `approval:${sessionId}`, groupId: 'overview', kind: 'approval' })
  return result
}
