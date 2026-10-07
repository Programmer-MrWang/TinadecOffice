<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, Copy } from '@lucide/vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import cpp from 'highlight.js/lib/languages/cpp'
import csharp from 'highlight.js/lib/languages/csharp'
import css from 'highlight.js/lib/languages/css'
import diff from 'highlight.js/lib/languages/diff'
import dockerfile from 'highlight.js/lib/languages/dockerfile'
import go from 'highlight.js/lib/languages/go'
import ini from 'highlight.js/lib/languages/ini'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import markdown from 'highlight.js/lib/languages/markdown'
import plaintext from 'highlight.js/lib/languages/plaintext'
import powershell from 'highlight.js/lib/languages/powershell'
import python from 'highlight.js/lib/languages/python'
import rust from 'highlight.js/lib/languages/rust'
import sql from 'highlight.js/lib/languages/sql'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'
import UiIslandCard from './ui/island-card.vue'

const props = defineProps<{
  content: string
}>()

const { t } = useI18n()

/**
 * A reply is continuous prose plus island cards: code, tables and quotes each
 * reuse the shared card instead of inventing a second surface. Only code carries
 * a header, because only code has something to copy.
 */
type MarkdownBlock =
  | { kind: 'prose'; html: string }
  | { kind: 'island'; html: string }
  | { kind: 'code'; html: string; code: string; language: string | null }

/** Fences whose "language" says nothing useful keep the header free of a label. */
const UNLABELLED_LANGUAGES = new Set(['text', 'txt', 'plain', 'plaintext', 'none', ''])

const languageModules: Array<[string, unknown]> = [
  ['bash', bash],
  ['cpp', cpp],
  ['csharp', csharp],
  ['css', css],
  ['diff', diff],
  ['dockerfile', dockerfile],
  ['go', go],
  ['ini', ini],
  ['java', java],
  ['javascript', javascript],
  ['json', json],
  ['markdown', markdown],
  ['plaintext', plaintext],
  ['powershell', powershell],
  ['python', python],
  ['rust', rust],
  ['sql', sql],
  ['typescript', typescript],
  ['xml', xml],
  ['yaml', yaml],
]
for (const [name, definition] of languageModules) hljs.registerLanguage(name, definition as never)

/**
 * A reply is re-parsed on every streaming delta, so the same code block would be
 * highlighted again and again. The cache keeps that off the hot path; it is
 * cleared wholesale at the cap because a reply is not worth LRU bookkeeping.
 */
const highlightCache = new Map<string, string>()
const HIGHLIGHT_CACHE_LIMIT = 240

function highlightCode(code: string, language: string | null): string {
  const key = `${language ?? ''}\u0000${code}`
  const cached = highlightCache.get(key)
  if (cached !== undefined) return cached
  const resolved = language ? hljs.getLanguage(language) : undefined
  let value: string
  try {
    value = hljs.highlight(code, { language: resolved?.name ?? 'plaintext', ignoreIllegals: true }).value
  } catch {
    value = hljs.highlight(code, { language: 'plaintext', ignoreIllegals: true }).value
  }
  if (highlightCache.size >= HIGHLIGHT_CACHE_LIMIT) highlightCache.clear()
  highlightCache.set(key, value)
  return value
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

function fenceLanguage(code: Element): string | null {
  const match = /(?:^|\s)language-([^\s]+)/i.exec(code.className)
  return match?.[1] ? match[1].toLowerCase() : null
}

function codeBlock(pre: Element): MarkdownBlock | null {
  const code = pre.querySelector('code')
  if (!code) return null
  const language = fenceLanguage(code)
  const text = code.textContent ?? ''
  code.classList.add('hljs')
  code.innerHTML = highlightCode(text, language)
  return { kind: 'code', html: pre.outerHTML, code: text, language }
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
  const blocks: MarkdownBlock[] = []
  for (const node of Array.from(fragment.childNodes)) {
    if (node.nodeType === Node.COMMENT_NODE) continue
    if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) continue
    const element = node.nodeType === Node.ELEMENT_NODE ? node as Element : null
    const tag = element?.tagName.toLowerCase()
    if (element?.tagName.toLowerCase() === 'pre') {
      blocks.push(codeBlock(element) ?? { kind: 'prose', html: outerHtml(node) })
      continue
    }
    const island = tag === 'blockquote' || Boolean(element?.classList.contains('markdown-table-scroll'))
    blocks.push({ kind: island ? 'island' : 'prose', html: outerHtml(node) })
  }
  return blocks
})

const copiedIndex = ref<number | null>(null)
const failedIndex = ref<number | null>(null)
let feedbackTimer: ReturnType<typeof setTimeout> | null = null

function resetFeedback() {
  if (feedbackTimer) clearTimeout(feedbackTimer)
  feedbackTimer = setTimeout(() => {
    copiedIndex.value = null
    failedIndex.value = null
  }, 1600)
}

/**
 * Electron loads the built page from disk, where the async clipboard may be
 * unavailable; the legacy path keeps the copy button working there too.
 */
async function writeClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.top = '-1000px'
  document.body.appendChild(area)
  try {
    area.select()
    if (!document.execCommand('copy')) throw new Error('copy rejected')
  } finally {
    area.remove()
  }
}

async function copyCode(block: Extract<MarkdownBlock, { kind: 'code' }>, index: number) {
  try {
    await writeClipboard(block.code)
    copiedIndex.value = index
    failedIndex.value = null
  } catch {
    copiedIndex.value = null
    failedIndex.value = index
  }
  resetFeedback()
}

onBeforeUnmount(() => {
  if (feedbackTimer) clearTimeout(feedbackTimer)
})
</script>

<template>
  <div class="markdown-body">
    <template v-for="(block, index) in blocks" :key="index">
      <UiIslandCard v-if="block.kind === 'code'" class="markdown-island markdown-code" padding="none">
        <div class="markdown-code-header">
          <span class="markdown-code-lang">{{ block.language && !UNLABELLED_LANGUAGES.has(block.language) ? block.language : '' }}</span>
          <button
            type="button"
            class="markdown-copy"
            :class="{ 'is-copied': copiedIndex === index, 'is-failed': failedIndex === index }"
            :aria-label="t('chat.markdownCopy')"
            :title="t('chat.markdownCopy')"
            @click="copyCode(block, index)"
          >
            <Check v-if="copiedIndex === index" :size="12" aria-hidden="true" />
            <Copy v-else :size="12" aria-hidden="true" />
            <span>{{ copiedIndex === index ? t('chat.markdownCopied') : failedIndex === index ? t('chat.markdownCopyFailed') : t('chat.markdownCopy') }}</span>
          </button>
        </div>
        <div class="markdown-island-content" v-html="block.html" />
      </UiIslandCard>
      <UiIslandCard v-else-if="block.kind === 'island'" class="markdown-island" padding="none">
        <div class="markdown-island-content" v-html="block.html" />
      </UiIslandCard>
      <div v-else class="markdown-prose" v-html="block.html" />
    </template>
  </div>
</template>
