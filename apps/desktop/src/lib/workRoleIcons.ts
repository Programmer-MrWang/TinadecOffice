/**
 * Icon per work role, so a work identity is never a bare word in the UI.
 *
 * The map is keyed by the vocabulary in `userProfile.ts`: adding a role there
 * without an entry fails typecheck (Record<WorkRole, …>) and the completeness
 * case in `workRoleIcons.test.ts`, so the two files cannot drift apart.
 */
import {
  Bug,
  Container,
  Database,
  Layers,
  Megaphone,
  Monitor,
  Palette,
  Server,
  Smartphone,
  Sparkles,
  SquareKanban,
  type LucideIcon,
} from '@lucide/vue'
import type { WorkRole } from './userProfile'

export const WORK_ROLE_ICONS: Record<WorkRole, LucideIcon> = {
  fullstack: Layers,
  frontend: Monitor,
  backend: Server,
  mobile: Smartphone,
  devops: Container,
  qa: Bug,
  data: Database,
  pm: SquareKanban,
  designer: Palette,
  operations: Megaphone,
  other: Sparkles,
}
