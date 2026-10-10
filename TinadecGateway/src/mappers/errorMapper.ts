/** RFC9457 ProblemDetails -> narrow public error contract. */
const CODE_MAP: Record<string, string> = {
  INVALID_REQUEST: 'invalid_request',
  INVALID_PROJECT: 'invalid_request',
  INVALID_SESSION: 'invalid_request',
  INVALID_SESSION_ID: 'invalid_request',
  INVALID_PROJECT_ID: 'invalid_request',
  INVALID_MESSAGE: 'invalid_request',
  INVALID_RUN_ID: 'invalid_request',
  INVALID_EVENT_CURSOR: 'invalid_request',
  INVALID_STREAM_CURSOR: 'invalid_request',
  INVALID_RUN_CONTROL: 'invalid_request',
  INVALID_STATUS: 'invalid_request',
  INVALID_DECISION: 'invalid_request',
  CONTEXT_REVISION_CONFLICT: 'context_conflict',
  CONTEXT_CONFLICT: 'context_conflict',
  MODEL_NOT_CONFIGURED: 'model_not_configured',
  NOT_FOUND: 'not_found',
  RUN_NOT_FOUND: 'run_not_found',
  SESSION_NOT_FOUND: 'session_not_found',
  PROJECT_NOT_FOUND: 'project_not_found',
  TOOL_EXECUTION_NOT_FOUND: 'tool_execution_not_found',
  TOOL_PROVIDER_UNAVAILABLE: 'tool_provider_unavailable',
  TOOL_RUNTIME_NOT_CONFIGURED: 'tool_runtime_not_configured',
  MODE_UNAVAILABLE: 'mode_unavailable',
  TOOL_PROVIDER_NOT_CONFIGURED: 'tool_provider_not_configured',
  FORBIDDEN: 'forbidden',
  ACTIVE_RUN_LIMIT: 'conflict',
  ACTIVE_RUN_CONFLICT: 'conflict',
  INVALID_LIFECYCLE_TRANSITION: 'conflict',
  ALREADY_DECIDED: 'conflict',
  INVALID_LIFECYCLE_STATUS: 'invalid_request',
  IDEMPOTENCY_KEY_REUSE: 'conflict',
  RUN_NOT_ACTIVE: 'conflict',
};

export const ERROR_CATEGORIES = ['user_action_required', 'retryable', 'environment_unavailable', 'internal'] as const;
export const ERROR_ACTIONS = ['retry', 'reload', 'open_settings', 'open_storage_settings', 'open_tool_settings', 'unregister_workspace', 'choose_folder'] as const;
export type ErrorCategory = typeof ERROR_CATEGORIES[number];
export type ErrorAction = typeof ERROR_ACTIONS[number];
export interface ErrorRecovery { category: ErrorCategory; retryable: boolean; actions: ErrorAction[] }

/** Core owns the policy. Only known public fields survive this boundary. */
export function publicErrorRecovery(data: Record<string, unknown>): Partial<ErrorRecovery> {
  const category = typeof data.category === 'string' && ERROR_CATEGORIES.includes(data.category as ErrorCategory)
    ? data.category as ErrorCategory : undefined;
  const actions = Array.isArray(data.actions)
    ? [...new Set(data.actions.filter((action): action is ErrorAction =>
      typeof action === 'string' && ERROR_ACTIONS.includes(action as ErrorAction)))] : undefined;
  return {
    ...(category ? { category } : {}),
    ...(typeof data.retryable === 'boolean' ? { retryable: data.retryable } : {}),
    ...(actions ? { actions } : {}),
  };
}

function errorRecovery(data: Record<string, unknown>, status: number): ErrorRecovery {
  const projected = publicErrorRecovery(data);
  const category = projected.category ?? (status >= 500 ? 'internal' : 'user_action_required');
  return {
    category,
    retryable: projected.retryable ?? (category === 'retryable' || category === 'internal'),
    actions: projected.actions ?? (category === 'internal' ? ['retry'] : []),
  };
}

function normalizeCode(raw: string | null | undefined, status: number): string {
  // A stable Core code must not disappear merely because a new domain added it.
  if (raw && /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.test(raw)) return raw;
  const mapped = raw ? CODE_MAP[raw.toUpperCase()] : undefined;
  if (mapped) return mapped;
  if (raw && /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/.test(raw)) return raw.toLowerCase();
  return status >= 500 ? 'internal_error' : 'invalid_request';
}

export interface ProblemDetails extends ErrorRecovery {
  type: string;
  title: string;
  status: number;
  detail?: string;
  code: string;
  trace_id?: string;
  instance?: string;
  diagnostics?: ConfigurationDiagnostic[];
}

export interface ConfigurationDiagnostic {
  code: string;
  message: string;
  severity: string;
  line?: number;
  column?: number;
}

/** Copy a narrow public projection; upstream extension objects may contain private data. */
export function publicDiagnostics(value: unknown): ConfigurationDiagnostic[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.flatMap((entry): ConfigurationDiagnostic[] => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const item = entry as Record<string, unknown>;
    if (typeof item.code !== 'string' || typeof item.message !== 'string' || typeof item.severity !== 'string') return [];
    for (const position of [item.line, item.column]) {
      if (position != null && (!Number.isSafeInteger(position) || Number(position) < 1)) return [];
    }
    return [{ code: item.code, message: item.message, severity: item.severity,
      ...(typeof item.line === 'number' ? { line: item.line } : {}),
      ...(typeof item.column === 'number' ? { column: item.column } : {}),
    }];
  });
}

export function toProblemDetails(status: number, codeRaw: string, detail: string, instance?: string, traceId?: string): ProblemDetails {
  const code = normalizeCode(codeRaw, status);
  return {
    type: `https://tinadec.dev/errors/${code}`, title: code, status, detail, code, instance, trace_id: traceId,
    ...errorRecovery({}, status),
  };
}

export function mapCoreErrorToExternal(status: number, data: unknown, instance?: string): ProblemDetails {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const rec = data as Record<string, unknown>;
    const codeRaw = typeof rec.code === 'string' ? rec.code : typeof rec.title === 'string' ? rec.title : undefined;
    const detail = [rec.detail, rec.message, rec.title].find((value): value is string => typeof value === 'string') ?? 'Request failed.';
    const traceId = typeof rec.trace_id === 'string' ? rec.trace_id
      : typeof rec.traceId === 'string' ? rec.traceId : undefined;
    const mapped = normalizeCode(codeRaw, status);
    const diagnostics = publicDiagnostics(rec.diagnostics);
    return {
      type: typeof rec.type === 'string' ? rec.type : `https://tinadec.dev/errors/${mapped}`,
      title: mapped, status, detail, code: mapped,
      instance: typeof rec.instance === 'string' ? rec.instance : instance,
      trace_id: traceId,
      ...errorRecovery(rec, status),
      ...(diagnostics ? { diagnostics } : {}),
    };
  }
  return toProblemDetails(status, status >= 500 ? 'internal_error' : 'invalid_request', 'Request failed.', instance);
}

export function isProblemDetailsLike(data: unknown): boolean {
  return !!data && typeof data === 'object' && 'code' in (data as Record<string, unknown>);
}
