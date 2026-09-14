/**
 * Retired bundled Agent Packs.
 *
 * The desktop release publishes GraphSeedPack only. A workspace that still has an
 * older pack installed keeps its published resources — an install is durable DB
 * rows and does not depend on the bundled manifest file — so the pack manager
 * surfaces a retirement notice and points at GraphSeedPack instead of silently
 * dropping the pack or crashing on a pack id it can no longer describe.
 *
 * The ids are the historical manifests' `metadata.pack_id` values (read from the
 * retired file in git history), never guessed.
 */
export const RETIRED_AGENT_PACK_IDS = ['tinadec.office.agent-pack'] as const

export function isRetiredAgentPack(packId: string | null | undefined): boolean {
  if (!packId) return false
  return RETIRED_AGENT_PACK_IDS.some((retired) => retired === packId)
}
