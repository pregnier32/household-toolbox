'use client';

import * as LucideIcons from 'lucide-react';
import { LucideIcon } from 'lucide-react';

type DynamicIconProps = {
  iconName: string;
  size?: number | string;
  className?: string;
  fallback?: React.ReactNode;
};

// Helper function to get icon component by name
function getIconComponent(iconName: string): LucideIcon | null {
  // Convert kebab-case or snake_case to PascalCase
  const pascalName = iconName
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('') as keyof typeof LucideIcons;
  
  return (LucideIcons[pascalName] as LucideIcon) || null;
}

export function DynamicIcon({ iconName, size = 24, className = '', fallback }: DynamicIconProps) {
  // Check if iconName looks like a URL (starts with http://, https://, or /)
  if (iconName.startsWith('http://') || iconName.startsWith('https://') || iconName.startsWith('/')) {
    // It's a URL, render as image
    return (
      <img 
        src={iconName} 
        alt="Icon" 
        width={size} 
        height={size} 
        className={className}
        onError={(e) => {
          // Hide image on error, show fallback if provided
          e.currentTarget.style.display = 'none';
        }}
      />
    );
  }

  // It's an icon name, try to render as Lucide icon
  const IconComponent = getIconComponent(iconName);
  
  if (IconComponent) {
    return <IconComponent size={size} className={className} />;
  }

  // Icon not found, show fallback or nothing
  if (fallback) {
    return <>{fallback}</>;
  }

  return null;
}

