export interface SettingsLeaveGuardOptions {
  isTools: () => boolean
  canLeave?: () => Promise<boolean>
  isExiting: () => boolean
  markExiting: () => void
  durationMs: number
}

export type SettingsExitWait = (durationMs: number) => Promise<void>

/**
 * Vue Router guards must settle by returning a value. Keeping the animation
 * wait inside the returned promise prevents Router from seeing an async guard
 * that has already finished while a later callback still calls `next()`.
 */
export function createSettingsLeaveGuard(
  options: SettingsLeaveGuardOptions,
  wait: SettingsExitWait = durationMs => new Promise<void>(resolve => setTimeout(resolve, durationMs)),
): () => Promise<boolean> {
  return async () => {
    if (options.isTools() && options.canLeave && !await options.canLeave()) return false
    if (options.isExiting()) return true
    options.markExiting()
    await wait(options.durationMs)
    return true
  }
}
