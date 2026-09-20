export type DashboardTab = 'tools' | 'calendar' | 'overview' | 'store';

export type User = {
  id: string;
  email: string;
  firstName: string;
  lastName?: string;
  userStatus?: string;
};

export type ToolIcon = {
  id: string;
  icon_url: string | null;
  has_icon_data: boolean;
};

export type Tool = {
  id: string;
  name: string;
  tool_tip: string | null;
  description: string | null;
  price: number;
  status: string;
  created_at: string | null;
  updated_at: string | null;
  isOwned?: boolean;
  isActive?: boolean;
  trialStatus?: string | null;
  trialEndDate?: string | null;
  icons: {
    default?: ToolIcon;
    coming_soon?: ToolIcon;
    available?: ToolIcon;
  };
};

export function getToolIconSrc(
  tool: Tool,
  preference: 'owned' | 'available' | 'coming_soon' = 'owned'
): string | null {
  const icon =
    preference === 'coming_soon'
      ? tool.icons.default || tool.icons.coming_soon || tool.icons.available
      : tool.icons.default || tool.icons.available || tool.icons.coming_soon;
  const iconUrl = icon?.icon_url && icon.icon_url.trim() !== '' ? icon.icon_url : null;
  return iconUrl || (icon?.id ? `/api/tools/icons/${icon.id}` : null);
}
