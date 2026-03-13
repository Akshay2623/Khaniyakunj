const rootElement = document.getElementById('root');
const bootFallback = document.getElementById('boot-fallback');

function clearBootFallback() {
  if (bootFallback) {
    bootFallback.remove();
  }
}

function showBootError(error) {
  if (!bootFallback) return;
  bootFallback.innerHTML = `
    <div style="max-width:560px;width:100%;background:#ffffff;border:1px solid #fecaca;border-radius:12px;padding:14px;color:#7f1d1d;">
      <div style="font-weight:700;margin-bottom:8px;">Frontend boot error</div>
      <div style="font-size:13px;line-height:1.4;">${String(error?.message || error || 'Unknown error')}</div>
    </div>
  `;
}

try {
  if (!rootElement) {
    throw new Error('Root container not found.');
  }
  import('./bootApp.jsx')
    .then((module) => module.startApp(rootElement))
    .then(() => {
      window.__SOCIETY_APP_BOOTED__ = true;
      clearBootFallback();
    })
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error('Frontend boot failed (dynamic import):', error);
      showBootError(error);
    });
} catch (error) {
  // eslint-disable-next-line no-console
  console.error('Frontend boot failed:', error);
  showBootError(error);
}
