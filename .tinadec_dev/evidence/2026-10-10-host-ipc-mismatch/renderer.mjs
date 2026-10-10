import { createApp, h, vaporInteropPlugin } from 'vue';
import { createI18n } from 'vue-i18n';
import HostAvailabilityBanner from '@/components/HostAvailabilityBanner.vue';
import { api } from '@/api';
import { readHostStatus, retryHostStatus } from '@/lib/hostConnection';
import { assertHostAccess, useHostAccess } from '@/lib/hostAccess';
import { useConnection } from '@/composables/useConnection';

// Only public health is substituted. No Core or Gateway is running in this
// contract fixture; every host status/retry/restart uses real preload and IPC.
let healthReads = 0;
api.health = async () => { healthReads++; return { status: 'ok' }; };
const connection = useConnection();
const access = useHostAccess();
const fixture = {
  ready: false,
  development: import.meta.env.DEV,
  read: () => readHostStatus(window.tinadec),
  retry: () => retryHostStatus(window.tinadec),
  snapshot: () => JSON.parse(JSON.stringify({ connection: connection.connectionState.value, host: connection.hostStatus.value, can_access_backend: access.canAccessBackend.value, health_reads: healthReads })),
  gate: async () => {
    try { await assertHostAccess('/api/v1/projects'); return { permitted: true }; }
    catch (error) { return { permitted: false, code: error.code, status: error.status }; }
  },
};
window.__ipcFixture = fixture;
const app = createApp({ render: () => h('main', { style: 'padding:48px' }, [h('h1', '宿主 IPC 契约隔离验收'), h('p', '生产 main / preload / readiness 组件；独立临时根；不连接用户后端。'), h(HostAvailabilityBanner)]) });
app.use(vaporInteropPlugin).use(createI18n({ legacy: false, locale: 'zh-CN', fallbackLocale: 'en', messages: {} })).mount('#app');
await connection.start();
fixture.ready = true;
