'use client';

import Image from 'next/image';
import { useTheme } from './AppThemeProvider';

type SideLogoProps = {
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  alt?: string;
};

const SRC_WHITE = '/images/logo/Logo_Side_White.png';
const SRC_BLACK = '/images/logo/Logo_Side_Black.png';

export function SideLogo({
  width = 200,
  height,
  className = 'h-auto',
  priority,
  alt = 'Household Toolbox',
}: SideLogoProps) {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';
  const src = isLight ? SRC_BLACK : SRC_WHITE;
  const intrinsicHeight = isLight ? 306 : 310;
  const intrinsicWidth = isLight ? 699 : 688;
  const renderedHeight = height ?? Math.round((width * intrinsicHeight) / intrinsicWidth);

  return (
    <Image
      key={resolvedTheme}
      src={src}
      alt={alt}
      width={width}
      height={renderedHeight}
      className={`${className} bg-transparent`}
      style={{ backgroundColor: 'transparent' }}
      unoptimized
      priority={priority}
    />
  );
}
