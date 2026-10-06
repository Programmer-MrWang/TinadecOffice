<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, shallowRef, watch } from 'vue'
import { Background } from '@vue-flow/background'
import { Handle, Position, VueFlow, useVueFlow, type Node as FlowNode, type NodeChange } from '@vue-flow/core'
import { NodeResizer } from '@vue-flow/node-resizer'
import { Bot, ChevronLeft, ChevronRight, GitBranch, ListTodo, Maximize, Minus, Plus, Redo2, ShieldCheck, Undo2 } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { UieShell, UieCanvas, UieCardHost, type SpatialChange, type SpatialLayout } from '@tinadec/ui'
import ComposerBar from '@/components/ComposerBar.vue'
import SpatialWorkCard from '@/components/spatial/SpatialWorkCard.vue'
import { UiButton } from '@/components/ui'
import { homeController as c } from '@/controllers/HomeController'
import { ensureProductionUie } from '@/lib/uiEngine'
import { api, type SessionTopologyDto } from '@/api'
import { projectSpatialObjects } from '@/lib/spatialObjects'
import { subscribeToSessionEvents } from '@/lib/sessionEventBus'
import { useSpatialGit } from '@/composables/useSpatialGit'
import { usePanelStyles } from '@/composables/usePanelStyles'

const { t } = useI18n()
const emit = defineEmits<{ ready: [] }>()
const uie = ensureProductionUie()
const { getPanelStyle, getPanelDataAttributes } = usePanelStyles()
// Like the immersive chat stack: inherit material tokens without painting or
// filtering the whole canvas. Individual controls own their glass surfaces.
const materialStyle = computed(() => {
  const { backgroundColor, backdropFilter, WebkitBackdropFilter, ...tokens } = getPanelStyle()
  return tokens
})
const materialAttrs = computed(() => getPanelDataAttributes())
c.setViewMode('space')
const ready = ref(false)
const composerDock = ref<HTMLElement | null>(null)
const hero = computed(() => c.messages.value.length === 0)
watch(hero, async () => {
  const box = composerDock.value?.querySelector<HTMLElement>('.composer-box')
  const from = box?.getBoundingClientRect()
  await nextTick()
  if (!box || !from?.width || !from.height || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const to = box.getBoundingClientRect()
  if (!to.width || !to.height || typeof box.animate !== 'function') return
  const dy = from.top - to.top
  if (Math.abs(dy) < 1) return
  box.animate([{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0px)' }],
    { duration: 350, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' })
})
const gesturing = ref(false)
const topology = shallowRef<SessionTopologyDto | null>(null)
const loadError = ref('')
const sessionKey = computed(() => c.selectedSessionId.value ?? `draft:${c.selectedProjectId.value ?? 'free'}`)
const projectPath = computed(() => c.currentSession.value
  ? c.projects.value.find(p => p.id === c.currentSession.value?.project_id)?.path ?? '' : c.currentProject.value?.path ?? '')
const git = useSpatialGit(projectPath)
provide('space:git', git)
const { applyNodeChanges, updateNodeInternals, setViewport, fitBounds, zoomIn, zoomOut } = useVueFlow({ id: 'session-space' })
let alive = true
let generation = 0
let topologyAbort: AbortController | undefined
let topologyFlight: string | null = null
let topologyDirty = false
let refreshTimer: ReturnType<typeof setTimeout> | undefined
let unsubscribe: (() => void) | undefined
const objects = computed(() => projectSpatialObjects({ sessionId: sessionKey.value, messages: c.messages.value,
  queuedMessages: c.queuedMessages.value, approvals: c.approvals.value, hasGitChanges: Boolean(git.state.value.preview.files?.length),
  topology: topology.value, orchestration: c.orchestration.value, turns: c.agentTurnActivities.value, streamingReply: c.streamingReply.value, streamingRunId: c.stoppableRunId.value }))
const objectMap = computed(() => Object.fromEntries(objects.value.map(o => [o.id, o])))
provide('space:objects', objectMap)
const nodes = computed<FlowNode[]>((previous) => {
  // Incoming task/status events must not reset an in-progress drag or resize.
  if (gesturing.value) return previous ?? []
  return objects.value.flatMap(object => {
  const item = uie.snapshot.value.space?.items[object.id]
  return item ? [{ id: object.id, type: 'work', position: { x: item.x, y: item.y }, width: item.width, height: item.autoHeight ? undefined : item.height, class: item.autoHeight ? 'space-auto-height' : '',
    style: { width: `${item.width}px`, height: item.autoHeight ? 'auto' : `${item.height}px` },
    dragHandle: '.space-drag-handle', data: {}, connectable: false, deletable: false }] : []
  })
})
const measuredHeights = new Map<string, number>()
const edges = computed(() => objects.value.flatMap((object, index) => (object.parentIds ?? []).filter(id => objectMap.value[id]).map(id => ({
  id: `${id}->${object.id}`, source: id, target: object.id, type: 'smoothstep', selectable: false,
  sourceHandle: objects.value.findIndex(o => o.id === id) === index - 1 ? 'flow' : 'branch',
  targetHandle: objects.value.findIndex(o => o.id === id) === index - 1 ? 'flow' : 'branch',
}))))
provide('space:measure', (id: string, height: number) => {
  const rounded = Math.ceil(height)
  if (gesturing.value || measuredHeights.get(id) === rounded) return
  measuredHeights.set(id, rounded)
  syncObjects()
  void nextTick(() => updateNodeInternals([id]))
})
function syncObjects() {
  if (!ready.value || uie.snapshot.value.space?.sessionId !== sessionKey.value) return
  const seeds = objects.value.map(o => ({ id: o.id, groupId: o.groupId, measuredHeight: measuredHeights.get(o.id) }))
  if (seeds.length) uie.dispatch({ command: { type: 'spaceSync', scope: uie.scope.value, seeds }, source: 'route', expectedRevision: uie.snapshot.value.revision })
}
watch(objects, syncObjects)

async function loadTopology() {
  const id = c.selectedSessionId.value
  if (id && topologyFlight === id) { topologyDirty = true; return }
  const read = ++generation
  topologyFlight = id
  topologyAbort?.abort()
  topologyAbort = new AbortController()
  if (!id) { topology.value = null; return }
  try {
    const data = await api.getSessionTopology(id, { include_finished: true, max_runs: 40, max_tasks: 200 }, AbortSignal.any([topologyAbort.signal, AbortSignal.timeout(10000)]))
    if (!alive || read !== generation || id !== c.selectedSessionId.value) return
    topology.value = data
    loadError.value = ''
  } catch (error) {
    if (alive && read === generation) loadError.value = error instanceof Error ? error.message : String(error)
  } finally {
    if (alive && read === generation) {
      topologyFlight = null
      if (topologyDirty) { topologyDirty = false; void loadTopology() }
    }
  }
}
function enterSession() {
  if (!ready.value) return
  generation++
  topologyFlight = null
  topologyDirty = false
  topology.value = null
  loadError.value = ''
  measuredHeights.clear()
  uie.showSpace(sessionKey.value)
  syncObjects()
  peek.value = null
  void loadTopology()
  void nextTick(restoreViewport)
}
watch(sessionKey, enterSession)
onMounted(async () => {
  c.start()
  await uie.ready
  if (!alive) return
  ready.value = true
  enterSession()
  unsubscribe = subscribeToSessionEvents(event => {
    if (event.session_id !== c.selectedSessionId.value || refreshTimer) return
    refreshTimer = setTimeout(() => { refreshTimer = undefined; void loadTopology(); if (event.type.startsWith('tool.execution.') || event.type === 'run.completed') void git.refresh() }, 800)
  })
  await nextTick()
  emit('ready')
})
onBeforeUnmount(() => { alive = false; generation++; topologyAbort?.abort(); unsubscribe?.(); clearTimeout(refreshTimer) })

function commit(changes: SpatialChange[]) {
  uie.dispatch({ command: { type: 'spaceMove', scope: uie.scope.value, changes }, source: 'user', expectedRevision: uie.snapshot.value.revision })
}
function dragStop(event: { nodes: FlowNode[] }) {
  commit(event.nodes.map(n => ({ id: n.id, x: n.position.x, y: n.position.y })))
  gesturing.value = false
}
function resizeStop(id: string, params: { x: number; y: number; width: number; height: number }) { commit([{ id, ...params }]); gesturing.value = false }
function camera(viewport: SpatialLayout['viewport']) {
  if (ready.value) uie.dispatch({ command: { type: 'spaceViewport', scope: uie.scope.value, viewport }, source: 'user', expectedRevision: uie.snapshot.value.revision })
}
function restoreViewport() { const v = uie.snapshot.value.space?.viewport; if (v) void setViewport(v) }
function locate(id: string) {
  const item = uie.snapshot.value.space?.items[id]
  if (item) void fitBounds({ x: item.x, y: item.y, width: item.width, height: item.height }, { padding: 0.4 })
  peek.value = null
}
function overview() {
  const items = objects.value.map(o => uie.snapshot.value.space?.items[o.id]).filter((i): i is NonNullable<typeof i> => !!i)
  if (!items.length) return
  const x = Math.min(...items.map(i => i.x)), y = Math.min(...items.map(i => i.y))
  void fitBounds({ x, y, width: Math.max(...items.map(i => i.x + i.width)) - x, height: Math.max(...items.map(i => i.y + i.height)) - y }, { padding: 0.15 })
}
function keyboard(event: KeyboardEvent) {
  const target = event.target as HTMLElement
  if (target.closest('input,textarea,[contenteditable=true]') || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return
  event.preventDefault()
  if (event.shiftKey) uie.redo(); else uie.undo()
}
const entries = [{ kind: 'meeting', key: 'planning', icon: Bot }, { kind: 'plan', key: 'plans', icon: ListTodo }, { kind: 'git', key: 'changes', icon: GitBranch }, { kind: 'approval', key: 'approvals', icon: ShieldCheck }] as const
const visibleEntries = computed(() => entries.filter(entry => objects.value.some(object => object.kind === entry.kind)))
const peek = ref<string | null>(null)
const peekIndex = ref(0)
const expanded = ref(false)
const previews = computed(() => objects.value.filter(o => o.kind === peek.value))
const preview = computed(() => previews.value[Math.min(peekIndex.value, previews.value.length - 1)])
function showPreview(kind: string) { if (peek.value !== kind) { peekIndex.value = 0; expanded.value = false }; peek.value = kind }
function leavePreview(event: FocusEvent) { if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) peek.value = null }
</script>

<template>
  <UieShell v-if="ready && c.viewMode.value === 'space'">
    <UieCanvas spatial>
      <div class="space-surface" :style="materialStyle" v-bind="materialAttrs" tabindex="-1" @keydown="keyboard">
        <div class="space-flow-area">
          <VueFlow :key="sessionKey" id="session-space" :nodes="nodes" :edges="edges" :apply-default="false"
            :nodes-connectable="false" :delete-key-code="null" :pan-on-drag="[1]" :pan-on-scroll="true" :zoom-on-scroll="false"
            :zoom-on-pinch="true" :zoom-on-double-click="false" :min-zoom="0.2" :max-zoom="2" :only-render-visible-elements="false"
            @nodes-change="(changes: NodeChange[]) => applyNodeChanges(changes)" @node-drag-start="gesturing = true" @node-drag-stop="dragStop"
            @pane-ready="restoreViewport" @viewport-change-end="camera">
            <Background pattern-color="var(--border-muted)" :gap="24" :size="1" />
            <template #node-work="{ id, selected }">
              <Handle id="flow" type="target" :position="Position.Top" />
              <Handle id="flow" type="source" :position="Position.Bottom" />
              <Handle id="branch" type="target" :position="Position.Left" />
              <Handle id="branch" type="source" :position="Position.Left" />
              <NodeResizer :min-width="320" :min-height="100" :max-width="1400" :max-height="1200" :is-visible="selected"
                @resize-start="gesturing = true" @resize-end="({ params }) => resizeStop(id, params)" />
              <UieCardHost :instance="{ id, descriptorId: 'spatialWork', title: '', state: { objectId: id } }" :active="true" />
            </template>
          </VueFlow>
          <div class="space-controls">
            <UiButton variant="ghost" size="icon" :aria-label="t('space.undo')" :disabled="!uie.canUndo.value" @click="uie.undo()"><Undo2 :size="16" /></UiButton>
            <UiButton variant="ghost" size="icon" :aria-label="t('space.redo')" :disabled="!uie.canRedo.value" @click="uie.redo()"><Redo2 :size="16" /></UiButton>
            <UiButton variant="ghost" size="icon" :aria-label="t('space.zoomOut')" @click="zoomOut()"><Minus :size="16" /></UiButton>
            <UiButton variant="ghost" size="icon" :aria-label="t('space.zoomIn')" @click="zoomIn()"><Plus :size="16" /></UiButton>
            <UiButton variant="ghost" size="icon" :aria-label="t('space.overview')" @click="overview"><Maximize :size="16" /></UiButton>
          </div>
          <div v-if="loadError" class="space-load-error" role="status">{{ loadError }} <button @click="loadTopology">{{ t('space.retry') }}</button></div>
        </div>
        <div ref="composerDock" class="space-composer-dock" :class="{ 'space-composer-hero': hero }">
          <nav v-if="visibleEntries.length" class="space-index" :aria-label="t('space.index')" @mouseleave="peek = null" @focusout="leavePreview" @keydown.esc.stop="peek = null">
            <div v-for="entry in visibleEntries" :key="entry.kind" class="space-index-entry">
              <button class="space-index-button" :aria-expanded="peek === entry.kind" @mouseenter="showPreview(entry.kind)" @focus="showPreview(entry.kind)" @click="showPreview(entry.kind); preview && locate(preview.id)">
                <component :is="entry.icon" :size="16" />{{ t('space.' + entry.key) }}
                <span v-if="entry.kind === 'approval' && c.approvals.value.some(a => a.status === 'pending')" class="space-approval-count">{{ c.approvals.value.filter(a => a.status === 'pending').length }}</span>
              </button>
              <Transition name="space-preview">
              <div v-if="peek === entry.kind && preview" class="space-peek" :class="{ 'space-peek-stacked': previews.length > 1 }">
                <div v-if="previews.length > 1" class="space-peek-pagination">
                  <button :disabled="peekIndex <= 0" :aria-label="t('space.previous')" @click="peekIndex--"><ChevronLeft :size="16" /></button>
                  <span>{{ peekIndex + 1 }} / {{ previews.length }}</span>
                  <button :disabled="peekIndex >= previews.length - 1" :aria-label="t('space.next')" @click="peekIndex++"><ChevronRight :size="16" /></button>
                  <button @click="expanded = !expanded">{{ t(expanded ? 'space.collapse' : 'space.expand') }}</button>
                </div>
                <div v-if="expanded" class="space-plan-list"><button v-for="item in previews" :key="item.id" @click="locate(item.id)">{{ item.title || t('space.kind.' + item.kind) }} · {{ item.groupId.slice(0, 8) }}</button></div>
                <div v-else class="space-peek-content" role="button" tabindex="0" :aria-label="preview.title || t('space.kind.' + preview.kind)" @keydown.enter.prevent="locate(preview.id)" @keydown.space.prevent="locate(preview.id)" @click="locate(preview.id)"><SpatialWorkCard :object="preview" preview /></div>
              </div>
              </Transition>
            </div>
          </nav>
          <ComposerBar spatial :hero="hero" :busy="c.busy.value || c.working.value" :model-value="c.draft.value" :permission="c.currentPermission.value"
            :projects="c.projects.value" :selected-project-id="c.selectedProjectId.value" :session-id="c.currentSession.value?.id ?? null"
            :mode-version-id="c.currentSession.value?.mode_version_id ?? null" :meeting-model-override="c.currentSession.value?.meeting_model_override ?? null"
            :runs="c.runs.value" :can-stop="Boolean(c.stoppableRunId.value)"
            @update:model-value="c.updateDraft($event)" @update:permission="c.updatePermission($event)" @submit="c.sendMessage($event)" @welcome-submit="c.handleWelcomeSend($event)"
            @stop="c.stopRun()" @create-project="c.openProject()" @select-project="c.setSelectedProject($event)">
            <template #capabilities><span class="space-meeting-label"><Bot :size="14" />{{ t('space.kind.meeting') }}</span></template>
          </ComposerBar>
        </div>
      </div>
    </UieCanvas>
  </UieShell>
</template>

<style>
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/core/dist/theme-default.css';
@import '@vue-flow/node-resizer/dist/style.css';
.space-surface { position: relative; height: 100%; min-height: 0; }
.space-flow-area { position: absolute; inset: 0; }
.space-flow-area .vue-flow__node-work { border-radius: 16px; background: transparent; box-shadow: var(--shadow-card-subtle); }
.space-flow-area .vue-flow__node-work.selected { outline: 2px solid var(--accent-primary); outline-offset: 3px; }
.space-controls { position: absolute; top: 8px; right: 12px; display: flex; border-radius: 12px; background: var(--surface-raised); }
.space-load-error { position: absolute; left: 16px; top: 8px; max-width: 65%; font-size: 12px; color: var(--text-secondary); background: var(--surface-raised); padding: 8px; border-radius: 8px; }
.space-composer-dock { position: absolute; bottom: 12px; left: 0; right: 0; width: min(760px, calc(100% - 32px)); margin: auto; z-index: 10; pointer-events: none; }
.space-composer-dock .composer, .space-index-entry { pointer-events: auto; }
.space-composer-dock.space-composer-hero { bottom: 50%; }
.space-composer-dock .composer { width: 100%; margin: 0; padding: 0; }
.space-index { display: flex; justify-content: center; gap: 8px; margin-bottom: 12px; position: relative; }
.space-index-entry { position: relative; }
.space-index-button { display: flex; align-items: center; gap: 8px; padding: 9px 14px; border: 0; border-radius: 10px; color: var(--text-secondary); background: var(--surface-raised); cursor: pointer; font-size: 13px; }
.space-index-button:hover, .space-index-button:focus-visible { color: var(--text-primary); background: var(--surface-hover); }
.space-peek { position: absolute; width: 420px; max-height: min(520px, 65vh); bottom: 100%; left: 50%; transform: translateX(-50%); padding-bottom: 12px; display: flex; flex-direction: column; }
.space-peek-content { border-radius: 16px; box-shadow: var(--shadow-card-subtle); }
.space-controls, .space-index-button, .space-peek-pagination, .space-plan-list { backdrop-filter: var(--material-filter-raised, none); }
.space-peek-content { min-height: 0; flex: 1; cursor: pointer; }
.space-peek-stacked::before { content: ''; position: absolute; inset: -7px 7px 22px; border-radius: 16px; background: var(--surface-section); border: 1px solid var(--border-muted); z-index: -1; }
.space-peek-pagination { display: flex; justify-content: space-around; gap: 8px; padding: 8px; background: var(--surface-raised); border-radius: 12px 12px 0 0; font-size: 12px; }
.space-peek button { color: var(--text-primary); background: var(--surface-raised); border: 0; cursor: pointer; }

.space-plan-list { flex: 1; overflow: auto; background: var(--surface-raised); }
.space-plan-list button { display: block; width: 100%; padding: 12px; text-align: left; }
.space-approval-count { color: var(--accent-warning); font-size: 12px; }
.space-meeting-label { display: flex; align-items: center; gap: 6px; color: var(--text-secondary); font-size: 12px; }
@media (max-width: 800px) { .space-index-entry { position: static; } .space-index-button { padding: 8px; gap: 4px; } .space-peek { max-width: calc(100vw - 88px); } }
.space-auto-height .uie-card-host { height: auto; }
.space-auto-height .spatial-work-card { height: auto; max-height: 560px; }
.space-flow-area .vue-flow__handle { opacity: 0; pointer-events: none; }
.space-flow-area .vue-flow__edge-path { stroke: var(--text-secondary); stroke-width: 1.5; }
.space-peek-content { overflow: hidden; }
.space-peek-content .spatial-work-card { height: auto; max-height: 440px; }
.space-peek { transform-origin: bottom center; }
.space-preview-enter-active, .space-preview-leave-active { transition: opacity 160ms ease, transform 160ms ease; }
.space-preview-enter-from, .space-preview-leave-to { opacity: 0; transform: translateX(-50%) translateY(6px) scale(.96); }
@media (prefers-reduced-motion: reduce) { .space-preview-enter-active, .space-preview-leave-active { transition: none; } }
</style>
