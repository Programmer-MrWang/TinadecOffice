// @vitest-environment happy-dom
import { reactive } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ToolJsonEditor from './ToolJsonEditor.vue'
const state = vi.hoisted(() => ({ options: { schemas: [] } as Record<string, any>, changes: vi.fn(), value: '{}', reveal: vi.fn(), position: vi.fn(), focus: vi.fn() }))
vi.mock('@/composables/useMonaco', () => ({ useMonaco: () => ({ getMonaco: async () => ({
  json: { jsonDefaults: { get diagnosticsOptions() { return state.options }, setDiagnosticsOptions(options: Record<string, unknown>) { state.options = structuredClone(options); state.changes(options) } } },
  editor: { createModel: (value: string) => { state.value = value; return { dispose: vi.fn(), getValue: () => state.value, setValue: (next: string) => { state.value = next } } }, create: () => ({ onDidChangeModelContent: vi.fn(), addCommand: vi.fn(), updateOptions: vi.fn(), dispose: vi.fn(), revealLineInCenter: state.reveal, setPosition: state.position, focus: state.focus }) },
  Uri: { parse: (value: string) => value }, KeyMod: { CtrlCmd: 1 }, KeyCode: { KeyS: 2 },
}) }) }))
describe('Tool JSON schema worker contract', () => {
  beforeEach(() => { vi.clearAllMocks(); state.options = { schemas: [] } })
  it('sends a plain clone of a reactive nested schema and unregisters it on disposal', async () => {
    const schema = reactive({ type: 'object', properties: { shell: { type: 'object', properties: { timeout_ms: { type: 'integer', minimum: 1 } } } } })
    const wrapper = mount(ToolJsonEditor, { props: { modelValue: '{}', label: 'Tool behavior', schema } }); await flushPromises()
    expect(state.options.schemas).toHaveLength(1)
    expect(state.options.schemas[0].schema).toEqual(schema)
    expect(state.options.allowComments).toBe(false)
    expect(state.options.trailingCommas).toBe('error')
    expect(wrapper.find('textarea').exists()).toBe(false)
    wrapper.unmount(); expect(state.options.schemas).toHaveLength(0)
  })
  it('focuses the requested category on mount and the root when an inherited category is absent', async () => {
    const wrapper = mount(ToolJsonEditor, { props: { modelValue: '{\n  "shell": {},\n  "read": {}\n}', label: 'Tool behavior', focusPath: 'read' } }); await flushPromises()
    expect(state.reveal).toHaveBeenLastCalledWith(3)
    expect(state.position).toHaveBeenLastCalledWith({ lineNumber: 3, column: 3 })
    expect(state.focus).toHaveBeenCalledOnce()
    await wrapper.setProps({ focusPath: 'write' })
    expect(state.reveal).toHaveBeenLastCalledWith(1)
    expect(state.position).toHaveBeenLastCalledWith({ lineNumber: 1, column: 1 })
    wrapper.unmount()
  })
})
