<script setup lang="ts">
import { computed, inject, onMounted, onBeforeUnmount, ref, watch, type ComputedRef } from 'vue'
import { Bot, CheckCircle2, Circle, FileCode2, GitBranch, ListTodo, MessageSquare, ShieldCheck, Wrench } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import type { SpatialObject } from '@/lib/spatialObjects'
import { homeController as c } from '@/controllers/HomeController'
import ToolCallCard from '@/components/chat/ToolCallCard.vue'
import { api } from '@/api'
import { readFileText, type ReadFileDataDto } from '@/lib/workspaceSearch'
import type { useSpatialGit } from '@/composables/useSpatialGit'
import ApprovalCard from '../../../../TinadecUI/src/components/cards/home/ApprovalCard.vue'
const cardElement = ref<HTMLElement | null>(null)
const measure = inject<(id: string, height: number) => void>('space:measure')
let sizeObserver: ResizeObserver | undefined
onMounted(() => {
  if (props.preview || !cardElement.value || !measure) return
  sizeObserver = new ResizeObserver(entries => {
    if (object.value) measure(object.value.id, entries[0].borderBoxSize[0]?.blockSize ?? cardElement.value!.offsetHeight)
  })
  sizeObserver.observe(cardElement.value)
})
onBeforeUnmount(() => sizeObserver?.disconnect())
const props = defineProps<{ object?: SpatialObject; preview?: boolean }>()
const { t, te } = useI18n()
const state = inject<Record<string, unknown>>('uie:cardState', {})
const objects = inject<ComputedRef<Record<string, SpatialObject>>>('space:objects')
const git = inject<ReturnType<typeof useSpatialGit>>('space:git')
const file = ref<string | null>(null)
const code = ref('')
const codeError = ref('')
const reading = ref(false)
let fileRead = 0
watch(() => git?.state.value.cwd, () => { fileRead++; file.value = null; code.value = ''; reading.value = false })
async function readFile(path: string) {
  const cwd = git?.state.value.cwd
  if (!cwd) return
  const read = ++fileRead
  file.value = path; code.value = ''; codeError.value = ''; reading.value = true
  try {
    const result = await api.readFile(cwd, path, { start_row: 1, end_row: 500 })
    if (read !== fileRead) return
    const data = result.data as ReadFileDataDto
    if (result.status === 'failed' || data.success === false) throw new Error(typeof result.data.error === 'string' ? result.data.error : result.summary)
    code.value = readFileText(data)
  } catch (error) { if (read === fileRead) codeError.value = error instanceof Error ? error.message : String(error) }
  finally { if (read === fileRead) reading.value = false }
}
const object = computed(() => props.object ?? objects?.value[String(state.objectId)])
const icons = { message: MessageSquare, meeting: Bot, plan: ListTodo, task: FileCode2, tool: Wrench, git: GitBranch, approval: ShieldCheck }
const completed = computed(() => object.value?.rows?.filter(r => ['completed', 'succeeded'].includes(r.status)).length ?? 0)
const status = (s?: string) => s && te('space.status.' + s) ? t('space.status.' + s) : s
</script>
<template>
  <article ref="cardElement" v-if="object" class="spatial-work-card" :data-object-id="object.id">
    <header class="space-drag-handle">
      <component :is="icons[object.kind]" :size="24" aria-hidden="true" />
      <h2>{{ object.title || t('space.kind.' + object.kind) }}</h2>
    </header>
    <div class="space-work-body nodrag nopan nowheel">
      <template v-if="object.kind === 'meeting'">
        <div v-if="object.queue?.length" class="space-meeting-queue">
          <div v-for="item in object.queue" :key="item.id" class="space-queue-row">
            <CheckCircle2 v-if="['completed', 'succeeded'].includes(item.status)" :size="16" class="space-success" /><Circle v-else :size="16" />
            <span>{{ item.content }}</span><small>{{ status(item.status) }}</small>
          </div>
        </div>
        <p v-if="object.body" class="space-work-text">{{ object.body }}</p>
      </template>
      <template v-else-if="object.kind === 'git'">
        <p v-if="!git?.state.value.cwd" class="space-muted">{{ t('space.noProject') }}</p>
        <template v-else>
          <button v-if="!preview" class="space-git-refresh" @click="git?.refresh()">{{ t('space.refresh') }}</button>
          <p v-if="git?.state.value.error" class="space-muted" role="status">{{ git.state.value.error }}</p>
          <p v-if="git?.state.value.loading" class="space-muted">{{ t('space.loading') }}</p>
          <div v-if="git?.state.value.loaded" class="space-todo-row"><GitBranch :size="20" /><div>{{ git?.state.value.preview.branch }}<small>↑ {{ git?.state.value.preview.ahead ?? 0 }} · ↓ {{ git?.state.value.preview.behind ?? 0 }}</small></div></div>
          <div v-for="commit in git?.state.value.commits.slice(0, 3)" :key="commit.hash" class="space-git-commit"><code>{{ commit.short_hash }}</code> {{ commit.subject }}</div>
          <p v-if="git?.state.value.loaded" class="space-muted">{{ t('space.filesChanged', { count: git?.state.value.preview.files?.length ?? 0 }) }}</p>
          <div v-for="item in git?.state.value.preview.files" :key="item.path" class="space-git-file">
            <span v-if="preview">{{ item.path }}</span><button v-else @click="readFile(item.path)"><FileCode2 :size="16" />{{ item.path }}</button>
          </div>
          <details v-if="file && !preview" open class="space-file-view"><summary>{{ file }} · {{ t('space.currentFile') }}</summary><p v-if="reading">{{ t('space.loading') }}</p><p v-else-if="codeError" role="status">{{ codeError }}</p><pre v-else>{{ code }}</pre></details>
        </template>
      </template>
      <ApprovalCard v-else-if="object.kind === 'approval' && !preview" compact />
      <template v-else-if="object.kind === 'approval'">
        <p v-if="!c.approvals.value.length" class="space-muted">{{ t('space.noApprovals') }}</p>
        <div v-for="a in c.approvals.value" :key="a.id" class="space-todo-row"><ShieldCheck :size="18" /><div>{{ a.summary }}<small>{{ status(a.status) }}</small></div></div>
      </template>
      <ToolCallCard v-else-if="object.tool && !preview" :tool-call="object.tool" :run-id="object.groupId" @approve="c.decideApprovalById($event, 'approved')" @reject="c.decideApprovalById($event, 'rejected')" />
      <template v-else>
        <p v-if="object.body || object.tool" class="space-work-text">{{ object.body || object.tool?.argsSummary }}</p>
        <div v-for="row in object.rows" :key="row.id" class="space-todo-row">
          <CheckCircle2 v-if="['completed', 'succeeded'].includes(row.status)" :size="20" class="space-success" /><Circle v-else :size="20" />
          <div>{{ row.title }}<small>{{ row.detail }} {{ status(row.status) }}</small></div>
        </div>
        <p v-if="!object.body && !object.tool && !object.rows?.length" class="space-muted">{{ t('space.noPlan') }}</p>
      </template>
    </div>
    <footer v-if="object.rows?.length">{{ t('space.progress', { done: completed, total: object.rows.length }) }}</footer>
    <footer v-else-if="object.status">{{ status(object.status) }}</footer>
  </article>
</template>
<style scoped>
.spatial-work-card { height: 100%; display: flex; flex-direction: column; min-width: 0; color: var(--text-primary); background: var(--surface-raised); backdrop-filter: var(--material-filter-raised, none); border-radius: 16px; overflow: hidden; }
.space-drag-handle { display: flex; align-items: center; gap: 9px; padding: 14px 18px 10px; cursor: grab; flex-shrink: 0; }
h2 { font-size: 17px; font-weight: 600; line-height: 1.25; margin: 0; overflow-wrap: anywhere; }
.space-drag-handle svg { flex-shrink: 0; }
.space-work-body { padding: 4px 18px 14px; flex: 1; min-height: 0; overflow: auto; user-select: text; }
.space-work-text { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 14px; line-height: 1.65; margin: 0 0 16px; }
.space-muted { color: var(--text-muted); line-height: 1.7; font-size: 13px; }
.space-todo-row { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 16px; font-size: 16px; }
.space-todo-row svg { flex-shrink: 0; margin-top: 2px; }
.space-todo-row small { display: block; margin-top: 7px; color: var(--text-muted); font: 12px var(--font-mono, monospace); overflow-wrap: anywhere; }
.space-success { color: var(--accent-success); }
footer { flex-shrink: 0; padding: 8px 24px 14px; font-size: 12px; color: var(--text-secondary); }
.space-git-refresh { float: right; border: 0; color: var(--text-secondary); background: transparent; cursor: pointer; }
.space-git-commit { font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; overflow-wrap: anywhere; }
.space-git-file { font-size: 13px; margin: 8px 0; overflow-wrap: anywhere; }
.space-git-file button { display: flex; text-align: left; align-items: center; gap: 8px; padding: 0; color: inherit; border: 0; background: transparent; cursor: pointer; }
.space-git-file svg { flex-shrink: 0; }
.space-file-view { margin-top: 12px; font-size: 12px; }
.space-file-view pre { font: 12px/1.6 var(--font-mono, monospace); overflow: auto; max-height: 360px; user-select: text; }
.space-meeting-queue { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
.space-queue-row { display: flex; align-items: start; gap: 8px; font-size: 13px; line-height: 1.5; }
.space-queue-row svg { flex-shrink: 0; margin-top: 2px; }
.space-queue-row span { flex: 1; min-width: 0; overflow-wrap: anywhere; white-space: pre-wrap; }
.space-queue-row small { color: var(--text-muted); white-space: nowrap; }
</style>
