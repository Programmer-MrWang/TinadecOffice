/**
 * The role vocabulary (`userProfile.ts`) and the icon map (`workRoleIcons.ts`)
 * are two lists that must stay the same list: a role the picker offers without
 * an icon would render as a bare word, which is exactly what the 2026-10-04
 * revision removed. `Record<WorkRole, LucideIcon>` catches a missing entry at
 * typecheck; this case catches a stray extra one.
 */
import { describe, expect, it } from 'vitest'
import { WORK_ROLES } from './userProfile'
import { WORK_ROLE_ICONS } from './workRoleIcons'

describe('workRoleIcons', () => {
  it('covers the work-role vocabulary exactly', () => {
    expect(Object.keys(WORK_ROLE_ICONS).sort()).toEqual([...WORK_ROLES].sort())
    for (const role of WORK_ROLES) {
      expect(WORK_ROLE_ICONS[role], `missing icon for ${role}`).toBeTruthy()
    }
  })
})
