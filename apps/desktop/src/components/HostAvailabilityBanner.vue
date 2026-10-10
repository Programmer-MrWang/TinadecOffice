<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Info, ShieldAlert, WifiOff } from '@lucide/vue'
import { UiButton } from '@/components/ui'
import { useHostAccess } from '@/lib/hostAccess'
import { retryConnection } from '@/composables/useConnection'
import { usePanelStyles } from '@/composables/usePanelStyles'

const { status } = useHostAccess()
const { getPanelStyle, getPanelDataAttributes } = usePanelStyles()
const { t } = useI18n({ useScope: 'local', messages: {
  'zh-CN': {
    previewTitle: '界面预览', previewText: '此页面不连接用户数据。工作区、目录选择和资源安装请在桌面应用中操作。',
    unavailableTitle: '桌面宿主连接中断', unavailableText: '工作区及资源操作暂不可用。连接验证成功后自动恢复，也可以手动重试。',
    rejectedTitle: '本地服务身份验证失败', rejectedText: '请使用同一次启动的 Core、Gateway 和 Desktop，再重试连接。',
    checking: '正在重新验证桌面宿主…', retry: '重试宿主连接', retrying: '正在重试…',
  },
  en: {
    previewTitle: 'UI preview', previewText: 'This page does not connect to user data. Use the desktop app for workspaces, folder selection and resource installation.',
    unavailableTitle: 'Desktop host disconnected', unavailableText: 'Workspace and resource operations are unavailable. They resume after host verification succeeds; you can also retry now.',
    rejectedTitle: 'Local service identity rejected', rejectedText: 'Start Core, Gateway and Desktop together, then retry the connection.',
    checking: 'Verifying the desktop host again…', retry: 'Retry host connection', retrying: 'Retrying…',
  },
} })
const pending = ref(false)
const visible = computed(() => Boolean(status.value && status.value.state !== 'ready') || pending.value)
const preview = computed(() => status.value?.state === 'preview')
const rejected = computed(() => status.value?.state === 'rejected')
const title = computed(() => t(preview.value ? 'previewTitle' : rejected.value ? 'rejectedTitle' : 'unavailableTitle'))
const description = computed(() => t(status.value?.state === 'checking' ? 'checking' : preview.value ? 'previewText' : rejected.value ? 'rejectedText' : 'unavailableText'))
async function retry() {
  if (pending.value) return
  pending.value = true
  try { await retryConnection() } finally { pending.value = false }
}
</script>

<template>
  <aside v-if="visible" class="host-availability-banner no-drag" role="status" aria-live="polite"
    :style="getPanelStyle()" v-bind="getPanelDataAttributes()">
    <Info v-if="preview" :size="18" aria-hidden="true" />
    <ShieldAlert v-else-if="rejected" :size="18" aria-hidden="true" />
    <WifiOff v-else :size="18" aria-hidden="true" />
    <div class="host-availability-copy"><strong>{{ title }}</strong><p>{{ description }}</p></div>
    <UiButton v-if="!preview" variant="outline" size="sm" :disabled="pending" @click="retry">
      {{ pending ? t('retrying') : t('retry') }}
    </UiButton>
  </aside>
</template>

<style scoped>
.host-availability-banner { position: fixed; z-index: 90; inset: auto 16px 16px; margin-inline: auto; width: fit-content; max-width: min(720px, calc(100vw - 32px)); display: flex; align-items: center; gap: 12px; padding: 12px 16px; border: 1px solid var(--border-muted); border-radius: var(--radius-md); background: var(--surface-raised); color: var(--text-primary); box-shadow: var(--shadow-card-subtle); }
.host-availability-banner > svg { flex-shrink: 0; color: var(--text-secondary); }
.host-availability-copy { min-width: 0; font-size: 12px; }
.host-availability-copy strong { font-size: 13px; font-weight: 600; }
.host-availability-copy p { margin: 3px 0 0; color: var(--text-secondary); overflow-wrap: anywhere; }
.host-availability-banner > button { flex-shrink: 0; }
@media (max-width: 640px) { .host-availability-banner { flex-wrap: wrap; } .host-availability-copy { flex: 1; } }
</style>
