/**
 * Paints a `ShareCardModel` onto a canvas.
 *
 * The picture is generated, not screenshotted: the same model the dialog shows
 * is what the user copies or downloads, so the two can never disagree. Colours
 * arrive as a resolved theme (the caller reads the app's CSS tokens) and the
 * avatar as an already-loaded image, which keeps this module synchronous and
 * free of environment lookups.
 */
import { SHARE_BRAND_COLOR, SHARE_BRAND_MARK, SHARE_BRAND_WORDMARK, type BrandGeometry } from './shareBrand'
import { HEATMAP_ROWS, HEATMAP_WEEKS, HEATMAP_MAX_LEVEL, type ShareCardModel } from './shareCard'

/** Logical card size in CSS pixels; the canvas is scaled by the device ratio. */
export const SHARE_CARD_WIDTH = 620
export const SHARE_CARD_HEIGHT = 420

const PADDING = 28
const AVATAR_SIZE = 56
const RADIUS = 18
const CELL = 13
const CELL_GAP = 4
/** Alpha ramp for levels 1…4; level 0 uses the theme's empty colour. */
const HEAT_ALPHA = [0, 0.24, 0.45, 0.7, 1]

export interface ShareCardTheme {
  cardBackground: string
  cardBorder: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  /** Brand mark + heatmap accent. */
  accent: string
  /** Level-0 cell, i.e. "no activity". */
  heatEmpty: string
}

export interface ShareCardPaintOptions {
  /** Device pixels per CSS pixel. */
  scale: number
  /** Loaded avatar, or null to draw the initial-letter placeholder. */
  avatar: CanvasImageSource | null
}

/**
 * @returns false when this environment has no 2D context (happy-dom has none),
 * so callers can keep the dialog usable instead of throwing on mount.
 */
export function paintShareCard(
  canvas: HTMLCanvasElement,
  model: ShareCardModel,
  theme: ShareCardTheme,
  options: ShareCardPaintOptions,
): boolean {
  const scale = options.scale > 0 ? options.scale : 1
  // Only the backing store is sized here — the displayed size belongs to CSS
  // (`width: 100%; height: auto`), which keeps the intrinsic 620:420 ratio while
  // the exported PNG stays at the device pixel resolution.
  canvas.width = Math.round(SHARE_CARD_WIDTH * scale)
  canvas.height = Math.round(SHARE_CARD_HEIGHT * scale)

  const ctx = canvas.getContext('2d')
  if (!ctx) return false

  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.clearRect(0, 0, SHARE_CARD_WIDTH, SHARE_CARD_HEIGHT)
  ctx.textBaseline = 'alphabetic'

  // Card surface.
  roundedRect(ctx, 0.5, 0.5, SHARE_CARD_WIDTH - 1, SHARE_CARD_HEIGHT - 1, RADIUS)
  ctx.fillStyle = theme.cardBackground
  ctx.fill()
  ctx.strokeStyle = theme.cardBorder
  ctx.lineWidth = 1
  ctx.stroke()

  paintIdentity(ctx, model, theme, options.avatar)
  paintStats(ctx, model, theme)
  paintHeatmap(ctx, model, theme)
  paintFooter(ctx, model, theme)

  return true
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, width, height, radius)
    return
  }
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + width, y, x + width, y + height, radius)
  ctx.arcTo(x + width, y + height, x, y + height, radius)
  ctx.arcTo(x, y + height, x, y, radius)
  ctx.arcTo(x, y, x + width, y, radius)
  ctx.closePath()
}

function paintIdentity(
  ctx: CanvasRenderingContext2D,
  model: ShareCardModel,
  theme: ShareCardTheme,
  avatar: CanvasImageSource | null,
): void {
  const centerY = PADDING + AVATAR_SIZE / 2

  if (!model.hidden) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(PADDING + AVATAR_SIZE / 2, centerY, AVATAR_SIZE / 2, 0, Math.PI * 2)
    ctx.closePath()
    ctx.clip()
    if (avatar) {
      ctx.drawImage(avatar, PADDING, PADDING, AVATAR_SIZE, AVATAR_SIZE)
    } else {
      ctx.fillStyle = theme.heatEmpty
      ctx.fillRect(PADDING, PADDING, AVATAR_SIZE, AVATAR_SIZE)
      ctx.fillStyle = theme.textSecondary
      ctx.font = '600 22px system-ui, -apple-system, "Segoe UI", sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(initialOf(model.nickname), PADDING + AVATAR_SIZE / 2, centerY + 8)
    }
    ctx.restore()
  }

  const name = model.hidden ? model.hiddenName : model.nickname || model.hiddenName
  ctx.textAlign = 'left'
  ctx.fillStyle = model.hidden ? theme.textMuted : theme.textPrimary
  ctx.font = '600 20px system-ui, -apple-system, "Segoe UI", sans-serif'
  const textX = model.hidden ? PADDING : PADDING + AVATAR_SIZE + 16
  ctx.fillText(truncate(ctx, name, SHARE_CARD_WIDTH - textX - PADDING), textX, centerY + 7)
}

function initialOf(name: string): string {
  const trimmed = name.trim()
  return trimmed ? trimmed.slice(0, 1).toUpperCase() : '·'
}

function paintStats(ctx: CanvasRenderingContext2D, model: ShareCardModel, theme: ShareCardTheme): void {
  const columns = model.stats.length
  const columnWidth = (SHARE_CARD_WIDTH - PADDING * 2) / columns
  const valueY = 160

  model.stats.forEach((stat, index) => {
    const centerX = PADDING + columnWidth * index + columnWidth / 2
    ctx.textAlign = 'center'
    ctx.fillStyle = theme.textPrimary
    ctx.font = '600 30px system-ui, -apple-system, "Segoe UI", sans-serif'
    ctx.fillText(stat.value, centerX, valueY)
    ctx.fillStyle = theme.textMuted
    ctx.font = '12px system-ui, -apple-system, "Segoe UI", sans-serif'
    ctx.fillText(truncate(ctx, stat.label, columnWidth - 8), centerX, valueY + 22)
  })
}

function paintHeatmap(ctx: CanvasRenderingContext2D, model: ShareCardModel, theme: ShareCardTheme): void {
  const cellWidth = CELL + CELL_GAP
  const gridWidth = HEATMAP_WEEKS * cellWidth - CELL_GAP
  const originX = (SHARE_CARD_WIDTH - gridWidth) / 2
  const originY = 216

  ctx.save()
  for (let week = 0; week < model.weeks.length; week += 1) {
    const column = model.weeks[week] ?? []
    for (let day = 0; day < HEATMAP_ROWS; day += 1) {
      const level = column[day]
      if (level === null || level === undefined) continue
      const x = originX + week * cellWidth
      const y = originY + day * cellWidth
      roundedRect(ctx, x, y, CELL, CELL, 3)
      if (level <= 0) {
        ctx.fillStyle = theme.heatEmpty
      } else {
        ctx.globalAlpha = HEAT_ALPHA[Math.min(level, HEATMAP_MAX_LEVEL)] ?? 1
        ctx.fillStyle = theme.accent
      }
      ctx.fill()
      ctx.globalAlpha = 1
    }
  }
  ctx.restore()
}

function paintFooter(ctx: CanvasRenderingContext2D, model: ShareCardModel, theme: ShareCardTheme): void {
  const y = SHARE_CARD_HEIGHT - PADDING - 4

  ctx.textAlign = 'left'
  ctx.fillStyle = theme.textMuted
  ctx.font = '13px system-ui, -apple-system, "Segoe UI", sans-serif'
  ctx.fillText(model.dateText, PADDING, y)

  // Brand, bottom right: the mark plus the calligraphic wordmark, both drawn
  // from the shipped SVG geometry (lib/shareBrand.ts) rather than set in a font.
  const markHeight = 18
  const wordmarkHeight = 15
  const markWidth = scaleWidth(SHARE_BRAND_MARK, markHeight)
  const wordmarkWidth = scaleWidth(SHARE_BRAND_WORDMARK, wordmarkHeight)
  const gap = 9
  const wordmarkX = SHARE_CARD_WIDTH - PADDING - wordmarkWidth
  const markX = wordmarkX - gap - markWidth

  drawBrandPath(ctx, SHARE_BRAND_MARK, markX, y - markHeight + 3, markWidth, markHeight, theme.accent)
  drawBrandPath(ctx, SHARE_BRAND_WORDMARK, wordmarkX, y - wordmarkHeight + 2, wordmarkWidth, wordmarkHeight, theme.textPrimary)
}

function scaleWidth(geometry: BrandGeometry, height: number): number {
  return (height * geometry.viewBox.width) / geometry.viewBox.height
}

function drawBrandPath(
  ctx: CanvasRenderingContext2D,
  geometry: BrandGeometry,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(width / geometry.viewBox.width, height / geometry.viewBox.height)
  ctx.fillStyle = color
  ctx.fill(new Path2D(geometry.path))
  ctx.restore()
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let result = text
  while (result.length > 1 && ctx.measureText(`${result}…`).width > maxWidth) {
    result = result.slice(0, -1)
  }
  return `${result}…`
}
