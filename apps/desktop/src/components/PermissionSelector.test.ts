// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import en from '@/locales/en'
import PermissionSelector from './PermissionSelector.vue'

afterEach(() => { document.body.innerHTML = '' })
describe('permission selection', () => {
  it('describes command approval and the policy of existing runs', async () => {
    const wrapper = mount(PermissionSelector, { attachTo: document.body, props: { modelValue: 'full-access' }, global: { plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })] } })
    const trigger = wrapper.get('button')
    await trigger.trigger('keydown', { key: 'ArrowDown' })
    await flushPromises()
    expect(trigger.attributes('aria-expanded')).toBe('true')
    const menu = document.querySelector('[role="menu"]')!
    const current = menu.querySelector<HTMLButtonElement>('[aria-checked="true"]')!
    expect(current.textContent).toContain('without manual approval')
    expect(menu.textContent).toContain('An existing run keeps')
    expect(document.activeElement).toBe(current)
    current.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
    expect(document.activeElement).toBe(menu.querySelector('button'))
    document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(document.querySelector('[role="menu"]')).toBeNull()
    expect(document.activeElement).toBe(trigger.element)
    wrapper.unmount()
  })
})
