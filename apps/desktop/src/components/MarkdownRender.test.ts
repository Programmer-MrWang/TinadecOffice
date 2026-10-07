// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'
import MarkdownRender from './MarkdownRender.vue'
import UiIslandCard from './ui/island-card.vue'

function render(content: string) {
  return mount(MarkdownRender, {
    props: { content },
    attachTo: document.body,
    global: { plugins: [createI18n({
      legacy: false, locale: 'en',
      messages: { en: { chat: { markdownTable: 'Markdown table' } } },
    })] },
  })
}

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
})
