// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref, type Ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import type { HostConnectionStatus } from '@/lib/hostConnection'
import HostAvailabilityBanner from './HostAvailabilityBanner.vue'
import { retryConnection } from '@/composables/useConnection'
const shared = vi.hoisted(() => ({ status: null as unknown as Ref<HostConnectionStatus> }))
vi.mock('@/lib/hostAccess', () => ({ useHostAccess: () => ({ status: shared.status }) }))
vi.mock('@/composables/useConnection', () => ({ retryConnection: vi.fn() }))
vi.mock('@/composables/usePanelStyles', () => ({ usePanelStyles: () => ({
  getPanelStyle: () => ({ backdropFilter: 'blur(8px)' }), getPanelDataAttributes: () => ({ 'data-panel-effect': 'blur' }),
}) }))
vi.mock('@/components/ui', () => ({ UiButton: { template: '<button><slot /></button>' } }))
describe('HostAvailabilityBanner', () => {
  let wrapper: ReturnType<typeof mount> | undefined
  beforeEach(() => { shared.status = ref({ state: 'ready', managed: true }); vi.clearAllMocks() })
  afterEach(() => wrapper?.unmount())
  function render(locale = 'zh-CN') {
    wrapper = mount(HostAvailabilityBanner, { global: { plugins: [createI18n({ legacy: false, locale, fallbackLocale: 'en', messages: {} })] } })
    return wrapper
  }
  it('keeps healthy host clear and explains preview without a fake retry action', async () => {
    const w = render(); expect(w.find('aside').exists()).toBe(false)
    shared.status.value = { state: 'preview', managed: false }; await w.vm.$nextTick()
    expect(w.text()).toContain('界面预览'); expect(w.text()).toContain('不连接用户数据')
    expect(w.find('button').exists()).toBe(false)
    expect(w.get('aside').attributes('data-panel-effect')).toBe('blur')
    expect(w.get('aside').attributes('style')).toContain('blur(8px)')
  })
  it('retries a real rejected host and prevents repeated clicks while pending', async () => {
    shared.status.value = { state: 'rejected', managed: true }
    let release!: (result: boolean) => void
    vi.mocked(retryConnection).mockImplementation(() => new Promise(resolve => { release = resolve }))
    const w = render(); expect(w.text()).toContain('身份验证失败')
    await w.get('button').trigger('click'); await w.get('button').trigger('click')
    expect(retryConnection).toHaveBeenCalledTimes(1); expect(w.get('button').attributes('disabled')).toBeDefined()
    shared.status.value = { state: 'ready', managed: true }; release(true)
    await vi.waitFor(() => expect(w.find('aside').exists()).toBe(false))
  })
  it('shows the unavailable host in English and reports background verification', async () => {
    shared.status.value = { state: 'unavailable', managed: true }
    const w = render('en'); expect(w.text()).toContain('Desktop host disconnected')
    expect(w.get('button').text()).toBe('Retry host connection')
    shared.status.value = { state: 'checking', managed: true }; await w.vm.$nextTick()
    expect(w.text()).toContain('Verifying the desktop host again')
  })
})
