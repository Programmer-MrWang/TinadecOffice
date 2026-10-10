<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SessionDto } from '@/api'
import { loadSessionCatalog } from '@/lib/sessionRoster'
import { useNotifications } from '@/composables/useNotifications'
import { selectionKey, selectionIdentity, setSelectedStorage } from '@/lib/storageScope'
import { UiSelectField } from '@/components/ui'

const { t } = useI18n()
const { notify } = useNotifications()
const sessions = ref<SessionDto[]>([])
const selectedSessionId = ref('')

async function fetchSessions() {
  try {
    const result = await loadSessionCatalog({ previous: sessions.value })
    sessions.value = result.rows
    for (const failure of result.failures) notify.error(failure.error.message, { title: t('settings.loadArchiveFailed') })
  } catch (error) {
    notify.error(error, { title: t('settings.loadArchiveFailed') })
  }
}

onMounted(fetchSessions)
</script>

<template>
  <UiSelectField
    v-model="selectedSessionId"
    class="session-selector"
    :aria-label="t('debugStudio.allSessions')"
    :options="[
      { value: '', label: t('debugStudio.allSessions') },
      ...sessions.map((session) => ({ value: selectionKey(session), label: session.title || session.id })),
    ]"
    @change="setSelectedStorage(selectionIdentity(selectedSessionId).storageId ?? 'user')"
  />
</template>

<style scoped>
.session-selector {
  width: 220px;
}
.session-selector :deep(.ui-select-trigger) {
  height: 30px;
  font-size: 12px;
}
</style>
