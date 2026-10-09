<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { api, type SessionDto } from '@/api'
import { selectionKey, selectionIdentity, setSelectedStorage } from '@/lib/storageScope'

const { t } = useI18n()
const sessions = ref<SessionDto[]>([])
const selectedSessionId = ref('')

async function fetchSessions() {
  try {
    sessions.value = await api.listSessions()
  } catch {
    sessions.value = []
  }
}

onMounted(fetchSessions)
</script>

<template>
  <select v-model="selectedSessionId" class="session-selector" @change="setSelectedStorage(selectionIdentity(selectedSessionId).storageId ?? 'user')">
    <option value="">{{ t('debugStudio.allSessions') }}</option>
    <option v-for="session in sessions" :key="selectionKey(session)" :value="selectionKey(session)">
      {{ session.title || session.id }}
    </option>
  </select>
</template>

<style scoped>
.session-selector {
  background: #21262d;
  border: 1px solid #30363d;
  color: #e6edf3;
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.15s;
}
.session-selector:hover { border-color: #484f58; }
.session-selector:focus {
  outline: none;
  border-color: #58a6ff;
}
</style>
