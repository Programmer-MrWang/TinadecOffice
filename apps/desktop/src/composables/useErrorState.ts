import { getErrorActionLabel } from './useNotifications'
import { computed, ref, type Ref } from 'vue'
import { ApiError, apiErrorDetails, type ApiErrorActionKind } from '@/lib/apiError'

/**
 * The full failure a screen is currently showing — not just a sentence.
 *
 * A string cannot say whether retrying helps, whether the person can fix it, or what to do
 * next, which is how "The registered project directory is unavailable." became a dead end.
 * Every field the server contract provides is preserved here so a section can render the
 * reason, the correlation id, the diagnostics and the recovery actions together.
 */
export interface ErrorState {
  /** Human message, already localized where the server supplied one. */
  message: string
  /** Stable machine code, e.g. `storage_scope_unavailable`. */
  code?: string
  /** Who can resolve it. */
  category?: ApiError['category']
  /** Whether repeating the identical request could succeed. */
  retryable?: boolean
  /** Stable recovery actions the server named, filtered to the known set. */
  actions: ApiErrorActionKind[]
  /** Correlation id for a bug report; shown, never invented. */
  traceId?: string
  /** Extra lines (config diagnostics) when the failure carried them. */
  details?: string
  /** HTTP status when the failure came from the API. */
  status?: number
}

export interface UseErrorState {
  /** Reactive record for template binding; null when there is nothing to show. */
  error: Ref<ErrorState | null>
  /** Convenience: the message alone, for compact inline slots. */
  message: Ref<string>
  /** Replaces the current failure; pass `null` to clear. */
  set: (input: unknown) => void
  /** Clears the current failure (call when a retry starts or a save succeeds). */
  clear: () => void
  /** Structural equality helper for tests and callers that compare states. */
  equals: (a: ErrorState | null, b: ErrorState | null) => boolean
}

/**
 * Normalises anything a `catch` can hand over into one shape. A classified `ApiError` keeps
 * its contract; a plain `Error` keeps its message; anything else is stringified once, here,
 * so no call site has to invent a fallback.
 */
export function toErrorState(input: unknown, fallback = ''): ErrorState {
  if (input instanceof ApiError) {
    return {
      message: input.message || fallback,
      ...(input.code ? { code: input.code } : {}),
      category: input.category,
      retryable: input.retryable,
      actions: [...input.actions],
      ...(input.trace_id ? { traceId: input.trace_id } : {}),
      ...(apiErrorDetails(input) ? { details: apiErrorDetails(input) } : {}),
      status: input.status,
    }
  }
  if (input instanceof Error) return { message: input.message || fallback, actions: [] }
  if (typeof input === 'string' && input.trim()) return { message: input, actions: [] }
  if (input && typeof input === 'object') {
    const record = input as Record<string, unknown>
    for (const field of ['message', 'detail', 'error', 'title'] as const) {
      const value = record[field]
      if (typeof value === 'string' && value.trim()) return { message: value, actions: [] }
    }
  }
  return { message: fallback, actions: [] }
}

export function useErrorState(fallback = ''): UseErrorState {
  const error = ref<ErrorState | null>(null)
  return {
    error,
    message: computed(() => error.value?.message ?? ''),
    set: (input: unknown) => { error.value = input == null ? null : toErrorState(input, fallback) },
    clear: () => { error.value = null },
    equals: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  }
}

/**
 * Turns the recovery actions the server named into callbacks this screen can run. Only actions
 * with a handler are offered, and the labels come from the shared notification wording so a
 * section never hardcodes its own copy of "Retry".
 */
export function recoveryActions(
  state: ErrorState | null,
  handlers: Partial<Record<ApiErrorActionKind, () => void | Promise<void>>>,
): Array<{ kind: ApiErrorActionKind; label: string; run: () => void | Promise<void> }> {
  if (!state) return []
  return state.actions.flatMap((kind) => {
    const run = handlers[kind]
    if (!run) return []
    return [{ kind, label: errorActionLabel(kind), run }]
  })
}

/** Shared labels, mirroring the notification layer so both surfaces read the same. */
export function errorActionLabel(kind: ApiErrorActionKind): string { return getErrorActionLabel(kind) }
