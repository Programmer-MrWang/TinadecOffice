<script setup lang="ts">
import { ref } from 'vue'
import ComposerBar from '@/components/ComposerBar.vue'

const projects = Array.from({ length: 45 }, (_, i) => ({
  id: `fixture-project-${i}`,
  name: i === 0 ? '包含很长中文与英文名称的示例项目 TinadecWorkspace-Long-Name' : `示例项目 ${String(i + 1).padStart(2, '0')}`,
  path: `/fixture-only/project-${i}`,
  created_at: '2026-10-09T00:00:00Z',
}))
const selectedProjectId = ref<string | null>(projects[0]!.id)
const draft = ref('')
const permission = ref('default')
const modeVersionId = ref<string | null>(null)
const choice = ref('尚未选择')
const narrow = ref(false)
function selectProject(id: string | null) {
  selectedProjectId.value = id
  choice.value = id ?? 'free-conversation'
}
</script>

<template>
  <main style="padding:32px;max-width:1000px;margin:auto">
    <h1 style="font-size:20px;margin-bottom:12px">项目、模式与权限菜单 · 隔离夹具</h1>
    <p style="margin-bottom:12px">45 个伪项目；没有业务 API、实际工作区或产品 store。</p>
    <div style="display:flex;gap:12px;margin-bottom:16px">
      <button @click="narrow = !narrow">切换窄宽度</button>
      <button @click="selectProject(null)">自由对话</button>
    </div>
    <output id="fixture-selection" style="display:block;margin-bottom:16px">最后选择：{{ choice }}</output>
    <section class="conversation" :class="{ 'chat-narrow': narrow }" :style="{ width: narrow ? '350px' : '760px', maxWidth: '100%', marginTop: '220px', overflow: 'visible' }">
      <ComposerBar hero :busy="false" v-model="draft" :permission="permission" :projects="projects" :selected-project-id="selectedProjectId"
        :mode-version-id="modeVersionId" @select-project="selectProject" @create-project="choice = 'open-project-fixture-only'"
        @update:permission="permission = $event" @update:mode-version-id="modeVersionId = $event" />
    </section>
  </main>
</template>
