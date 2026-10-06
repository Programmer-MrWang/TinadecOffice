<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Background } from '@vue-flow/background'
import { Handle, Position, VueFlow, type Node } from '@vue-flow/core'
import { Bot, CheckCircle2, Code2, ListTodo, Search, ShieldCheck, TestTube2 } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import AppHeader from '@/components/AppHeader.vue'
import AppSidebar from '@/components/AppSidebar.vue'
import ComposerBar from '@/components/ComposerBar.vue'
import { homeController } from '@/controllers/HomeController'
import type { PermissionLevel } from '@/types/mode'

type SpatialNodeData = {
  title: string
  subtitle: string
  status: string
  kind: 'meeting' | 'plan' | 'agent' | 'work'
  progress?: string
  icon: typeof Bot
}

type SpatialNode = Node<SpatialNodeData>

const router = useRouter()
const { t } = useI18n()
const c = homeController
const sidebarCollapsed = ref(false)
const modeVersionId = ref<string | null>(null)
const permission = ref<PermissionLevel>(c.currentPermission.value)
const nodes = ref<SpatialNode[]>([])
const viewportKey = computed(() => `tinadec-space:${c.selectedSessionId.value ?? 'draft'}`)

function makeNodes(): SpatialNode[] {
  return [
    {
      id: 'meeting',
      type: 'spatial',
      position: { x: 80, y: 150 },
      data: { title: '会议智能体', subtitle: '接收用户消息 · 组织工作', status: '等待任务', kind: 'meeting', icon: Bot },
    },
    {
      id: 'plan',
      type: 'spatial',
      position: { x: 390, y: 150 },
      data: { title: '计划', subtitle: 'Todo · 执行顺序', status: '3 项任务', kind: 'plan', progress: '1/3 已完成', icon: ListTodo },
    },
    {
      id: 'agent-code',
      type: 'spatial',
      position: { x: 700, y: 78 },
      data: { title: '代码编辑智能体', subtitle: '编辑 src/App.vue', status: '进行中', kind: 'agent', progress: '写入代码', icon: Code2 },
    },
    {
      id: 'agent-test',
      type: 'spatial',
      position: { x: 700, y: 270 },
      data: { title: '测试智能体', subtitle: '验证前端行为', status: '等待执行', kind: 'agent', progress: '0/4 Tests', icon: TestTube2 },
    },
    {
      id: 'work-git',
      type: 'spatial',
      position: { x: 1030, y: 78 },
      data: { title: '更改', subtitle: 'Git · 当前工作区', status: '2 files changed', kind: 'work', icon: CheckCircle2 },
    },
    {
      id: 'work-approval',
      type: 'spatial',
      position: { x: 1030, y: 270 },
      data: { title: '审批', subtitle: '等待用户裁决', status: '1 项待审查', kind: 'work', icon: ShieldCheck },
    },
  ]
}

function restoreNodes() {
  const base = makeNodes()
  try {
    const raw = localStorage.getItem(viewportKey.value)
    if (!raw) {
      nodes.value = base
      return
    }
    const saved = JSON.parse(raw) as Record<string, { x: number; y: number }>
    for (const node of base) {
      const position = saved[node.id]
      if (position) node.position = position
    }
    nodes.value = base
  } catch {
    nodes.value = base
  }
}

function persistNodes() {
  const positions: Record<string, { x: number; y: number }> = {}
  for (const node of nodes.value as SpatialNode[]) positions[node.id] = { x: node.position.x, y: node.position.y }
  localStorage.setItem(viewportKey.value, JSON.stringify(positions))
}

function handleNodesChange(changes: unknown) {
  const list = changes as Array<{ id: string; type: string; position?: { x: number; y: number } }>
  let changed = false
  const current = nodes.value as SpatialNode[]
  for (const node of current) {
    const change = list.find((item) => item.id === node.id && item.type === 'position')
    if (!change?.position) continue
    changed = true
    node.position = change.position
  }
  if (changed) persistNodes()
}

function selectSession(id: string) {
  c.setSelectedSession(id)
  restoreNodes()
}

function createSession(projectId: string | null) {
  void c.createSession(projectId)
}

onMounted(() => {
  c.start()
  modeVersionId.value = c.currentSession.value?.mode_version_id ?? null
  restoreNodes()
})

watch(() => c.selectedSessionId.value, () => {
  modeVersionId.value = c.currentSession.value?.mode_version_id ?? null
  restoreNodes()
})
</script>

<template>
  <main class="spatial-page">
    <div class="top-drag-bar" />
    <AppHeader />
    <div class="spatial-body">
      <AppSidebar
        :projects="c.projects.value"
        :sessions="c.sessions.value"
        :selected-project-id="c.selectedProjectId.value"
        :selected-session-id="c.selectedSessionId.value"
        :busy="c.busy.value"
        :collapsed="sidebarCollapsed"
        @select-project="c.setSelectedProject($event)"
        @select-session="selectSession($event)"
        @create-session="createSession($event)"
        @open-project="c.openProject()"
        @go-market="router.push('/market')"
        @go-settings="router.push('/settings')"
        @go-workbench="router.push('/workbench')"
        @go-space="router.push('/space')"
        @toggle-collapse="sidebarCollapsed = !sidebarCollapsed"
        @rename-project="(id, name) => c.renameProject(id, name)"
        @rename-session="(id, title) => c.renameSession(id, title)"
        @archive-project="c.archiveProject($event)"
        @archive-session="c.archiveSession($event)"
        @trash-project="c.trashProject($event)"
        @trash-session="c.trashSession($event)"
      />

      <section class="spatial-stage">
        <div class="spatial-flow-wrap">
          <VueFlow
            :nodes="nodes"
            :edges="[]"
            :nodes-connectable="false"
            :elements-selectable="true"
            :pan-on-drag="[1]"
            :zoom-on-scroll="true"
            :zoom-on-double-click="false"
            :min-zoom="0.35"
            :max-zoom="1.8"
            :fit-view-on-init="false"
            class="spatial-flow"
            @nodes-change="handleNodesChange"
          >
            <Background pattern-color="var(--border-muted)" :gap="24" :size="1" />
            <template #node-spatial="{ data }">
              <article class="spatial-node" :class="`is-${data.kind}`">
                <Handle type="target" :position="Position.Left" :connectable="false" />
                <header class="spatial-node-head">
                  <component :is="data.icon" :size="17" aria-hidden="true" />
                  <strong>{{ data.title }}</strong>
                </header>
                <p>{{ data.subtitle }}</p>
                <footer>
                  <span>{{ data.status }}</span>
                  <b v-if="data.progress">{{ data.progress }}</b>
                </footer>
                <Handle type="source" :position="Position.Right" :connectable="false" />
              </article>
            </template>
          </VueFlow>
          <div class="spatial-hint">中键拖动画布 · 滚轮缩放 · 拖动控件调整工作区域</div>
        </div>

        <div class="spatial-composer">
          <ComposerBar
            :hero="false"
            :busy="c.busy.value || c.working.value"
            :model-value="c.draft.value"
            :permission="permission"
            :projects="c.projects.value"
            :selected-project-id="c.selectedProjectId.value"
            :session-id="c.currentSession.value?.id ?? null"
            :mode-version-id="modeVersionId"
            :meeting-model-override="c.currentSession.value?.meeting_model_override ?? null"
            :runs="c.runs.value"
            :can-stop="Boolean(c.stoppableRunId.value)"
            @update:model-value="c.updateDraft($event)"
            @update:permission="permission = $event"
            @update:mode-version-id="modeVersionId = $event"
            @submit="c.sendMessage($event)"
            @stop="c.stopRun()"
            @create-project="c.openProject()"
            @select-project="c.setSelectedProject($event)"
          />
        </div>
      </section>
    </div>
  </main>
</template>

<style>
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/core/dist/theme-default.css';

.spatial-page,
.spatial-body,
.spatial-stage {
  width: 100%;
  height: 100%;
  min-height: 0;
}

.spatial-page { position: relative; overflow: hidden; background: var(--bg-app); }
.spatial-body { display: flex; padding-top: 0; }
.spatial-stage { position: relative; min-width: 0; }
.spatial-flow-wrap { position: absolute; inset: 0 0 122px; }
.spatial-flow { width: 100%; height: 100%; background: var(--bg-app); }
.spatial-composer { position: absolute; left: 50%; bottom: 18px; z-index: 10; width: min(760px, calc(100% - 40px)); transform: translateX(-50%); }
.spatial-composer .composer { width: 100%; }
.spatial-hint { position: absolute; top: 14px; left: 50%; padding: 5px 10px; border-radius: 999px; color: var(--text-tertiary); background: color-mix(in srgb, var(--surface-raised) 84%, transparent); font-size: 11px; pointer-events: none; transform: translateX(-50%); }
.spatial-node { width: 240px; padding: 14px; border: 1px solid var(--border-card); border-radius: 16px; color: var(--text-primary); background: color-mix(in srgb, var(--surface-raised) 94%, transparent); box-shadow: var(--shadow-card-subtle); cursor: grab; }
.spatial-node:active { cursor: grabbing; }
.spatial-node-head { display: flex; align-items: center; gap: 8px; font-size: 14px; }
.spatial-node p { margin: 12px 0; color: var(--text-secondary); font-size: 12px; }
.spatial-node footer { display: flex; justify-content: space-between; gap: 10px; color: var(--text-tertiary); font-family: var(--font-mono, monospace); font-size: 11px; }
.spatial-node footer b { color: var(--accent-primary); font-weight: 500; }
.spatial-node.is-meeting { border-color: color-mix(in srgb, var(--accent-primary) 55%, var(--border-card)); }
.spatial-node.is-plan { border-color: color-mix(in srgb, var(--accent-warning) 45%, var(--border-card)); }
.spatial-node.is-work { border-color: color-mix(in srgb, var(--accent-success) 45%, var(--border-card)); }
.vue-flow__handle { opacity: 0; }
</style>
