/**
 * The share card as plain data.
 *
 * Everything the exported PNG shows — values, labels, the contribution grid and
 * the footer — is computed here without touching the DOM, so the picture can be
 * asserted in tests. `shareCardCanvas.ts` only paints what this module returns;
 * the settings component only supplies the identity, the usage numbers and the
 * resolved theme colours.
 */

/** 26 weeks ≈ six months of activity: the width the reference card uses. */
export const HEATMAP_WEEKS = 26
export const HEATMAP_ROWS = 7
/** 0 = no activity, 4 = the busiest day in the window. */
export const HEATMAP_MAX_LEVEL = 4
export const HEATMAP_LEVELS = HEATMAP_MAX_LEVEL + 1

export interface ShareCardStat {
  value: string
  label: string
}

export interface ShareCardModel {
  /** The nickname, or empty when the profile is hidden. */
  nickname: string
  /** Data URL of the avatar, or null when hidden/unset. */
  avatar: string | null
  /** Read instead of the nickname while the profile is hidden. */
  hiddenName: string
  stats: ShareCardStat[]
  /**
   * `weeks[weekIndex][dayIndex]`, dayIndex 0 = Sunday … 6 = Saturday, so the
   * grid reads like a calendar. `null` marks a day that has not happened yet.
   */
  weeks: (number | null)[][]
  dateText: string
  hidden: boolean
}

export interface ShareUsage {
  /** Aggregate over the last year; null when no call reported tokens. */
  yearlyTokens: number | null
  peakDailyTokens: number | null
  currentStreakDays: number
  totalActiveDays: number
  /** Tokens per local day key (`toDayKey`). */
  dailyTokens: Record<string, number>
}

export interface ShareCardInput extends ShareUsage {
  nickname: string
  avatar: string | null
  /** Replaces the nickname and hides the avatar in the picture. */
  hideProfile: boolean
}

export interface ShareCardLabels {
  hiddenName: string
  yearlyTokens: string
  peakDaily: string
  currentStreak: string
  totalActiveDays: string
}

/** Local day key — a Map key, never a Date comparison, so timezones stay out of it. */
export function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

/**
 * Grouped below 10k, compact above it: `3751` reads as `3,751` and `20000` as
 * `2万` (en: `20K`) — the shape the reference card uses for its big numbers.
 */
export function formatCompactCount(value: number | null, locale: string): string {
  if (value === null || !Number.isFinite(value)) return '—'
  if (Math.abs(value) < 10_000) return value.toLocaleString(locale)
  try {
    return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
  } catch {
    return value.toLocaleString(locale)
  }
}

export function formatShareDate(date: Date, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(date)
  } catch {
    return date.toDateString()
  }
}

/** Sunday of the week `date` falls in, at local midnight. */
function startOfWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  start.setDate(start.getDate() - start.getDay())
  return start
}

function dayKeyAt(weekStart: Date, dayIndex: number): string {
  const day = new Date(weekStart)
  day.setDate(day.getDate() + dayIndex)
  return toDayKey(day)
}

/**
 * Last `weeks` weeks of daily activity, bucketed into 0…4 levels against the
 * busiest day *inside the window* (not the all-time peak: a quiet six months
 * should still show contrast). Days after `today` come back as `null` so the
 * final column stops where the calendar does.
 */
export function buildHeatmap(
  dailyTokens: Record<string, number>,
  today: Date,
  weeks: number = HEATMAP_WEEKS,
): (number | null)[][] {
  const thisWeekStart = startOfWeek(today)
  const windowStart = new Date(thisWeekStart)
  windowStart.setDate(windowStart.getDate() - (weeks - 1) * HEATMAP_ROWS)

  let max = 0
  for (let week = 0; week < weeks; week += 1) {
    const weekStart = new Date(windowStart)
    weekStart.setDate(weekStart.getDate() + week * HEATMAP_ROWS)
    for (let day = 0; day < HEATMAP_ROWS; day += 1) {
      const tokens = dailyTokens[dayKeyAt(weekStart, day)] ?? 0
      if (tokens > max) max = tokens
    }
  }

  // Compare reconstructed local dates, never day-key strings: those are not
  // lexicographically ordered (`2026-10-4` sorts after `2026-9-30`).
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const grid: (number | null)[][] = []
  for (let week = 0; week < weeks; week += 1) {
    const weekStart = new Date(windowStart)
    weekStart.setDate(weekStart.getDate() + week * HEATMAP_ROWS)
    const column: (number | null)[] = []
    for (let day = 0; day < HEATMAP_ROWS; day += 1) {
      const cell = new Date(weekStart)
      cell.setDate(cell.getDate() + day)
      const cellStart = new Date(cell.getFullYear(), cell.getMonth(), cell.getDate())
      column.push(cellStart > todayStart ? null : levelOf(dailyTokens[dayKeyAt(weekStart, day)] ?? 0, max))
    }
    grid.push(column)
  }
  return grid
}

function levelOf(tokens: number, max: number): number {
  if (tokens <= 0 || max <= 0) return 0
  return Math.min(HEATMAP_MAX_LEVEL, Math.max(1, Math.ceil((tokens / max) * HEATMAP_MAX_LEVEL)))
}

export function buildShareCardModel(
  input: ShareCardInput,
  labels: ShareCardLabels,
  context: { locale: string; today: Date },
): ShareCardModel {
  return {
    nickname: input.hideProfile ? '' : input.nickname,
    avatar: input.hideProfile ? null : input.avatar,
    hiddenName: labels.hiddenName,
    stats: [
      { value: formatCompactCount(input.yearlyTokens, context.locale), label: labels.yearlyTokens },
      { value: formatCompactCount(input.peakDailyTokens, context.locale), label: labels.peakDaily },
      { value: String(input.currentStreakDays), label: labels.currentStreak },
      { value: String(input.totalActiveDays), label: labels.totalActiveDays },
    ],
    weeks: buildHeatmap(input.dailyTokens, context.today),
    dateText: formatShareDate(context.today, context.locale),
    hidden: input.hideProfile,
  }
}

/** `tinadec-share-20261004.png` — sortable, and it says what it is. */
export function shareCardFilename(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `tinadec-share-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}.png`
}
