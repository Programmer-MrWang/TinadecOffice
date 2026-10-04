<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Copy, Download, Eye, EyeOff, X } from '@lucide/vue'
import { UiButton } from '@/components/ui'
import { useNotifications } from '@/composables/useNotifications'
import { userProfile } from '@/lib/userProfile'
import {
  buildShareCardModel,
  shareCardFilename,
  type ShareCardLabels,
  type ShareUsage,
} from '@/lib/shareCard'
import { paintShareCard, type ShareCardTheme } from '@/lib/shareCardCanvas'

/**
 * Share card: one generated picture of the local identity plus token usage.
 *
 * What is shown is what is exported — the canvas is the preview and the source
 * of the copied/downloaded PNG, so there is no second layout to keep in sync.
 * The card is drawn from `lib/shareCard.ts`'s model and the app's own CSS
 * tokens, which is what makes it look like Tinadec rather than a screenshot.
 */
const props = defineProps<{ usage: ShareUsage | null }>()
const emit = defineEmits<{ close: [] }>()

const { t, locale } = useI18n()
const { notify, status } = useNotifications()

const canvasRef = ref<HTMLCanvasElement | null>(null)
/** Privacy switch: the picture drops the avatar and the nickname. */
const hideProfile = ref(false)
/** False when this environment has no 2D context — the dialog says so instead of lying. */
const painted = ref(false)

const EMPTY_USAGE: ShareUsage = {
  yearlyTokens: null,
  peakDailyTokens: null,
  currentStreakDays: 0,
  totalActiveDays: 0,
  dailyTokens: {},
}

const usage = computed(() => props.usage ?? EMPTY_USAGE)

const labels = computed<ShareCardLabels>(() => ({
  hiddenName: t('settings.personalShareHiddenName'),
  yearlyTokens: t('settings.personalUsageYearlyTokens'),
  peakDaily: t('settings.personalUsagePeakDaily'),
  currentStreak: t('settings.personalUsageCurrentStreak'),
  totalActiveDays: t('settings.personalUsageTotalDays'),
}))

const model = computed(() =>
  buildShareCardModel(
    {
      ...usage.value,
      nickname: userProfile.nickname,
      avatar: userProfile.avatar,
      hideProfile: hideProfile.value,
    },
    labels.value,
    { locale: locale.value, today: new Date() },
  ),
)

const toggleTitle = computed(() =>
  hideProfile.value ? t('settings.personalShareShowProfile') : t('settings.personalShareHideProfile'),
)

/** The card borrows the app's own palette, so it follows the user's theme. */
function resolveTheme(): ShareCardTheme {
  const styles = getComputedStyle(document.documentElement)
  const read = (token: string, fallback: string): string => styles.getPropertyValue(token).trim() || fallback
  return {
    cardBackground: read('--surface-raised', '#1d211d'),
    cardBorder: read('--border-muted', 'rgba(255, 255, 255, 0.12)'),
    textPrimary: read('--text-primary', '#f2f4f1'),
    textSecondary: read('--text-secondary', '#c9cec6'),
    textMuted: read('--text-muted', '#8b9187'),
    accent: read('--accent', '#2ec4b6'),
    heatEmpty: read('--surface-hover', 'rgba(255, 255, 255, 0.07)'),
  }
}

async function loadAvatar(source: string | null): Promise<HTMLImageElement | null> {
  if (!source) return null
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('avatar'))
      image.src = source
    })
    // `decode()` settles the frame before drawing; without it a data URL can be
    // drawn before the bitmap exists (same guard as useDynamicPalette).
    if (typeof image.decode === 'function') {
      try {
        await image.decode()
      } catch {
        // A decode failure still leaves the loaded bitmap usable.
      }
    }
    return image
  } catch {
    return null
  }
}

/** Guards against an older, slower avatar load repainting over a newer card. */
let paintToken = 0

async function repaint(): Promise<void> {
  const canvas = canvasRef.value
  if (!canvas) return
  const token = ++paintToken
  const avatar = await loadAvatar(model.value.avatar)
  if (token !== paintToken) return
  painted.value = paintShareCard(canvas, model.value, resolveTheme(), {
    scale: window.devicePixelRatio || 1,
    avatar,
  })
}

onMounted(() => {
  void repaint()
})

watch(model, () => {
  void repaint()
})

function toggleProfile(): void {
  hideProfile.value = !hideProfile.value
}

async function toPngBlob(): Promise<Blob | null> {
  const canvas = canvasRef.value
  // `toBlob` is also absent wherever there is no 2D context; both paths end in
  // the same "could not generate the image" report rather than a thrown promise.
  if (!canvas || typeof canvas.toBlob !== 'function') return null
  return await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png')
  })
}

function reportFailure(message: string): void {
  status.error({ key: 'personal-share', source: 'desktop', message })
}

async function copyImage(): Promise<void> {
  const blob = await toPngBlob()
  if (!blob || typeof ClipboardItem === 'undefined' || typeof navigator.clipboard?.write !== 'function') {
    reportFailure(t('settings.personalShareCopyFailed'))
    return
  }
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    notify.success(t('settings.personalShareCopied'))
  } catch {
    reportFailure(t('settings.personalShareCopyFailed'))
  }
}

async function downloadImage(): Promise<void> {
  const blob = await toPngBlob()
  if (!blob) {
    reportFailure(t('settings.personalShareDownloadFailed'))
    return
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = shareCardFilename(new Date())
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="model-provider-modal personal-share-overlay" @click.self="emit('close')">
    <div class="personal-share-column">
      <div class="personal-share-close-row">
        <UiButton variant="ghost" size="icon" :title="t('settings.personalShareClose')" @click="emit('close')">
          <X :size="16" />
        </UiButton>
      </div>

      <canvas
        ref="canvasRef"
        class="personal-share-canvas"
        role="img"
        :aria-label="t('settings.personalShareTitle')"
      ></canvas>

      <div class="personal-share-actions">
        <button
          type="button"
          class="personal-share-action"
          :aria-pressed="hideProfile"
          :title="toggleTitle"
          :aria-label="toggleTitle"
          @click="toggleProfile"
        >
          <component :is="hideProfile ? Eye : EyeOff" :size="16" />
        </button>
        <button
          type="button"
          class="personal-share-action"
          :title="t('settings.personalShareCopy')"
          :aria-label="t('settings.personalShareCopy')"
          @click="copyImage"
        >
          <Copy :size="16" />
        </button>
        <button
          type="button"
          class="personal-share-action"
          :title="t('settings.personalShareDownload')"
          :aria-label="t('settings.personalShareDownload')"
          @click="downloadImage"
        >
          <Download :size="16" />
        </button>
      </div>

      <p v-if="!painted" class="personal-share-fallback">{{ t('settings.personalShareUnavailable') }}</p>
    </div>
  </div>
</template>
