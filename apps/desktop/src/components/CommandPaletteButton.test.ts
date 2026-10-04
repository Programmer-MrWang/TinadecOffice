// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import CommandPaletteButton from './CommandPaletteButton.vue'
import { closePalette, paletteIsOpen } from '@/composables/useCommandPalette'
import { PALETTE_COMBO, formatCombo } from '@/lib/keybindings'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, named?: unknown) =>
      named && typeof named === 'object' && 'combo' in named
        ? `${key}:${(named as { combo: string }).combo}`
        : key,
  }),
}))

describe('CommandPaletteButton', () => {
  afterEach(() => closePalette())

  it('names itself after the palette and announces the real binding', () => {
    const button = mount(CommandPaletteButton).get('[data-testid="command-palette-button"]')

    expect(button.attributes('aria-label')).toBe('palette.title')
    expect(button.attributes('aria-haspopup')).toBe('dialog')
    expect(button.attributes('aria-expanded')).toBe('false')
    // The shortcut comes from the binding owner, so a tooltip can never advertise a combo
    // this platform does not use, and the palette cannot be renamed away from its button.
    expect(button.attributes('aria-keyshortcuts')).toBe(formatCombo(PALETTE_COMBO))
    expect(button.attributes('title')).toBe(`palette.openWithShortcut:${formatCombo(PALETTE_COMBO)}`)
  })

  it('clicking the button expands the strip instead of opening the dialog', async () => {
    const wrapper = mount(CommandPaletteButton)
    expect(paletteIsOpen()).toBe(false)

    await wrapper.get('[data-testid="command-palette-button"]').trigger('click')

    // The dialog stays closed until there is a query; the strip is the
    // preview of the surface, not a second surface of its own.
    expect(paletteIsOpen()).toBe(false)
    expect(wrapper.find('[data-testid="command-palette-button"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="palette-entry-input-wrap"]').exists()).toBe(true)
  })

  it('typing into the strip and pressing Enter hands the query over to the dialog', async () => {
    const wrapper = mount(CommandPaletteButton)
    await wrapper.get('[data-testid="command-palette-button"]').trigger('click')

    const input = wrapper.get('[data-testid="palette-entry-input"]')
    await input.setValue('launcher')
    await input.trigger('keydown', { key: 'Enter' })

    expect(paletteIsOpen()).toBe(true)
    // The strip collapses once the palette takes over; two inputs would
    // fight for the same keystroke behind the dialog.
    expect(wrapper.find('[data-testid="palette-entry-input-wrap"]').exists()).toBe(false)
  })

  it('the strip closes itself on Escape without touching the palette', async () => {
    const wrapper = mount(CommandPaletteButton)
    await wrapper.get('[data-testid="command-palette-button"]').trigger('click')
    expect(wrapper.find('[data-testid="palette-entry-input-wrap"]').exists()).toBe(true)

    await wrapper.get('[data-testid="palette-entry-input"]').trigger('keydown', { key: 'Escape' })

    expect(paletteIsOpen()).toBe(false)
    expect(wrapper.find('[data-testid="palette-entry-input-wrap"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="command-palette-button"]').exists()).toBe(true)
  })
})
