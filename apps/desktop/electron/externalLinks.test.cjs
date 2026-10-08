'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')

// externalLinks requires 'electron' for `shell`; the guards themselves are pure.
const Module = require('node:module')
const originalLoad = Module._load

/** @type {string[]} */
const opened = []

Module._load = function (request, parent, isMain) {
  if (request === 'electron') {
    return { shell: { openExternal: (url) => { opened.push(url); return Promise.resolve() } } }
  }
  return originalLoad.call(this, request, parent, isMain)
}

const { attachExternalLinkGuards, isSafeExternalUrl, sameOrigin } = require('./externalLinks.cjs')

test.after(() => {
  Module._load = originalLoad
})

test.beforeEach(() => {
  opened.length = 0
})

test('only http(s) reaches the shell', () => {
  assert.equal(isSafeExternalUrl('https://github.com/Tinadec/TinadecOffice'), true)
  assert.equal(isSafeExternalUrl('http://127.0.0.1:48730/docs'), true)

  // Everything else — including schemes a page can invent — must not be handed to the OS.
  for (const url of [
    'file:///C:/Windows/System32/calc.exe',
    'javascript:alert(1)',
    'ms-settings:',
    'vscode://x',
    'tinadec-media://local/abc',
    'not a url',
    '',
  ]) {
    assert.equal(isSafeExternalUrl(url), false, `opened ${url}`)
  }
})

test('origin comparison ignores the path', () => {
  assert.equal(sameOrigin('app://bundle/index.html#/a', 'app://bundle/index.html#/b'), true)
  assert.equal(sameOrigin('http://127.0.0.1:5173/x', 'http://127.0.0.1:5173/y'), true)
  assert.equal(sameOrigin('http://127.0.0.1:5173/x', 'http://127.0.0.1:5174/x'), false)
  assert.equal(sameOrigin('https://example.com/', 'http://example.com/'), false)
  assert.equal(sameOrigin('nonsense', 'nonsense'), false)
})

/** Minimal webContents double. */
function makeWebContents(currentUrl) {
  const handlers = {}
  return {
    handlers,
    getURL: () => currentUrl,
    setWindowOpenHandler: (fn) => { handlers.open = fn },
    on: (event, fn) => { handlers[event] = fn },
  }
}

test('window.open on an http(s) target opens the browser and never a window', () => {
  const wc = makeWebContents('app://bundle/index.html#/')
  attachExternalLinkGuards(wc)

  assert.deepEqual(wc.handlers.open({ url: 'https://github.com/Tinadec/TinadecOffice' }), { action: 'deny' })
  assert.deepEqual(opened, ['https://github.com/Tinadec/TinadecOffice'])

  assert.deepEqual(wc.handlers.open({ url: 'file:///C:/Windows/System32/calc.exe' }), { action: 'deny' })
  assert.deepEqual(opened, ['https://github.com/Tinadec/TinadecOffice'], 'a file: target reached the shell')
})

test('an in-page link to another site opens externally instead of replacing the app', () => {
  const wc = makeWebContents('app://bundle/index.html#/')
  attachExternalLinkGuards(wc)

  let prevented = false
  wc.handlers['will-navigate']({ preventDefault: () => { prevented = true } }, 'https://example.com/doc')
  assert.equal(prevented, true)
  assert.deepEqual(opened, ['https://example.com/doc'])
})

test('navigating inside the app is left alone', () => {
  const wc = makeWebContents('app://bundle/index.html#/')
  attachExternalLinkGuards(wc)

  let prevented = false
  wc.handlers['will-navigate']({ preventDefault: () => { prevented = true } }, 'app://bundle/index.html#/settings')
  assert.equal(prevented, false, 'the SPA must be able to navigate itself')
  assert.deepEqual(opened, [])
})
