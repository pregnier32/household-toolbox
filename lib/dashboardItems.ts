/**
 * Helper utility for tools to create dashboard items
 * This provides a simple interface for tools to add items to the user's dashboard
 */

export interface CreateDashboardItemParams {
  tool_id: string;
  title: string;
  description?: string;
  type: 'calendar_event' | 'action_item' | 'both';
  due_date?: string | Date; // ISO string or Date object
  scheduled_date?: string | Date; // ISO string or Date object
  priority?: 'low' | 'medium' | 'high';
  status?: 'pending' | 'completed' | 'cancelled';
  metadata?: Record<string, any>;
}

export interface DashboardItem {
  id: string;
  user_id: string;
  tool_id: string;
  title: string;
  description?: string;
  type: 'calendar_event' | 'action_item' | 'both';
  due_date?: string;
  scheduled_date?: string;
  priority?: 'low' | 'medium' | 'high';
  status: 'pending' | 'completed' | 'cancelled';
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

/**
 * Create a dashboard item from a tool
 * This should be called from server-side code (API routes)
 */
export async function createDashboardItem(
  params: CreateDashboardItemParams
): Promise<DashboardItem> {
  // Convert dates to ISO strings if they're Date objects
  const payload = {
    ...params,
    due_date: params.due_date
      ? typeof params.due_date === 'string'
        ? params.due_date
        : params.due_date.toISOString()
      : undefined,
    scheduled_date: params.scheduled_date
      ? typeof params.scheduled_date === 'string'
        ? params.scheduled_date
        : params.scheduled_date.toISOString()
      : undefined,
  };

  const response = await fetch('/api/dashboard/items', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create dashboard item');
  }

  const data = await response.json();
  return data.item;
}

/**
 * Update a dashboard item
 */
export async function updateDashboardItem(
  itemId: string,
  updates: Partial<CreateDashboardItemParams>
): Promise<DashboardItem> {
  // Convert dates to ISO strings if they're Date objects
  const payload: any = { ...updates };
  if (updates.due_date) {
    payload.due_date =
      typeof updates.due_date === 'string'
        ? updates.due_date
        : updates.due_date.toISOString();
  }
  if (updates.scheduled_date) {
    payload.scheduled_date =
      typeof updates.scheduled_date === 'string'
        ? updates.scheduled_date
        : updates.scheduled_date.toISOString();
  }

  const response = await fetch(`/api/dashboard/items/${itemId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update dashboard item');
  }

  const data = await response.json();
  return data.item;
}

/**
 * Delete a dashboard item
 */
export async function deleteDashboardItem(itemId: string): Promise<void> {
  const response = await fetch(`/api/dashboard/items/${itemId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete dashboard item');
  }
}
