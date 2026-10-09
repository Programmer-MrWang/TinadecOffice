export interface ApiDiagnostic {
  code: string
  message: string
  severity: string
  line?: number
  column?: number
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null
}

export function apiErrorMessage(body: unknown, fallback: string): string {
  const data = record(body)
  const candidates = [data?.message, record(data?.error)?.message, data?.error,
    data?.summary, data?.detail, data?.title]
  return candidates.find((value): value is string => typeof value === 'string' && value.length > 0) ?? fallback
}

/** Only public diagnostic fields enter UI state; never retain the response body. */
export function parseApiDiagnostics(value: unknown): ApiDiagnostic[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry): ApiDiagnostic[] => {
    const item = record(entry)
    if (!item || typeof item.code !== 'string' || typeof item.message !== 'string'
      || typeof item.severity !== 'string') return []
    for (const position of [item.line, item.column]) {
      if (position != null && (!Number.isSafeInteger(position) || Number(position) < 1)) return []
    }
    return [{
      code: item.code,
      message: item.message,
      severity: item.severity,
      ...(typeof item.line === 'number' ? { line: item.line } : {}),
      ...(typeof item.column === 'number' ? { column: item.column } : {}),
    }]
  })
}

export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  readonly trace_id?: string
  readonly instance?: string
  readonly diagnostics: ApiDiagnostic[]

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    const data = record(body)
    this.code = typeof data?.code === 'string' ? data.code : undefined
    this.trace_id = typeof data?.trace_id === 'string' ? data.trace_id : undefined
    this.instance = typeof data?.instance === 'string' ? data.instance : undefined
    this.diagnostics = parseApiDiagnostics(data?.diagnostics)
  }
}

export function apiErrorDetails(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined
  const data = error as Error & { diagnostics?: unknown; trace_id?: unknown }
  const lines = parseApiDiagnostics(data.diagnostics).map((item) => {
    const position = item.line == null ? '' : ` (${item.line}${item.column == null ? '' : `:${item.column}`})`
    return `${item.severity} ${item.code}${position}: ${item.message}`
  })
  if (typeof data.trace_id === 'string' && data.trace_id) lines.push(`trace_id: ${data.trace_id}`)
  return lines.length > 0 ? lines.join('\n') : undefined
}
