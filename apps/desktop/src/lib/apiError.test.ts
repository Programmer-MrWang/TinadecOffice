import { describe, expect, it } from 'vitest'
import { ApiError, apiErrorDetails, isUnavailableStorageError, parseApiDiagnostics } from './apiError'

describe('public API diagnostics', () => {
  it('drops invalid structures and private fields while retaining nullable positions', () => {
    expect(parseApiDiagnostics([
      { code: 'rule', message: 'Fix it.', severity: 'error', line: null, column: null, private_value: 'drop' },
      { code: 'rule', message: 'Bad position.', severity: 'error', line: '3' },
      { code: 'rule', message: 'Bad position.', severity: 'error', column: 0 },
      { code: 'rule', message: 'Missing severity.' },
      null,
    ])).toEqual([{ code: 'rule', message: 'Fix it.', severity: 'error' }])
  })

  it('formats only diagnostics and correlation ID for notification details', () => {
    const error = new ApiError('Invalid.', 400, { code: 'configuration_invalid', trace_id: 'trace-1',
      diagnostics: [{ code: 'rule', message: 'Fix it.', severity: 'error', line: 3 }], private_value: 'drop' })
    expect(apiErrorDetails(error)).toBe('error rule (3): Fix it.\ntrace_id: trace-1')
    expect(JSON.stringify(error)).not.toContain('drop')
    expect(apiErrorDetails(new Error('Unstructured.'))).toBeUndefined()
  })
})

describe('error contract', () => {
  it('carries the server category, retryability and known recovery actions', () => {
    const error = new ApiError('Folder is gone.', 409, {
      code: 'storage_scope_unavailable',
      category: 'environment_unavailable',
      retryable: false,
      actions: ['unregister_workspace', 'retry', 'open_storage_settings'],
    })
    expect(error.category).toBe('environment_unavailable')
    expect(error.retryable).toBe(false)
    expect(error.actions).toEqual(['unregister_workspace', 'retry', 'open_storage_settings'])
    expect(error.canRetry).toBe(true)
  })

  it('drops unknown actions and unknown categories instead of trusting them', () => {
    const error = new ApiError('nope', 400, {
      code: 'invalid_request',
      category: 'some_future_category',
      actions: ['wire_money', 'reload'],
    })
    expect(error.category).toBe('user_action_required')
    expect(error.actions).toEqual(['reload'])
  })

  it('falls back honestly when the server predates the contract', () => {
    const client = new ApiError('bad input', 400, { code: 'invalid_request' })
    expect(client.category).toBe('user_action_required')
    expect(client.retryable).toBe(false)
    expect(client.actions).toEqual([])

    const server = new ApiError('boom', 500, { code: 'internal_error' })
    expect(server.category).toBe('internal')
    expect(server.retryable).toBe(true)
  })

  it('recognises an unavailable workspace so the sidebar can offer a way out', () => {
    expect(isUnavailableStorageError(new ApiError('gone', 409, { code: 'storage_scope_unavailable' }))).toBe(true)
    expect(isUnavailableStorageError(new ApiError('conflict', 409, { code: 'storage_conflict' }))).toBe(false)
    expect(isUnavailableStorageError(new Error('plain'))).toBe(false)
  })
})
