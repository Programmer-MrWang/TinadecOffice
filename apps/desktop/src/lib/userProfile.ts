/**
 * Local user profile (nickname + avatar + work roles) for the Desktop shell.
 *
 * Self-contained module: state lives in localStorage, exposed through one
 * reactive snapshot. Settings → Personal is the only writer today; other
 * surfaces should import `userProfile` when they later want to show the
 * identity, and stay read-only unless they become editors of it.
 */
import { reactive, readonly } from 'vue'

/** Fixed vocabulary of work roles; labels resolve through settings.personalRole_* locale keys. */
export const WORK_ROLES = [
  'fullstack',
  'frontend',
  'backend',
  'mobile',
  'devops',
  'qa',
  'data',
  'pm',
  'designer',
  'operations',
  'other',
] as const

export type WorkRole = (typeof WORK_ROLES)[number]

export interface UserProfile {
  nickname: string
  /** Short free-text bio shown under the nickname. */
  bio: string
  /** Data URL of the chosen image, or null when no avatar is set. */
  avatar: string | null
  /** Selected work roles (multi-select); order matches WORK_ROLES. */
  roles: WorkRole[]
  /**
   * Free-text label used in place of the generic `other` role. Empty means the
   * `other` role reads as its locale label, and it is meaningless unless
   * `roles` contains `other` (the picker clears it otherwise).
   */
  customRole: string
}

const STORAGE_KEY = 'tinadec.user_profile'

/** ~400 KB of base64 keeps the profile inside one localStorage entry. */
export const AVATAR_MAX_BYTES = 300 * 1024

interface PersistedProfile {
  nickname?: unknown
  bio?: unknown
  avatar?: unknown
  roles?: unknown
  customRole?: unknown
}

function isWorkRole(value: unknown): value is WorkRole {
  return typeof value === 'string' && (WORK_ROLES as readonly string[]).includes(value)
}

const EMPTY_PROFILE: UserProfile = { nickname: '', bio: '', avatar: null, roles: [], customRole: '' }

function loadPersisted(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...EMPTY_PROFILE }
    const parsed = JSON.parse(raw) as PersistedProfile
    return {
      nickname: typeof parsed.nickname === 'string' ? parsed.nickname : '',
      bio: typeof parsed.bio === 'string' ? parsed.bio : '',
      avatar: typeof parsed.avatar === 'string' && parsed.avatar.startsWith('data:image/') ? parsed.avatar : null,
      roles: Array.isArray(parsed.roles) ? parsed.roles.filter(isWorkRole) : [],
      customRole: typeof parsed.customRole === 'string' ? parsed.customRole : '',
    }
  } catch {
    return { ...EMPTY_PROFILE }
  }
}

const state = reactive<UserProfile>(loadPersisted())

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Quota errors are possible on older entries; the in-memory state still holds.
  }
}

export const userProfile = readonly(state)

export function setNickname(nickname: string): void {
  state.nickname = nickname.trim()
  persist()
}

export function setBio(bio: string): void {
  state.bio = bio.trim()
  persist()
}

export function setAvatar(avatar: string | null): void {
  state.avatar = avatar
  persist()
}

export function setRoles(roles: WorkRole[]): void {
  // Dedupe and keep the canonical WORK_ROLES ordering so the UI never depends on click order.
  state.roles = WORK_ROLES.filter((role) => roles.includes(role))
  // A label for `other` is meaningless once `other` is gone; drop it with the role
  // so a stale word cannot resurface on the chip. `roles` itself holds the truth.
  if (!state.roles.includes('other')) state.customRole = ''
  persist()
}

export function setCustomRole(customRole: string): void {
  state.customRole = customRole.trim()
  persist()
}
