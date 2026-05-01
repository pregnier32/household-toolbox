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
  height = 40,
  className = 'h-auto',
  priority,
  alt = 'Household Toolbox',
}: SideLogoProps) {
  const { resolvedTheme } = useTheme();
  const src = resolvedTheme === 'light' ? SRC_BLACK : SRC_WHITE;

  return (
    <Image
      key={resolvedTheme}
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      priority={priority}
    />
  );
}
