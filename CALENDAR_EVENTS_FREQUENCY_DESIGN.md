# Calendar Events Frequency Design

## Current Design Overview

The Calendar Events tool stores event **definitions** in the `tools_ce_events` table with frequency information. However, the Dashboard Calendar view queries the `dashboard_items` table, which expects individual `scheduled_date` values (one record per calendar occurrence).

## Frequency Types & Dashboard Display

### 1. **One Time** Events
- **Storage**: 1 record in `tools_ce_events`
- **Dashboard Items**: 1 record in `dashboard_items` (if `add_to_dashboard = true`)
- **Example**: "Doctor Appointment" on 2025-03-15
  - Creates 1 dashboard item with `scheduled_date = 2025-03-15`

### 2. **Weekly** Events
- **Storage**: 1 record in `tools_ce_events` with `days_of_week` array (e.g., [1, 3, 5] for Mon, Wed, Fri)
- **Dashboard Items**: **Multiple records** - one for each occurrence
- **Calculation**: 
  - From `date` (start date) until `end_date` (or indefinitely if no end_date)
  - For each selected day of week
  - **Example**: "Gym Workout" starting 2025-01-06, every Monday/Wednesday/Friday, no end date
    - Creates ~156 dashboard items per year (52 weeks × 3 days)
    - Over 5 years: ~780 dashboard items
    - Over 10 years: ~1,560 dashboard items

### 3. **Monthly** Events
- **Storage**: 1 record in `tools_ce_events` with `day_of_month` (e.g., 15)
- **Dashboard Items**: **Multiple records** - one per month
- **Calculation**:
  - From `date` (start date) until `end_date` (or indefinitely)
  - On the specified `day_of_month` each month
  - **Example**: "Rent Payment" on the 1st of every month, starting 2025-01-01, no end date
    - Creates 12 dashboard items per year
    - Over 5 years: ~60 dashboard items
    - Over 10 years: ~120 dashboard items

### 4. **Annual** Events
- **Storage**: 1 record in `tools_ce_events`
- **Dashboard Items**: **Multiple records** - one per year
- **Calculation**:
  - From `date` (start date) until `end_date` (or indefinitely)
  - On the same month/day each year
  - **Example**: "Birthday" on 2025-06-15, no end date
    - Creates 1 dashboard item per year
    - Over 5 years: 5 dashboard items
    - Over 10 years: 10 dashboard items

## Current Implementation Gap

**The current design does NOT automatically expand recurring events into dashboard_items records.** 

When a user creates a recurring event:
1. ✅ The event definition is saved to `tools_ce_events`
2. ❌ No dashboard_items are created automatically
3. ❌ The Dashboard Calendar won't show the recurring occurrences

## Recommended Approach

### Option 1: **On-Demand Expansion (Recommended)**
Generate dashboard_items dynamically when querying the Dashboard Calendar:

**Pros:**
- No database bloat
- Easy to update recurring events (just change the definition)
- Handles indefinite recurring events efficiently

**Cons:**
- More complex query logic
- Requires calculating occurrences on-the-fly

**Implementation:**
- When Dashboard Calendar requests events for a month, query `tools_ce_events` where `add_to_dashboard = true`
- Expand recurring events into individual occurrences for that month
- Return expanded list to the calendar view

### Option 2: **Pre-Generated Dashboard Items**
Create dashboard_items records when events are saved/updated:

**Pros:**
- Simple queries (just filter dashboard_items by month)
- Fast calendar rendering

**Cons:**
- Database bloat (potentially thousands of records for long-running recurring events)
- Complex update logic (need to delete/recreate items when event changes)
- Need cleanup logic for past events
- Hard to handle indefinite recurring events (how far in advance to generate?)

**Implementation:**
- When event is created/updated, generate dashboard_items for:
  - Next 2-3 years of occurrences, OR
  - Until `end_date` if specified
- Use a background job to generate future occurrences periodically
- Clean up old dashboard_items periodically

### Option 3: **Hybrid Approach**
Store event definitions + generate dashboard_items for near-term only:

**Pros:**
- Balance between simplicity and efficiency
- Only generate what's needed for current/future months

**Cons:**
- Still requires expansion logic
- Need to regenerate periodically

**Implementation:**
- Generate dashboard_items for next 6-12 months when event is created
- Background job regenerates items monthly
- Query combines dashboard_items + on-demand expansion for far-future dates

## Recommendation

**I recommend Option 1 (On-Demand Expansion)** because:

1. **Scalability**: No database bloat from thousands of recurring event occurrences
2. **Flexibility**: Easy to modify recurring events without cascading updates
3. **Simplicity**: Single source of truth (the event definition)
4. **Performance**: Modern databases can handle the calculation efficiently

### Implementation Details for Option 1:

1. **API Endpoint**: Create `/api/dashboard/items/calendar-events` that:
   - Queries `tools_ce_events` where `add_to_dashboard = true` and `is_active = true`
   - Expands recurring events into occurrences for the requested month
   - Returns array of occurrences with calculated `scheduled_date`

2. **Expansion Logic**:
   ```typescript
   function expandEventToOccurrences(event, year, month) {
     // One Time: return single occurrence if date matches month
     // Weekly: calculate all occurrences in month for selected days_of_week
     // Monthly: return occurrence if day_of_month exists in month
     // Annual: return occurrence if month/day matches
   }
   ```

3. **Update Dashboard Calendar**: Modify `loadCalendarEvents` to call the new endpoint instead of querying `dashboard_items` directly for calendar events.

## Database Schema Considerations

The current `tools_ce_events` table design supports this approach:
- ✅ `frequency` field stores the recurrence pattern
- ✅ `days_of_week` (JSONB) for Weekly events
- ✅ `day_of_month` for Monthly events
- ✅ `date` (start date) and `end_date` for date range
- ✅ `add_to_dashboard` flag to control visibility

No schema changes needed - the design already supports on-demand expansion!
