import type { ApprovalDto, MessageDto, OrchestrationSnapshotDto, SessionTopologyDto } from '@/api'
import type { ToolCall, TurnActivity } from '@/composables/useAgentActivity'

export interface SpatialObject {
  id: string
  groupId: string
  kind: 'message' | 'meeting' | 'plan' | 'task' | 'tool' | 'git' | 'approval'
  parentIds?: string[]
  queue?: { id: string; content: string; status: string }[]
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
  queuedMessages?: { id: string; content: string }[]
  approvals?: ApprovalDto[]
  hasGitChanges?: boolean
  streamingRunId?: string | null
}): SpatialObject[] {
  const { sessionId, messages, turns, streamingReply } = input
  const snapshot = input.orchestration?.run?.session_id === sessionId ? input.orchestration : null
  const topology = input.topology?.session_id === sessionId ? input.topology : null
  const runs = new Map<string, { status: string; tasks: NonNullable<SessionTopologyDto>['runs'][number]['tasks'] }>()
  for (const run of topology?.runs ?? []) runs.set(run.run_id, { status: run.status, tasks: run.tasks })
  if (snapshot?.run && !runs.has(snapshot.run.id)) runs.set(snapshot.run.id, { status: snapshot.run.status, tasks: snapshot.nodes.map(n => ({ task_id: n.id, task_key: n.id, title: n.title, status: n.status, dependencies: n.dependencies, write_scope: [] })) })
  const result: SpatialObject[] = []
  const meetingId = `meeting:${sessionId}`
  const userMessages = messages.filter(m => m.session_id === sessionId && m.role === 'user')
  const queue = userMessages.map(m => {
    const runId = m.run_id ?? (snapshot?.run?.user_message_id === m.id ? snapshot.run.id : undefined)
    const answered = messages.some(a => a.session_id === sessionId && a.role === 'assistant' && runId && a.run_id === runId)
    return { id: m.id, content: m.content, status: (runId && runs.get(runId)?.status) || (answered ? 'completed' : 'queued') }
  })
  for (const m of input.queuedMessages ?? []) if (!queue.some(q => q.id === m.id)) queue.push({ ...m, status: 'queued' })
  const replies = messages.filter(m => m.session_id === sessionId && m.role === 'assistant')
  const latestReply = replies.at(-1)?.content
  const currentRun = input.streamingRunId ? runs.get(input.streamingRunId) : snapshot?.run
  if (queue.length || runs.size || Object.keys(turns).length || replies.length) result.push({
    id: meetingId, groupId: sessionId, kind: 'meeting', queue,
    status: currentRun?.status,
    body: (input.streamingRunId && streamingReply) || latestReply || snapshot?.run?.summary || '',
  })
  for (const [runId, run] of runs) {
    if (run.tasks.length) result.push({ id: `tasks:${runId}`, groupId: runId, kind: 'plan', parentIds: [meetingId], rows: run.tasks.map(task => ({ id: task.task_id, title: task.title, status: task.status, detail: task.handle ?? task.agent_slug ?? undefined })) })
    for (const task of run.tasks) result.push({ id: `task:${runId}:${task.task_id}`, groupId: runId, kind: 'task', parentIds: task.dependencies.length ? task.dependencies.map(id => `task:${runId}:${run.tasks.find(t => t.task_id === id || t.task_key === id)?.task_id ?? id}`) : [`tasks:${runId}`], title: task.handle ?? task.agent_slug ?? task.title, status: task.status, body: task.title + (task.result_summary ? '\n\n' + task.result_summary : '') })
  }
  for (const [runId, turn] of Object.entries(turns)) {
    for (const plan of turn.thinkingSteps?.filter(s => s.type === 'plan') ?? []) result.push({ id: `plan:${runId}:${plan.id}`, groupId: runId, kind: 'plan', parentIds: [meetingId], title: plan.title, body: plan.description })
    for (const tool of turn.toolCalls ?? []) result.push({ id: `tool:${runId}:${tool.id}`, groupId: runId, kind: 'tool', parentIds: [meetingId], title: tool.toolName, status: tool.status, tool })
  }
  const tools = result.flatMap(o => o.tool ? [o.tool] : [])
  if (tools.some(tool => tool.toolId.startsWith('git_')) || (tools.length && input.hasGitChanges))
    result.push({ id: `git:${sessionId}`, groupId: 'overview', kind: 'git', parentIds: [meetingId] })
  if (input.approvals?.some(approval => approval.session_id === sessionId))
    result.push({ id: `approval:${sessionId}`, groupId: 'overview', kind: 'approval', parentIds: [meetingId] })
  return result
}
