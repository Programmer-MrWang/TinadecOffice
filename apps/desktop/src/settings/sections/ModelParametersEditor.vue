<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { UiButton, UiInput } from '@/components/ui'
import { api, type ModelParametersDto, type ModelProviderInstanceDto } from '@/api'

const props = defineProps<{ provider: ModelProviderInstanceDto; model: string }>()
const emit = defineEmits<{ saved: []; cancel: []; reload: [] }>()
const { t } = useI18n()
const busy = ref(false)
const error = ref('')
const stale = ref(false)
const form = reactive({ effort: '', temperature: '', topP: '', maxTokens: '' })
const supportsReasoning = computed(() => ['openai-chat', 'openai-responses'].includes(props.provider.protocol ?? 'openai-chat'))
const temperatureMax = computed(() => props.provider.protocol === 'anthropic-messages' ? 1 : 2)
const omitsSampling = computed(() => Boolean(form.effort && form.effort !== 'none' && /^(gpt-[56]|o[134])/i.test(props.model)))
const numberFields = computed(() => [
  { key: 'temperature' as const, label: 'settings.modelTemperature', min: 0, max: temperatureMax.value, step: '0.1', disabled: omitsSampling.value },
  { key: 'topP' as const, label: 'settings.modelTopP', min: 0, max: 1, step: '0.01', disabled: omitsSampling.value },
  { key: 'maxTokens' as const, label: 'settings.modelMaxOutput', min: 1, max: undefined, step: '1', disabled: false },
])
const invalidFields = computed(() => new Set(numberFields.value.filter(field => {
  if (field.disabled || !form[field.key].trim()) return false
  const value = Number(form[field.key])
  return !Number.isFinite(value) || value < field.min || (field.max !== undefined && value > field.max)
    || (field.key === 'maxTokens' && !Number.isSafeInteger(value))
}).map(field => field.key)))
const effortOptions = ['none', 'low', 'medium', 'high', 'xhigh'] as const
const effortLabels = { none: 'settings.reasoningNone', low: 'settings.reasoningLow', medium: 'settings.reasoningMedium', high: 'settings.reasoningHigh', xhigh: 'settings.reasoningXhigh' }

watch(() => [props.provider.id, props.provider.revision, props.model], () => {
  const settings = props.provider.model_parameters?.[props.model] ?? {}
  Object.assign(form, { effort: settings.reasoning_effort ?? '', temperature: String(settings.temperature ?? ''), topP: String(settings.top_p ?? ''), maxTokens: String(settings.max_output_tokens ?? '') })
  error.value = ''
  stale.value = false
}, { immediate: true })

async function save() {
  if (busy.value || invalidFields.value.size > 0 || props.provider.revision == null) return
  busy.value = true
  error.value = ''
  const settings: ModelParametersDto = {}
  if (supportsReasoning.value && form.effort) settings.reasoning_effort = form.effort as ModelParametersDto['reasoning_effort']
  if (!omitsSampling.value && form.temperature.trim()) settings.temperature = Number(form.temperature)
  if (!omitsSampling.value && form.topP.trim()) settings.top_p = Number(form.topP)
  if (form.maxTokens.trim()) settings.max_output_tokens = Number(form.maxTokens)
  const parameters = { ...props.provider.model_parameters }
  if (Object.keys(settings).length > 0) parameters[props.model] = settings
  else delete parameters[props.model]
  try {
    await api.saveModelProvider(props.provider.id, {
      driver: props.provider.driver, display_name: props.provider.display_name, connection_kind: props.provider.connection_kind,
      enabled: props.provider.enabled, model_parameters: parameters,
    }, { expected_revision: props.provider.revision })
    emit('saved')
  } catch (err) {
    stale.value = [412, 428].includes((err as { status?: number }).status ?? 0)
    error.value = stale.value ? t('settings.modelParametersStale') : err instanceof Error ? err.message : String(err)
  } finally { busy.value = false }
}
</script>

<template>
  <form class="model-parameters-editor" :aria-busy="busy" @submit.prevent="save">
    <fieldset :disabled="busy">
      <legend>{{ t('settings.modelParametersFor', { model }) }}</legend>
      <p class="quiet" id="model-parameters-help">{{ t('settings.modelParametersHint') }}</p>
      <div class="model-parameters-fields">
        <div v-if="supportsReasoning" class="settings-field">
          <label for="model-reasoning">{{ t('settings.modelReasoningEffort') }}</label>
          <select id="model-reasoning" v-model="form.effort" class="settings-select" aria-describedby="model-parameters-help">
            <option value="">{{ t('settings.modelDefaultParameter') }}</option>
            <option v-for="effort in effortOptions" :key="effort" :value="effort">{{ t(effortLabels[effort]) }}</option>
          </select>
        </div>
        <div v-for="field in numberFields" :key="field.key" class="settings-field" :data-invalid="invalidFields.has(field.key) || undefined" :data-disabled="field.disabled || undefined">
          <label :for="`model-parameter-${field.key}`">{{ t(field.label) }}</label>
          <UiInput :id="`model-parameter-${field.key}`" v-model="form[field.key]" type="number" :min="field.min" :max="field.max" :step="field.step" :disabled="field.disabled"
            :aria-invalid="invalidFields.has(field.key)" :aria-describedby="invalidFields.has(field.key) ? `model-error-${field.key}` : 'model-parameters-help'" :placeholder="t('settings.modelDefaultParameter')" />
          <span v-if="invalidFields.has(field.key)" :id="`model-error-${field.key}`" class="model-parameter-error">{{ t(field.key === 'maxTokens' ? 'settings.modelIntegerRequired' : 'settings.modelRangeRequired', { max: field.max }) }}</span>
        </div>
      </div>
      <p v-if="omitsSampling" class="quiet" role="note">{{ t('settings.modelSamplingUnavailable') }}</p>
      <p v-if="error" class="model-parameter-error" role="alert">{{ error }}</p>
      <div class="model-parameters-actions">
        <UiButton type="button" variant="ghost" size="sm" @click="Object.assign(form, { effort: '', temperature: '', topP: '', maxTokens: '' })">{{ t('settings.modelResetParameters') }}</UiButton>
        <UiButton v-if="stale" type="button" variant="outline" size="sm" @click="emit('reload')">{{ t('settings.refresh') }}</UiButton>
        <UiButton type="button" variant="ghost" size="sm" @click="emit('cancel')">{{ t('settings.cancel') }}</UiButton>
        <UiButton type="submit" size="sm" :disabled="busy || stale || invalidFields.size > 0 || provider.revision == null">{{ t(busy ? 'settings.modelParametersSaving' : 'settings.save') }}</UiButton>
      </div>
    </fieldset>
  </form>
</template>

<style scoped>
.model-parameters-editor { padding: var(--spacing-4, 16px); background: var(--surface-section); border-radius: var(--radius-md); }
fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
legend { font-weight: 600; margin-bottom: var(--spacing-2, 8px); overflow-wrap: anywhere; }
.model-parameters-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr)); gap: var(--spacing-3, 12px); margin-top: var(--spacing-3, 12px); }
.model-parameters-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: var(--spacing-2, 8px); margin-top: var(--spacing-4, 16px); }
.model-parameter-error { color: var(--accent-danger); font-size: var(--font-size-sm, 12px); }
</style>
