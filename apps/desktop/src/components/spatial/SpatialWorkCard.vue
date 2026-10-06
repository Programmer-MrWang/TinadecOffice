<script setup lang="ts">
import { computed, inject, type ComputedRef } from 'vue'
import { Bot, CheckCircle2, Circle, FileCode2, GitBranch, ListTodo, MessageSquare, ShieldCheck, Wrench } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import type { SpatialObject } from '@/lib/spatialObjects'
import { homeController as c } from '@/controllers/HomeController'
import ToolCallCard from '@/components/chat/ToolCallCard.vue'
import GitCard from '../../../../TinadecUI/src/components/cards/home/GitCard.vue'
import ApprovalCard from '../../../../TinadecUI/src/components/cards/home/ApprovalCard.vue'
const props = defineProps<{ object?: SpatialObject; preview?: boolean }>()
const { t } = useI18n()
const state = inject<Record<string, unknown>>('uie:cardState', {})
const objects = inject<ComputedRef<Record<string, SpatialObject>>>('space:objects')
const object = computed(() => props.object ?? objects?.value[String(state.objectId)])
const icons = { message: MessageSquare, meeting: Bot, plan: ListTodo, task: FileCode2, tool: Wrench, git: GitBranch, approval: ShieldCheck }
const completed = computed(() => object.value?.rows?.filter(r => ['completed', 'succeeded'].includes(r.status)).length ?? 0)
const status = (s?: string) => s && t('space.status.' + s) !== 'space.status.' + s ? t('space.status.' + s) : s
</script>
<template>
  <article v-if="object" class="spatial-work-card" :data-object-id="object.id">
    <header class="space-drag-handle">
      <component :is="icons[object.kind]" :size="24" aria-hidden="true" />
      <h2>{{ object.title || t('space.kind.' + object.kind) }}</h2>
    </header>
    <div class="space-work-body nodrag nopan nowheel">
      <GitCard v-if="object.kind === 'git' && !preview" />
      <ApprovalCard v-else-if="object.kind === 'approval' && !preview" />
      <template v-else-if="object.kind === 'approval'">
        <p v-if="!c.approvals.value.length" class="space-muted">{{ t('space.noApprovals') }}</p>
        <div v-for="a in c.approvals.value" :key="a.id" class="space-todo-row"><ShieldCheck :size="18" /><div>{{ a.summary }}<small>{{ status(a.status) }}</small></div></div>
      </template>
      <p v-else-if="object.kind === 'git'" class="space-muted">{{ c.currentProject.value?.name ?? t('space.noProject') }}<br />{{ t('space.locateGit') }}</p>
      <ToolCallCard v-else-if="object.tool && !preview" :tool-call="object.tool" :run-id="object.groupId" @approve="c.decideApprovalById($event, 'approved')" @reject="c.decideApprovalById($event, 'rejected')" />
      <template v-else>
        <p v-if="object.body || object.tool" class="space-work-text">{{ object.body || object.tool?.argsSummary }}</p>
        <div v-for="row in object.rows" :key="row.id" class="space-todo-row">
          <CheckCircle2 v-if="['completed', 'succeeded'].includes(row.status)" :size="20" class="space-success" /><Circle v-else :size="20" />
          <div>{{ row.title }}<small>{{ row.detail }} {{ status(row.status) }}</small></div>
        </div>
        <p v-if="!object.body && !object.tool && !object.rows?.length" class="space-muted">{{ t(object.kind === 'meeting' ? 'space.waitingMessage' : 'space.noPlan') }}</p>
      </template>
    </div>
    <footer v-if="object.rows?.length">{{ t('space.progress', { done: completed, total: object.rows.length }) }}</footer>
    <footer v-else-if="object.status">{{ status(object.status) }}</footer>
  </article>
</template>
<style scoped>
.spatial-work-card { height: 100%; display: flex; flex-direction: column; min-width: 0; color: var(--text-primary); background: var(--surface-raised); border-radius: 16px; overflow: hidden; }
.space-drag-handle { display: flex; align-items: center; gap: 9px; padding: 18px 24px 12px; cursor: grab; flex-shrink: 0; }
h2 { font-size: 24px; font-weight: 700; line-height: 1.25; margin: 0; overflow-wrap: anywhere; }
.space-drag-handle svg { flex-shrink: 0; }
.space-work-body { padding: 6px 24px 16px; flex: 1; min-height: 0; overflow: auto; user-select: text; }
.space-work-text { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 14px; line-height: 1.65; margin: 0 0 16px; }
.space-muted { color: var(--text-tertiary); line-height: 1.7; font-size: 13px; }
.space-todo-row { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 16px; font-size: 16px; }
.space-todo-row svg { flex-shrink: 0; margin-top: 2px; }
.space-todo-row small { display: block; margin-top: 7px; color: var(--text-tertiary); font: 12px var(--font-mono, monospace); overflow-wrap: anywhere; }
.space-success { color: var(--accent-success); }
footer { flex-shrink: 0; padding: 8px 24px 14px; font-size: 12px; color: var(--text-secondary); }
</style>
