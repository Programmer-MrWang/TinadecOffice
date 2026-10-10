import { createApp } from 'vue'
import { createPinia } from 'pinia'
import * as Vue from 'vue'
// ponytail: vue 3.5 has no vaporInteropPlugin; 3.6-rc does — tolerate either
const vaporInteropPlugin = (Vue as unknown as Record<string, unknown>).vaporInteropPlugin as Parameters<ReturnType<typeof createApp>['use']>[0] | undefined
import App from './App.vue'
import router from './router'
import i18n from './i18n'
import { useTheme } from './composables/useTheme'
import { useDynamicPalette } from './composables/useDynamicPalette'
import { setErrorActionLabels, setNotificationFallbackText } from './composables/useNotifications'
import { installPreviewShimIfNeeded } from './lib/previewShim'
import { homeController } from './controllers/HomeController'
import { installRendererErrorFallback } from './lib/rendererErrorFallback'
import './styles.css'

// Install a minimal `window.tinadec` when running without the Electron preload
// (bare-vite preview / MCP pane) so pages render instead of crashing.
installPreviewShimIfNeeded()

const app = createApp(App)
const pinia = createPinia()

// Vapor SFCs (via `<template vapor>`) render through the Vapor renderer; the
// interop plugin lets them live inside the classic vdom tree (e.g. Ui primitives
// used by splash/notifications) while the rest of the app stays classic.
app.use(pinia)
if (vaporInteropPlugin) app.use(vaporInteropPlugin)

app.use(router)
app.use(i18n)

// Register recovery handlers before mount so the first classified error already offers its
// escape hatch (retry / unregister). The controller is the singleton that owns the roster.
homeController.installErrorRecovery()

// Inject localized fallback text for notification composables
// so unknownError follows the active locale.
setNotificationFallbackText(i18n.global.t('app.unknownError'))
// Recovery labels for server-classified errors. The server names an action kind (retry, reload,
// unregister_workspace, ...); the wording lives here so the API never ships UI copy.
setErrorActionLabels({
  retry: i18n.global.t('errors.actions.retry'),
  reload: i18n.global.t('errors.actions.reload'),
  open_settings: i18n.global.t('errors.actions.openSettings'),
  open_storage_settings: i18n.global.t('errors.actions.openStorageSettings'),
  open_tool_settings: i18n.global.t('errors.actions.openToolSettings'),
  unregister_workspace: i18n.global.t('errors.actions.unregisterWorkspace'),
  choose_folder: i18n.global.t('errors.actions.chooseFolder'),
})

// 在挂载前初始化主题，确保 DOM 准备好后再应用样式
const { applyInitialTheme } = useTheme()
if (applyInitialTheme) {
  applyInitialTheme()
}
// Arm the Monet background-extraction watcher (idempotent singleton).
useDynamicPalette()

// Global error containment: logs every uncaught error and, on the first fatal
// one, swaps the stuck splash for a recoverable DOM fallback instead of leaving
// a silent solid-color window. Installed before mount so render errors during
// boot are also caught.
const report = installRendererErrorFallback(app)
try {
  app.mount('#app')
} catch (err) {
  // A throw at mount means nothing rendered — this is fatal, show the fallback.
  report(err, { source: 'app.mount' }, true)
}

