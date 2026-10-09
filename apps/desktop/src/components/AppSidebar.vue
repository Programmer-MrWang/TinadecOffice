<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { selectionKey, selectionIdentity, selectedStorage } from '@/lib/storageScope'
import {
  Archive,
  ArrowRightLeft,
  Bug,
  ChevronRight,
  FolderOpen,
  MessageSquare,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Settings,
  LayoutGrid,
  Waypoints,
  Sparkles,
  Store,
  Terminal,
  Trash2,
} from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import type { ProjectDto, SessionDto } from '../api'
import BrandLogo from '@/components/BrandLogo.vue'
import TinadecCalligraphy from '@/components/TinadecCalligraphy.vue'
import InlineRenameInput from '@/components/InlineRenameInput.vue'
import RowContextMenu, { type RowMenuItem } from '@/components/RowContextMenu.vue'
import { UiButton } from '@/components/ui'
import { useNotifications } from '@/composables/useNotifications'

const { t } = useI18n()
const { confirm } = useNotifications()

const props = defineProps<{
  projects: ProjectDto[]
  sessions: SessionDto[]
  selectedProjectId: string | null
  selectedSessionId: string | null
  busy: boolean
  collapsed?: boolean
  spaceActive?: boolean
  panelStyle?: Record<string, string>
  panelDataAttrs?: Record<string, string>
}>()

const emit = defineEmits<{
  'select-project': [id: string]
  'select-session': [id: string]
  'create-session': [projectId: string | null]
  'open-project': []
  'go-settings': []
  'go-market': []
  'go-workbench': []
  'change-view': [mode: 'flat' | 'space']
  'toggle-collapse': []
  'rename-project': [id: string, name: string]
  'rename-session': [id: string, title: string]
  'archive-project': [id: string]
  'archive-session': [id: string]
  'trash-project': [id: string]
  'trash-session': [id: string]
  'migrate-session': [id: string, targetProjectKey: string]
}>()

const expandedProjects = ref<Set<string>>(new Set())
const viewMenu = ref<HTMLDivElement | null>(null)
const viewMenuStyle = ref({ left: '0px', top: '0px' })
function openViewMenu(event: MouseEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  viewMenuStyle.value = { left: `${Math.max(8, Math.min(rect.left, window.innerWidth - 210))}px`, top: `${Math.max(8, rect.top - 116)}px` }
  viewMenu.value?.togglePopover()
}
function changeView(mode: 'flat' | 'space') {
  viewMenu.value?.hidePopover()
  emit('change-view', mode)
}

// ---- Lifecycle management (context menu + inline rename) ----
interface MenuTarget {
  kind: 'project' | 'session'
  id: string
  name: string
  x: number
  y: number
}

const menuTarget = ref<MenuTarget | null>(null)
const renaming = ref<{ kind: 'project' | 'session'; id: string } | null>(null)
const migrationDialog = ref<HTMLDialogElement | null>(null)
const migrationSession = ref<MenuTarget | null>(null)
const migrationProject = ref('')
const migrationProjects = computed(() => props.projects.filter(project => project.storage_id && (project.lifecycle_status ?? 'active') === 'active'))
const migrationAllowed = computed(() => menuTarget.value?.kind === 'session' && props.sessions.some(session => selectionKey(session) === menuTarget.value?.id && !session.project_id) && migrationProjects.value.length > 0)

const menuItems = computed<RowMenuItem[]>(() => [
  { key: 'rename', label: t('sidebar.rename'), icon: Pencil },
  ...(migrationAllowed.value ? [{ key: 'migrate', label: t('sidebar.migrateSession'), icon: ArrowRightLeft }] : []),
  { key: 'archive', label: t('sidebar.archive'), icon: Archive },
  { key: 'trash', label: t('sidebar.moveToTrash'), icon: Trash2, danger: true },
])

function openMenuAtCursor(event: MouseEvent, kind: 'project' | 'session', id: string, name: string) {
  menuTarget.value = { kind, id, name, x: event.clientX, y: event.clientY }
}

function openMenuAtButton(event: MouseEvent, kind: 'project' | 'session', id: string, name: string) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  menuTarget.value = { kind, id, name, x: rect.left, y: rect.bottom + 4 }
}

function startRename(target: MenuTarget) {
  renaming.value = { kind: target.kind, id: target.id }
  if (target.kind === 'project' && !expandedProjects.value.has(target.id)) {
    const next = new Set(expandedProjects.value)
    next.add(target.id)
    expandedProjects.value = next
  }
}

function submitRename(value: string) {
  const current = renaming.value
  renaming.value = null
  if (!current) return
  if (current.kind === 'project') emit('rename-project', current.id, value)
  else emit('rename-session', current.id, value)
}

function cancelRename() {
  renaming.value = null
}

async function handleMenuSelect(key: string) {
  const target = menuTarget.value
  menuTarget.value = null
  if (!target) return
  if (key === 'rename') {
    startRename(target)
    return
  }
  if (key === 'migrate') {
    migrationSession.value = target
    migrationProject.value = migrationProjects.value[0] ? selectionKey(migrationProjects.value[0]) : ''
    await nextTick()
    migrationDialog.value?.showModal()
    return
  }
  if (key === 'archive') {
    if (target.kind === 'project') emit('archive-project', target.id)
    else emit('archive-session', target.id)
    return
  }
  if (key === 'trash') {
    const isProject = target.kind === 'project'
    const confirmed = await confirm({
      title: isProject ? t('sidebar.trashProjectConfirmTitle') : t('sidebar.trashSessionConfirmTitle'),
      message: isProject
        ? t('sidebar.trashProjectConfirmMessage', { name: target.name })
        : t('sidebar.trashSessionConfirmMessage', { name: target.name }),
      confirmLabel: t('sidebar.moveToTrash'),
      destructive: true,
    })
    if (!confirmed) return
    if (isProject) emit('trash-project', target.id)
    else emit('trash-session', target.id)
  }
}
function submitMigration() {
  if (!migrationSession.value || !migrationProject.value) return
  emit('migrate-session', migrationSession.value.id, migrationProject.value)
  migrationDialog.value?.close(); migrationSession.value = null
}

const filteredProjects = computed(() => {
  return props.projects
})

function getProjectSessions(projectKey: string): SessionDto[] {
  const { id, storageId } = selectionIdentity(projectKey)
  return props.sessions.filter((s) => (s.project_id ?? null) === id && (!storageId || s.storage_id === storageId) && s.title)
}

function isExpanded(projectId: string): boolean {
  return expandedProjects.value.has(projectId)
}

function toggleExpand(projectId: string) {
  const next = new Set(expandedProjects.value)
  if (next.has(projectId)) {
    next.delete(projectId)
  } else {
    next.add(projectId)
  }
  expandedProjects.value = next
}

function handleProjectClick(projectId: string) {
  toggleExpand(projectId)
  emit('select-project', projectId)
}

function handleSessionClick(sessionId: string) {
  emit('select-session', sessionId)
}

function handleNewSession(projectId: string) {
  emit('create-session', projectId)
}

function handleNewThread() {
  emit('create-session', props.selectedProjectId ?? props.projects[0]?.id ?? null)
}

// Sessions not bound to any project (Codex-style free conversations). The title is
// not a filter: a newly created conversation still carries the default
// 'Tinadec session' title until its first message generates one, so hiding that
// title made every fresh free conversation invisible.
const freeSessions = computed(() =>
  props.sessions.filter((s) => !s.project_id && s.title)
)

const tokenUsage = ref<number[]>([])

function openDebugStudio() {
  ;(window as unknown as { tinadec?: { openDebugStudio?: () => Promise<boolean> } }).tinadec?.openDebugStudio?.()
}
</script>

<template>
  <aside class="sidebar" :class="{ 'sidebar-collapsed': collapsed }" :style="panelStyle" v-bind="panelDataAttrs">
    <div class="sidebar-topbar">
      <div class="brand">
        <BrandLogo :size="14" class="sidebar-icon brand-logo-icon" />
        <TinadecCalligraphy :size="14" class="sidebar-label brand-calligraphy" />
      </div>
    </div>

    <nav class="sidebar-nav">
      <UiButton
        variant="ghost"
        size="sm"
        class="sidebar-nav-item w-full justify-start"
        :disabled="busy"
        :title="t('sidebar.newChat')"
        @click="handleNewThread"
      >
        <MessageSquare :size="16" class="sidebar-icon" />
        <span class="sidebar-label">{{ t('sidebar.newChat') }}</span>
      </UiButton>
      <UiButton
        variant="ghost"
        size="sm"
        class="sidebar-nav-item w-full justify-start"
        :title="t('sidebar.market')"
        @click="emit('go-market')"
      >
        <Store :size="16" class="sidebar-icon" />
        <span class="sidebar-label">{{ t('sidebar.market') }}</span>
      </UiButton>
      <UiButton
        variant="ghost"
        size="sm"
        class="sidebar-nav-item w-full justify-start"
        :title="t('sidebar.commandCenter')"
        @click="emit('go-workbench')"
      >
        <Terminal :size="16" class="sidebar-icon" />
        <span class="sidebar-label">{{ t('sidebar.commandCenter') }}</span>
      </UiButton>
      <UiButton
        variant="ghost"
        size="sm"
        class="sidebar-nav-item w-full justify-start"
        title="Debug Studio"
        @click="openDebugStudio()"
      >
        <Bug :size="16" class="sidebar-icon" />
        <span class="sidebar-label">Debug Studio</span>
      </UiButton>
    </nav>

    <div class="sidebar-list">
      <div v-if="freeSessions.length > 0" class="project-group free-conversation-group">
        <div class="project-row">
          <div class="project-row-main free-conversation-header">
            <Sparkles :size="14" class="sidebar-list-item-icon sidebar-icon" />
            <span class="sidebar-list-item-text sidebar-label">{{ t('sidebar.freeConversations') }}</span>
          </div>
        </div>
        <div class="project-sessions sidebar-extra">
          <div
            v-for="session in freeSessions"
            :key="selectionKey(session)"
            class="session-row"
            :class="{ active: session.id === selectedSessionId && (!session.storage_id || session.storage_id === selectedStorage) }"
            @contextmenu.prevent="openMenuAtCursor($event, 'session', selectionKey(session), session.title)"
          >
            <button
              class="session-item"
              @click="handleSessionClick(selectionKey(session))"
              @dblclick.stop="renaming = { kind: 'session', id: selectionKey(session) }"
            >
              <span class="session-dot" :class="session.status" />
              <InlineRenameInput
                v-if="renaming?.kind === 'session' && renaming.id === selectionKey(session)"
                :model-value="session.title"
                class="session-title"
                @submit="submitRename"
                @cancel="cancelRename"
              />
              <span v-else class="session-title">{{ session.title }}</span>
            </button>
            <button
              class="session-more"
              :title="t('sidebar.moreActions')"
              @click.stop="openMenuAtButton($event, 'session', selectionKey(session), session.title)"
            >
              <MoreHorizontal :size="13" />
            </button>
          </div>
        </div>
      </div>

      <div
        v-for="project in filteredProjects"
        :key="selectionKey(project)"
        class="project-group"
      >
        <div
          class="project-row"
          :class="{ active: project.id === selectedProjectId && (!project.storage_id || project.storage_id === selectedStorage) }"
          @contextmenu.prevent="openMenuAtCursor($event, 'project', selectionKey(project), project.name)"
        >
          <button
            class="project-row-main"
            :aria-current="project.id === selectedProjectId && (!project.storage_id || project.storage_id === selectedStorage) ? 'location' : undefined"
            :title="project.name"
            @click="handleProjectClick(selectionKey(project))"
            @dblclick.stop="renaming = { kind: 'project', id: selectionKey(project) }"
          >
            <ChevronRight
              :size="14"
              class="project-chevron sidebar-extra"
              :class="{ expanded: isExpanded(selectionKey(project)) }"
            />
            <FolderOpen :size="14" class="sidebar-list-item-icon sidebar-icon" />
            <InlineRenameInput
              v-if="renaming?.kind === 'project' && renaming.id === selectionKey(project)"
              :model-value="project.name"
              class="sidebar-list-item-text"
              @submit="submitRename"
              @cancel="cancelRename"
            />
            <span v-else class="sidebar-list-item-text sidebar-label">{{ project.name }}</span>
          </button>
          <button
            class="project-row-action sidebar-extra"
            :title="t('sidebar.moreActions')"
            @click.stop="openMenuAtButton($event, 'project', selectionKey(project), project.name)"
          >
            <MoreHorizontal :size="14" />
          </button>
          <button
            class="project-row-action sidebar-extra"
            :title="t('sidebar.newChat')"
            @click.stop="handleNewSession(selectionKey(project))"
          >
            <Plus :size="14" />
          </button>
        </div>

        <div v-if="isExpanded(selectionKey(project))" class="project-sessions sidebar-extra">
          <div
            v-for="session in getProjectSessions(selectionKey(project))"
            :key="selectionKey(session)"
            class="session-row"
            :class="{ active: session.id === selectedSessionId && (!session.storage_id || session.storage_id === selectedStorage) }"
            @contextmenu.prevent="openMenuAtCursor($event, 'session', selectionKey(session), session.title)"
          >
            <button
              class="session-item"
              :aria-current="session.id === selectedSessionId && (!session.storage_id || session.storage_id === selectedStorage) ? 'page' : undefined"
              @click="handleSessionClick(selectionKey(session))"
              @dblclick.stop="renaming = { kind: 'session', id: selectionKey(session) }"
            >
              <span class="session-dot" :class="session.status" />
              <InlineRenameInput
                v-if="renaming?.kind === 'session' && renaming.id === selectionKey(session)"
                :model-value="session.title"
                class="session-title"
                @submit="submitRename"
                @cancel="cancelRename"
              />
              <span v-else class="session-title">{{ session.title }}</span>
            </button>
            <button
              class="session-more"
              :title="t('sidebar.moreActions')"
              @click.stop="openMenuAtButton($event, 'session', selectionKey(session), session.title)"
            >
              <MoreHorizontal :size="13" />
            </button>
          </div>
          <div v-if="getProjectSessions(selectionKey(project)).length === 0" class="session-empty">
            {{ t('sidebar.noSessions') }}
          </div>
        </div>
      </div>

      <div v-if="filteredProjects.length === 0" class="sidebar-empty">
        <span class="sidebar-label">{{ t('sidebar.noResults') }}</span>
      </div>
    </div>

    <div v-if="tokenUsage.length > 0" class="token-usage-area">
      <div class="token-usage-chart">
        <div
          v-for="(height, index) in tokenUsage"
          :key="index"
          class="token-usage-bar"
          :style="{ height: `${height}%` }"
          :class="{
            'low': height < 40,
            'medium': height >= 40 && height < 70,
            'high': height >= 70
          }"
        />
      </div>
    </div>

    <div class="sidebar-footer">
      <div class="sidebar-footer-actions" :class="{ 'sidebar-footer-actions-collapsed': collapsed }">
        <UiButton
          variant="ghost"
          size="icon"
          class="sidebar-footer-action"
          :title="t('space.switchView')"
          :aria-label="t('space.switchView')"
          aria-haspopup="dialog"
          @click="openViewMenu"
        >
          <Waypoints v-if="spaceActive" :size="16" /><LayoutGrid v-else :size="16" />
        </UiButton>
        <UiButton
          variant="ghost"
          size="icon"
          class="sidebar-footer-action"
          :title="t('sidebar.settings')"
          @click="emit('go-settings')"
        >
          <Settings :size="16" />
        </UiButton>
        <UiButton
          variant="ghost"
          size="icon"
          class="sidebar-footer-action"
          :title="collapsed ? '展开侧边栏' : '折叠侧边栏'"
          @click="emit('toggle-collapse')"
        >
          <component :is="collapsed ? PanelLeftOpen : PanelLeftClose" :size="16" />
        </UiButton>
      </div>
    </div>

    <RowContextMenu
      :visible="menuTarget !== null"
      :x="menuTarget?.x ?? 0"
      :y="menuTarget?.y ?? 0"
      :items="menuItems"
      @select="handleMenuSelect"
      @close="menuTarget = null"
    />
    <div ref="viewMenu" popover class="sidebar-view-menu" :style="viewMenuStyle" role="dialog" :aria-label="t('space.switchView')">
      <button :aria-pressed="!spaceActive" @click="changeView('flat')"><LayoutGrid :size="18" />{{ t('space.flat') }}</button>
      <button :aria-pressed="!!spaceActive" @click="changeView('space')"><Waypoints :size="18" />{{ t('space.title') }}</button>
    </div>
    <dialog ref="migrationDialog" class="sidebar-migration-dialog" aria-labelledby="migration-title" @close="migrationSession = null">
      <form @submit.prevent="submitMigration">
        <h2 id="migration-title">{{ t('sidebar.migrateSession') }}</h2>
        <p>{{ migrationSession?.name }}</p>
        <label>{{ t('sidebar.migrationTarget') }}<select v-model="migrationProject" class="settings-select" autofocus><option v-for="project in migrationProjects" :key="selectionKey(project)" :value="selectionKey(project)">{{ project.name }} · {{ project.path }}</option></select></label>
        <p class="quiet">{{ t('sidebar.migrationExplanation') }}</p>
        <div><UiButton type="button" variant="ghost" @click="migrationDialog?.close()">{{ t('common.cancel') }}</UiButton><UiButton type="submit" :disabled="!migrationProject || busy">{{ t('sidebar.migrateSession') }}</UiButton></div>
      </form>
    </dialog>
  </aside>
</template>

<style scoped>
.sidebar-view-menu { position: fixed; inset: auto; margin: 0; width: 200px; padding: 6px; border: 1px solid var(--border-muted); border-radius: 12px; background: var(--surface-raised); color: var(--text-primary); box-shadow: var(--shadow-card-subtle); }
.sidebar-view-menu button { display: flex; align-items: center; gap: 10px; width: 100%; padding: 12px; border: 0; border-radius: 8px; background: transparent; color: inherit; cursor: pointer; }
.sidebar-view-menu button:hover, .sidebar-view-menu button[aria-pressed="true"] { background: var(--surface-selected); }
.sidebar-migration-dialog { width: min(560px, calc(100vw - 32px)); border: 1px solid var(--border-muted); border-radius: 12px; padding: 24px; background: var(--surface-raised); color: var(--text-primary); box-shadow: var(--shadow-card-subtle); }
.sidebar-migration-dialog::backdrop { background: color-mix(in srgb, var(--bg-overlay) 65%, transparent); }
.sidebar-migration-dialog form, .sidebar-migration-dialog label { display: grid; gap: 12px; }
.sidebar-migration-dialog form > div { display: flex; justify-content: flex-end; gap: 12px; }
.sidebar-migration-dialog h2 { font-size: 18px; margin: 0; }
.sidebar-migration-dialog select:focus-visible { outline: 2px solid var(--accent-primary); outline-offset: 2px; }
</style>
