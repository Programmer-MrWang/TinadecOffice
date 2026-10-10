<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArchiveRestore, FolderOpen, MessageSquare, Trash2 } from '@lucide/vue'
import { generatedApi, type ProjectDto } from '@/generated/client'
import type { SessionDto } from '@/api'
import { UiButton } from '@/components/ui'
import { useNotifications } from '@/composables/useNotifications'
import { selectionKey } from '@/lib/storageScope'
import { loadSessionCatalog } from '@/lib/sessionRoster'
import { toErrorState } from '@/composables/useErrorState'
import { useHostAccess } from '@/lib/hostAccess'

const { t } = useI18n()
const { confirm, notify } = useNotifications()

const { canAccessBackend, reason: hostReason } = useHostAccess()
const loading = ref(false)
const loadErrors = ref<string[]>([])
let generation = 0
let controller: AbortController | null = null
const archivedProjects = ref<ProjectDto[]>([])
const archivedSessions = ref<SessionDto[]>([])
const trashedProjects = ref<ProjectDto[]>([])
const trashedSessions = ref<SessionDto[]>([])
const projectNames = ref<Map<string, string>>(new Map())

async function load() {
  if (!canAccessBackend.value) return
  const read = ++generation
  controller?.abort()
  const request = new AbortController(); controller = request
  loading.value = true; loadErrors.value = []
  const report = (error: unknown) => {
    if (read !== generation || request.signal.aborted) return
    const failure = toErrorState(error, t('settings.loadArchiveFailed'))
    loadErrors.value.push([failure.message, failure.details, failure.traceId ? 'trace_id: ' + failure.traceId : ''].filter(Boolean).join('\n'))
  }
  const lists = [activeProjects, archivedProjects, trashedProjects]
  try {
    await Promise.allSettled([
      ...(['active', 'archived', 'trashed'] as const).map((lifecycle, index) => generatedApi.listProjects(lifecycle, { signal: request.signal }).then(rows => {
        if (read === generation && !request.signal.aborted) lists[index]!.value = rows
      }).catch(report)),
      ...(['archived', 'trashed'] as const).map(lifecycle => {
        const target = lifecycle === 'archived' ? archivedSessions : trashedSessions
        return loadSessionCatalog({ lifecycleStatus: lifecycle, previous: target.value, signal: request.signal }).then(result => {
          if (read !== generation || request.signal.aborted) return
          target.value = result.rows
          for (const failure of result.failures) loadErrors.value.push(failure.source.storageId + ': ' + failure.error.message + (failure.error.traceId ? ' · trace_id: ' + failure.error.traceId : ''))
        }).catch(report)
      }),
    ])
    if (read !== generation || request.signal.aborted) return
    const names = new Map<string, string>()
    for (const project of [...activeProjects.value, ...archivedProjects.value, ...trashedProjects.value]) names.set(selectionKey({ ...project, storage_id: project.storage_id ?? 'user' }), project.name)
    projectNames.value = names
  } finally { if (read === generation) loading.value = false }
}
const activeProjects = ref<ProjectDto[]>([])
watch(canAccessBackend, ready => {
  if (ready) void load()
  else { ++generation; controller?.abort(); loading.value = false }
})
onMounted(() => { void load() })
onBeforeUnmount(() => { ++generation; controller?.abort() })

const archivedEmpty = computed(() => archivedProjects.value.length === 0 && archivedSessions.value.length === 0)
const trashEmpty = computed(() => trashedProjects.value.length === 0 && trashedSessions.value.length === 0)

function projectNameOf(session: SessionDto): string {
  if (!session.project_id) return t('sidebar.freeConversations')
  return projectNames.value.get(selectionKey({ id: session.project_id, storage_id: session.storage_id })) ?? session.project_id
}

async function restoreProject(project: ProjectDto) {
  try {
    await generatedApi.restoreProject(selectionKey(project))
    await load()
  } catch (err) {
    notify.error(err, { title: t('settings.loadArchiveFailed') })
  }
}

async function restoreSession(session: SessionDto) {
  try {
    await generatedApi.restoreSession(selectionKey(session))
    await load()
  } catch (err) {
    notify.error(err, { title: t('settings.loadArchiveFailed') })
  }
}

async function purgeProject(project: ProjectDto) {
  const ok = await confirm({
    title: t('settings.purgeConfirmTitle'),
    message: t('settings.purgeProjectConfirmMessage', { name: project.name }),
    confirmLabel: t('settings.deletePermanently'),
    destructive: true,
  })
  if (!ok) return
  try {
    await generatedApi.purgeProject(selectionKey(project))
    await load()
  } catch (err) {
    notify.error(err, { title: t('settings.deletePermanently') })
  }
}

async function purgeSession(session: SessionDto) {
  const ok = await confirm({
    title: t('settings.purgeConfirmTitle'),
    message: t('settings.purgeSessionConfirmMessage', { name: session.title || session.id }),
    confirmLabel: t('settings.deletePermanently'),
    destructive: true,
  })
  if (!ok) return
  try {
    await generatedApi.purgeSession(selectionKey(session))
    await load()
  } catch (err) {
    notify.error(err, { title: t('settings.deletePermanently') })
  }
}
</script>

<template>
  <div class="archive-trash-section">
    <h2>{{ t('settings.archiveTrash') }}</h2>
    <p class="archive-trash-subtitle">{{ t('settings.archiveTrashSubtitle') }}</p>

    <p v-if="!canAccessBackend" role="status">{{ hostReason }}</p>
    <p v-if="loading" role="status">{{ t('common.loading') }}</p>
    <div v-if="loadErrors.length" role="alert" class="archive-trash-failures"><p v-for="(error, index) in loadErrors" :key="index">{{ error }}</p><UiButton variant="outline" size="sm" :disabled="loading || !canAccessBackend" @click="load">{{ t('settings.retry') }}</UiButton></div>
    <section class="archive-trash-group">
      <h3><ArchiveRestore :size="14" /> {{ t('settings.archivedGroup') }}</h3>
      <p v-if="!loading && !loadErrors.length && archivedEmpty" class="archive-trash-empty">{{ t('settings.emptyArchived') }}</p>
      <template v-else>
        <div v-if="archivedProjects.length" class="archive-trash-list-label">{{ t('settings.projectsGroup') }}</div>
        <div
          v-for="project in archivedProjects"
          :key="selectionKey(project)"
          class="archive-trash-row"
          data-testid="archived-project-row"
        >
          <FolderOpen :size="14" class="archive-trash-row-icon" />
          <span class="archive-trash-row-title">{{ project.name }}</span>
          <UiButton variant="outline" size="sm" :disabled="!canAccessBackend || loading" @click="restoreProject(project)">{{ t('settings.restore') }}</UiButton>
        </div>
        <div v-if="archivedSessions.length" class="archive-trash-list-label">{{ t('settings.sessionsGroup') }}</div>
        <div
          v-for="session in archivedSessions"
          :key="selectionKey(session)"
          class="archive-trash-row"
          data-testid="archived-session-row"
        >
          <MessageSquare :size="14" class="archive-trash-row-icon" />
          <span class="archive-trash-row-title">
            {{ session.title }}
            <span class="archive-trash-row-meta">{{ t('settings.sessionInProject', { name: projectNameOf(session) }) }}</span>
          </span>
          <UiButton variant="outline" size="sm" :disabled="!canAccessBackend || loading" @click="restoreSession(session)">{{ t('settings.restore') }}</UiButton>
        </div>
      </template>
    </section>

    <section class="archive-trash-group">
      <h3><Trash2 :size="14" /> {{ t('settings.trashGroup') }}</h3>
      <p v-if="!loading && !loadErrors.length && trashEmpty" class="archive-trash-empty">{{ t('settings.emptyTrash') }}</p>
      <template v-else>
        <div v-if="trashedProjects.length" class="archive-trash-list-label">{{ t('settings.projectsGroup') }}</div>
        <div
          v-for="project in trashedProjects"
          :key="selectionKey(project)"
          class="archive-trash-row"
          data-testid="trashed-project-row"
        >
          <FolderOpen :size="14" class="archive-trash-row-icon" />
          <span class="archive-trash-row-title">{{ project.name }}</span>
          <UiButton variant="outline" size="sm" :disabled="!canAccessBackend || loading" @click="restoreProject(project)">{{ t('settings.restore') }}</UiButton>
          <UiButton variant="destructive" size="sm" :disabled="!canAccessBackend || loading" @click="purgeProject(project)">{{ t('settings.deletePermanently') }}</UiButton>
        </div>
        <div v-if="trashedSessions.length" class="archive-trash-list-label">{{ t('settings.sessionsGroup') }}</div>
        <div
          v-for="session in trashedSessions"
          :key="selectionKey(session)"
          class="archive-trash-row"
          data-testid="trashed-session-row"
        >
          <MessageSquare :size="14" class="archive-trash-row-icon" />
          <span class="archive-trash-row-title">
            {{ session.title }}
            <span class="archive-trash-row-meta">{{ t('settings.sessionInProject', { name: projectNameOf(session) }) }}</span>
          </span>
          <UiButton variant="outline" size="sm" :disabled="!canAccessBackend || loading" @click="restoreSession(session)">{{ t('settings.restore') }}</UiButton>
          <UiButton variant="destructive" size="sm" :disabled="!canAccessBackend || loading" @click="purgeSession(session)">{{ t('settings.deletePermanently') }}</UiButton>
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.archive-trash-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.archive-trash-subtitle {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}

.archive-trash-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border-radius: 10px;
  background: var(--surface-section, var(--surface-raised));
}

.archive-trash-group h3 {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 13px;
  color: var(--text-primary);
}

.archive-trash-empty {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}

.archive-trash-list-label {
  margin-top: 6px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}

.archive-trash-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 8px;
  background: var(--surface-chrome, transparent);
}

.archive-trash-row-icon {
  flex: none;
  color: var(--text-muted);
}

.archive-trash-row-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--text-primary);
}

.archive-trash-row-meta {
  margin-left: 8px;
  font-size: 11px;
  color: var(--text-muted);
}
</style>
