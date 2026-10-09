// @vitest-environment happy-dom
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { describe, expect, it, vi } from 'vitest'
import zh from '@/locales/zh-CN'
import { api } from '@/api'
import ToolsOverviewPanel from './ToolsOverviewPanel.vue'

vi.mock('@/components/ui', () => ({ UiButton: { template: '<button><slot /></button>' }, UiBadge: { template: '<span><slot /></span>' }, UiInput: { template: '<input />' } }))
vi.mock('@/composables/useNotifications', () => ({ useNotifications: () => ({ notify: { error: vi.fn() } }) }))
vi.mock('@/api', () => ({ api: { getToolLayerReadiness: vi.fn(), getHarnessManifest: vi.fn(), listTools: vi.fn(), searchTools: vi.fn(), getEffectiveToolSettings: vi.fn() } }))
const tools = ['read_file', 'write_file'].map(id => ({ id, display_name: id, description: id, source: 'native', risk: 'low', capabilities: [], requires_approval: false }))

describe('Tools effective overview', () => {
  it('uses the live tool inventory when the harness manifest is empty and filters the selected Agent grants', async () => {
    vi.mocked(api.getToolLayerReadiness).mockResolvedValue(null as never)
    vi.mocked(api.getHarnessManifest).mockResolvedValue({ tools: [] } as never)
    vi.mocked(api.listTools).mockResolvedValue(tools as never)
    vi.mocked(api.searchTools).mockResolvedValue(tools.map(tool => ({ tool, score: 1 })) as never)
    const wrapper = mount(ToolsOverviewPanel, { props: { agentId: 'research', agents: [{ id: 'research', display_name: 'Research' }], effectiveToolIds: ['read_file'] }, global: { plugins: [createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': zh } })] } })
    await flushPromises()
    expect(api.listTools).toHaveBeenCalledOnce()
    expect(wrapper.get('.tools-effective-card strong').text()).toContain('1')
    expect(wrapper.findAll('.tool-discovery-card')).toHaveLength(1)
    expect(wrapper.get('.tool-discovery-card').text()).toContain('read_file')
    expect(wrapper.get('.tool-discovery-card').text()).not.toContain('write_file')
    expect(wrapper.find('.tool-discovery-card code').exists()).toBe(false)
    expect(wrapper.get('.tools-tool-facts').text()).toContain('使用智能体：Research')
    expect(api.getEffectiveToolSettings).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('displays shared usage from effective grants and declares a missing source explicitly', async () => {
    vi.mocked(api.getHarnessManifest).mockResolvedValue({ tools: [] } as never)
    vi.mocked(api.listTools).mockResolvedValue(tools as never)
    vi.mocked(api.searchTools).mockResolvedValue([{ tool: { ...tools[0]!, source: '' }, score: 1 }] as never)
    vi.mocked(api.getEffectiveToolSettings).mockResolvedValue({ allowed_tool_ids: ['read_file'], settings: {}, settings_hash: 'effective' })
    const wrapper = mount(ToolsOverviewPanel, { props: { agents: [{ id: 'research', display_name: 'Research' }], projectId: 'project-a' }, global: { plugins: [createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': zh } })] } })
    await flushPromises()
    expect(api.getEffectiveToolSettings).toHaveBeenCalledWith('research', 'project-a')
    expect(wrapper.get('.tools-tool-facts').text()).toContain('来源未声明')
    expect(wrapper.get('.tools-tool-facts').text()).toContain('使用智能体：Research')
    wrapper.unmount()
  })
})
