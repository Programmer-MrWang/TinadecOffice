#!/usr/bin/env node
// One real ACP turn against an installed harness, measured rather than assumed.
//
//   node scripts/harness-acp-smoke.mjs opencode
//
// Never in CI: it starts the vendor's own binary, which uses the operator's login and quota. The
// point is to record what the harness actually does — the protocol version it accepts, whether it
// asks for permission on a prompt with no tools, which session/update kinds it emits, and how the
// answer ends — because every one of those is a fact Core has to be right about and none of them can
// be read out of a specification.

import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, existsSync, openSync, readSync, closeSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const HARNESSES = {
  opencode: { binary: 'opencode', argv: ['acp'] },
  codebuddy: {
    binary: 'codebuddy',
    argv: ['--acp'],
    roots: [
      'C:/Program Files/WorkBuddy/resources/app.asar.unpacked/cli/bin',
      join(process.env.LOCALAPPDATA ?? '', 'Programs/WorkBuddy/resources/app.asar.unpacked/cli/bin')
    ]
  },
  dsh: { binary: 'dsh', argv: ['--profile', 'acp'] },
  'kimi-code': { binary: 'kimi', argv: ['acp'], roots: [join(process.env.USERPROFILE ?? '', '.kimi-code/bin')] }
}

// Same rule Core uses: on Windows an extensionless npm entry is a /bin/sh script that CreateProcess
// refuses, so the startable shim has to win.
const EXTENSIONS = process.platform === 'win32' ? ['.cmd', '.exe', '.bat'] : ['']

function isBareWindowsImage(path) {
  if (process.platform !== 'win32') return true
  try {
    const fd = openSync(path, 'r')
    try { const head = Buffer.alloc(2); return readSync(fd, head, 0, 2, 0) === 2 && head[0] === 0x4d && head[1] === 0x5a }
    finally { closeSync(fd) }
  } catch { return false }
}

function locate(spec) {
  for (const root of [...(spec.roots ?? []), ...process.env.PATH.split(process.platform === 'win32' ? ';' : ':')]) {
    if (!root) continue
    for (const extension of EXTENSIONS) {
      const candidate = join(root, `${spec.binary}${extension}`)
      if (existsSync(candidate)) return candidate
    }
    const bare = join(root, spec.binary)
    if (existsSync(bare) && isBareWindowsImage(bare)) return bare
  }
  return null
}

const id = process.argv[2]
const spec = HARNESSES[id]
if (!spec) {
  console.error(`unknown harness '${id}'. known: ${Object.keys(HARNESSES).join(', ')}`)
  process.exit(2)
}
const binary = locate(spec)
if (!binary) {
  console.error(`${id}: binary '${spec.binary}' not found on this machine — nothing to measure.`)
  process.exit(3)
}

const scratch = mkdtempSync(join(tmpdir(), 'tinadec-acp-smoke-'))
// npm shims are batch files, and Node refuses to spawn them directly (CVE-2024-27980) — the same
// reason Core's probe goes through cmd.exe. Argv must be appended as separate args, never joined.
const [file, prefixArgs] = /\.(cmd|bat)$/i.test(binary)
  ? ['cmd.exe', ['/d', '/s', '/c', binary]]
  : [binary, []]
const child = spawn(file, [...prefixArgs, ...spec.argv], { cwd: scratch, stdio: ['pipe', 'pipe', 'pipe'] })

let nextId = 1
const pending = new Map()
const timeline = []
const updates = new Map()
const requestsToClient = []
let sessionId = null
let started = 0
let stdout = ''
let stderrTail = ''

function send(method, params, expectReply = true) {
  const frame = { jsonrpc: '2.0', method, params }
  if (expectReply) frame.id = nextId++
  child.stdin.write(JSON.stringify(frame) + '\n')
  return expectReply ? frame.id : null
}

function request(method, params) {
  return new Promise((resolve, reject) => {
    const id = send(method, params)
    pending.set(id, { resolve, reject })
  })
}

child.stdout.on('data', (chunk) => {
  stdout += chunk.toString('utf8')
  let newline
  while ((newline = stdout.indexOf('\n')) >= 0) {
    const line = stdout.slice(0, newline).trim()
    stdout = stdout.slice(newline + 1)
    if (!line) continue
    let frame
    try {
      frame = JSON.parse(line)
    } catch {
      console.error(`  non-JSON stdout line: ${line.slice(0, 160)}`)
      continue
    }
    handle(frame)
  }
})
child.stderr.on('data', (chunk) => {
  stderrTail = (stderrTail + chunk.toString('utf8')).slice(-4000)
})

function handle(frame) {
  const at = Date.now()
  if (frame.method && frame.id !== undefined && frame.id !== null) {
    // The agent asking the client something is the behaviour this run exists to observe: Round 1
    // answers every request by refusing it, and a harness that stops instead of asking would be a
    // different finding.
    requestsToClient.push({ method: frame.method, id: frame.id, at: at - started, options: (frame.params?.options ?? []).map((option) => option.kind ?? option.outcome ?? '?') })
    if (frame.method === 'session/request_permission') {
      child.stdin.write(JSON.stringify({
        jsonrpc: '2.0',
        id: frame.id,
        result: { outcome: { selected: frame.params?.options?.[0]?.optionId ?? 'reject_once', outcome: 'selected' } }
      }) + '\n')
      return
    }
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: frame.id, error: { code: -32601, message: 'not supported by this client' } }) + '\n')
    return
  }
  if (frame.method === 'session/update') {
    const kind = frame.params?.update?.sessionUpdate ?? '?'
    const previous = updates.get(kind)
    updates.set(kind, { count: (previous?.count ?? 0) + 1, firstAt: previous?.firstAt ?? at - started, lastAt: at - started })
    // The field names on these frames are the reason this script exists: Core maps them, and a
    // mapping written from a specification silently reads zero.
    if (!previous) console.log(`  frame ${kind}: ${JSON.stringify(frame.params?.update).slice(0, 400)}`)
    if (kind === 'agent_message_chunk') {
      const text = frame.params?.update?.content?.text ?? ''
      timeline.push(text)
    }
    return
  }
  if (frame.id !== undefined && pending.has(frame.id)) {
    const waiter = pending.get(frame.id)
    pending.delete(frame.id)
    if (frame.error) waiter.reject(new Error(`frame ${frame.id}: ${JSON.stringify(frame.error)}`))
    else waiter.resolve(frame.result)
  }
}

const kill = () => { try { child.kill('SIGTERM') } catch { /* already gone */ } }
process.on('SIGINT', () => { kill(); cleanup(130) })

function cleanup(code) {
  try { rmSync(scratch, { recursive: true, force: true }) } catch { /* the child may still hold it */ }
  process.exit(code)
}

const timeout = setTimeout(() => {
  console.error(`TIMEOUT after 180000ms. updates: ${JSON.stringify([...updates.keys()])}`)
  if (stderrTail) console.error(`stderr tail:\n${stderrTail}`)
  kill()
  cleanup(4)
}, 180_000)

try {
  started = Date.now()
  const initialized = await request('initialize', {
    protocolVersion: 1,
    clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false }
  })
  console.log('initialize ->')
  console.log(`  protocolVersion accepted: ${initialized.protocolVersion}`)
  console.log(`  agent capabilities: ${JSON.stringify(initialized.agentCapabilities ?? {})}`)
  console.log(`  auth methods: ${(initialized.authMethods ?? []).map((method) => method.id).join(', ') || '(none offered)'}`)

  const created = await request('session/new', { cwd: scratch, mcpServers: [] })
  sessionId = created.sessionId
  console.log('session/new ->')
  console.log(`  sessionId: ${sessionId}`)
  console.log(`  models: ${JSON.stringify(created.models ?? null)}`)
  console.log(`  modes: ${JSON.stringify(created.modes ?? null)}`)

  const result = await new Promise((resolve, reject) => {
    const promptId = send('session/prompt', {
      sessionId,
      prompt: [{ type: 'text', text: 'Reply with exactly this word and nothing else: PONG' }]
    })
    pending.set(promptId, {
      resolve: (value) => { clearTimeout(timeout); resolve(value) },
      reject: (error) => { clearTimeout(timeout); reject(error) }
    })
  })

  const answer = timeline.join('')
  console.log('session/prompt ->')
  console.log(`  stopReason: ${result?.stopReason}`)
  console.log(`  usage: ${JSON.stringify(result?.usage ?? null)}`)
  console.log(`  elapsed: ${Date.now() - started}ms`)
  console.log(`  answer (${answer.length} chars): ${JSON.stringify(answer.slice(0, 200))}`)
  console.log('  update kinds:')
  for (const [kind, info] of updates) {
    console.log(`    ${kind}: ${info.count}x, first ${info.firstAt}ms, last ${info.lastAt}ms`)
  }
  const lastUpdate = Math.max(...[...updates.values()].map((info) => info.lastAt), 0)
  console.log(`  answer length vs prompt end: prompt answered at ${Date.now() - started}ms, last update at ${lastUpdate}ms — the gap is what the drain window has to cover`)
  console.log(`  agent→client requests: ${requestsToClient.length ? JSON.stringify(requestsToClient) : '(none)'}`)
  console.log(`  pending frames at end: ${pending.size}`)
} catch (error) {
  clearTimeout(timeout)
  console.error(`FAILED: ${error.message}`)
  console.error(`  updates seen: ${[...updates.keys()].join(', ') || '(none)'}`)
  if (stderrTail) console.error(`  stderr tail:\n${stderrTail}`)
  kill()
  cleanup(1)
}

kill()
cleanup(0)
