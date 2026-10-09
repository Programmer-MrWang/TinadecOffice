const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const test = require('node:test');
const { storagePaths } = require('./storagePaths.cjs');
test('all platforms share the user root and only an absolute TINADEC_HOME overrides it', () => {
  const home = path.resolve(path.sep, 'home', 'test');
  const defaults = storagePaths({ LOCALAPPDATA: 'ignored', XDG_DATA_HOME: 'ignored' }, () => home);
  assert.equal(defaults.root, path.join(home, '.tinadec'));
  assert.equal(defaults.desktopState, path.join(home, '.tinadec', 'state', 'desktop'));
  assert.equal(defaults.desktopCache, path.join(home, '.tinadec', 'cache', 'desktop'));
  assert.notEqual(defaults.desktopState, defaults.desktopCache);
  assert.equal(storagePaths({ TINADEC_HOME: home }, () => 'unused').root, home);
  assert.throws(() => storagePaths({ TINADEC_HOME: 'relative' }), /absolute/);
});
test('stable bootstrap chooses a user root once; environment roots do not follow pointers', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'tinadec-bootstrap-'));
  try {
    const anchor = path.join(home, '.tinadec'); const external = path.join(home, 'external');
    fs.mkdirSync(path.join(anchor, 'config'), { recursive: true });
    fs.writeFileSync(path.join(anchor, 'config', 'desktop.toml'), `user_root = ${JSON.stringify(external.replace(/\\/g, '/'))}\n`);
    const result = storagePaths({}, () => home);
    assert.equal(result.root, external);
    assert.equal(result.desktopConfig, path.join(anchor, 'config', 'desktop.toml'));
    fs.mkdirSync(path.join(external, 'config'), { recursive: true });
    fs.writeFileSync(path.join(external, 'config', 'desktop.toml'), 'user_root = "ignored"\n');
    assert.equal(storagePaths({ TINADEC_HOME: external }, () => home).root, external);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});
test('malformed bootstrap fails before fallback storage can be created', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'tinadec-bootstrap-invalid-'));
  try {
    const config = path.join(home, '.tinadec', 'config'); fs.mkdirSync(config, { recursive: true });
    fs.writeFileSync(path.join(config, 'desktop.toml'), 'user_root = [');
    assert.throws(() => storagePaths({}, () => home), /desktop\.toml/);
    assert.equal(fs.existsSync(path.join(home, '.tinadec', 'state')), false);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});
