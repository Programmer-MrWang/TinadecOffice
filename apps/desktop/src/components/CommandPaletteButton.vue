<script setup lang="ts">
import { Search } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { nextTick, ref, watch } from 'vue'
import { UiButton } from '@/components/ui'
import { openPalette, useCommandPalette } from '@/composables/useCommandPalette'

const { t } = useI18n()
const { open, comboLabel } = useCommandPalette()

// The button grows into a real input when it is clicked: one less modal, and
// the jump from chrome to search reads as a stretch instead of a dialog
// appearing out of nowhere. Typing forwards into the palette's own query.
const expanded = ref(false)
const draft = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

watch(expanded, async (isExpanded) => {
  if (!isExpanded) return
  await nextTick()
  inputRef.value?.focus()
})

watch(open, (isOpen) => {
  // When the palette takes over, the strip collapses back to a bare button.
  // Its draft already got handed off; keeping the input open behind the
  // dialog would read as two surfaces fighting for the same keystroke.
  if (isOpen) expanded.value = false
})

function expand() {
  expanded.value = true
}

function confirm() {
  const text = draft.value
  openPalette(text)
  expanded.value = false
}

function collapse() {
  expanded.value = false
}

function onBlur() {
  // Blur without a query collapses; blur inside the dialog (input → dialog
  // input) never fires because the palette has its own input focused by the
  // time this one would have blurred.
  if (!draft.value.trim()) collapse()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    draft.value = ''
    collapse()
  } else if (event.key === 'Enter') {
    confirm()
    event.preventDefault()
  }
}
</script>

<template>
  <div
    class="palette-entry"
    :class="{ 'palette-entry--open': expanded }"
    data-testid="palette-entry"
  >
    <UiButton
      v-if="!expanded"
      variant="ghost"
      size="icon"
      class="window-btn commands"
      data-testid="command-palette-button"
      aria-haspopup="dialog"
      :aria-expanded="open"
      :aria-label="t('palette.title')"
      :aria-keyshortcuts="comboLabel"
      :title="t('palette.openWithShortcut', { combo: comboLabel })"
      @click="expand"
    >
      <Search :size="14" />
    </UiButton>
    <div v-else class="palette-entry-input-wrap" data-testid="palette-entry-input-wrap">
      <Search :size="13" class="palette-entry-icon" aria-hidden="true" />
      <input
        ref="inputRef"
        v-model="draft"
        class="palette-entry-input"
        type="text"
        :placeholder="t('palette.spotlightPlaceholder')"
        :aria-label="t('palette.title')"
        autocapitalize="off"
        autocomplete="off"
        spellcheck="false"
        data-testid="palette-entry-input"
        @blur="onBlur"
        @keydown="onKeydown"
      />
    </div>
  </div>
</template>

<style scoped>
.palette-entry {
  display: flex;
  align-items: center;
}

/* The strip keeps the window-chrome capsule so it reads as the same family
   as minimize / maximize / close, just longer. */
.palette-entry-input-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 224px;
  height: 26px;
  padding: 0 10px;
  background: color-mix(in srgb, var(--surface-input) 75%, transparent);
  border: 1px solid var(--border-muted);
  border-radius: 999px;
  animation: palette-entry-expand 0.18s ease;
}

@keyframes palette-entry-expand {
  from { width: 32px; opacity: 0.4; }
  to   { width: 224px; opacity: 1; }
}

.palette-entry-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.palette-entry-input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 12px;
  outline: none;
}

.palette-entry-input::placeholder {
  color: var(--text-muted);
}
</style>
