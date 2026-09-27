import {
  BookUser,
  CalendarDays,
  CreditCard,
  FileStack,
  Hammer,
  ListChecks,
  Luggage,
  PartyPopper,
  PawPrint,
  Receipt,
  ScrollText,
  ShoppingCart,
  SprayCan,
  Stethoscope,
  StickyNote,
  Target,
  UtensilsCrossed,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

const TOOL_ICONS: Record<string, LucideIcon> = {
  SprayCan,
  Wrench,
  Hammer,
  Stethoscope,
  PawPrint,
  Receipt,
  CreditCard,
  PartyPopper,
  CalendarDays,
  ListChecks,
  Target,
  UtensilsCrossed,
  ShoppingCart,
  BookUser,
  FileStack,
  StickyNote,
  Luggage,
  ScrollText,
};

type ToolIconProps = {
  name: string;
  className?: string;
};

export function ToolIcon({ name, className = 'h-6 w-6' }: ToolIconProps) {
  const Icon = TOOL_ICONS[name] ?? Wrench;
  return <Icon className={className} aria-hidden="true" />;
}
