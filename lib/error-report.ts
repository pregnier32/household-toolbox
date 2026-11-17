const MAX_MESSAGE = 300;
const MAX_PATH = 180;
const MAX_DIGEST = 80;

export type PageErrorReport = {
  digest: string;
  message: string;
  path: string;
};

function cleanText(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function cleanPath(value: unknown): string {
  if (typeof value !== 'string') return '';
  const path = value.trim().split('?')[0]?.split('#')[0] ?? '';
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return '';
  return path.slice(0, MAX_PATH);
}

export function pageErrorReport(input: {
  digest?: unknown;
  message?: unknown;
  path?: unknown;
}): PageErrorReport | null {
  const digest = cleanText(input.digest, MAX_DIGEST);
  const message = cleanText(input.message, MAX_MESSAGE);
  const path = cleanPath(input.path);
  if (!digest && !message) return null;
  return { digest, message, path };
}

export function recordPageError(report: PageErrorReport): void {
  console.error('Page error', report.path || '/', report.digest || 'no-digest', report.message || 'unknown');
}
