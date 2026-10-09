<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { UiButton, UiCard } from '@/components/ui'
const emit = defineEmits<{ choice: [value: 'save' | 'discard' | 'cancel'] }>()
const { t } = useI18n()
const host = ref<HTMLElement | null>(null)
const previous = window.document.activeElement as HTMLElement | null
onMounted(() => host.value?.querySelector<HTMLElement>('button')?.focus())
onBeforeUnmount(() => previous?.focus())
function trap(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); emit('choice', 'cancel'); return }
  if (event.key !== 'Tab') return
  const buttons = Array.from(host.value?.querySelectorAll<HTMLElement>('button') ?? [])
  const first = buttons[0]; const last = buttons[buttons.length - 1]
  if (event.shiftKey && window.document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && window.document.activeElement === last) { event.preventDefault(); first?.focus() }
}
</script>
<template>
  <div ref="host" class="model-provider-modal tools-draft-dialog" role="dialog" aria-modal="true" aria-labelledby="tools-draft-title" @keydown="trap" @click.self="emit('choice', 'cancel')">
    <UiCard class="model-provider-modal-content"><template #header><h3 id="tools-draft-title">{{ t('toolsSettings.unsavedTitle') }}</h3></template><template #content><p>{{ t('toolsSettings.unsavedMessage') }}</p></template><template #footer><div class="tools-command-bar"><UiButton variant="ghost" @click="emit('choice', 'cancel')">{{ t('toolsSettings.keepEditing') }}</UiButton><UiButton variant="outline" @click="emit('choice', 'discard')">{{ t('toolsSettings.discard') }}</UiButton><UiButton @click="emit('choice', 'save')">{{ t('toolsSettings.saveAndLeave') }}</UiButton></div></template></UiCard>
  </div>
</template>
