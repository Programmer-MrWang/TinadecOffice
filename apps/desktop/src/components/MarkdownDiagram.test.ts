// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { afterEach, describe, expect, it, vi } from 'vitest'
import mermaid, { type ParseResult } from 'mermaid'
import MarkdownDiagram from './MarkdownDiagram.vue'

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    parse: vi.fn(async () => true),
    render: vi.fn(async () => ({ svg: '<svg data-testid="diagram"></svg>' })),
  },
}))

const diagram = vi.mocked(mermaid)

function render(code: string) {
  return mount(MarkdownDiagram, {
    props: { code },
    attachTo: document.body,
    global: { plugins: [createI18n({
      legacy: false, locale: 'en',
      messages: { en: { chat: { markdownDiagram: 'Diagram', markdownDiagramError: 'Diagram failed' } } },
    })] },
  })
}

afterEach(() => {
  vi.clearAllMocks()
})

const SOURCE = 'graph TD\n  A --> B'

describe('MarkdownDiagram', () => {
  it('renders the diagram with a per-diagram id and the strict security level', async () => {
    const wrapper = render(SOURCE)
    await flushPromises()
    expect(wrapper.find('.markdown-diagram-svg svg').exists()).toBe(true)
    expect(diagram.initialize).toHaveBeenCalledWith(expect.objectContaining({ securityLevel: 'strict', startOnLoad: false }))
    expect(diagram.render).toHaveBeenCalledWith(expect.stringMatching(/^md-diagram-\d+$/), SOURCE)
    wrapper.unmount()
  })

  it('keeps the source visible when the diagram cannot be parsed', async () => {
    // mermaid resolves `false` for an invalid diagram when errors are suppressed.
    diagram.parse.mockResolvedValueOnce(false as unknown as ParseResult)
    const wrapper = render(SOURCE)
    await flushPromises()
    expect(wrapper.find('.markdown-diagram-svg').exists()).toBe(false)
    expect(wrapper.get('.markdown-diagram-fallback code').text()).toBe(SOURCE)
    expect(wrapper.get('.markdown-diagram-note').text()).toContain('Diagram failed')
    wrapper.unmount()
  })

  it('does not hand an oversized diagram to mermaid', async () => {
    const wrapper = render(`graph TD\n${'A-->B\n'.repeat(4000)}`)
    await flushPromises()
    expect(diagram.render).not.toHaveBeenCalled()
    expect(wrapper.find('.markdown-diagram-note').exists()).toBe(true)
    wrapper.unmount()
  })
})
