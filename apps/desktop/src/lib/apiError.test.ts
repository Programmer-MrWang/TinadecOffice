import { describe, expect, it } from 'vitest'
import { ApiError, apiErrorDetails, parseApiDiagnostics } from './apiError'

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
