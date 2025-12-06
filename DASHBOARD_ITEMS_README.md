# Dashboard Items System

This system allows tools to create items that appear in the user's Dashboard, either in the Calendar view or the Action Items list.

## Setup

1. **Run the database migration:**
   ```sql
   -- Run the SQL file in your Supabase SQL Editor
   supabase/create-dashboard-items-table.sql
   ```

2. **The system is now ready to use!**

## How Tools Can Create Dashboard Items

### From Server-Side Code (API Routes)

Tools should call the dashboard items API from their server-side code:

```typescript
// Example: Creating an action item from a tool's API route
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Your tool's logic here...
  
  // Create a dashboard item
  const dashboardItemResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/dashboard/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': request.headers.get('Cookie') || '', // Pass auth cookie
    },
    body: JSON.stringify({
      tool_id: 'your-tool-id',
      title: 'Feed the dog',
      description: 'Remember to feed Buddy his dinner',
      type: 'action_item', // or 'calendar_event' or 'both'
      due_date: '2025-01-15T18:00:00Z',
      priority: 'high', // 'low', 'medium', or 'high'
      status: 'pending',
      metadata: {
        petName: 'Buddy',
        mealType: 'dinner',
        // Any tool-specific data
      },
    }),
  });

  if (!dashboardItemResponse.ok) {
    console.error('Failed to create dashboard item');
  }

  // Continue with your tool's response...
}
```

### From Client-Side Code

```typescript
// Example: Creating a calendar event from client-side
const createCalendarEvent = async () => {
  const response = await fetch('/api/dashboard/items', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tool_id: 'your-tool-id',
      title: 'Vet Appointment',
      description: 'Annual checkup for Buddy',
      type: 'calendar_event',
      scheduled_date: '2025-01-20T14:00:00Z',
      priority: 'high',
      metadata: {
        petId: 'pet-123',
        appointmentType: 'checkup',
      },
    }),
  });

  const data = await response.json();
  return data.item;
};
```

## Item Types

### `action_item`
- Appears in the "Upcoming Action Items" card on the Dashboard Overview
- Requires `due_date`
- Best for tasks that need to be completed

### `calendar_event`
- Appears on the Calendar view
- Requires `scheduled_date`
- Best for events/appointments

### `both`
- Appears in both places
- Requires both `due_date` and `scheduled_date`
- Best for items that are both events and tasks

## API Endpoints

### GET `/api/dashboard/items`
Fetch dashboard items with optional filters:
- `?type=action_item` - Filter by type
- `?status=pending` - Filter by status
- `?month=2025-01` - Filter calendar events by month (YYYY-MM format)
- `?limit=50` - Limit results
- `?offset=0` - Pagination offset

### POST `/api/dashboard/items`
Create a new dashboard item.

**Required fields:**
- `tool_id` - UUID of the tool creating the item
- `title` - Item title
- `type` - 'calendar_event', 'action_item', or 'both'

**Optional fields:**
- `description` - Item description
- `due_date` - ISO date string (required for action_item)
- `scheduled_date` - ISO date string (required for calendar_event)
- `priority` - 'low', 'medium', or 'high'
- `status` - 'pending', 'completed', or 'cancelled' (default: 'pending')
- `metadata` - JSON object for tool-specific data

### PUT `/api/dashboard/items/[id]`
Update an existing dashboard item.

### DELETE `/api/dashboard/items/[id]`
Delete a dashboard item.

## Examples

### Example 1: Pet Care Schedule Tool
```typescript
// Create a feeding reminder
await fetch('/api/dashboard/items', {
  method: 'POST',
  body: JSON.stringify({
    tool_id: 'pet-care-schedule',
    title: 'Feed Buddy',
    type: 'action_item',
    due_date: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), // 6 hours from now
    priority: 'high',
    metadata: { petId: 'pet-123', meal: 'dinner' },
  }),
});
```

### Example 2: Maintenance Calendar Tool
```typescript
// Create a maintenance appointment
await fetch('/api/dashboard/items', {
  method: 'POST',
  body: JSON.stringify({
    tool_id: 'maintenance-calendar',
    title: 'HVAC Service',
    description: 'Annual HVAC maintenance check',
    type: 'calendar_event',
    scheduled_date: '2025-02-15T10:00:00Z',
    priority: 'medium',
    metadata: { serviceType: 'hvac', technician: 'John Doe' },
  }),
});
```

### Example 3: Recurring Task
```typescript
// Create a recurring task that appears in both places
await fetch('/api/dashboard/items', {
  method: 'POST',
  body: JSON.stringify({
    tool_id: 'your-tool-id',
    title: 'Water the plants',
    type: 'both',
    due_date: '2025-01-15T18:00:00Z',
    scheduled_date: '2025-01-15T18:00:00Z',
    priority: 'low',
    metadata: { recurring: true, frequency: 'weekly' },
  }),
});
```

## Display Features

### Action Items
- Displayed in the "Upcoming Action Items" card
- Shows title, description, due date, and priority
- Overdue items are highlighted in red
- Users can mark items as completed
- Sorted by due date (earliest first)

### Calendar Events
- Displayed as colored bars on calendar days
- Up to 2 events shown per day, with a "+N" indicator for more
- Events are clickable (future enhancement: show event details)
- Filtered by the currently viewed month

## Notes

- All items are automatically scoped to the authenticated user
- Items can be updated or deleted by the user
- The `metadata` field allows tools to store tool-specific data
- Items are automatically filtered and displayed in the appropriate views
