import { createApp, h, vaporInteropPlugin } from '/src/lib/vue-shim.ts';
import { createPinia } from 'pinia';
import { createRouter, createWebHashHistory } from 'vue-router';
import AgentPacksPanel from '/src/settings/sections/AgentPacksPanel.vue';
import NotificationDetailDialog from '/src/components/NotificationDetailDialog.vue';
import NotificationIslandHost from '/src/components/NotificationIslandHost.vue';
import i18n from '/src/i18n.ts';
import { ensureGraphSeedPack, graphSeedPackState, setGraphSeedPackTranslator } from '/src/agentPacks/graphSeedPackBootstrap.ts';
import { useNotifications } from '/src/composables/useNotifications.ts';

setGraphSeedPackTranslator((key, params) => String(i18n.global.t(key, params || {})));
const app = createApp({ render: () => h('main', { style: 'padding:100px 40px;max-width:1100px;margin:auto' }, [h('h1', 'GraphSeedPack · 隔离验收'), h(AgentPacksPanel), h(NotificationIslandHost), h(NotificationDetailDialog)]) });
app.use(createPinia());
if (vaporInteropPlugin) app.use(vaporInteropPlugin);
const router = createRouter({ history: createWebHashHistory(), routes: [{ path: '/', name: 'settings', component: { render: () => null } }] });
app.use(router); app.use(i18n); app.mount('#app');
window.__graphseedFixture = {
  phase: () => graphSeedPackState.value.phase,
  notifications: () => useNotifications().items.value.map(({ id, key, message, details, level, count }) => ({ id, key, message, details, level, count })),
  reconnect: () => ensureGraphSeedPack(),
  showError: () => { const item = useNotifications().items.value.find(item => item.key === 'graph-seed-pack'); if (item) useNotifications().openDetail(item.id); },
};
await ensureGraphSeedPack({ force: true, prompt: false });
