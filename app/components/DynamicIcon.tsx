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
  // Trim whitespace
  const trimmedName = iconName.trim();
  
  // First, try the icon name as-is (in case it's already in PascalCase)
  if (LucideIcons[trimmedName as keyof typeof LucideIcons]) {
    return LucideIcons[trimmedName as keyof typeof LucideIcons] as LucideIcon;
  }
  
  // If it's already PascalCase but didn't match, try with first letter capitalized
  const capitalized = trimmedName.charAt(0).toUpperCase() + trimmedName.slice(1);
  if (LucideIcons[capitalized as keyof typeof LucideIcons]) {
    return LucideIcons[capitalized as keyof typeof LucideIcons] as LucideIcon;
  }
  
  // Convert kebab-case or snake_case to PascalCase
  const pascalName = trimmedName
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('') as keyof typeof LucideIcons;
  
  // Try the converted name
  if (LucideIcons[pascalName as keyof typeof LucideIcons]) {
    return LucideIcons[pascalName as keyof typeof LucideIcons] as LucideIcon;
  }
  
  // Handle camelCase (e.g., "stickyNote" -> "StickyNote")
  // Split on capital letters and convert to PascalCase
  const camelCaseMatch = trimmedName.match(/[A-Z]?[a-z]+|[A-Z]+(?=[A-Z]|$)/g);
  if (camelCaseMatch && camelCaseMatch.length > 1) {
    const fromCamelCase = camelCaseMatch
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
    if (LucideIcons[fromCamelCase as keyof typeof LucideIcons]) {
      return LucideIcons[fromCamelCase as keyof typeof LucideIcons] as LucideIcon;
    }
  }
  
  return null;
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

  // Icon not found - log for debugging in development
  if (process.env.NODE_ENV === 'development') {
    console.warn(`Icon not found: "${iconName}" (trimmed: "${iconName.trim()}"). Available icons include:`, 
      Object.keys(LucideIcons).filter(k => k.toLowerCase().includes(iconName.trim().toLowerCase().slice(0, 3))).slice(0, 5)
    );
  }

  // Icon not found, show fallback or nothing
  if (fallback) {
    return <>{fallback}</>;
  }

  return null;
}

