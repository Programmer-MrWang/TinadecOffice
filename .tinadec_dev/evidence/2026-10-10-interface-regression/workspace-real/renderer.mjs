import { createApp, h, vaporInteropPlugin } from '/src/lib/vue-shim.ts';
import { createPinia } from 'pinia';
import { createRouter, createWebHashHistory } from 'vue-router';
import i18n from '/src/i18n.ts';
import AppSidebar from '/src/components/AppSidebar.vue';
import WorkspaceEditorDialog from '/src/components/WorkspaceEditorDialog.vue';
import HostAvailabilityBanner from '/src/components/HostAvailabilityBanner.vue';
import { homeController as c } from '/src/controllers/HomeController.ts';
import { api } from '/src/api.ts';
import { selectionKey, selectedStorage } from '/src/lib/storageScope.ts';
import { useConnection } from '/src/composables/useConnection.ts';
import { useTheme } from '/src/composables/useTheme.ts';
useTheme().setTheme('dark');
window.__workspaceFixture={c,api,selectedStorage,selectionKey,ready:false};
const app=createApp({render:()=>h('main',{style:'display:grid;grid-template-columns:280px 1fr;height:100vh;padding:8px;gap:24px'},[
h(AppSidebar,{projects:c.projects.value,sessions:c.sessions.value,selectedProjectId:c.selectedProjectId.value,selectedSessionId:c.selectedSessionId.value,busy:c.busy.value,workspaceLoadStates:c.workspaceLoadStates.value,'onOpen-project':c.openProject,'onEdit-workspace':c.editWorkspace,'onCreate-session':c.startNewConversation,'onSelect-session':c.setSelectedSession}),
h('section',{style:'padding:48px'},[h('h1','工作区 · 接口回归隔离验收'),h('p',c.currentProject.value?.name??'自由对话'),h('p','真实 Core / Gateway 与生产 Desktop 组件、main 和 preload；独立临时用户根。')]),
h(WorkspaceEditorDialog),h(HostAvailabilityBanner)])});
app.use(vaporInteropPlugin).use(createPinia()).use(createRouter({history:createWebHashHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]})).use(i18n).mount('#app');
await useConnection().start(); c.start(); window.__workspaceFixture.ready=true;
