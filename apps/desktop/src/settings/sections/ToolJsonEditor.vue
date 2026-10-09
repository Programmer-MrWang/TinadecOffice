<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useMonaco } from '@/composables/useMonaco'
import type { ToolJsonSchema } from '@/settings/toolSettings'

const props = defineProps<{ modelValue: string; schema?: ToolJsonSchema | null; label: string; readonly?: boolean; language?: 'json' | 'markdown'; focusPath?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string]; save: [] }>()
const { getMonaco } = useMonaco()
const host = ref<HTMLDivElement | null>(null)
const fallback = ref(false)
let disposed = false
let editor: import('monaco-editor').editor.IStandaloneCodeEditor | null = null
let model: import('monaco-editor').editor.ITextModel | null = null
let monaco: Awaited<ReturnType<typeof getMonaco>> | null = null
function focusCategory() {
  if (!props.focusPath || !editor || !model) return
  const key = JSON.stringify(props.focusPath.split('.')[0]) + ':'
  const lines = model.getValue().split('\n')
  const line = lines.findIndex(value => value.includes(key))
  const lineNumber = line < 0 ? 1 : line + 1
  editor.revealLineInCenter(lineNumber)
  editor.setPosition({ lineNumber, column: line < 0 ? 1 : lines[line]!.indexOf(key) + 1 })
  editor.focus()
}
const modelPath = `inmemory://tinadec-tools/${crypto.randomUUID()}.${props.language === 'markdown' ? 'md' : 'json'}`
function configureSchema() {
  if (!monaco || !props.schema || props.language === 'markdown') return
  const defaults = monaco.json.jsonDefaults
  // Vue may proxy nested schema values; Monaco sends this document to a worker.
  const schemaDocument = JSON.parse(JSON.stringify(props.schema)) as ToolJsonSchema
  defaults.setDiagnosticsOptions({ ...defaults.diagnosticsOptions, validate: true, allowComments: false,
    schemas: [...(defaults.diagnosticsOptions.schemas ?? []).filter(schema => schema.uri !== modelPath), { uri: modelPath, fileMatch: [modelPath], schema: schemaDocument }],
    trailingCommas: 'error', comments: 'error', enableSchemaRequest: false,
  })
}
onMounted(async () => {
  try {
    const instance = await getMonaco()
    if (disposed || !host.value) return
    monaco = instance
    model = instance.editor.createModel(props.modelValue, props.language ?? 'json', instance.Uri.parse(modelPath))
    configureSchema()
    editor = instance.editor.create(host.value, { model, ariaLabel: props.label, readOnly: props.readonly,
      automaticLayout: true, minimap: { enabled: false }, fontSize: 13, tabSize: 2,
      scrollBeyondLastLine: false, wordWrap: 'on', formatOnPaste: false, padding: { top: 12 },
    })
    editor.onDidChangeModelContent(() => { if (model && model.getValue() !== props.modelValue) emit('update:modelValue', model.getValue()) })
    editor.addCommand(instance.KeyMod.CtrlCmd | instance.KeyCode.KeyS, () => emit('save'))
    focusCategory()
  } catch { if (!disposed) fallback.value = true }
})
watch(() => props.modelValue, value => { if (model && value !== model.getValue()) model.setValue(value) })
watch(() => props.schema, configureSchema)
watch(() => props.readonly, value => editor?.updateOptions({ readOnly: value }))
watch(() => props.focusPath, focusCategory)
onBeforeUnmount(() => {
  disposed = true
  if (monaco) {
    const defaults = monaco.json.jsonDefaults
    defaults.setDiagnosticsOptions({ ...defaults.diagnosticsOptions, schemas: (defaults.diagnosticsOptions.schemas ?? []).filter(schema => schema.uri !== modelPath) })
  }
  editor?.dispose(); model?.dispose()
})
</script>
<template>
  <div class="tools-json-editor">
    <textarea v-if="fallback" :value="modelValue" :aria-label="label" :readonly="readonly" spellcheck="false" @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)" @keydown.ctrl.s.prevent="emit('save')" />
    <div v-else ref="host" class="tools-monaco-host" />
  </div>
</template>
