<script setup lang="ts">
import { recoveryActions, useErrorState } from '@/composables/useErrorState'
import { computed, nextTick, ref, watch } from 'vue'
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle, DialogDescription, DialogClose } from 'reka-ui'
import { FolderPlus, FolderOpen, Star, Trash2, X, LoaderCircle } from '@lucide/vue'
import { UiButton, UiInput } from '@/components/ui'
import { api } from '@/api'
import { basenameFromPath } from '@/format'
import { homeController as c } from '@/controllers/HomeController'
import { selectionIdentity, projectStorageId } from '@/lib/storageScope'
import { folderIdentity, workspaceIcons, workspaceColors, type WorkspaceRoot, type WorkspacePreview, type WorkspaceInput } from '@/lib/workspaces'
import { usePanelStyles } from '@/composables/usePanelStyles'

const { getPanelStyle, getPanelDataAttributes } = usePanelStyles()
const form = ref<WorkspaceInput>({ name: '', roots: [], primary_root_id: '', icon: 'folder', color: 'default' })
const nameEdited = ref(false), saving = ref(false), picking = ref(false), loading = ref(false), failure = useErrorState(), error = computed(() => failure.error.value?.message ?? ''), hash = ref('')
const existing = ref<WorkspacePreview | null>(null)
const editor = c.workspaceEditor
let read = 0
const primary = computed(() => form.value.roots.find(root => root.id === form.value.primary_root_id))
/**
 * The dialog's single read path. It is a named function so the retry/reload recovery actions
 * can honestly re-run it, instead of closing and reopening the dialog and hoping.
 */
async function loadEditor(): Promise<void> {
  const version = ++read
  const key = editor.value.projectKey
  form.value = { name: '', roots: [], primary_root_id: '', icon: 'folder', color: 'default' }
  failure.clear(); existing.value = null; hash.value = ''; nameEdited.value = false; loading.value = false
  if (!key) return
  loading.value = true
  try {
    const identity = selectionIdentity(key)
    const workspace = await api.readWorkspace(identity.storageId ?? projectStorageId(identity.id))
    if (version !== read) return
    form.value = { ...workspace, roots: workspace.roots.map(root => ({ ...root })) }; hash.value = workspace.content_hash; nameEdited.value = true
  } catch (reason) { if (version === read) failure.set(reason) }
  finally { if (version === read) loading.value = false }
}

watch(() => [editor.value.open, editor.value.projectKey] as const, async ([open]) => {
  if (!open) return
  await loadEditor()
}, { immediate: true })

/** Re-runs the dialog's read path: the retry action for a failed workspace read. */
async function reload(): Promise<void> { await loadEditor() }
/** Re-reads whatever this dialog is currently showing; used by the retry/reload recovery actions. */
function setPrimary(root: WorkspaceRoot) {
  form.value.primary_root_id = root.id
  if (!nameEdited.value) form.value.name = basenameFromPath(root.path)
}
function removeRoot(root: WorkspaceRoot) {
  if (form.value.roots.length === 1 || root.id === form.value.primary_root_id) return
  form.value.roots = form.value.roots.filter(item => item.id !== root.id)
}
async function addFolders() {
  if (picking.value || saving.value) return
  const version = read
  picking.value = true; failure.clear()
  try {
    const paths = await window.tinadec.selectWorkspaceFolders()
    if (version !== read) return
    if (!paths.length) return
    const seen = new Set(form.value.roots.map(root => folderIdentity(root.path)))
    const duplicate = paths.find(path => { const id = folderIdentity(path); if (seen.has(id)) return true; seen.add(id); return false })
    if (duplicate) throw new Error('文件夹已添加：' + duplicate)
    if (!editor.value.projectKey) {
      const previews = await Promise.all(paths.map(path => api.previewWorkspace(path)))
      if (version !== read) return
      const saved = previews.find(preview => preview.exists)
      if (saved) { existing.value = saved; return }
    }
    if (form.value.roots.length + paths.length > 32) throw new Error('最多添加 32 个源文件夹。')
    const roots = paths.map(path => ({ id: crypto.randomUUID(), path }))
    form.value.roots.push(...roots)
    if (!form.value.primary_root_id) setPrimary(roots[0]!)
  } catch (reason) { if (version === read) failure.set(reason) }
  finally { picking.value = false }
}
function close(open: boolean) { if (!saving.value) editor.value = { ...editor.value, open } }
async function submit() {
  if (saving.value || loading.value || picking.value) return
  const saved = existing.value?.workspace
  const input = saved ?? form.value
  if (!input.name.trim() || !input.roots.length || (!saved && editor.value.projectKey && !hash.value)) return
  saving.value = true; failure.clear()
  try { await c.completeWorkspace(input, editor.value.projectKey, hash.value, existing.value?.project_path) }
  catch (reason) { failure.set(reason) }
  finally { saving.value = false }
}

// The dialog shows the whole failure contract: an unreadable preview, a refused save and a
// stale ETag are three different problems with three different next steps.
const failureState = computed(() => failure.error.value)
const failureRecovery = computed(() => recoveryActions(failure.error.value, {
  // Re-running the dialog's own reads is the honest retry: it re-reads the workspace and
  // re-runs the folder picker, which are the two things that can fail in this dialog.
  retry: () => reload(),
  reload: () => reload(),
  choose_folder: () => addFolders(),
}))
</script>

<template>
  <DialogRoot :open="editor.open" @update:open="close">
    <DialogPortal>
      <DialogOverlay class="workspace-dialog-overlay" />
      <DialogContent class="workspace-dialog" :style="getPanelStyle()" v-bind="getPanelDataAttributes()" @escape-key-down="saving && $event.preventDefault()" @interact-outside="$event.preventDefault()">
        <form @submit.prevent="submit">
          <header><DialogTitle>{{ editor.projectKey ? '编辑工作区' : '新建工作区' }}</DialogTitle><DialogClose as-child><UiButton type="button" variant="ghost" size="icon" aria-label="关闭" :disabled="saving"><X :size="16" /></UiButton></DialogClose></header>
          <DialogDescription>添加已有源文件夹，在同一个工作区中管理对话与配置。</DialogDescription>
          <p v-if="loading" role="status"><LoaderCircle class="animate-spin" :size="16" />正在读取工作区…</p>
          <section v-else-if="existing?.workspace" class="workspace-existing">
            <h3>找到已有工作区</h3><strong>{{ existing.workspace.name }}</strong>
            <ul><li v-for="root in existing.workspace.roots" :key="root.id">{{ root.path }}<span v-if="root.id === existing.workspace.primary_root_id"> · 主文件夹</span></li></ul>
            <p>保存位置：{{ existing.storage_root }}</p><p>打开后保留原有配置与对话。</p>
            <UiButton type="button" variant="ghost" :disabled="saving" @click="existing = null">重新选择文件夹</UiButton>
          </section>
          <template v-else>
            <section class="workspace-source-section">
              <h3>源文件夹</h3>
              <ul v-if="form.roots.length" class="workspace-source-list">
                <li v-for="root in form.roots" :key="root.id">
                  <FolderOpen :size="16" /><div class="workspace-source-path"><strong>{{ basenameFromPath(root.path) }}</strong><span :title="root.path">{{ root.path }}</span></div>
                  <span v-if="root.id === form.primary_root_id" class="workspace-primary"><Star :size="12" />主文件夹</span>
                  <UiButton v-else type="button" size="sm" variant="ghost" :disabled="saving" @click="setPrimary(root)">设为主要</UiButton>
                  <UiButton type="button" variant="ghost" size="icon" :aria-label="`移除 ${basenameFromPath(root.path)}`" :disabled="saving || root.id === form.primary_root_id || form.roots.length === 1" :title="root.id === form.primary_root_id ? '移除前请将另一个文件夹设为主要' : '移除引用，保留文件夹'" @click="removeRoot(root)"><Trash2 :size="14" /></UiButton>
                </li>
              </ul>
              <UiButton type="button" variant="outline" class="workspace-add-folders" :disabled="saving || picking" @click="addFolders"><FolderPlus :size="18" />{{ picking ? '正在选择…' : '添加源文件夹' }}</UiButton>
            </section>
            <label class="workspace-field">工作区名称<UiInput v-model="form.name" maxlength="128" placeholder="默认使用主文件夹名称" :disabled="saving" @update:model-value="nameEdited = true" /></label>
            <fieldset class="workspace-appearance" :disabled="saving"><legend>图标</legend><button v-for="(icon, key) in workspaceIcons" :key="key" type="button" :aria-label="`图标 ${key}`" :aria-pressed="form.icon === key" @click="form.icon = key"><component :is="icon" :size="18" /></button></fieldset>
            <fieldset class="workspace-appearance" :disabled="saving"><legend>颜色</legend><button v-for="color in workspaceColors" :key="color" type="button" :aria-label="`颜色 ${color}`" :aria-pressed="form.color === color" @click="form.color = color"><span class="workspace-color-swatch" :class="`workspace-color-${color}`" /></button></fieldset>
            <p class="workspace-storage-note">{{ editor.projectKey ? '更换主文件夹保留当前数据保存位置；已有运行与终端保持原绑定。' : `确认创建后，在${primary ? ' ' + primary.path + '/.tinadec' : '主文件夹的 .tinadec'} 保存工作区数据。` }}</p>
          </template>
          <div v-if="failureState" role="alert" class="workspace-error">
            <p>{{ failureState.message }}</p>
            <p v-if="failureState.traceId" class="workspace-error-trace">trace_id: {{ failureState.traceId }}</p>
            <div v-if="failureRecovery.length" class="workspace-error-actions">
              <UiButton v-for="action in failureRecovery" :key="action.kind" variant="outline" size="sm" @click="action.run()">{{ action.label }}</UiButton>
            </div>
          </div>
          <footer><UiButton type="button" variant="ghost" :disabled="saving" @click="close(false)">取消</UiButton><UiButton type="submit" :disabled="saving || loading || picking || (!existing?.workspace && (!form.name.trim() || !form.roots.length || (!!editor.projectKey && !hash)))"><LoaderCircle v-if="saving" :size="16" class="animate-spin" />{{ existing ? '打开已有工作区' : editor.projectKey ? '保存' : '创建工作区' }}</UiButton></footer>
        </form>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
.workspace-dialog-overlay { position: fixed; inset: 0; z-index: 100; background: color-mix(in srgb, var(--bg-overlay) 65%, transparent); backdrop-filter: blur(8px); }
.workspace-dialog { position: fixed; z-index: 101; top: 50%; left: 50%; transform: translate(-50%, -50%); width: min(640px, calc(100vw - 32px)); max-height: calc(100vh - 48px); overflow: auto; border: 1px solid var(--border-muted); border-radius: var(--radius-lg); background: var(--surface-raised); color: var(--text-primary); padding: 24px; box-shadow: var(--shadow-card-subtle); }
form { display: grid; gap: 16px; } header, footer { display: flex; justify-content: space-between; align-items: center; gap: 8px; } header { font-size: 18px; font-weight: 600; } footer { justify-content: flex-end; } h3 { font-size: 13px; font-weight: 600; margin: 0 0 10px; } p { margin: 0; font-size: 12px; color: var(--text-muted); }
.workspace-field { display: grid; gap: 8px; font-size: 13px; } .workspace-source-list { list-style: none; padding: 0; margin: 0 0 12px; display: grid; gap: 8px; } .workspace-source-list li { display: flex; align-items: center; gap: 8px; padding: 8px; border-radius: var(--radius-md); background: var(--surface-section); }
.workspace-source-path { flex: 1; min-width: 0; display: grid; gap: 4px; font-size: 12px; } .workspace-source-path span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-muted); } .workspace-primary { display: flex; gap: 4px; align-items: center; font-size: 11px; color: var(--text-muted); white-space: nowrap; }
.workspace-add-folders { width: 100%; min-height: 64px; } .workspace-appearance { border: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; } legend { font-size: 13px; margin-bottom: 8px; } .workspace-appearance button { display: grid; place-items: center; width: 32px; height: 32px; border: 1px solid transparent; border-radius: var(--radius-sm); background: var(--surface-section); color: var(--text-secondary); cursor: pointer; }
.workspace-appearance button:hover { background: var(--surface-hover); } .workspace-appearance button[aria-pressed="true"] { border-color: var(--accent-primary); background: var(--surface-selected); } .workspace-appearance button:focus-visible { outline: 2px solid var(--accent-primary); outline-offset: 2px; } .workspace-color-swatch { width: 16px; height: 16px; border-radius: 50%; background: currentColor; }
.workspace-existing { display: grid; gap: 8px; } .workspace-existing li, .workspace-existing p, .workspace-error { overflow-wrap: anywhere; } .workspace-error { color: var(--text-error); }
</style>
