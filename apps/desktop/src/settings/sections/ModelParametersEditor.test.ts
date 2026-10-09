// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import en from '@/locales/en'
import type { ModelProviderInstanceDto } from '@/api'
import ModelParametersEditor from './ModelParametersEditor.vue'
import { captureStorageId, setSelectedStorage } from '@/lib/storageScope'

const mocks = vi.hoisted(() => ({ save: vi.fn() }))
vi.mock('@/api', () => ({ api: { saveModelProvider: mocks.save } }))
const provider: ModelProviderInstanceDto = {
  id: 'provider-a', driver: 'openai', protocol: 'openai-responses', display_name: 'A', connection_kind: 'api-key',
  has_api_key: true, enabled: true, capabilities: ['chat'], status: 'ready', status_message: '', revision: 7, created_at: '', updated_at: '',
  model_parameters: { 'test-model': { reasoning_effort: 'high', max_output_tokens: 8192 }, other: { temperature: 0.2 } },
}
const i18n = () => createI18n({ legacy: false, locale: 'en', messages: { en } })
afterEach(() => vi.resetAllMocks())

describe('model parameter editor', () => {
  it('writes user defaults even while Home shows a project', async () => {
    const storage: string[] = []
    mocks.save.mockImplementation(async () => { storage.push(captureStorageId('/api/v1/model-providers/provider-a')); return provider })
    setSelectedStorage('active-project')
    const wrapper = mount(ModelParametersEditor, { props: { provider, model: 'test-model' }, global: { plugins: [i18n()] } })
    await wrapper.get('#model-reasoning').setValue('low'); await wrapper.get('form').trigger('submit'); await flushPromises()
    expect(storage).toEqual(['user'])
    wrapper.unmount(); setSelectedStorage('user')
  })
  it('saves per model with the provider revision and keeps sibling parameters', async () => {
    const wrapper = mount(ModelParametersEditor, { props: { provider, model: 'test-model' }, global: { plugins: [i18n()] } })
    await wrapper.get('#model-reasoning').setValue('xhigh')
    await wrapper.get('#model-parameter-temperature').setValue('0')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(mocks.save).toHaveBeenCalledWith('provider-a', expect.objectContaining({
      model_parameters: { 'test-model': { reasoning_effort: 'xhigh', temperature: 0, max_output_tokens: 8192 }, other: { temperature: 0.2 } },
    }), { expected_revision: 7 })
    expect(wrapper.emitted('saved')).toHaveLength(1)
    wrapper.unmount()
  })
  it('resets this model without erasing sibling settings', async () => {
    const wrapper = mount(ModelParametersEditor, { props: { provider, model: 'test-model' }, global: { plugins: [i18n()] } })
    await wrapper.get('button[type="button"]').trigger('click')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(mocks.save.mock.calls[0]?.[1].model_parameters).toEqual({ other: { temperature: 0.2 } })
    wrapper.unmount()
  })
  it('refuses fractional output limits and exposes an accessible field error', async () => {
    const wrapper = mount(ModelParametersEditor, { props: { provider, model: 'test-model' }, global: { plugins: [i18n()] } })
    await wrapper.get('#model-parameter-maxTokens').setValue('1.5')
    expect(wrapper.get('#model-parameter-maxTokens').attributes('aria-invalid')).toBe('true')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    await wrapper.get('form').trigger('submit')
    expect(mocks.save).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('keeps the editor and unsaved choices after a stale-write rejection', async () => {
    mocks.save.mockRejectedValue(Object.assign(new Error('stale'), { status: 412 }))
    const wrapper = mount(ModelParametersEditor, { props: { provider, model: 'test-model' }, global: { plugins: [i18n()] } })
    await wrapper.get('#model-reasoning').setValue('low')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Refresh')
    expect((wrapper.get('#model-reasoning').element as HTMLSelectElement).value).toBe('low')
    expect(wrapper.emitted('saved')).toBeUndefined()
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
  it('omits sampling for OpenAI reasoning models and hides unsupported reasoning on Anthropic', async () => {
    const wrapper = mount(ModelParametersEditor, { props: { provider, model: 'gpt-5.4' }, global: { plugins: [i18n()] } })
    await wrapper.get('#model-reasoning').setValue('high')
    expect(wrapper.get('#model-parameter-temperature').attributes('disabled')).toBeDefined()
    await wrapper.setProps({ provider: { ...provider, protocol: 'anthropic-messages', revision: 8 } })
    expect(wrapper.find('#model-reasoning').exists()).toBe(false)
    await wrapper.get('#model-parameter-temperature').setValue('1.5')
    expect(wrapper.get('#model-parameter-temperature').attributes('aria-invalid')).toBe('true')
    wrapper.unmount()
  })
})
