const path = require('node:path');
const { homedir } = require('node:os');
const fs = require('node:fs');
const { parse } = require('smol-toml');

/** The host and Core share this user root; legacy platform paths are never read. */
function storagePaths(environment = process.env, homedirImpl = homedir) {
  const override = environment.TINADEC_HOME?.trim();
  if (override && !path.isAbsolute(override)) throw new Error('TINADEC_HOME must be an absolute path.');
  const bootstrapRoot = override ? path.resolve(override) : path.join(homedirImpl(), '.tinadec');
  const desktopConfig = path.join(bootstrapRoot, 'config', 'desktop.toml');
  let configuredRoot;
  if (!override) {
    try { configuredRoot = parse(fs.readFileSync(desktopConfig, 'utf8')).user_root; }
    catch (error) { if (error.code !== 'ENOENT') throw new Error(`Cannot read ${desktopConfig}: ${error.message}`, { cause: error }); }
  }
  if (configuredRoot !== undefined && (typeof configuredRoot !== 'string' || !path.isAbsolute(configuredRoot))) throw new Error('desktop.toml user_root must be an absolute path.');
  const root = configuredRoot ? path.resolve(configuredRoot) : bootstrapRoot;
  const paths = Object.fromEntries(['config', 'data', 'state', 'logs', 'cache', 'temp', 'skills', 'packages', 'worktrees'].map(category => [category, path.join(root, category)]));
  return { root, bootstrapRoot, source: override ? 'environment' : configuredRoot ? 'desktop' : 'default', ...paths,
    desktopConfig,
    desktopState: path.join(paths.state, 'desktop'),
    desktopCache: path.join(paths.cache, 'desktop'),
    hostLogs: path.join(paths.logs, 'host'),
  };
}

/** Must run before Electron ready, when Chromium selects its session directories. */
function configureElectronStorage(app, environment = process.env) {
  const paths = storagePaths(environment);
  for (const directory of [paths.desktopState, paths.desktopCache, paths.hostLogs]) fs.mkdirSync(directory, { recursive: true });
  app.setPath('userData', paths.desktopState);
  app.setPath('sessionData', paths.desktopCache);
  app.setPath('logs', paths.hostLogs);
  return paths;
}

module.exports = { storagePaths, configureElectronStorage };
