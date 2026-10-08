/**
 * External link handling shared by every window.
 *
 * Every window used to install `setWindowOpenHandler(() => ({ action: 'deny' }))`, which
 * silently swallowed the About page's repository link, "open API docs", and the preview
 * panel's external-open button. An http(s) target now opens in the user's browser; anything
 * else (custom schemes, `file:`, `javascript:`) is still dropped rather than handed to the
 * shell.
 */

const { shell } = require('electron');

/**
 * True only for http(s). Every other scheme — including `file:` and anything a page can
 * invent — is refused before it reaches the OS.
 * @param {string} url
 * @returns {boolean}
 */
function isSafeExternalUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Compare origins. An unparseable URL never matches.
 * @param {string} left
 * @param {string} right
 * @returns {boolean}
 */
function sameOrigin(left, right) {
  try {
    const a = new URL(left);
    const b = new URL(right);
    return a.protocol === b.protocol && a.host === b.host;
  } catch {
    return false;
  }
}

/**
 * Install both guards on a window's webContents.
 *
 * `setWindowOpenHandler` covers `window.open`/`target=_blank`; `will-navigate` covers a
 * plain in-page link click, which otherwise replaced the whole SPA with the remote page.
 * Hash-router navigation does not raise `will-navigate`, and same-origin navigation (the dev
 * server's own reloads) is left alone.
 *
 * @param {{setWindowOpenHandler: Function, on: Function, getURL: Function}} webContents
 */
function attachExternalLinkGuards(webContents) {
  webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  webContents.on('will-navigate', (event, url) => {
    if (sameOrigin(url, webContents.getURL())) return;
    event.preventDefault();
    if (isSafeExternalUrl(url)) {
      void shell.openExternal(url);
    }
  });
}

module.exports = {
  attachExternalLinkGuards,
  isSafeExternalUrl,
  sameOrigin,
};
