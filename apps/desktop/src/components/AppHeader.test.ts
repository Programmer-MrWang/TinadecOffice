// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import AppHeader from './AppHeader.vue'
import CommandPaletteButton from './CommandPaletteButton.vue'
import { UiButton } from './ui'
import stylesCss from '../styles.css?raw'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

describe('AppHeader command palette entry', () => {
  // What the entry says and does is the shared button's own contract
  // (`CommandPaletteButton.test.ts`); this file only proves the live window chrome
  // actually renders it — the defect being guarded against is a header that quietly
  // drops the button, or re-inlines a second copy of its markup.
  it('renders the shared palette entry, not a private copy of it', () => {
    const wrapper = mount(AppHeader)

    expect(wrapper.findComponent(CommandPaletteButton).exists()).toBe(true)
    expect(wrapper.findAllComponents(CommandPaletteButton)).toHaveLength(1)
    wrapper.unmount()
  })
})

describe('AppHeader window controls', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('keeps the controls accessible and sends each click to its window IPC action', async () => {
    const controls = {
      minimizeWindow: vi.fn(),
      maximizeWindow: vi.fn(),
      closeWindow: vi.fn(),
    }
    vi.stubGlobal('tinadec', controls)
    const wrapper = mount(AppHeader)

    for (const [selector, action] of [
      ['.minimize', 'minimizeWindow'],
      ['.maximize', 'maximizeWindow'],
      ['.close', 'closeWindow'],
    ] as const) {
      const button = wrapper.get(selector)
      expect(button.attributes('aria-label')).toBe(button.attributes('title'))
      expect(button.attributes('aria-label')).toBeTruthy()
      expect(button.get('svg').attributes('aria-hidden')).toBe('true')
      expect(wrapper.findComponent<typeof UiButton>(selector).props('variant')).toBe('ghost')
      await button.trigger('click')
      expect(controls[action]).toHaveBeenCalledOnce()
    }
    wrapper.unmount()
  })

  it('uses bare icon controls on both main and settings surfaces, with a keyboard focus outline', () => {
    const base = stylesCss.match(/\.window-controls \.window-btn,\s*\.settings-window-controls \.window-btn\s*\{([^}]*)\}/)?.[1]
    expect(base).toBeTruthy()
    expect(base).toMatch(/background:\s*transparent;/)
    expect(base).toMatch(/border:\s*0;/)
    expect(base).toMatch(/box-shadow:\s*none;/)
    expect(base).toMatch(/width:\s*36px;/)
    expect(base).toMatch(/height:\s*32px;/)
    expect(base).toMatch(/-webkit-app-region:\s*no-drag;/)

    const hover = stylesCss.match(/\.window-controls \.window-btn:hover,\s*\.settings-window-controls \.window-btn:hover\s*\{([^}]*)\}/)?.[1]
    expect(hover).toMatch(/background:\s*transparent;/)
    const focus = stylesCss.match(/\.window-controls \.window-btn:focus-visible,\s*\.settings-window-controls \.window-btn:focus-visible\s*\{([^}]*)\}/)?.[1]
    expect(focus).toMatch(/outline:\s*2px solid var\(--border-input-focus\);/)
  })
})
