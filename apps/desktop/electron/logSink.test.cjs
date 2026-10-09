const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const test = require('node:test');
const { createLogSink } = require('./logSink.cjs');
test('host rotation shares the scope budget with Core and keeps active files', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tinadec-host-log-'));
  try {
    const logs = path.join(root, 'logs'); const host = path.join(logs, 'host'); const runtime = path.join(logs, 'runtime');
    fs.mkdirSync(runtime, { recursive: true });
    fs.writeFileSync(path.join(runtime, 'core.log'), 'active');
    const rotated = path.join(runtime, `core.log.639008400000000000-${'a'.repeat(32)}`);
    fs.writeFileSync(rotated, '01234567890123456789');
    const sink = createLogSink(host, { maxFileBytes: 10, maxTotalBytes: 40 });
    sink.write('gateway', '0123456789012345678901234567890123456789');
    assert.ok(fs.existsSync(path.join(runtime, 'core.log')));
    assert.equal(fs.existsSync(rotated), false);
    const sizes = fs.readdirSync(host).map(file => fs.statSync(path.join(host, file)).size);
    assert.ok(sizes.every(size => size <= 10));
    assert.ok(sizes.reduce((a, b) => a + b, 6) <= 40);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test('host logging reads canonical TOML capacity and refuses an invalid document', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tinadec-log-config-'));
  try {
    fs.mkdirSync(path.join(root, 'config'));
    const configuration = path.join(root, 'config', 'logging.toml');
    fs.writeFileSync(configuration, 'version = 1\n[logging]\nrotation_bytes = 4096\ntotal_bytes = 8192\n');
    const host = path.join(root, 'logs', 'host'); const sink = createLogSink(host);
    sink.write('electron', Buffer.alloc(12 * 1024));
    const files = fs.readdirSync(host).map(file => fs.statSync(path.join(host, file)).size);
    assert.ok(files.every(size => size <= 4096)); assert.ok(files.reduce((a, b) => a + b, 0) <= 8192);
    fs.writeFileSync(configuration, '[logging]\nrotation_bytes = 4096\ntotal_bytes = 1\n');
    assert.throws(() => createLogSink(host), /Invalid logging configuration/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
