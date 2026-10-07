import type { ApprovalDto, MessageDto, OrchestrationSnapshotDto, SessionTopologyDto, TopologyTaskDto } from '@/api'
import type { ToolCall, TurnActivity } from '@/composables/useAgentActivity'

export interface SpatialObject {
  id: string
  groupId: string
  kind: 'message' | 'meeting' | 'run' | 'result' | 'plan' | 'task' | 'tool' | 'git' | 'approval'
  runId?: string
  taskId?: string
  instanceId?: string
  owner?: string
  /** Spatial task IDs, resolved only within this run. */
  dependencyIds?: string[]
  unresolvedDependencies?: string[]
  dependencyUnverified?: boolean
  waitingFor?: string[]
  /** The source reports omitted records, not merely an abbreviated title. */
  truncated?: boolean
  queue?: { id: string; content: string; status: string; editable?: boolean; runId?: string }[]
  title?: string
  status?: string
  body?: string
  rows?: { id: string; title: string; status: string; detail?: string }[]
  tool?: ToolCall
}

export interface SpatialRelation {
  id: string
  source: string
  target: string
  kind: 'dependency'
  sourceField: 'dependencies'
}

/** A read projection: statuses and ownership always come from Core records. */
export function projectSpatialObjects(input: {
  sessionId: string
  messages: MessageDto[]
  topology: SessionTopologyDto | null
  orchestration: OrchestrationSnapshotDto | null
  turns: Record<string, TurnActivity>
  streamingReply?: string
  streamingReplies?: Record<string, string>
  queuedMessages?: { id: string; content: string }[]
  approvals?: ApprovalDto[]
  hasGitChanges?: boolean
  streamingRunId?: string | null
}): SpatialObject[] {
  const { sessionId, turns } = input
  const messages = input.messages.filter(m => m.session_id === sessionId)
  const snapshot = input.orchestration?.run?.session_id === sessionId ? input.orchestration : null
  const topology = input.topology?.session_id === sessionId ? input.topology : null
  const runs = new Map<string, { status: string; tasks: TopologyTaskDto[]; truncated?: boolean }>()
  for (const run of topology?.runs ?? []) runs.set(run.run_id, {
    status: run.status, tasks: run.tasks, truncated: run.tasks_truncated || run.instances_truncated,
  })
  // The legacy session snapshot can contain nodes from several runs. Never reassign them
  // to its latest run, or use it to fill holes in an authoritative topology run.
  if (snapshot?.run && !runs.has(snapshot.run.id)) runs.set(snapshot.run.id, {
    status: snapshot.run.status,
    tasks: snapshot.nodes.filter(n => n.run_id === snapshot.run!.id && n.session_id === sessionId)
      .map(n => ({ task_id: n.id, task_key: n.id, title: n.title, status: n.status, dependencies: n.dependencies, write_scope: [] })),
  })
  const messageRunId = (m: MessageDto) => m.run_id || (
    m.role === 'user' && snapshot?.run?.user_message_id === m.id ? snapshot.run.id : undefined
  )
  const requests = new Map<string, string[]>()
  const replies = new Map<string, string[]>()
  const unassociatedReplies: string[] = []
  const queue = new Map<string, NonNullable<SpatialObject['queue']>[number]>()
  for (const message of messages) {
    const runId = messageRunId(message)
    if (runId && !runs.has(runId)) runs.set(runId, { status: 'unknown', tasks: [] })
    if (message.role === 'user') {
      queue.set(message.id, {
        id: message.id, content: message.content,
        status: runId ? runs.get(runId)!.status || 'unknown' : 'unassociated',
        ...(runId ? { runId } : {}),
      })
      if (runId) requests.set(runId, [...(requests.get(runId) ?? []), message.content])
    } else if (message.role === 'assistant') {
      if (runId) replies.set(runId, [...(replies.get(runId) ?? []), message.content])
      else unassociatedReplies.push(message.content)
    }
  }
  // Only controller-owned pending entries are editable; a history row is never
  // inferred to be queued just because its run or answer has not been loaded.
  for (const message of input.queuedMessages ?? []) queue.set(message.id, { id: message.id, content: message.content, status: 'queued', editable: true })
  const result: SpatialObject[] = []
  if (queue.size || runs.size || unassociatedReplies.length) result.push({
    id: `meeting:${sessionId}`, groupId: sessionId, kind: 'meeting', queue: [...queue.values()],
    // The UI labels this as unassociated history. It has no "latest run" status.
    body: unassociatedReplies.join('\n\n'), truncated: topology?.runs_truncated,
  })
  for (const [runId, run] of runs) {
    const tasks = [...new Map(run.tasks.map(task => [task.task_id, task])).values()]
    const byId = new Map(tasks.map(task => [task.task_id, task]))
    const byKey = new Map<string, TopologyTaskDto | null>()
    for (const task of tasks) byKey.set(task.task_key, byKey.has(task.task_key) ? null : task)
    const taskId = (id: string) => `task:${runId}:${id}`
    const body = (requests.get(runId) ?? []).join('\n\n')
    const title = Array.from(body.trim().split(/\r?\n/, 1)[0])
    result.push({
      id: `tasks:${runId}`, groupId: runId, runId, kind: 'run', status: run.status,
      title: title.length > 80 ? title.slice(0, 79).join('') + '…' : title.join('') || undefined,
      body, truncated: run.truncated,
      rows: tasks.map(task => ({ id: taskId(task.task_id), title: task.title, status: task.status, detail: task.handle ?? task.agent_slug ?? undefined })),
    })
    for (const task of tasks) {
      const dependencies = new Map<string, TopologyTaskDto>()
      const unresolved = new Set<string>()
      for (const key of task.dependencies) {
        const dependency = byId.get(key) ?? byKey.get(key)
        if (dependency) dependencies.set(dependency.task_id, dependency)
        else unresolved.add(key)
      }
      result.push({
        id: taskId(task.task_id), groupId: runId, runId, taskId: task.task_id, kind: 'task',
        title: task.title, owner: task.handle ?? task.agent_slug ?? undefined,
        instanceId: task.worker_instance_id ?? undefined, status: task.status, body: task.result_summary ?? '',
        dependencyIds: [...dependencies.keys()].map(taskId), unresolvedDependencies: [...unresolved],
        waitingFor: [...dependencies.values()].filter(d => !['completed', 'succeeded'].includes(d.status)).map(d => d.title),
      })
    }
    // The remainder may contain missing references, cycles or their descendants.
    // None can be advertised as an independent branch or labelled a cycle by guess.
    let pending = result.filter(o => o.kind === 'task' && o.runId === runId)
    const resolved = new Set<string>()
    while (pending.length) {
      const ready = pending.filter(o => !o.unresolvedDependencies?.length && o.dependencyIds?.every(id => resolved.has(id)))
      if (!ready.length) { for (const object of pending) object.dependencyUnverified = true; break }
      for (const object of ready) resolved.add(object.id)
      pending = pending.filter(o => !resolved.has(o.id))
    }
    const turn = turns[runId]
    // A turn bucket is not a session identity. Only runs established above may
    // contribute activity, and an explicit conflicting identity is rejected.
    if (turn && (turn.runId === undefined || turn.runId === runId)) {
      for (const plan of turn.thinkingSteps?.filter(s => s.type === 'plan') ?? []) result.push({
        id: `plan:${runId}:${plan.id}`, groupId: runId, runId, kind: 'plan', title: plan.title, body: plan.description,
      })
      for (const tool of turn.toolCalls ?? []) {
        if (tool.runId !== undefined && tool.runId !== runId) continue
        result.push({ id: `tool:${runId}:${tool.id}`, groupId: runId, runId, kind: 'tool', title: tool.toolName, status: tool.status, tool })
      }
    }
    const streamed = input.streamingReplies?.[runId] ?? (input.streamingRunId === runId ? input.streamingReply : undefined)
    const answers = replies.get(runId)
    // Durable answers win even while a stale topology still calls the run active.
    // Never append an old preview to the persisted answer or another run's text.
    if (answers?.length || streamed) result.push({
      id: `result:${runId}`, groupId: runId, runId, kind: 'result', status: run.status,
      body: answers?.length ? answers.join('\n\n') : streamed,
    })
  }
  if (input.hasGitChanges || result.some(o => o.tool?.toolId.startsWith('git_')))
    result.push({ id: `git:${sessionId}`, groupId: 'overview', kind: 'git' })
  if (input.approvals?.some(approval => approval.session_id === sessionId))
    result.push({ id: `approval:${sessionId}`, groupId: 'overview', kind: 'approval' })
  return result
}

/** Dependencies are scheduling constraints, not inferred ownership or message flow. */
export function projectSpatialRelations(objects: SpatialObject[]): SpatialRelation[] {
  const tasks = new Map(objects.filter(o => o.kind === 'task').map(o => [o.id, o]))
  const relations = new Map<string, SpatialRelation>()
  for (const target of tasks.values()) {
    for (const sourceId of target.dependencyIds ?? []) {
      const source = tasks.get(sourceId)
      if (!target.runId || source?.runId !== target.runId) continue
      const id = `dependency:${sourceId}->${target.id}`
      relations.set(id, { id, source: sourceId, target: target.id, kind: 'dependency', sourceField: 'dependencies' })
    }
  }
  return [...relations.values()]
}
