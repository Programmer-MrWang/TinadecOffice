<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { UieShell } from '@tinadec/ui'
import { homeController } from '@/controllers/HomeController'
import { consumeRequest, pendingConversationId } from '@/lib/pageRequests'
import { useUiePage } from '@/lib/uiEngine'
import { useHomeEntrance } from '@/composables/useHomeEntrance'

// The UIE store is a module singleton shared by every UIE route; entering Home
// switches it back to the home layout (restoring the user's saved home layout).
const uie = useUiePage('home')
const emit = defineEmits<{ ready: [] }>()
const root = ref<HTMLElement | null>(null)
const { contentReady, phase } = useHomeEntrance(root, uie.ready, () => emit('ready'))

// Spatial transition state — declarative, class-driven.
// Same mechanism as the Settings page: toggling container classes
// (.home-entering / .home-exiting) drives CSS @keyframes in
// page-transitions.css. No <Transition>, no v-show, no document.querySelector.
//
// Keep transforms on the material roots, never their ancestors; the UIE store
// owns geometry and the page wrapper only supplies declarative animation state.
//
// Entry animation: the container is always visible (never display:none), so
// UieCanvas.measure() reads the real .uie-canvas size on the first frame
// and the columns get correct geometry. The .home-entering class then plays
// the rise-from-below keyframes on the freshly mounted stacks — on both
// initial load and when returning from settings (fresh stacks replay the
// keyframes, exactly like the Settings nav/content do on every mount).
const homeExiting = ref(false)

// Exit duration must match page-transitions.css (@keyframes home-up-exit:
// 0.2s per column + 0.1s max stagger delay).
const EXIT_DURATION_MS = 300

onMounted(() => {
  homeController.start()
})

// A spotlight conversation row hands its id over through the request channel:
// the palette navigates here, and the selection lands on the one ref the
// sidebar, the message pane and the loader all already read.
consumeRequest(pendingConversationId, (sessionId) => {
  homeController.setSelectedSession(sessionId)
})

// Spatial exit: toggle .home-exiting so the exit keyframes drive the staggered
// upward flight declaratively, then complete the navigation once the CSS
// animation settles. Mirrors SettingsPage.vue's onBeforeRouteLeave guard.
onBeforeRouteLeave((_to, _from, next) => {
  if (homeExiting.value) {
    next()
    return
  }
  homeExiting.value = true
  setTimeout(() => next(), EXIT_DURATION_MS)
})
</script>

<template>
  <div
    ref="root"
    class="home-page-container"
    :class="{ 'home-preparing': phase === 'preparing', 'home-entering': phase === 'entering', 'home-exiting': homeExiting }"
  >
    <UieShell v-if="contentReady" />
  </div>
</template>

<style scoped>
.home-page-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>
