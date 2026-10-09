import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const evidence = import.meta.dirname;
function suites(files) {
  const latest = new Map(); const inputs = [];
  for (const file of files) {
    const path = join(evidence, file); if (!existsSync(path)) continue;
    const xml = readFileSync(path, 'utf8'); inputs.push(file);
    for (const result of xml.matchAll(/<UnitTestResult\s+([^>]+)>/g)) {
      const attrs = Object.fromEntries([...result[1].matchAll(/([\w]+)="([^"]*)"/g)].map(item => [item[1], item[2]]));
      latest.set(attrs.testName, { test: attrs.testName, outcome: attrs.outcome, source: file });
    }
  }
  const results = [...latest.values()];
  return { inputs, total_unique: results.length, passed: results.filter(row => row.outcome === 'Passed').length,
    failed: results.filter(row => row.outcome === 'Failed').length, skipped: results.filter(row => row.outcome === 'NotExecuted').length, results };
}
const desktop = JSON.parse(readFileSync(join(evidence, 'desktop-tests-final.json'), 'utf8'));
const summary = {
  policy: 'Latest outcome per fully qualified test and platform; repeats are not added. Initial failures remain in their TRX files.',
  windows_core: suites(['workspace-contract.trx', 'workspace-core.trx', 'storage-baseline.trx', 'workspace-core-final.trx', 'workspace-core-regression.trx', 'workspace-move-final.trx', 'workspace-persistence-final.trx']),
  windows_tools: suites(['workspace-tools-final.trx', 'workspace-tools-regression.trx', 'workspace-tools-latest.trx']),
  resource_claims: suites(['workspace-resource-claims.trx']),
  linux_core: suites(['linux-workspace-core-initial.trx', 'linux-workspace-core-second.trx', 'linux-workspace-core-third.trx', 'linux-workspace-core-fourth.trx', 'linux-workspace-core-fifth.trx', 'linux-workspace-core.trx', 'linux-workspace-vector-existing.trx']),
  linux_tools: suites(['linux-workspace-tools-initial.trx', 'linux-workspace-tools-second.trx', 'linux-workspace-tools.trx']),
  desktop: { passed: desktop.numPassedTests, failed: desktop.numFailedTests, skipped: desktop.numPendingTests, source: 'desktop-tests-final.json' },
  gateway: { passed: 6, failed: 0, source: 'bun test src/storageProxy.test.ts src/openapi.snapshot.test.ts' },
  native_ipc: { passed: 1, failed: 0, source: 'node --test electron/workspaceFolders.test.cjs' },
  windows_native_ui: JSON.parse(readFileSync(join(evidence, 'desktop-native.json'), 'utf8')),
  windows_visual_ui: JSON.parse(readFileSync(join(evidence, 'desktop-ui.json'), 'utf8')),
  linux_environment: JSON.parse(readFileSync(join(evidence, 'linux-result.json'), 'utf8')),
  tools_process: { accepted: JSON.parse(readFileSync(join(evidence, 'tool-process.json'), 'utf8')).accepted, windows_low_privilege_shell: 'not_accepted' },
};
writeFileSync(join(evidence, 'validation-summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(Object.fromEntries(Object.entries(summary).filter(([key]) => !['windows_native_ui', 'policy'].includes(key)).map(([key, value]) => [key, Object.fromEntries(Object.entries(value).filter(([field]) => field !== 'results'))])), null, 2));
