'use client';

import Link from 'next/link';
import type { ComponentProps } from 'react';
import { trackPublicEvent } from '@/lib/public-analytics';

type TrackedLinkProps = ComponentProps<typeof Link> & {
  eventName: string;
  eventParams?: Record<string, string>;
};

export function TrackedLink({ eventName, eventParams, onClick, ...props }: TrackedLinkProps) {
  return (
    <Link
      {...props}
      onClick={(event) => {
        trackPublicEvent(eventName, eventParams);
        onClick?.(event);
      }}
    />
  );
}
