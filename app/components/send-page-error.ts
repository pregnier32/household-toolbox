export function sendPageError(error: { digest?: string; message?: string }) {
  const body = JSON.stringify({
    digest: error.digest ?? '',
    message: error.message ?? '',
    path: window.location.pathname,
  });
  void fetch('/api/errors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => undefined);
}
