<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import UiIslandCard from './ui/island-card.vue'

const props = defineProps<{
  content: string
}>()

const { t } = useI18n()

/**
 * A reply is continuous prose plus island cards: code, tables and quotes each
 * reuse the shared card instead of inventing a second surface.
 */
interface MarkdownBlock {
  island: boolean
  html: string
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] as string)
}

/**
 * The html goes back through `v-html`, so a text node is escaped: a model that
 * types `&lt;img onerror=…&gt;` must still see text, not markup.
 */
function outerHtml(node: ChildNode): string {
  if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent ?? '')
  return (node as Element).outerHTML
}

const blocks = computed<MarkdownBlock[]>(() => {
  const raw = marked.parse(props.content, {
    breaks: true,
    gfm: true,
    async: false,
  }) as string
  // Sanitize the complete document first so reference links and nested Markdown
  // retain their meaning. Only trusted layout wrappers are added afterwards.
  const fragment = DOMPurify.sanitize(raw, { RETURN_DOM_FRAGMENT: true })
  for (const table of fragment.querySelectorAll('table')) {
    const scroll = document.createElement('div')
    scroll.className = 'markdown-table-scroll'
    scroll.tabIndex = 0
    scroll.setAttribute('role', 'region')
    scroll.setAttribute('aria-label', t('chat.markdownTable'))
    table.replaceWith(scroll)
    scroll.appendChild(table)
  }
  return Array.from(fragment.childNodes)
    .filter(node => node.nodeType !== Node.COMMENT_NODE
      && (node.nodeType !== Node.TEXT_NODE || Boolean(node.textContent?.trim())))
    .map(node => {
      const element = node.nodeType === Node.ELEMENT_NODE ? node as Element : null
      const tag = element?.tagName.toLowerCase()
      const island = tag === 'pre' || tag === 'blockquote'
        || Boolean(element?.classList.contains('markdown-table-scroll'))
      return { island, html: outerHtml(node) }
    })
})
</script>

<template>
  <div class="markdown-body">
    <template v-for="(block, index) in blocks" :key="index">
      <UiIslandCard v-if="block.island" class="markdown-island" padding="none">
        <div class="markdown-island-content" v-html="block.html" />
      </UiIslandCard>
      <div v-else class="markdown-prose" v-html="block.html" />
    </template>
  </div>
</template>
