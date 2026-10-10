<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import { computed, watch, onMounted, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBackground } from '@/composables/useBackground'
import {
  useConnection,
  CONNECTION_BANNER_KEY,
  retryConnection,
} from '@/composables/useConnection'
import { useNotifications, startStatusSync } from '@/composables/useNotifications'
import { ensureGraphSeedPack, setGraphSeedPackTranslator } from '@/agentPacks/graphSeedPackBootstrap'
import AppSplash from '@/components/AppSplash.vue'
import HostAvailabilityBanner from '@/components/HostAvailabilityBanner.vue'
import NotificationIslandHost from '@/components/NotificationIslandHost.vue'
import NotificationDetailDialog from '@/components/NotificationDetailDialog.vue'
import SelectionContextMenu from '@/components/SelectionContextMenu.vue'
import CommandPalette from '@/components/CommandPalette.vue'
import { installPaletteKeybinding } from '@/composables/useCommandPalette'

// ---- Background layer (global, outside page transitions) ----
// The background layer is ALWAYS rendered here — outside the <Transition> —
// so it is never affected by page-transition transforms.  CSS `position: fixed`
// inside a transformed ancestor behaves like `position: absolute`, which
// would cause the background to slide along with the page.  By keeping it
// here, the background stays perfectly static during navigation.
//
// Even when type === 'none' (no custom background), the layer is still
// rendered with the theme's --bg-primary colour.  This ensures the window
// has a stable, non-animated bottom layer at all times.  Page containers
// (.shell, .settings-page, .workspace) are always transparent so this
// layer shows through.
const { settings: backgroundSettings, applyBackground } = useBackground()
watch(backgroundSettings, () => applyBackground(), { deep: true, immediate: true })

// ---- Backend connection gating ----
// Health success/timeout mounts the route; splash leaves when that route is ready.
// 子窗口（?splash=0，如 Debug Studio / Detached Panel）跳过 splash：
// 它们复用主窗口已建立的后端连接，不应重播首次启动序列。
const isChildWindow = new URLSearchParams(window.location.search).get('splash') === '0'
const isPetWindow = window.location.hash.startsWith('#/pet')
const { t } = useI18n()
setGraphSeedPackTranslator((key, params) => String(t(key, params ?? {})))
const { connectionState, start: startConnection } = useConnection()
let graphSeedBootstrapped = false
const { status, dismissByKey } = useNotifications()
let unsubscribeStatusSync: (() => void) | undefined
let uninstallPaletteKeys: (() => void) | undefined
const isConnecting = computed(() => !isChildWindow && connectionState.value === 'connecting')
const route = useRoute()
// Startup happens once. Retrying a lost backend must preserve the live page.
const mainStarted = ref(!isConnecting.value)
const entryReady = ref(isChildWindow)
watch(isConnecting, (connecting) => {
  if (!connecting) mainStarted.value = true
})

function onPageReady() {
  entryReady.value = true
}

function onRouteMounted() {
  // UIE routes report readiness after selecting and measuring their layouts.
  // Other routes have their own entry animations and are ready on mount.
  if (route.name !== 'home' && route.name !== 'market' && route.name !== 'space') onPageReady()
}

watch(connectionState, (state) => {
  if (isPetWindow || isChildWindow) return
  if (state === 'connected') {
    dismissByKey(CONNECTION_BANNER_KEY)
    if (!graphSeedBootstrapped) {
      graphSeedBootstrapped = true
      void ensureGraphSeedPack()
    }
    return
  }
  if (state === 'host_unavailable' || state === 'host_rejected' || state === 'host_restart_required') { dismissByKey(CONNECTION_BANNER_KEY); return }
  if (state === 'preview') { dismissByKey(CONNECTION_BANNER_KEY); return }
  if (state === 'timeout') {
    status.error({
      key: CONNECTION_BANNER_KEY,
      title: t('app.backendNotConnected'),
      message: t('app.backendNotConnectedMessage'),
      source: 'gateway',
      action: { label: t('app.retryConnection'), run: () => retryConnection() },
    })
    return
  }
  if (state === 'disconnected') {
    status.error({
      key: CONNECTION_BANNER_KEY,
      title: t('app.backendDisconnected'),
      message: t('app.backendDisconnectedMessage'),
      source: 'gateway',
      action: { label: t('app.retryConnection'), run: () => retryConnection() },
    })
  }
})

onMounted(() => {
  if (!isPetWindow) void startConnection()
  if (!isPetWindow) {
    unsubscribeStatusSync = startStatusSync()
    // The palette is the window's command surface, and a pet has no commands to run.
    uninstallPaletteKeys = installPaletteKeybinding()
  }
})

onBeforeUnmount(() => {
  unsubscribeStatusSync?.()
  uninstallPaletteKeys?.()
})
</script>

<template>
  <RouterView v-if="isPetWindow" />

  <template v-else>
  <!-- Keep one Vue splash node through route preparation and CSS departure.
       Home readiness includes saved layout, fonts and measured paint frames. -->
  <AppSplash
    v-if="!isChildWindow && !isPetWindow"
    :class="{ 'app-splash--leaving': entryReady }"
    :aria-hidden="entryReady ? 'true' : undefined"
  />

  <!-- Background Layer — rendered behind splash during route preparation.
       INTENTIONALLY OUTSIDE any <Transition> / transformed ancestor:
       CSS position:fixed degrades to absolute inside a transformed parent,
       which would make the background slide with the page (see comment below).
       This div is the stable, static foundation of the entire window. -->
  <div
    v-if="mainStarted"
    class="background-layer"
    :class="{ 'background-layer--none': backgroundSettings.type === 'none' }"
  >
    <!-- Image Background -->
    <div
      v-if="backgroundSettings.type === 'image'"
      class="background-image"
      :style="{
        backgroundImage: backgroundSettings.source ? `url('${backgroundSettings.source}')` : 'none',
        backgroundSize: backgroundSettings.size,
        backgroundPosition: backgroundSettings.position,
        backgroundRepeat: backgroundSettings.repeat,
        opacity: backgroundSettings.opacity / 100,
        filter: backgroundSettings.blur > 0 ? `blur(${backgroundSettings.blur}px)` : 'none',
      }"
    />
    <!-- Video Background -->
    <video
      v-else-if="backgroundSettings.type === 'video' && backgroundSettings.source"
      class="background-video"
      :src="backgroundSettings.source"
      autoplay
      loop
      muted
      :style="{
        opacity: backgroundSettings.opacity / 100,
        filter: backgroundSettings.blur > 0 ? `blur(${backgroundSettings.blur}px)` : 'none',
      }"
    />
    <!-- HTML Background -->
    <div
      v-else-if="backgroundSettings.type === 'html' && backgroundSettings.source"
      class="background-html"
      v-html="backgroundSettings.source"
      :style="{
        opacity: backgroundSettings.opacity / 100,
        filter: backgroundSettings.blur > 0 ? `blur(${backgroundSettings.blur}px)` : 'none',
      }"
    />
    <!-- When type === 'none', the layer is empty but still has --bg-primary
         from .background-layer--none CSS class. -->
  </div>

  <!-- Main content shell.
       页面入场动画由各页面（如 HomePage）内部触发，
       而非在此处包裹 RouterView —— 因为路由组件是懒加载的，外层 Transition
       会在子元素挂载前就移除 enter-active 类，导致动画失效。 -->
  <div v-if="mainStarted" class="main-content">
    <!-- No Transition wrapper around RouterView: TinadecUIE owns the main
         window layout and the stable card-frame material root. A transition
         would unload the page host on route change, breaking backdrop-filter
         and hitting removed-node patches with TinadecUIE's absolute layout. -->
    <RouterView v-slot="{ Component }">
      <component :is="Component" @ready="onPageReady" @vue:mounted="onRouteMounted" />
    </RouterView>
  </div>
  <HostAvailabilityBanner v-if="mainStarted && !isChildWindow" />
  <NotificationIslandHost v-if="entryReady" />
  <NotificationDetailDialog v-if="entryReady" />
  <SelectionContextMenu />
  <CommandPalette />
  </template>
</template>
