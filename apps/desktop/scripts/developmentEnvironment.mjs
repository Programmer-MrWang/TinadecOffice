/** Private credentials are only passed to the trusted Electron launch, never Vite/plugins. */
export function developmentEnvironment(extraEnv = {}, trustedHost = false, environment = process.env) {
  const result = { ...environment, ...extraEnv };
  delete result.ELECTRON_RUN_AS_NODE;
  delete result.ELECTRON_NO_ATTACH_CONSOLE;
  if (!trustedHost) delete result.TINADEC_HOST_CONTROL_TOKEN;
  return result;
}
