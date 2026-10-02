/**
 * Agent pack manifest integrity — the single desktop-side implementation of the
 * digest Core expects.
 *
 * Core validates `integrity.digest` over its own DTO round-trip of the submitted
 * manifest (RFC 8785 canonical JSON, SHA-256), never over the submitted bytes. A
 * manifest therefore has to be "DTO-closed" — no keys the Core DTO does not model,
 * and every modelled property that is not omitted-when-absent spelled out — for a
 * digest computed here to match. `GraphSeedPackClosureTests` in the Core test
 * project is the gate that keeps the bundled manifest DTO-closed; the per-pack
 * `*.test.ts` digest gate recomputes the constant from the JSON file.
 */

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

/** RFC 8785 JSON Canonicalization Scheme (sorted keys, no insignificant whitespace). */
export function canonicalizeAgentPackManifest(value: unknown): string {
  return canonicalize(value as JsonValue)
}

function canonicalize(value: JsonValue): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Agent pack manifest contains a non-finite number.')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key]!)}`)
    .join(',')}}`
}

/** SHA-256 of the canonical manifest bytes, lowercase hex. */
export async function digestAgentPackManifest(manifest: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalizeAgentPackManifest(manifest))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
