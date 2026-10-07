// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MarkdownRender from './MarkdownRender.vue'
import UiIslandCard from './ui/island-card.vue'

function render(content: string) {
  return mount(MarkdownRender, {
    props: { content },
    attachTo: document.body,
    global: { plugins: [createI18n({
      legacy: false, locale: 'en',
      messages: {
        en: {
          chat: {
            markdownTable: 'Markdown table',
            markdownCopy: 'Copy code',
            markdownCopied: 'Copied',
            markdownCopyFailed: 'Copy failed',
            markdownAnchor: 'Jump to this heading',
            markdownFootnotes: 'Footnotes',
            markdownBackReference: 'Back to reference {n}',
            callout: {
              note: 'Note',
              tip: 'Tip',
              important: 'Important',
              warning: 'Warning',
              caution: 'Caution',
            },
          },
        },
      },
    })] },
  })
}

function stubClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: { writeText } })
}

afterEach(() => {
  Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: undefined })
  vi.restoreAllMocks()
})

describe('Markdown content islands', () => {
  it('keeps prose continuous and uses existing island cards for quotes, code and tables', () => {
    const wrapper = render('正文 **加粗** 与 [引用][ref]\n\n> 引用内容\n\n```js\nconst answer = 42;\n```\n\n| 左 | 中 | 右 |\n| :--- | :---: | ---: |\n| A | B | C |\n\n[ref]: https://example.invalid/reference')
    expect(wrapper.findAllComponents(UiIslandCard)).toHaveLength(3)
    expect(wrapper.get('.markdown-prose strong').text()).toBe('加粗')
    expect(wrapper.get('a').attributes('href')).toBe('https://example.invalid/reference')
    expect(wrapper.get('.island-body blockquote').text()).toBe('引用内容')
    expect(wrapper.get('.island-body code.language-js').text()).toBe('const answer = 42;')
    const region = wrapper.get('.markdown-table-scroll')
    expect(region.attributes()).toMatchObject({ role: 'region', tabindex: '0', 'aria-label': 'Markdown table' })
    expect(wrapper.findAll('th').map(cell => cell.attributes('align'))).toEqual(['left', 'center', 'right'])
    expect(wrapper.findAll('.island-card').every(card => card.attributes('data-panel-effect') === undefined)).toBe(true)
    wrapper.unmount()
  })

  it('retains nested lists, ordered starts and readonly task states', () => {
    const wrapper = render('3. 第三项\n4. 第四项\n\n- 父项目\n  - 子项目\n\n- [x] 已完成\n- [ ] 待处理')
    expect(wrapper.get('ol').attributes('start')).toBe('3')
    expect(wrapper.get('ul ul').text()).toBe('子项目')
    expect(wrapper.findAll<HTMLInputElement>('input[type="checkbox"]').map(box => [box.element.checked, box.element.disabled]))
      .toEqual([[true, true], [false, true]])
    wrapper.unmount()
  })

  it('wraps nested HTML tables while preserving text and sanitizing the complete document', () => {
    const wrapper = render('<div>前文<table><tr><td>嵌套表格</td></tr></table>后文</div>\n<script type="application/json">{"inert":true}</script>')
    expect(wrapper.text()).toBe('前文嵌套表格后文')
    expect(wrapper.get('.markdown-table-scroll td').text()).toBe('嵌套表格')
    expect(wrapper.find('script').exists()).toBe(false)
    wrapper.unmount()
  })

  it('escapes text nodes instead of re-parsing them as markup', () => {
    const wrapper = render('&lt;img src=x onerror=alert(1)&gt;')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.get('.markdown-prose').text()).toBe('<img src=x onerror=alert(1)>')
    wrapper.unmount()
  })

  it('preserves completed block DOM and table focus when later streaming prose changes', async () => {
    const completed = '```js\nconst answer = 42;\n```\n\n| 列 |\n| --- |\n| 值 |\n\n'
    const wrapper = render(completed + '后续文字')
    const code = wrapper.get('pre code').element
    const region = wrapper.get<HTMLElement>('.markdown-table-scroll').element
    region.focus()
    await wrapper.setProps({ content: completed + '后续文字继续 **加粗**' })
    expect(wrapper.get('pre code').element).toBe(code)
    expect(wrapper.get('.markdown-table-scroll').element).toBe(region)
    expect(document.activeElement).toBe(region)
    expect(wrapper.get('.markdown-prose strong').text()).toBe('加粗')
    wrapper.unmount()
  })

  it('updates unfinished fences inside the same island and renders no placeholder for empty text', async () => {
    const wrapper = render('')
    expect(wrapper.findAllComponents(UiIslandCard)).toHaveLength(0)
    await wrapper.setProps({ content: '```js\nconst answer =' })
    const card = wrapper.get('.island-card').element
    expect(wrapper.get('pre code').text()).toBe('const answer =')
    await wrapper.setProps({ content: '```js\nconst answer = 42;\n```' })
    expect(wrapper.get('.island-card').element).toBe(card)
    expect(wrapper.get('pre code').text()).toBe('const answer = 42;')
    wrapper.unmount()
  })

  it('highlights fenced code, labels its language and keeps unlabelled fences quiet', () => {
    const wrapper = render('```js\nconst answer = 42;\n```\n\n```text\nplain\n```')
    const cards = wrapper.findAll('.markdown-code')
    expect(cards).toHaveLength(2)
    expect(cards[0]!.get('.markdown-code-lang').text()).toBe('js')
    expect(cards[0]!.findAll('.hljs-keyword').length).toBeGreaterThan(0)
    expect(cards[1]!.get('.markdown-code-lang').text()).toBe('')
    wrapper.unmount()
  })

  it('copies the raw code and reports the result on the button', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined)
    stubClipboard(writeText)
    const wrapper = render('```js\nconst answer = 42;\n```')
    await wrapper.get('.markdown-copy').trigger('click')
    expect(writeText).toHaveBeenCalledWith('const answer = 42;\n')
    expect(wrapper.get('.markdown-copy').classes()).toContain('is-copied')
    expect(wrapper.get('.markdown-copy').text()).toContain('Copied')
    wrapper.unmount()
  })

  it('reports a failed copy instead of pretending it succeeded', async () => {
    stubClipboard(() => Promise.reject(new Error('denied')))
    const wrapper = render('```js\nconst answer = 42;\n```')
    await wrapper.get('.markdown-copy').trigger('click')
    expect(wrapper.get('.markdown-copy').classes()).toContain('is-failed')
    expect(wrapper.get('.markdown-copy').text()).toContain('Copy failed')
    expect(wrapper.get('pre code').text()).toBe('const answer = 42;')
    wrapper.unmount()
  })
})

describe('Markdown extended syntax', () => {
  it('renders inline and display maths that survive sanitizing', () => {
    const wrapper = render('行内 $a^2+b^2=c^2$ 结束。\n\n$$\n\\frac{1}{2}\n$$')
    // happy-dom does not parse MathML, so the real Chromium check for the
    // <math> branches lives in the Electron fixture; here the KaTeX output itself
    // is asserted, including the display wrapper.
    expect(wrapper.findAll('.katex').length).toBeGreaterThanOrEqual(2)
    expect(wrapper.find('.katex-display').exists()).toBe(true)
    expect(wrapper.find('.katex-display .katex').exists()).toBe(true)
    wrapper.unmount()
  })

  it('localises footnote labels and keeps the reference reachable', () => {
    const wrapper = render('脚注[^1]。\n\n[^1]: 脚注正文。')
    const section = wrapper.get('.footnotes')
    expect(section.text()).toContain('脚注正文。')
    expect(section.get('h2').text()).toBe('Footnotes')
    expect(wrapper.get('a[data-footnote-ref]').attributes('href')).toBe('#footnote-1')
    expect(section.get('a[data-footnote-backref]').attributes('aria-label')).toBe('Back to reference 1')
    wrapper.unmount()
  })

  it('turns alert quotes into typed callouts and leaves ordinary quotes alone', () => {
    const wrapper = render('> [!WARNING]\n> 注意磁盘空间\n\n> [!NOTE] 自定义标题\n> 正文\n\n> 普通引用')
    const callouts = wrapper.findAll('.markdown-callout')
    expect(callouts).toHaveLength(2)
    expect(callouts[0]!.classes()).toContain('is-warning')
    expect(callouts[0]!.get('.markdown-callout-head').text()).toBe('Warning')
    expect(callouts[0]!.get('.markdown-callout-body').text()).toBe('注意磁盘空间')
    expect(callouts[1]!.get('.markdown-callout-head').text()).toBe('自定义标题')
    expect(wrapper.findAll('.markdown-island').length).toBe(3)
    expect(wrapper.find('.markdown-island:not(.markdown-callout) blockquote').exists()).toBe(true)
    wrapper.unmount()
  })

  it('gives headings a prefixed, de-duplicated id and a hover anchor', () => {
    const wrapper = render('## 标题一\n\n## 标题一\n\n## 标题二')
    const headings = wrapper.findAll('h2')
    expect(headings.map(heading => heading.attributes('id'))).toEqual(['md-标题一', 'md-标题一-2', 'md-标题二'])
    const anchor = headings[0]!.get('.markdown-anchor')
    expect(anchor.attributes('href')).toBe('#md-标题一')
    expect(anchor.attributes('aria-label')).toBe('Jump to this heading')
    wrapper.unmount()
  })

  it('scrolls to an in-page anchor without touching the router hash', async () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    const wrapper = render('## 标题\n\n正文')
    const hash = window.location.hash
    await wrapper.get('.markdown-anchor').trigger('click')
    expect(scrollIntoView).toHaveBeenCalled()
    expect(window.location.hash).toBe(hash)
    expect(wrapper.get('h2').classes()).toContain('is-anchor-target')
    wrapper.unmount()
  })
})
