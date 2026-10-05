<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { UieCanvas } from '@tinadec/ui'
import AppHeader from '@/components/AppHeader.vue'
import { marketController } from '@/controllers/MarketController'
import { useUiePage } from '@/lib/uiEngine'

const uie = useUiePage('market')
const emit = defineEmits<{ ready: [] }>()
const canvasReady = ref(false)
let alive = true

// The page owns the read and its lifecycle; the cards it mounts only render the state.
onMounted(async () => {
  await uie.ready
  if (!alive) return
  // The shared store may still hold Home's layout while disk hydration runs.
  // Select the restored Market layout before the first canvas/card mount.
  uie.showPage('market')
  canvasReady.value = true
  marketController.start()
  await nextTick()
  if (alive) emit('ready')
})

onBeforeUnmount(() => {
  alive = false
  marketController.stop()
})
</script>

<template>
  <main class="shell">
    <div class="top-drag-bar" />
    <AppHeader />
    <UieCanvas v-if="canvasReady" />
  </main>
</template>

<style scoped>
.shell {
  position: relative;
  height: 100vh;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: transparent;
}
</style>
