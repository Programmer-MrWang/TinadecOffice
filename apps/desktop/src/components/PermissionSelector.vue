<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, useId } from 'vue'
import { ChevronDown, Eye, Shield, ShieldAlert, ShieldCheck, UserCheck, Users } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { usePanelStyles } from '@/composables/usePanelStyles'
import type { PermissionLevel } from '@/types/mode'
import { computeDropdownPlacement } from '@/lib/dropdownPlacement'

const { t } = useI18n()
const { getPanelStyle, getPanelDataAttributes } = usePanelStyles()
const panelStyle = computed(() => getPanelStyle())
const panelDataAttrs = computed(() => getPanelDataAttributes())

interface PermissionOption {
  key: PermissionLevel
  label: string
  icon: any
  /** What the level hands away, shown on hover. */
  hint?: string
}

const permissions = computed<PermissionOption[]>(() => [
  { key: 'default', label: t('permission.default'), icon: Shield, hint: t('permission.defaultHint') },
  { key: 'auto-approve', label: t('permission.autoApprove'), icon: ShieldCheck, hint: t('permission.autoApproveHint') },
  { key: 'full-access', label: t('permission.fullAccess'), icon: ShieldAlert, hint: t('permission.fullAccessHint') },
  { key: 'delegate-conversation', label: t('permission.delegateConversation'), icon: UserCheck, hint: t('permission.delegateConversationHint') },
  { key: 'delegate-reviewer', label: t('permission.delegateReviewer'), icon: Eye, hint: t('permission.delegateReviewerHint') },
  { key: 'delegate-both', label: t('permission.delegateBoth'), icon: Users, hint: t('permission.delegateBothHint') },
])

const props = defineProps<{
  modelValue: PermissionLevel
}>()

const emit = defineEmits<{
  'update:modelValue': [value: PermissionLevel]
}>()

const showDropdown = ref(false)
const triggerRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const menuId = useId()
const dropdownStyle = ref<Record<string, string>>({})

const currentPermission = computed(() => permissions.value.find(p => p.key === props.modelValue) ?? permissions.value[0])

function updateDropdownPosition() {
  const trigger = triggerRef.value
  if (!trigger) return
  const rect = trigger.getBoundingClientRect()
  dropdownStyle.value = { ...computeDropdownPlacement(rect, window.innerWidth, window.innerHeight,
    { minWidth: Math.min(320, window.innerWidth - 16), estimatedHeight: 440, maxHeightCap: 480 }), maxWidth: 'calc(100vw - 16px)' }
}

async function toggleDropdown() {
  showDropdown.value = !showDropdown.value
  if (showDropdown.value) {
    await nextTick()
    updateDropdownPosition()
    const items = dropdownRef.value?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')
    items?.[Math.max(0, permissions.value.findIndex(item => item.key === props.modelValue))]?.focus()
  }
}

function selectPermission(key: PermissionLevel) {
  emit('update:modelValue', key)
  showDropdown.value = false
  triggerRef.value?.focus()
}

function handleClickOutside(event: MouseEvent) {
  const target = event.target as Node
  if (!triggerRef.value?.contains(target) && !dropdownRef.value?.contains(target)) {
    showDropdown.value = false
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (!showDropdown.value) return
  if (event.key === 'Escape') { event.preventDefault(); showDropdown.value = false; triggerRef.value?.focus(); return }
  if (event.key === 'Tab') { showDropdown.value = false; return }
  const items = [...(dropdownRef.value?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])]
  const index = items.indexOf(document.activeElement as HTMLButtonElement)
  if (index < 0 || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
  items[next]?.focus()
}

function openFromKeyboard(event: KeyboardEvent) {
  if (!showDropdown.value && ['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); void toggleDropdown() }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', updateDropdownPosition)
})
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', updateDropdownPosition)
})
</script>

<template>
  <div class="permission-selector">
    <button
      ref="triggerRef"
      class="permission-selector-trigger"
      type="button"
      aria-haspopup="menu"
      :aria-expanded="showDropdown"
      :aria-controls="menuId"
      :aria-label="`${t('permission.selectLabel')}: ${currentPermission.label}`"
      :title="t('permission.nextRunHint')"
      @keydown="openFromKeyboard"
      @click="toggleDropdown"
    >
      <component :is="currentPermission.icon" :size="14" />
      <span class="permission-selector-label">{{ currentPermission.label }}</span>
      <ChevronDown :size="12" class="permission-selector-chevron" />
    </button>

    <Teleport to="body">
      <div
        v-if="showDropdown"
        :id="menuId"
        ref="dropdownRef"
        role="menu"
        :aria-label="t('permission.selectLabel')"
        class="permission-selector-portal"
        :style="[dropdownStyle, panelStyle]"
        v-bind="panelDataAttrs"
      >
        <button
          v-for="perm in permissions"
          :key="perm.key"
          class="permission-selector-item"
          type="button"
          role="menuitemradio"
          :aria-checked="perm.key === modelValue"
          :class="{ active: perm.key === modelValue }"
          :title="perm.hint"
          @click="selectPermission(perm.key)"
        >
          <component :is="perm.icon" :size="14" />
          <span class="permission-option-copy"><span>{{ perm.label }}</span><small>{{ perm.hint }}</small></span>
        </button>
        <p class="permission-policy-note">{{ t('permission.nextRunHint') }}</p>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.permission-option-copy { display: flex; flex-direction: column; gap: 4px; text-align: start; }
.permission-option-copy small { color: var(--text-secondary); font-size: var(--text-xs, 12px); white-space: normal; line-height: 1.5; }
.permission-selector-item { align-items: flex-start; }
.permission-selector-item > svg { flex-shrink: 0; margin-top: 2px; }
.permission-policy-note { color: var(--text-secondary); font-size: var(--text-xs, 12px); white-space: normal; line-height: 1.5; padding: 8px 12px 4px; margin: 0; }
</style>
