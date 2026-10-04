import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PROVIDER_TEMPLATES } from './providerTemplates'

const HARNESS_IDS = ['opencode', 'cursor', 'codebuddy', 'dsh', 'kimi-code', 'claude-code', 'codex', 'zcode']

// Core's catalog is the authority for what each harness actually speaks; a desktop row claiming a
// channel the catalog does not declare can be saved but never driven, and one missing a channel
// hides a way the user could reach the same binary. The comparison parses Core rather than restating
// the table, so the guard cannot drift into agreeing with a wrong copy of itself.
const catalogSource = readFileSync(
  fileURLToPath(new URL('../../../TinadecCore/Abstractions/Ports/HarnessCatalog.cs', import.meta.url)),
  'utf8',
)

function harness(driver: string) {
  return PROVIDER_TEMPLATES.find((template) => template.driver === driver)!
}

describe('harness provider templates', () => {
  it('reads the real catalog source, so a moved file cannot blank the check', () => {
    expect(catalogSource).toContain('public static IReadOnlyList<HarnessSpec> All')
    expect(catalogSource).toContain('Id: "opencode",')
    expect(catalogSource.length).toBeGreaterThan(1000)
  })

  it('offers exactly the eight catalog harnesses', () => {
    const drivers = PROVIDER_TEMPLATES.filter((template) => template.connection_kind === 'cli').map((template) => template.driver)

    expect(drivers.slice().sort()).toEqual([...HARNESS_IDS].sort())
  })

  it('declares the same channels Core does, per harness', () => {
    for (const id of HARNESS_IDS) {
      const expected = catalogChannels(id)
      const actual = (harness(id).channels ?? []).map((channel) => channel.channel).sort()
      expect(actual, `${id} channels`).toEqual(expected)
    }
  })

  it('names the same protocol for each channel as Core does', () => {
    for (const id of HARNESS_IDS) {
      for (const channel of harness(id).channels ?? []) {
        expect(catalogProtocolFor(id, channel.channel), `${id}/${channel.channel}`).toBe(channel.protocol)
      }
    }
  })

  it('keeps the three harnesses with no ACP endpoint out of the acp channel', () => {
    // Measured, not inferred: `claude --help` and `codex --help` on this host mention ACP zero times,
    // and ZCode ships an app-server instead. Claiming acp for them is what made the old rows unconnectable.
    for (const id of ['claude-code', 'codex', 'zcode']) {
      expect(harness(id).channels ?? [], id).not.toContainEqual(expect.objectContaining({ channel: 'acp' }))
      expect(harness(id).protocol).toBe('headless-cli')
    }
  })

  it('pairs every channel with the protocol that names it, and no HTTP template with a channel', () => {
    const byChannel: Record<string, string> = { acp: 'acp', cli: 'headless-cli', tui: 'tui' }
    for (const id of HARNESS_IDS) {
      for (const channel of harness(id).channels ?? []) {
        expect(byChannel[channel.channel], `${id}/${channel.channel}`).toBe(channel.protocol)
      }
    }
    for (const driver of ['openai-compatible', 'anthropic', 'ollama']) {
      const template = PROVIDER_TEMPLATES.find((item) => item.driver === driver)
      if (!template) continue
      expect(template.channels ?? [], driver).toEqual([])
    }
  })

  it('shows no argv or endpoint field for a channel Core starts from its own catalog', () => {
    // Both `acp` and `headless-cli` argv come from HarnessCatalog at spawn time, so an editable
    // launch_args box would collect a string Core then ignores — and the free-text form of it cannot
    // even be split into arguments safely. Only opencode's serve command is genuinely the user's.
    for (const id of HARNESS_IDS) {
      const fields = harness(id).fields
      expect(fields.base_url, id).toBe(false)
      expect(fields.model, id).toBe(false)
      expect(fields.api_key, id).toBe(false)
      expect(fields.binary_path, id).toBe(true)
      expect(fields.server_url, id).toBe(id === 'opencode')
      expect(fields.launch_args, id).toBe(id === 'opencode')
    }
  })

  it('names an absolute path for every harness binary', () => {
    // Core refuses a connect whose binary_path is not an existing file, so a bare command name in the
    // placeholder teaches people to type something that cannot work.
    for (const id of HARNESS_IDS) {
      const placeholder = harness(id).placeholders.binary_path ?? ''
      expect(/(^\/|[A-Za-z]:\\\\|\\\\)/.test(placeholder) || placeholder.includes('\\'), `${id} placeholder`).toBe(true)
    }
  })

  it('carries every display and summary key into both locale bundles', () => {
    // providerTemplates.ts holds `providers.*` key names rather than calling t(), so the parity suite
    // that scans panels for t() literals never sees them; a typo here renders a dotted key in the UI.
    const bundles = ['en', 'zh-CN'].map((locale) => {
      const source = readFileSync(fileURLToPath(new URL(`./locales/${locale}.ts`, import.meta.url)), 'utf8')
      return { locale, keys: new Set([...source.matchAll(/^\s{4}([A-Za-z0-9_]+):/gm)].map((match) => match[1])) }
    })

    const wanted = PROVIDER_TEMPLATES.flatMap((template) => [template.display_name_key, template.summary_key])
      .filter((key) => key.startsWith('providers.'))
      .map((key) => key.slice('providers.'.length))

    expect(wanted.length).toBeGreaterThan(0)
    for (const bundle of bundles) {
      const missing = wanted.filter((key) => !bundle.keys.has(key))
      expect(missing, `missing providers.* keys in ${bundle.locale}`).toEqual([])
    }
  })

  it('keeps the fabricated port flag out of every placeholder', () => {
    // The scan in TinadecCore HarnessCatalogTests also watches this tree; this assertion says which
    // file the rule protects, so the failure names the table rather than a mystery count.
    const offenders = PROVIDER_TEMPLATES.filter((template) =>
      Object.values(template.placeholders ?? {}).some((value) => String(value).includes('acp' + '-port')))
    expect(offenders.map((template) => template.driver)).toEqual([])
  })
})

/** `Id: "opencode"` … `Channels: [new(AgentChannels.Acp, ChatProtocols.Acp, …)]` in Core's table. */
function catalogBlock(id: string): string {
  const start = catalogBlockStart(id)
  const next = catalogSource.indexOf('Id: "', start + 1)
  return catalogSource.slice(start, next === -1 ? catalogSource.length : next)
}

function catalogBlockStart(id: string): number {
  const marker = `Id: "${id}",`
  const at = catalogSource.indexOf(marker)
  expect(at, `catalog entry for ${id}`).toBeGreaterThan(-1)
  return at
}

function catalogChannels(id: string): string[] {
  const block = catalogBlock(id)
  const channels = [...block.matchAll(/new\(AgentChannels\.(\w+)/g)].map((match) => match[1].toLowerCase())
  // Core's ids are Pascal-cased constants (`Acp`, `Cli`, `Tui`) while the desktop uses the wire words.
  return channels.map((channel) => (channel === 'cli' ? 'cli' : channel === 'acp' ? 'acp' : channel === 'tui' ? 'tui' : channel)).sort()
}

function catalogProtocolFor(id: string, channel: string): string | undefined {
  const constant = channel.toUpperCase() === 'CLI' ? 'Cli' : channel === 'acp' ? 'Acp' : 'Tui'
  const match = catalogBlock(id).match(new RegExp(`new\\(AgentChannels\\.${constant}, ChatProtocols\\.(\\w+)`))
  if (!match) return undefined
  return protocolName(match[1])
}

function protocolName(constant: string): string {
  switch (constant) {
    case 'Acp': return 'acp'
    case 'HeadlessCli': return 'headless-cli'
    case 'Tui': return 'tui'
    case 'OpencodeServe': return 'opencode-serve'
    case 'OpenAiChat': return 'openai-chat'
    case 'OpenAiResponses': return 'openai-responses'
    case 'AnthropicMessages': return 'anthropic-messages'
    default: return constant.toLowerCase()
  }
}
