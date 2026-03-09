/**
 * Offscreen document for clipboard write (used when copying snip image without user gesture).
 * navigator.clipboard often requires focus, so we fall back to document.execCommand('copy') with an img element.
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target !== 'offscreen' || message.type !== 'copy-snip-image') {
    return;
  }
  const { imageDataUrl, sourceText } = message.data || {};
  (async () => {
    try {
      if (!imageDataUrl || typeof imageDataUrl !== 'string') {
        throw new Error('Missing image data');
      }
      let copied = false;
      try {
        const res = await fetch(imageDataUrl);
        const blob = await res.blob();
        const items = { 'image/png': blob };
        if (sourceText && typeof sourceText === 'string') {
          items['text/plain'] = new Blob([sourceText], { type: 'text/plain' });
        }
        await navigator.clipboard.write([new ClipboardItem(items)]);
        copied = true;
      } catch (_) {
        /* Clipboard API may fail when document is not focused; use execCommand fallback */
      }
      if (!copied) {
        const img = document.createElement('img');
        img.src = imageDataUrl;
        img.style.position = 'fixed';
        img.style.left = '-9999px';
        document.body.appendChild(img);
        const range = document.createRange();
        range.selectNode(img);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        try {
          copied = document.execCommand('copy');
        } finally {
          sel.removeAllRanges();
          document.body.removeChild(img);
        }
      }
      if (!copied) {
        throw new Error('Could not copy image to clipboard');
      }
      sendResponse({ success: true });
    } catch (err) {
      sendResponse({ success: false, error: err instanceof Error ? err.message : String(err) });
    } finally {
      window.close();
    }
  })();
  return true;
});
