'use client';

import { useEffect } from 'react';
import { trackPublicEvent } from '@/lib/public-analytics';

type TrackPublicPageViewProps = {
  eventName: string;
  slug?: string;
  source?: string;
};

export function TrackPublicPageView({ eventName, slug, source }: TrackPublicPageViewProps) {
  useEffect(() => {
    const params: Record<string, string> = {};
    if (slug) params.slug = slug;
    if (source) params.source = source;
    trackPublicEvent(eventName, Object.keys(params).length > 0 ? params : undefined);
  }, [eventName, slug, source]);

  return null;
}
