<script setup lang="ts">
import { Search } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { homeController } from '@/controllers/HomeController'
import { closePalette, useCommandPalette } from '@/composables/useCommandPalette'
import {
  availableCommands,
  implicitArgument,
  type AppCommand,
  type CommandHost,
} from '@/lib/appCommands'
import {
  requestConversation,
  requestModelProvider,
  requestSettingsSection,
} from '@/lib/pageRequests'
import {
  refreshSpotlight,
  searchSpotlight,
  spotlightKindLabel,
  type SpotlightGroup,
  type SpotlightHost,
  type SpotlightItem,
} from '@/lib/spotlight'

const { t } = useI18n()
const router = useRouter()
const { open, comboLabel, seededQuery } = useCommandPalette()

const query = ref('')
const activeIndex = ref(0)
const groups = ref<SpotlightGroup[]>([])
const searching = ref(false)
const dialogRef = ref<HTMLDialogElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)
const listId = 'command-palette-list'

/**
 * The palette's half of `CommandHost`. It owns none of the composer's local state, so
 * it reads what the controller holds and does its own navigation - which is the whole
 * reason the command table takes a host instead of calling into a component.
 */
const commandHost: CommandHost = {
  canStop: () => Boolean(homeController.stoppableRunId.value),
  draft: () => homeController.draft.value,
  setDraft: (value) => homeController.updateDraft(value),
  send: (text, dispatch) => {
    homeController.updateDraft(text)
    void homeController.sendMessage({
      dispatch_mode: dispatch,
      target_run_id: null,
      mode_version_id: null,
      meeting_model_override: null,
    })
  },
  stopRun: () => {
    void homeController.stopRun()
  },
  newSession: () => {
    void homeController.createSession(homeController.selectedProjectId.value ?? null)
  },
  navigate: (routeName) => {
    void router.push({ name: routeName })
  },
  routeName: () => String(router.currentRoute.value.name ?? ''),
}

function runCommand(command: AppCommand) {
  const argument = implicitArgument(command, commandHost)
  closePalette()
  // Closed before running: a navigation command replaces the page underneath, and a
  // send clears the draft the row was about to read, so the list is stale either way.
  command.run(commandHost, argument)
}

/** Commands as spotlight items, so one list and one keyboard path covers every kind. */
const commandItems = computed<SpotlightItem[]>(() =>
  availableCommands(commandHost).map((command) => ({
    id: command.id,
    kind: 'command' as const,
    label: t(command.labelKey),
    detail: command.slash ? `/${command.slash}` : undefined,
    keywords: (command.keywordKeys ?? []).map((key) => t(key)).join(' '),
    action: () => runCommand(command),
  })),
)

const spotlightHost: SpotlightHost = {
  navigate: (routeName) => void router.push({ name: routeName }),
  navigateSettings: (section) => {
    requestSettingsSection(section)
    if (router.currentRoute.value.name !== 'settings') void router.push({ name: 'settings' })
  },
  openSession: (sessionId) => {
    requestConversation(sessionId)
    if (router.currentRoute.value.name !== 'home') void router.push({ name: 'home' })
  },
  selectProvider: (providerId) => {
    requestModelProvider(providerId)
    if (router.currentRoute.value.name !== 'settings') void router.push({ name: 'settings' })
  },
  openWorkspacePath: () => {
    // The code workspace mounts when its page does; drop the user on it with the
    // path selected by the page's own request channel.
    if (router.currentRoute.value.name !== 'code-editor') void router.push({ name: 'code-editor' })
  },
  loadedSessions: () => homeController.sessions.value,
  workspaceRoot: () => homeController.currentProject.value?.path ?? '',
}

/** Flat rows across every group, in render order: the keyboard cursor walks this list. */
const rows = computed(() => groups.value.flatMap((group) => group.items))

const activeId = computed(() =>
  rows.value.length ? `command-palette-option-${activeIndex.value}` : undefined,
)

// A keystroke re-runs the search; the workspace leg is debounced inside the same
// token so a cancelled query never lands after a newer one.
let searchToken = 0
let searchTimer: ReturnType<typeof setTimeout> | null = null

async function runSearch() {
  const token = ++searchToken
  searching.value = Boolean(query.value.trim())
  const result = await searchSpotlight(query.value, spotlightHost, (key) => t(key), commandItems.value)
  if (token !== searchToken) return
  groups.value = result
  searching.value = false
}

watch(query, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => void runSearch(), 180)
})

// Availability depends on live composer/run state. Rebuild the open list when
// that state changes so a newly stoppable run exposes Stop/Queue immediately.
watch(commandItems, () => {
  if (open.value) void runSearch()
})

watch(rows, (list) => {
  if (activeIndex.value >= list.length) activeIndex.value = Math.max(0, list.length - 1)
})

watch(open, async (isOpen) => {
  const element = dialogRef.value
  if (!element) return
  if (!isOpen) {
    if (element.open) element.close()
    return
  }
  query.value = seededQuery.value
  activeIndex.value = 0
  refreshSpotlight()
  element.showModal()
  await nextTick()
  inputRef.value?.focus()
  void runSearch()
})

// The list scrolls, so the highlighted row has to stay inside it: a cursor that has
// scrolled out of view reads as a keyboard that stopped working.
watch(activeIndex, () => {
  if (!activeId.value) return
  document.getElementById(activeId.value)?.scrollIntoView({ block: 'nearest' })
})

function move(delta: number) {
  const count = rows.value.length
  if (!count) return
  activeIndex.value = (activeIndex.value + delta + count) % count
}

/** Where a flat cursor index lands, for group-header rendering in the template. */
function rowIndex(groupIndex: number, itemIndex: number): number {
  let at = 0
  for (let g = 0; g < groupIndex; g += 1) at += groups.value[g]!.items.length
  return at + itemIndex
}

function run(item: SpotlightItem) {
  closePalette()
  // Every row owns one action. Commands use the same path as conversations,
  // settings and resources so click and Enter cannot silently diverge.
  item.action()
}

function onBackdropClick(event: MouseEvent) {
  // A native dialog has no backdrop click handler; the clicks that land on the dialog
  // element itself (not on its content) are the backdrop.
  if (event.target === dialogRef.value) closePalette()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    move(1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    move(-1)
  } else if (event.key === 'Enter') {
    const item = rows.value[activeIndex.value]
    if (!item) return
    event.preventDefault()
    run(item)
  }
}
</script>

<template>
  <!-- A native <dialog>, like the notification detail dialog: showModal() brings the
       focus trap, the top layer, the Escape handling and the caret's return home.
       Re-implementing any of those here is how a palette becomes a keyboard trap. -->
  <dialog
    ref="dialogRef"
    class="command-palette no-drag"
    :aria-label="t('palette.title')"
    @close="closePalette()"
    @click="onBackdropClick"
    @keydown="onKeydown"
  >
    <div class="command-palette-search">
      <Search :size="14" class="command-palette-search-icon" aria-hidden="true" />
      <input
        ref="inputRef"
        v-model="query"
        class="command-palette-input"
        type="text"
        role="combobox"
        :placeholder="t('palette.spotlightPlaceholder')"
        :aria-label="t('palette.title')"
        aria-expanded="true"
        aria-autocomplete="list"
        :aria-controls="listId"
        :aria-activedescendant="activeId"
        autocapitalize="off"
        autocomplete="off"
        spellcheck="false"
        data-testid="palette-input"
      />
      <kbd class="command-palette-accelerator">{{ comboLabel }}</kbd>
    </div>

    <div
      v-if="rows.length"
      :id="listId"
      class="command-palette-list"
      role="listbox"
      :aria-label="t('palette.title')"
      data-testid="palette-list"
    >
      <template v-for="(group, groupIndex) in groups" :key="group.kind">
        <p class="command-palette-kind" :data-testid="`palette-kind-${group.kind}`">
          {{ t(spotlightKindLabel(group.kind)) }}
        </p>
        <div
          v-for="(item, itemIndex) in group.items"
          :key="item.id"
          :id="`command-palette-option-${rowIndex(groupIndex, itemIndex)}`"
          class="command-palette-row"
          :class="{ 'is-active': rowIndex(groupIndex, itemIndex) === activeIndex }"
          role="option"
          :aria-selected="rowIndex(groupIndex, itemIndex) === activeIndex"
          :data-testid="`palette-row-${item.id}`"
          @mouseenter="activeIndex = rowIndex(groupIndex, itemIndex)"
          @click="run(item)"
        >
          <span class="command-palette-label">{{ item.label }}</span>
          <code v-if="item.kind === 'command' && item.detail" class="command-palette-syntax">{{ item.detail }}</code>
          <span v-else-if="item.detail" class="command-palette-detail">{{ item.detail }}</span>
        </div>
      </template>
    </div>

    <p v-else-if="searching" class="command-palette-empty" role="status" data-testid="palette-searching">
      {{ t('palette.searching') }}
    </p>
    <p v-else class="command-palette-empty" role="status" data-testid="palette-empty">
      {{ t('palette.empty') }}
    </p>

    <div class="command-palette-footer">
      <span>{{ t('palette.hintNavigate') }}</span>
      <span>{{ t('palette.hintRun') }}</span>
      <span>{{ t('palette.hintClose') }}</span>
    </div>
  </dialog>
</template>

<style scoped>
.command-palette {
  width: min(calc(100vw - 32px), 560px);
  margin: auto;
  padding: 0;
  border: 1px solid var(--border-muted);
  border-radius: 10px;
  background: var(--surface-section);
  color: var(--text-primary);
  box-shadow: var(--shadow-panel);
  backdrop-filter: blur(22px) saturate(120%);
  -webkit-backdrop-filter: blur(22px) saturate(120%);
  -webkit-app-region: no-drag;
}

.command-palette::backdrop {
  background: rgb(3 6 10 / 52%);
}

.command-palette-search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-muted);
}

.command-palette-search-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.command-palette-input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
}

.command-palette-input::placeholder {
  color: var(--text-muted);
}

.command-palette-accelerator {
  flex-shrink: 0;
  padding: 2px 6px;
  border: 1px solid var(--border-muted);
  border-radius: 5px;
  background: var(--surface-input);
  color: var(--text-secondary);
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 11px;
}

.command-palette-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin: 0;
  padding: 4px;
  max-height: 340px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.command-palette-kind {
  margin: 0;
  padding: 8px 8px 3px;
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.command-palette-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 7px 8px;
  border-radius: 6px;
  cursor: pointer;
}

.command-palette-row.is-active {
  background: var(--bg-hover);
}

.command-palette-label {
  font-size: 12px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.command-palette-syntax {
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 11px;
  color: var(--text-secondary);
}

.command-palette-detail {
  max-width: 240px;
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.command-palette-empty {
  margin: 0;
  padding: 18px 14px;
  color: var(--text-muted);
  font-size: 12px;
}

.command-palette-footer {
  display: flex;
  gap: 14px;
  padding: 8px 14px;
  border-top: 1px solid var(--border-muted);
  color: var(--text-muted);
  font-size: 11px;
}
</style>
