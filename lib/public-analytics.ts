'use client';

/**
 * Public marketing events.
 *
 * Household Toolbox does not currently load a third-party analytics provider.
 * These events are dispatched on the page and pushed to `window.dataLayer`
 * when a tag manager is added later. Do not add a new analytics vendor here.
 */

export { PUBLIC_ANALYTICS_EVENTS } from '@/lib/public-analytics-events';

type AnalyticsWindow = Window & {
  dataLayer?: Array<Record<string, unknown>>;
};

export function trackPublicEvent(name: string, params?: Record<string, string>) {
  if (typeof window === 'undefined') return;

  const detail = { name, ...(params ?? {}) };
  window.dispatchEvent(new CustomEvent('ht-public-event', { detail }));

  const analyticsWindow = window as AnalyticsWindow;
  if (Array.isArray(analyticsWindow.dataLayer)) {
    analyticsWindow.dataLayer.push({ event: name, ...params });
  }
}
