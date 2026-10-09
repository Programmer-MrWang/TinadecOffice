<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronRight, Cpu, FileText, Globe, Monitor } from '@lucide/vue'
import BrandLogo from '@/components/BrandLogo.vue'
import { UiButton, UiCard, UiSwitch } from '@/components/ui'
import { useDebugStudio } from '@/composables/useDebugStudio'
import { api as baseApi } from '@/api'
import { scopedApi } from '@/lib/storageScope'
const api = scopedApi(baseApi, () => 'user')

/**
 * About section extracted from SettingsPage (D7.2 pilot module).
 *
 * Self-contained: runtime health check (Core/Gateway), architecture map,
 * links, and license. No shared state with other settings sections.
 */
const { t } = useI18n()
const { enabled: debugStudioEnabled, loaded: debugStudioLoaded, error: debugStudioLoadError, load: loadDebugStudio, saveEnabled } = useDebugStudio()
const debugStudioSaving = ref(false)
const debugStudioSaveError = ref('')
async function changeDebugStudio(value: boolean): Promise<void> {
  debugStudioSaving.value = true
  debugStudioSaveError.value = ''
  try { await saveEnabled(value) }
  catch (error) { debugStudioSaveError.value = error instanceof Error ? error.message : String(error) }
  finally { debugStudioSaving.value = false }
}

const aboutCoreStatus = ref<string>('')
const aboutCoreVersion = ref<string>('')
const aboutGatewayStatus = ref<string>('')

async function checkAboutHealth(): Promise<void> {
  try {
    const data = await api.health()
    aboutCoreStatus.value = data.status === 'ok' ? 'ok' : ''
    aboutCoreVersion.value = typeof data.version === 'string' ? data.version : ''
    aboutGatewayStatus.value = data.gateway === 'ok' ? 'ok' : ''
  } catch {
    aboutCoreStatus.value = ''
    aboutGatewayStatus.value = ''
  }
}

function openExternal(url: string): void {
  window.open(url, '_blank')
}

onMounted(checkAboutHealth)
onMounted(loadDebugStudio)
</script>

<template>
  <div>
    <h2>{{ t('settings.about') }}</h2>

    <!-- App identity -->
    <div class="about-brand">
      <div class="about-brand-icon">
        <BrandLogo :size="28" />
      </div>
      <div class="about-brand-text">
        <span class="about-brand-name">TinadecOffice</span>
        <span class="about-brand-ver">v0.1.0</span>
      </div>
    </div>

    <!-- Runtime status -->
    <div class="about-status-grid" data-testid="about-health">
      <div class="about-status-card">
        <div class="about-status-row">
          <span class="about-status-label">Core (.NET)</span>
          <span class="about-status-dot" :class="aboutCoreStatus === 'ok' ? 'ok' : 'off'" />
          <span class="about-status-text" :class="aboutCoreStatus === 'ok' ? 'ok' : 'off'">
            {{ aboutCoreStatus === 'ok' ? t('aboutPage.running') : t('aboutPage.unreachable') }}
          </span>
        </div>
        <div v-if="aboutCoreVersion" class="about-status-detail">{{ aboutCoreVersion }}</div>
      </div>
      <div class="about-status-card">
        <div class="about-status-row">
          <span class="about-status-label">Gateway</span>
          <span class="about-status-dot" :class="aboutGatewayStatus === 'ok' ? 'ok' : 'off'" />
          <span class="about-status-text" :class="aboutGatewayStatus === 'ok' ? 'ok' : 'off'">
            {{ aboutGatewayStatus === 'ok' ? t('aboutPage.running') : t('aboutPage.unreachable') }}
          </span>
        </div>
      </div>
    </div>

    <!-- Version table -->
    <UiCard class="about-versions">
      <div class="about-row">
        <span>{{ t('settings.versionDesktop') }}</span>
        <span>0.1.0</span>
      </div>
      <div class="about-row">
        <span>{{ t('settings.versionCore') }}</span>
        <span>0.1.0</span>
      </div>
    </UiCard>

    <!-- Architecture -->
    <UiCard class="about-developer-tools">
      <h3>{{ t('aboutPage.developerTools') }}</h3>
      <div class="about-developer-row">
        <div>
          <label for="about-debug-studio">{{ t('aboutPage.showDebugStudio') }}</label>
          <p id="about-debug-studio-hint">{{ t('aboutPage.debugStudioHint') }}</p>
        </div>
        <UiSwitch id="about-debug-studio" :model-value="debugStudioEnabled" :disabled="!debugStudioLoaded || Boolean(debugStudioLoadError) || debugStudioSaving" aria-describedby="about-debug-studio-hint" @update:model-value="changeDebugStudio" />
      </div>
      <p v-if="debugStudioLoadError || debugStudioSaveError" class="about-developer-error" role="alert">
        {{ t(debugStudioLoadError ? 'aboutPage.debugStudioLoadFailed' : 'aboutPage.debugStudioSaveFailed') }}: {{ debugStudioSaveError || String(debugStudioLoadError) }}
      </p>
    </UiCard>

    <div class="about-arch">
      <h3>{{ t('aboutPage.architecture') }}</h3>
      <p class="about-decouple-hint">{{ t('settings.decoupleHint') }}</p>
      <div class="about-layers">
        <div class="about-layer">
          <div class="about-layer-header">
            <Monitor :size="14" />
            <span>Desktop</span>
          </div>
          <div class="about-layer-tech">Electron + Vue 3 + Tailwind</div>
          <div class="about-layer-port">:5173</div>
        </div>
        <div class="about-layer-arrow">
          <ChevronRight :size="14" />
        </div>
        <div class="about-layer">
          <div class="about-layer-header">
            <Globe :size="14" />
            <span>Gateway</span>
          </div>
          <div class="about-layer-tech">Elysia + Node.js</div>
          <div class="about-layer-port">:48730</div>
        </div>
        <div class="about-layer-arrow">
          <ChevronRight :size="14" />
        </div>
        <div class="about-layer about-layer--core">
          <div class="about-layer-header">
            <Cpu :size="14" />
            <span>Core</span>
          </div>
          <div class="about-layer-tech">.NET 10 + SQLite</div>
          <div class="about-layer-port">:48731</div>
        </div>
      </div>
    </div>

    <!-- Links -->
    <div class="about-links">
      <UiButton variant="outline" size="sm" class="about-link-btn" @click="openExternal('https://github.com/apanzinc/TinadecCode')">
        <Globe :size="14" />
        <span>GitHub</span>
      </UiButton>
      <UiButton variant="outline" size="sm" class="about-link-btn" @click="openExternal(api.gatewayUrl + '/docs')">
        <FileText :size="14" />
        <span>{{ t('settings.apiDocs') }}</span>
      </UiButton>
    </div>

    <p class="about-license">&copy; {{ new Date().getFullYear() }} TinadecOffice &middot; GPL-3.0-or-later</p>
  </div>
</template>
