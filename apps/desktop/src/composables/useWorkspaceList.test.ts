// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { recentWorkspaceSessions, revealWorkspace, useWorkspaceList, workspaceListStorageKey } from './useWorkspaceList'
import type { SessionDto } from '@/api'
describe('workspace list persistence', () => {
  beforeEach(() => localStorage.clear())
  it('reveals a created workspace without resetting manual order or other groups', () => {
    let list!: ReturnType<typeof useWorkspaceList>
    const wrapper = mount(defineComponent({ setup() { list = useWorkspaceList(); return () => null } }))
    list.reconcile(['one', 'two']); list.state.value.collapsed = true
    list.toggle('one', 'collapsedKeys'); list.toggle('two', 'collapsedKeys')
    revealWorkspace('one')
    expect(list.state.value.collapsed).toBe(false)
    expect(list.state.value.collapsedKeys).toEqual(['two'])
    expect(list.state.value.order).toEqual(['one', 'two']); wrapper.unmount()
  })
  it('keeps five recent rows and the active older conversation', () => {
    const rows = Array.from({ length: 9 }, (_, index) => ({ id: `${index}`, storage_id: 'one', updated_at: new Date(index * 1000).toISOString() } as SessionDto))
    expect(recentWorkspaceSessions(rows, 'one::0').map(row => row.id)).toEqual(['8', '7', '6', '5', '4', '0'])
    expect(recentWorkspaceSessions(rows, null, true)).toHaveLength(9)
  })
  it('retains manual order and state across refresh and remount', () => {
    let list!: ReturnType<typeof useWorkspaceList>
    const component = defineComponent({ setup() { list = useWorkspaceList(); return () => null } })
    let wrapper = mount(component)
    list.reconcile(['a::p', 'b::p']); list.step('b::p', -1); list.toggle('a::p', 'collapsedKeys'); list.toggle('b::p', 'allKeys')
    list.reconcile(['a::p', 'b::p']); expect(list.state.value.order).toEqual(['b::p', 'a::p'])
    list.reconcile(['a::p', 'c::p', 'b::p']); expect(list.state.value.order).toEqual(['c::p', 'b::p', 'a::p'])
    wrapper.unmount(); wrapper = mount(component)
    expect(list.state.value.collapsedKeys).toEqual(['a::p']); expect(list.state.value.allKeys).toEqual(['b::p'])
    expect(JSON.parse(localStorage.getItem(workspaceListStorageKey)!)).toEqual(list.state.value); wrapper.unmount()
  })
})
