// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref, type PropType } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import UieCanvas from '../../../TinadecUI/src/components/UieCanvas.vue'
import { __resetUieForTests, initUie, type UieStore } from '../../../TinadecUI/src/components/useUie'
import { createCardRegistry } from '../../../TinadecUI/src/engine/registry'
import type { UieColumn } from '../../../TinadecUI/src/engine/types'

const lifecycle = vi.hoisted(() => ({ created: vi.fn(), destroyed: vi.fn() }))
vi.mock('../../../TinadecUI/src/components/UieColumn.vue', async () => {
  const { onBeforeUnmount } = await import('vue')
  return { default: defineComponent({
    props: { column: { type: Object as PropType<UieColumn>, required: true } },
    setup(props) {
      lifecycle.created(props.column.slotId)
      onBeforeUnmount(() => lifecycle.destroyed(props.column.slotId))
      const count = ref(0)
      return () => h('section', { 'data-column': props.column.slotId }, [
        h('button', { onClick: () => count.value++ }, String(count.value)),
      ])
    },
  }) }
})

let uie: UieStore
let wrapper: VueWrapper | undefined
beforeEach(() => {
  vi.clearAllMocks()
  __resetUieForTests()
  uie = initUie({ registry: createCardRegistry() })
})
afterEach(() => { wrapper?.unmount(); wrapper = undefined; __resetUieForTests() })

describe('UIE spatial panel lifecycle', () => {
  it('creates the right column only on first open, then hides and reuses its mounted state', async () => {
    wrapper = mount(UieCanvas, { attachTo: document.body, props: { spatial: true, spatialPanel: false }, slots: { default: '<p>Canvas work</p>' } })
    expect(lifecycle.created.mock.calls.map(([id]) => id)).toEqual(['left'])
    expect(wrapper.find('[data-column="right"]').exists()).toBe(false)
    expect(wrapper.get('.uie-space-stage').text()).toBe('Canvas work')
    expect(wrapper.get('.uie-space-stage').attributes('style')).toContain('right: 8px')

    await wrapper.setProps({ spatialPanel: true })
    const right = wrapper.get('[data-column="right"]')
    const element = right.element
    await right.get('button').trigger('click')
    expect(right.isVisible()).toBe(true)
    expect(right.get('button').text()).toBe('1')
    expect(wrapper.get('.uie-space-stage').attributes('style')).toContain(`right: ${uie.geometry.value.columns.right.width + uie.snapshot.value.gap}px`)

    await wrapper.setProps({ spatialPanel: false })
    expect(wrapper.get('[data-column="right"]').element).toBe(element)
    expect(wrapper.get('[data-column="right"]').isVisible()).toBe(false)
    expect(lifecycle.destroyed).not.toHaveBeenCalled()
    expect(wrapper.get('.uie-space-stage').attributes('style')).toContain('right: 8px')

    await wrapper.setProps({ spatialPanel: true })
    expect(wrapper.get('[data-column="right"]').element).toBe(element)
    expect(wrapper.get('[data-column="right"] button').text()).toBe('1')
    expect(wrapper.get('[data-column="right"]').isVisible()).toBe(true)
    expect(lifecycle.created.mock.calls.map(([id]) => id)).toEqual(['left', 'right'])
  })

  it('creates a panel requested at mount and leaves flat column order and visibility unchanged', async () => {
    wrapper = mount(UieCanvas, { props: { spatial: true, spatialPanel: true } })
    expect(wrapper.get('[data-column="right"]').isVisible()).toBe(true)
    wrapper.unmount()
    lifecycle.created.mockClear()

    uie.snapshot.value = { ...uie.snapshot.value, columnOrder: ['right', 'left', 'center'] }
    wrapper = mount(UieCanvas, { props: { spatialPanel: false } })
    expect(wrapper.findAll('[data-column]').map(column => column.attributes('data-column'))).toEqual(['right', 'left', 'center'])
    expect(wrapper.find('.uie-space-stage').exists()).toBe(false)
    const right = wrapper.get('[data-column="right"]').element
    await wrapper.setProps({ spatialPanel: true })
    await wrapper.setProps({ spatialPanel: false })
    expect(wrapper.get('[data-column="right"]').isVisible()).toBe(true)
    expect(wrapper.get('[data-column="right"]').element).toBe(right)
    expect(lifecycle.created).toHaveBeenCalledTimes(3)
  })
})
