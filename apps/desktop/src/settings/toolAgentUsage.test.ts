// @vitest-environment happy-dom
import { effectScope, nextTick, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, type ToolSettingsEffective } from '@/api'
import { useToolAgentUsage } from './toolAgentUsage'

vi.mock('@/api', () => ({ api: { getEffectiveToolSettings: vi.fn() } }))
afterEach(() => { vi.clearAllMocks() })
function response(ids: string[]): ToolSettingsEffective { return { settings_hash: 'fixture', allowed_tool_ids: ids } }

describe('effective Agent tool usage', () => {
  it('uses effective tools per persistent definition in the selected project and isolates failed Agents', async () => {
    vi.mocked(api.getEffectiveToolSettings).mockImplementation(async id => {
      if (id === 'research') return response(['read_file', 'read_file'])
      if (id === 'coding') return response(['shell'])
      if (id === 'unavailable') throw new Error('Core unavailable')
      return { settings_hash: 'missing-list' }
    })
    const scope = effectScope()
    const result = scope.run(() => useToolAgentUsage(() => [
      { id: 'research', display_name: 'Research' }, { id: 'coding', display_name: 'Coding' },
      { id: 'unavailable', display_name: 'Unavailable' }, { id: 'missing', slug: 'Missing' },
      { id: 'disabled', display_name: 'Disabled', enabled: false },
    ], () => 'project', () => undefined))!
    await flushPromises()
    expect(result.usage.value).toEqual({ read_file: ['Research'], shell: ['Coding'] })
    expect(result.failedAgentNames.value).toEqual(['Unavailable', 'Missing'])
    expect(result.loading.value).toBe(false)
    expect(api.getEffectiveToolSettings).toHaveBeenCalledWith('research', 'project')
    expect(api.getEffectiveToolSettings).not.toHaveBeenCalledWith('disabled', 'project')
    scope.stop()
  })

  it('does not let a late project response replace the current usage', async () => {
    let resolveOld!: (value: ToolSettingsEffective) => void
    vi.mocked(api.getEffectiveToolSettings).mockImplementation((_id, project) => project === 'old'
      ? new Promise(resolve => { resolveOld = resolve }) : Promise.resolve(response(['shell'])))
    const project = ref('old')
    const scope = effectScope()
    const result = scope.run(() => useToolAgentUsage(() => [{ id: 'agent', display_name: 'Agent' }], () => project.value, () => undefined))!
    project.value = 'new'
    await nextTick(); await flushPromises()
    expect(result.usage.value).toEqual({ shell: ['Agent'] })
    resolveOld(response(['write_file']))
    await flushPromises()
    expect(result.usage.value).toEqual({ shell: ['Agent'] })
    scope.stop()
  })

  it('clears shared usage and ignores pending reads when a specific Agent is selected', async () => {
    let resolve!: (value: ToolSettingsEffective) => void
    vi.mocked(api.getEffectiveToolSettings).mockImplementation(() => new Promise(done => { resolve = done }))
    const selected = ref<string | undefined>(undefined)
    const scope = effectScope()
    const result = scope.run(() => useToolAgentUsage(() => [{ id: 'agent' }], () => undefined, () => selected.value))!
    selected.value = 'agent'
    await nextTick()
    expect(result.loading.value).toBe(false)
    resolve(response(['read_file']))
    await flushPromises()
    expect(result.usage.value).toEqual({})
    expect(api.getEffectiveToolSettings).toHaveBeenCalledTimes(1)
    await result.refresh()
    expect(api.getEffectiveToolSettings).toHaveBeenCalledTimes(1)
    scope.stop()
  })
})
