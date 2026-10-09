import { createApp, h, vaporInteropPlugin } from '/src/lib/vue-shim.ts';
import { createPinia } from 'pinia';
import { createRouter, createWebHashHistory } from 'vue-router';
import i18n from '/src/i18n.ts';
import '/src/styles.css';
import AppSidebar from '/src/components/AppSidebar.vue';
import WorkspaceEditorDialog from '/src/components/WorkspaceEditorDialog.vue';
import { homeController as c } from '/src/controllers/HomeController.ts';
import { api } from '/src/api.ts';
import { selectionKey, selectedStorage } from '/src/lib/storageScope.ts';
import { useTheme } from '/src/composables/useTheme.ts';
useTheme().setTheme('dark');
document.body.style.background = 'var(--bg-primary)';
document.body.style.color = 'var(--text-primary)';
window.__workspaceFixture = {
  c, selectedStorage,
  async load() { c.projects.value = await api.listProjects(); },
  seedConversationRows() {
    const project = c.projects.value[0];
    c.sessions.value = Array.from({ length: 9 }, (_, index) => ({ id: 'ui-row-' + index, storage_id: project.storage_id, project_id: project.id, title: '列表交互夹具 ' + index, status: 'ready', view_mode: 'flat', permission_mode: 'default', settings_revision: 0, created_at: new Date(index * 1000).toISOString(), updated_at: new Date(index * 1000).toISOString() }));
    c.selectedSessionId.value = 'ui-row-0';
  },
};
const app = createApp({ render: () => h('main', { style: 'display:grid;grid-template-columns:280px 1fr;height:100vh;padding:8px;gap:24px' }, [
  h(AppSidebar, { projects: c.projects.value, sessions: c.sessions.value, selectedProjectId: c.selectedProjectId.value, selectedSessionId: c.selectedSessionId.value, busy: false, workspaceLoadStates: c.workspaceLoadStates.value,
    'onOpen-project': c.openProject, 'onEdit-workspace': c.editWorkspace, 'onCreate-session': c.startNewConversation, 'onSelect-session': c.setSelectedSession }),
  h('section', { style: 'padding:48px' }, [h('h1', '工作区 · 隔离验收'), h('p', c.currentProject.value ? c.currentProject.value.name + ' · ' + c.currentProject.value.path : '自由对话'), h('p', '真实 Core / Gateway 与仓库 Desktop 组件；列表行使用独立界面夹具。'), h('p', '运行事实、用户配置与凭据没有从真实用户根复制。')]), h(WorkspaceEditorDialog),
]) });
app.use(vaporInteropPlugin).use(createPinia()).use(createRouter({ history: createWebHashHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }] })).use(i18n).mount('#app');
await window.__workspaceFixture.load();
