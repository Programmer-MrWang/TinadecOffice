'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')

const {
  MEDIA_ORIGIN,
  decodePathToken,
  encodePathToken,
  mediaMimeFor,
  mediaPathFromUrl,
  mediaUrlFor,
  parseRange,
  sourceToMediaPath,
} = require('./localMedia.cjs')

test('only image and video extensions are servable', () => {
  assert.equal(mediaMimeFor('/tmp/a.PNG'), 'image/png')
  assert.equal(mediaMimeFor('/tmp/a.mp4'), 'video/mp4')
  assert.equal(mediaMimeFor('/tmp/notes.txt'), null)
  assert.equal(mediaMimeFor('/tmp/payload.exe'), null)
  assert.equal(mediaMimeFor('/tmp/noextension'), null)
  assert.equal(mediaUrlFor('/tmp/payload.exe'), null)
})

test('a media URL round trips back to the same path', () => {
  for (const filePath of [
    '/home/user/背景 图.png',
    'C:\\Users\\My User\\background image.jpg',
    '/tmp/video.mp4',
  ]) {
    const url = mediaUrlFor(filePath)
    assert.ok(url && url.startsWith(`${MEDIA_ORIGIN}/`), `no URL for ${filePath}`)
    assert.equal(mediaPathFromUrl(url), filePath)
  }
})

test('a tampered or non-media token is refused instead of decoded', () => {
  const good = encodePathToken('/tmp/photo.png')
  assert.equal(decodePathToken(good), '/tmp/photo.png')

  // Valid base64 of a path whose extension is not servable.
  assert.equal(decodePathToken(encodePathToken('/tmp/payload.exe')), null)
  assert.equal(decodePathToken('not base64 !!!'), null)
  assert.equal(decodePathToken(''), null)
  assert.equal(decodePathToken(undefined), null)
  // A token that decodes to different bytes than it claims must not be trusted.
  assert.equal(decodePathToken(Buffer.from('/tmp/a.png ', 'utf8').toString('base64url')), null)
  assert.equal(mediaPathFromUrl('tinadec-media://other/abc'), null)
  assert.equal(mediaPathFromUrl('file:///tmp/a.png'), null)
})

test('range parsing covers the forms a video element sends', () => {
  assert.deepEqual(parseRange('bytes=0-99', 1000), { start: 0, end: 99 })
  assert.deepEqual(parseRange('bytes=100-', 1000), { start: 100, end: 999 })
  assert.deepEqual(parseRange('bytes=-50', 1000), { start: 950, end: 999 })
  assert.deepEqual(parseRange('bytes=0-99999', 1000), { start: 0, end: 999 })

  // No usable range: serve the whole body rather than failing the request.
  assert.equal(parseRange(undefined, 1000), null)
  assert.equal(parseRange('bytes=0-1,5-6', 1000), null)
  assert.equal(parseRange('items=0-1', 1000), null)

  // Out of bounds: the caller answers 416.
  assert.equal(parseRange('bytes=1000-', 1000), 'invalid')
  assert.equal(parseRange('bytes=500-100', 1000), 'invalid')
  assert.equal(parseRange('bytes=-0', 1000), 'invalid')
})

test('legacy sources still resolve to a path', () => {
  assert.equal(sourceToMediaPath('tinadec-media://local/' + encodePathToken('/tmp/a.png')), '/tmp/a.png')
  assert.equal(sourceToMediaPath('file:///tmp/a.png'), '/tmp/a.png')
  assert.equal(sourceToMediaPath('https://example.com/a.png'), null)
  assert.equal(sourceToMediaPath(''), null)
  assert.equal(sourceToMediaPath(undefined), null)
})
