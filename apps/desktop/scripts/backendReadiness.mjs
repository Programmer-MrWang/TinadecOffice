import { createRequire } from 'node:module';
const { verifyHostIdentity } = createRequire(import.meta.url)('../electron/hostIdentity.cjs');

/** Public liveness cannot release Electron before both managed roles prove this launch's key. */
export async function developmentBackendIsReady({ gatewayUrl, coreUrl, token, probeJson,
  verifyIdentity = verifyHostIdentity }) {
  const [gateway, core] = await Promise.all([
    probeJson(gatewayUrl + '/api/v1/health'), probeJson(coreUrl + '/api/v1/health'),
  ]);
  if (!(gateway?.status === 200 && gateway.data?.core_status === 'ready'
    && core?.status === 200 && core.data?.name === 'tinadec-core')) return false;
  try {
    await Promise.all([
      verifyIdentity(coreUrl, 'core', token), verifyIdentity(gatewayUrl, 'gateway', token),
    ]);
    return true;
  } catch (error) {
    if (['host_identity_rejected', 'host_endpoint_invalid', 'host_credential_invalid'].includes(error?.code)) {
      // Never include the inherited environment or credential in launcher output.
      throw new Error('Development host identity was rejected. Start Core, Gateway and Desktop together with npm run dev.');
    }
    return false;
  }
}
