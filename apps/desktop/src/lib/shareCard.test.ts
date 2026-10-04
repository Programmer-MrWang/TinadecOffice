/**
 * Share card model tests.
 *
 * The picture is generated rather than screenshotted, so the parts that can be
 * wrong on their own — the numbers, the calendar alignment and the brand mark —
 * are pure functions and are pinned here. The canvas painter consumes exactly
 * this model.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { SHARE_BRAND_COLOR, SHARE_BRAND_MARK, SHARE_BRAND_WORDMARK } from './shareBrand'
import {
  HEATMAP_ROWS,
  HEATMAP_WEEKS,
  buildHeatmap,
  buildShareCardModel,
  formatCompactCount,
  shareCardFilename,
  toDayKey,
  type ShareCardLabels,
} from './shareCard'

// src/lib/shareCard.test.ts -> apps/desktop
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** 2026-10-04 is a Sunday, so the last heatmap column starts exactly at "today". */
const TODAY = new Date(2026, 9, 4)

const LABELS: ShareCardLabels = {
  hiddenName: 'Tinadec user',
  yearlyTokens: 'Tokens used (past year)',
  peakDaily: 'Peak daily tokens',
  currentStreak: 'Current active streak',
  totalActiveDays: 'Total active days',
}

function day(offsetFromToday: number): Date {
  const date = new Date(TODAY)
  date.setDate(date.getDate() + offsetFromToday)
  return date
}

function tokensOn(offsetFromToday: number, tokens: number): Record<string, number> {
  return { [toDayKey(day(offsetFromToday))]: tokens }
}

describe('share card numbers', () => {
  it('groups small counts and compacts large ones per locale', () => {
    expect(formatCompactCount(3751, 'en')).toBe('3,751')
    expect(formatCompactCount(3751, 'zh-CN')).toBe('3,751')
    // 20k is "2万" in Chinese and "20K" in English — the reference card's shape.
    expect(formatCompactCount(20_000, 'zh-CN')).toBe('2万')
    expect(formatCompactCount(20_000, 'en')).toMatch(/^20\s*K$/i)
    // Absent is not zero: the usage card's rule applies to the picture too.
    expect(formatCompactCount(null, 'zh-CN')).toBe('—')
  })

  it('names the file by the local day it was made', () => {
    expect(shareCardFilename(TODAY)).toBe('tinadec-share-20261004.png')
    expect(shareCardFilename(new Date(2026, 0, 9))).toBe('tinadec-share-20260109.png')
  })

  it('draws the brand from the shipped SVGs, not from a font', () => {
    // The card must ship the real logo and the real wordmark: the constants are
    // inlined (a file:// image would taint the exported canvas), so this is what
    // keeps them identical to the files.
    const cases = [
      { file: 'tinadec-logo.svg', geometry: SHARE_BRAND_MARK },
      { file: 'Tinadec-calligraphy.svg', geometry: SHARE_BRAND_WORDMARK },
    ]

    for (const { file, geometry } of cases) {
      const svg = readFileSync(resolve(appRoot, 'public', file), 'utf-8')
      expect(/<path[^>]*\sd="([^"]+)"/.exec(svg)?.[1], file).toBe(geometry.path)

      const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1].trim().split(/\s+/).map(Number) ?? []
      expect(geometry.viewBox, file).toEqual({ width: viewBox[2], height: viewBox[3] })
    }

    expect(SHARE_BRAND_COLOR).toMatch(/^#[0-9a-f]{6}$/i)
  })
})

describe('share card heatmap', () => {
  it('lays the window out as calendar weeks ending today', () => {
    const grid = buildHeatmap({}, TODAY)

    expect(grid).toHaveLength(HEATMAP_WEEKS)
    for (const column of grid) expect(column).toHaveLength(HEATMAP_ROWS)

    const last = grid[HEATMAP_WEEKS - 1]!
    // Today is Sunday: its own cell exists, the rest of the column is the future.
    expect(last[0]).toBe(0)
    expect(last.slice(1)).toEqual([null, null, null, null, null, null])
    // Every other column is entirely in the past.
    expect(grid[HEATMAP_WEEKS - 2]!.every((level) => level !== null)).toBe(true)
  })

  it('buckets against the busiest day inside the window, not the all-time peak', () => {
    const grid = buildHeatmap({ ...tokensOn(-1, 100), ...tokensOn(-2, 50) }, TODAY)

    // Today is Sunday, so -1 (Saturday) and -2 (Friday) land in the previous
    // column; 100 tokens fills the scale and 50 takes the middle of it.
    const previousWeek = grid[HEATMAP_WEEKS - 2]!
    expect(previousWeek[6]).toBe(4)
    expect(previousWeek[5]).toBe(2)
    // Quiet neighbours stay empty rather than inheriting the peak.
    expect(previousWeek[4]).toBe(0)
  })

  it('reaches the oldest column and nothing before it', () => {
    const oldest = day(-(HEATMAP_WEEKS - 1) * HEATMAP_ROWS)
    const grid = buildHeatmap(tokensOn(-(HEATMAP_WEEKS - 1) * HEATMAP_ROWS, 7), TODAY)

    expect(grid[0]![oldest.getDay()]).toBe(4)
    expect(grid[0]!.filter((level) => level !== 0)).toHaveLength(1)
  })
})

describe('share card model', () => {
  const input = {
    nickname: 'wwiinnddy',
    avatar: 'data:image/png;base64,AAAA',
    hideProfile: false,
    yearlyTokens: 20_000,
    peakDailyTokens: 3751,
    currentStreakDays: 16,
    totalActiveDays: 16,
    dailyTokens: tokensOn(-1, 100),
  }

  it('reads the four usage figures with the usage card labels', () => {
    const model = buildShareCardModel(input, LABELS, { locale: 'zh-CN', today: TODAY })

    expect(model.stats.map((stat) => stat.label)).toEqual([
      LABELS.yearlyTokens,
      LABELS.peakDaily,
      LABELS.currentStreak,
      LABELS.totalActiveDays,
    ])
    expect(model.stats.map((stat) => stat.value)).toEqual(['2万', '3,751', '16', '16'])
    expect(model.dateText).toBe('2026年10月4日')
    expect(model.hidden).toBe(false)
    expect(model.nickname).toBe('wwiinnddy')
    expect(model.avatar).toBe(input.avatar)
  })

  it('drops the identity — and only the identity — when the privacy switch is on', () => {
    const hidden = buildShareCardModel({ ...input, hideProfile: true }, LABELS, {
      locale: 'en',
      today: TODAY,
    })

    expect(hidden.hidden).toBe(true)
    expect(hidden.nickname).toBe('')
    expect(hidden.avatar).toBeNull()
    expect(hidden.hiddenName).toBe('Tinadec user')
    // The numbers are the point of the card and are unaffected.
    expect(hidden.stats).toEqual(buildShareCardModel(input, LABELS, { locale: 'en', today: TODAY }).stats)
  })
})
