import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapCoreErrorToExternal } from './errorMapper.js';

test('new stable Core codes remain actionable without a second Gateway whitelist', () => {
  const mapped = mapCoreErrorToExternal(400, { code: 'brand_new_code', detail: 'x' }, '/api/v1/x');
  assert.equal(mapped.code, 'brand_new_code');
});

test('framework-authored core rejections keep their own code through the gateway', () => {
  const cases: Array<[number, string]> = [
    [400, 'invalid_request'],
    [400, 'invalid_model_parameters'],
    [400, 'invalid_space_options'],
    [400, 'invalid_session_settings'],
    [409, 'session_settings_conflict'],
    [409, 'space_options_frozen'],
    [409, 'space_options_conflict'],
    [409, 'spec_confirmation_scope'],
    // The paged audit reads (/api/v1/model-invocations) reject a malformed filter with these two,
    // and "you passed the wrong thing" must not arrive as a retryable `conflict`.
    [400, 'invalid_query'],
    [400, 'invalid_cursor'],
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [403, 'host_authorization_required'],
    [404, 'not_found'],
    [405, 'method_not_allowed'],
    [413, 'payload_too_large'],
    [415, 'unsupported_media_type'],
    [422, 'invalid_request'],
    [429, 'rate_limited'],
    [500, 'internal_error'],
    [406, 'request_failed'],
  ];
  for (const [status, code] of cases) {
    const mapped = mapCoreErrorToExternal(
      status,
      { code, detail: 'Core named the rule.', type: `https://tinadec.dev/errors/${code}`, trace_id: 'trace-1' },
      '/api/v1/x',
    );
    assert.equal(mapped.code, code, `status ${status}`);
    assert.equal(mapped.title, code, `status ${status}`);
    assert.equal(mapped.status, status);
    assert.equal(mapped.detail, 'Core named the rule.');
    assert.equal(mapped.trace_id, 'trace-1');
  }
});

test('a core problem with no stable code uses an honest HTTP-status fallback', () => {
  const mapped = mapCoreErrorToExternal(400, { title: 'Bad Request', status: 400 }, '/api/v1/x');
  assert.equal(mapped.code, 'invalid_request');
  assert.equal(mapped.title, 'invalid_request');
  assert.equal(mapped.category, 'user_action_required');
  assert.equal(mapCoreErrorToExternal(500, null).code, 'internal_error');
  assert.equal(mapCoreErrorToExternal(500, null).retryable, true);
});

test('configuration failures keep narrow diagnostics and reject malformed positions or private extensions', () => {
  const diagnostic = { code: 'configuration_unique', message: 'Duplicate draft slug meeting.', severity: 'error', line: 7, column: 3 };
  const mapped = mapCoreErrorToExternal(400, {
    code: 'configuration_invalid', detail: 'Configuration validation failed.', trace_id: 'trace-config',
    diagnostics: [
      { ...diagnostic, private_extension: 'must-not-forward' },
      { ...diagnostic, line: '7' },
      { ...diagnostic, column: -1 },
      { code: 'missing-message', severity: 'error' },
      { ...diagnostic, line: null, column: null },
    ],
    secret_reference: 'must-not-forward',
  });
  assert.equal(mapped.code, 'configuration_invalid');
  assert.equal(mapped.trace_id, 'trace-config');
  assert.deepEqual(mapped.diagnostics, [diagnostic, { code: diagnostic.code, message: diagnostic.message, severity: 'error' }]);
  assert.equal(JSON.stringify(mapped).includes('must-not-forward'), false);
  for (const code of ['configuration_conflict', 'configuration_missing', 'configuration_restart_required', 'configuration_unique_filter_unsupported'])
    assert.equal(mapCoreErrorToExternal(412, { code }).code, code);
});


test('classification and recovery actions preserve Core policy and drop unknown values', () => {
  const mapped = mapCoreErrorToExternal(409, {
    code: 'storage_scope_unavailable', category: 'environment_unavailable', retryable: false,
    actions: ['unregister_workspace', 'retry', 'open_storage_settings', 'retry', 'private_action', { key: 'retry' }],
    trace_id: 'trace-scope', diagnostics: [], private_extension: { secret: 'must-not-forward' },
  });
  assert.equal(mapped.code, 'storage_scope_unavailable');
  assert.equal(mapped.category, 'environment_unavailable');
  assert.equal(mapped.retryable, false);
  assert.deepEqual(mapped.actions, ['unregister_workspace', 'retry', 'open_storage_settings']);
  assert.equal(mapped.trace_id, 'trace-scope');
  assert.deepEqual(mapped.diagnostics, []);
  assert.equal(JSON.stringify(mapped).includes('must-not-forward'), false);
  const malformed = mapCoreErrorToExternal(503, { code: 'future_failure', category: 'private_category', retryable: 'false', actions: [false, 'private_action'] });
  assert.equal(malformed.category, 'internal');
  assert.equal(malformed.retryable, true);
  assert.deepEqual(malformed.actions, []);
});
