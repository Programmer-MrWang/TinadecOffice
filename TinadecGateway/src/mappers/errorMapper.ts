/** RFC9457 ProblemDetails -> stable external code mapper */
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

const ALLOWED_CODES = new Set([
  'workspace_authorization_required',
  'session_settings_conflict',
  'space_options_unavailable',
  'space_options_invalid',
  'space_base_unavailable',
  'space_workflow_invalid',
  'space_options_conflict',
  'space_worktree_unavailable',
  'invalid_space_options',
  'invalid_session_settings',
  'space_options_frozen',
  'spec_confirmation_scope',
  'invalid_request',
  'invalid_query',
  'invalid_cursor',
  'unauthorized',
  'forbidden',
  'host_authorization_required',
  'host_identity_unavailable',
  'configuration_invalid',
  'configuration_conflict',
  'configuration_missing',
  'configuration_not_found',
  'configuration_link_rejected',
  'configuration_scope_mismatch',
  'configuration_changed_during_admission',
  'configuration_restart_required',
  'configuration_projection_invalid',
  'configuration_source_reference',
  'configuration_unique_filter_unsupported',
  'method_not_allowed',
  'payload_too_large',
  'unsupported_media_type',
  'rate_limited',
  'internal_error',
  'request_failed',
  'context_conflict',
  'model_not_configured',
  // A local harness that is installed but will not start, or was asked for on a channel it does not
  // speak. All three were rewriting to `conflict`, which tells the client to retry later when the
  // real answer is that this binary cannot be connected here.
  'CLI_CONNECT_FAILED',
  'CLI_CONNECT_INVALID',
  'harness_channel_unsupported',
  'harness_channel_required',
  'harness_protocol_unsupported',
  'not_found',
  'snapshot_not_found',
  'file_not_found',
  'path_outside_workspace',
  'file_content_not_captured',
  'workspace_conflict',
  'run_not_found',
  'session_not_found',
  'project_not_found',
  'tool_execution_not_found',
  'tool_provider_unavailable',
  'mode_unavailable',
  'invalid_model_parameters',
  'tool_runtime_not_configured',
  'tool_provider_not_configured',
  'mcp_server_not_found',
  'market_source_not_found',
  'market_entry_not_found',
  'market_source_exists',
  'market_source_disabled',
  'unsupported_market_source_kind',
  'invalid_market_source',
  // The install surface's own refusals. Without these a 412 "your preview is stale" arrives at the
  // client as `conflict`, which tells it to retry later rather than to preview again.
  'market_install_not_expressible',
  'market_install_target_unresolved',
  'market_install_proposal_not_found',
  'market_install_proposal_stale',
  'market_installation_not_found',
  'market_install_project_not_found',
  'market_source_in_use',
  'forbidden',
  'conflict',
  'invalid_agent_pack_manifest',
  'agent_pack_management_forbidden',
  'agent_pack_version_hash_conflict',
  'agent_pack_resource_conflict',
  'agent_pack_revision_conflict',
  'agent_pack_incompatible',
  'agent_pack_not_found',
  'agent_pack_owner_conflict',
  'agent_pack_preview_stale',
  'managed_resource_read_only',
  'tina_chat_input_locked',
  // Mode switching across conversation identities, and the resource ledger: both carry a sentence a
  // person can act on, which a generic `conflict` would throw away.
  'conversation_identity_locked_mismatch',
  'resource_conflict',
  // Session organization (TinaChat): refusals name what to do instead.
  'organization_not_started',
  'organization_archived',
  'tina_chat_forbidden',
  'tina_chat_not_found',
  'tina_chat_revision_conflict',
  'invalid_tina_chat_request',
  'member_offline',
  'member_limit',
  'ambiguous_address',
  'report_closed',
]);

function normalizeCode(raw?: string | null): string {
  if (!raw) return 'conflict';
  const upper = raw.toUpperCase();
  if (CODE_MAP[upper]) return CODE_MAP[upper]!;
  const lower = raw.toLowerCase();
  if (ALLOWED_CODES.has(lower)) return lower;
  // already snake lower?
  return 'conflict';
}

export interface ProblemDetails {
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
function publicDiagnostics(value: unknown): ConfigurationDiagnostic[] | undefined {
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
  const code = normalizeCode(codeRaw);
  return {
    type: `https://tinadec.dev/errors/${code}`,
    title: code,
    status,
    detail,
    code,
    instance,
    trace_id: traceId,
  };
}

export function mapCoreErrorToExternal(status: number, data: unknown, instance?: string): ProblemDetails {
  if (data && typeof data === 'object') {
    const rec = data as Record<string, unknown>;
    const codeRaw = typeof rec.code === 'string' ? rec.code : typeof rec.title === 'string' ? rec.title : 'conflict';
    const detail = (rec.detail as string) ?? (rec.message as string) ?? (rec.title as string) ?? 'Request failed.';
    const traceId = typeof rec.trace_id === 'string' ? rec.trace_id
      : typeof rec.traceId === 'string' ? rec.traceId : undefined;
    const mapped = normalizeCode(codeRaw);
    const diagnostics = publicDiagnostics(rec.diagnostics);
    return {
      type: typeof rec.type === 'string' ? rec.type : `https://tinadec.dev/errors/${mapped}`,
      title: mapped,
      status,
      detail: String(detail),
      code: mapped,
      instance: typeof rec.instance === 'string' ? rec.instance : instance,
      trace_id: traceId,
      ...(diagnostics ? { diagnostics } : {}),
    };
  }
  return toProblemDetails(status, 'conflict', 'Request failed.', instance);
}

export function isProblemDetailsLike(data: unknown): boolean {
  return !!data && typeof data === 'object' && 'code' in (data as Record<string,unknown>);
}
