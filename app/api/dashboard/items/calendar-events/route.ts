import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';

/**
 * Expand a calendar event into individual occurrences for a given month
 */
/**
 * Parse a date string (YYYY-MM-DD) as a local date, not UTC
 * This prevents timezone shifts when comparing dates
 */
function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day); // month is 0-indexed in Date constructor
}

function expandEventToOccurrences(
  event: any,
  year: number,
  month: number // 0-indexed (0 = January, 11 = December)
): Array<{ scheduled_date: string; title: string; description?: string; metadata: any }> {
  const occurrences: Array<{ scheduled_date: string; title: string; description?: string; metadata: any }> = [];
  // Parse dates as local dates to avoid timezone issues
  const startDate = parseLocalDate(event.date);
  const endDate = event.end_date ? parseLocalDate(event.end_date) : null;
  
  // Get the first and last day of the requested month
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  
  // Helper to check if a date is within the event's date range
  const isInDateRange = (date: Date): boolean => {
    if (date < startDate) return false;
    if (endDate && date > endDate) return false;
    return true;
  };

  // Helper to format date as ISO string with optional time
  const formatScheduledDate = (date: Date, time?: string | null): string => {
    const scheduled = new Date(date);
    if (time) {
      // Parse time string (HH:MM format)
      const [hours, minutes] = time.split(':').map(Number);
      scheduled.setHours(hours, minutes || 0, 0, 0);
    } else {
      // Default to 9 AM if no time specified
      scheduled.setHours(9, 0, 0, 0);
    }
    return scheduled.toISOString();
  };

  switch (event.frequency) {
    case 'One Time':
      // Single occurrence - only if it falls in the requested month
      if (
        startDate.getFullYear() === year &&
        startDate.getMonth() === month &&
        isInDateRange(startDate)
      ) {
        occurrences.push({
          scheduled_date: formatScheduledDate(startDate),
          title: event.title,
          description: event.notes || undefined,
          metadata: {
            referenceType: 'calendar_event',
            referenceId: event.id,
            categoryId: event.category_id,
            frequency: event.frequency,
          },
        });
      }
      break;

    case 'Weekly':
      // Generate occurrences for each selected day of week in the month
      if (event.days_of_week && Array.isArray(event.days_of_week) && event.days_of_week.length > 0) {
        const daysOfWeek = event.days_of_week; // Array of numbers (0-6)
        
        // Iterate through each day of the month
        for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
          const currentDate = new Date(year, month, day);
          const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
          
          // Check if this day of week is selected and date is within range
          // Also ensure the date is on or after the start date
          if (
            daysOfWeek.includes(dayOfWeek) && 
            isInDateRange(currentDate) &&
            currentDate >= startDate
          ) {
            occurrences.push({
              scheduled_date: formatScheduledDate(currentDate, event.time),
              title: event.title,
              description: event.notes || undefined,
              metadata: {
                referenceType: 'calendar_event',
                referenceId: event.id,
                categoryId: event.category_id,
                frequency: event.frequency,
                daysOfWeek: event.days_of_week,
              },
            });
          }
        }
      }
      break;

    case 'Monthly':
      // Generate occurrence on the specified day of month
      if (event.day_of_month) {
        const dayOfMonth = event.day_of_month;
        
        // Check if the month has this day (e.g., February doesn't have day 30)
        // If the requested day doesn't exist in the month, skip it
        if (dayOfMonth <= lastDayOfMonth.getDate()) {
          const occurrenceDate = new Date(year, month, dayOfMonth);
          
          // Ensure the occurrence date is on or after the start date
          if (isInDateRange(occurrenceDate) && occurrenceDate >= startDate) {
            occurrences.push({
              scheduled_date: formatScheduledDate(occurrenceDate),
              title: event.title,
              description: event.notes || undefined,
              metadata: {
                referenceType: 'calendar_event',
                referenceId: event.id,
                categoryId: event.category_id,
                frequency: event.frequency,
                dayOfMonth: event.day_of_month,
              },
            });
          }
        }
      }
      break;

    case 'Annual':
      // Generate occurrence on the same month/day each year
      const eventMonth = startDate.getMonth();
      const eventDay = startDate.getDate();
      
      // Check if the requested month matches the event's month
      if (month === eventMonth) {
        // Check if the month has this day (e.g., Feb 29 in non-leap years)
        // If the day doesn't exist in the requested year's month, skip it
        if (eventDay <= lastDayOfMonth.getDate()) {
          const occurrenceDate = new Date(year, month, eventDay);
          
          // Ensure the occurrence date is on or after the start date
          if (isInDateRange(occurrenceDate) && occurrenceDate >= startDate) {
            occurrences.push({
              scheduled_date: formatScheduledDate(occurrenceDate, event.time),
              title: event.title,
              description: event.notes || undefined,
              metadata: {
                referenceType: 'calendar_event',
                referenceId: event.id,
                categoryId: event.category_id,
                frequency: event.frequency,
              },
            });
          }
        }
      }
      break;
  }

  return occurrences;
}

/**
 * GET - Fetch calendar events for a specific month, expanding recurring events
 * Query params:
 * - month: YYYY-MM format (e.g., "2025-03")
 * - toolId: Optional tool ID to filter by specific tool
 */
export async function GET(request: NextRequest) {
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month');
    const toolId = searchParams.get('toolId');

    if (!monthParam) {
      return NextResponse.json({ error: 'month parameter is required (YYYY-MM format)' }, { status: 400 });
    }

    // Parse month parameter (YYYY-MM)
    const [yearStr, monthStr] = monthParam.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1; // Convert to 0-indexed

    if (isNaN(year) || isNaN(month) || month < 0 || month > 11) {
      return NextResponse.json({ error: 'Invalid month format. Use YYYY-MM' }, { status: 400 });
    }

    // Build query for calendar events
    let query = supabaseServer
      .from('tools_ce_events')
      .select(`
        id,
        title,
        date,
        time,
        frequency,
        notes,
        add_to_dashboard,
        is_active,
        end_date,
        days_of_week,
        day_of_month,
        category_id,
        tool_id,
        tools_ce_categories!category_id (
          id,
          name,
          card_color
        )
      `)
      .eq('user_id', user.id)
      .eq('add_to_dashboard', true)
      .eq('is_active', true);

    // Filter by tool if provided
    if (toolId) {
      query = query.eq('tool_id', toolId);
    }

    const { data: events, error } = await query;

    if (error) {
      console.error('Error fetching calendar events:', error);
      // If table doesn't exist yet, return empty array (graceful degradation)
      if (error.message?.includes('does not exist') || 
          error.message?.includes('schema cache') ||
          error.code === '42P01' ||
          error.code === 'PGRST116') {
        return NextResponse.json({ items: [] });
      }
      return NextResponse.json({ error: 'Failed to fetch calendar events' }, { status: 500 });
    }

    if (!events || events.length === 0) {
      console.log(`No calendar events found for month ${monthParam} (user: ${user.id})`);
      return NextResponse.json({ items: [] });
    }

    console.log(`Found ${events.length} calendar events for month ${monthParam}:`, 
      events.map(e => ({ id: e.id, title: e.title, date: e.date, frequency: e.frequency, add_to_dashboard: e.add_to_dashboard, is_active: e.is_active }))
    );

    // Expand all events into occurrences for the requested month
    const allOccurrences: Array<{
      id: string;
      title: string;
      description?: string;
      type: string;
      scheduled_date: string;
      priority?: string;
      status: string;
      metadata: any;
      tools?: { id: string; name: string };
    }> = [];

    for (const event of events) {
      const occurrences = expandEventToOccurrences(event, year, month);
      console.log(`Event "${event.title}" (${event.date}, ${event.frequency}) expanded to ${occurrences.length} occurrences for ${monthParam}`);
      
      for (const occurrence of occurrences) {
        allOccurrences.push({
          id: `${event.id}-${occurrence.scheduled_date}`, // Unique ID for this occurrence
          title: occurrence.title,
          description: occurrence.description,
          type: 'calendar_event',
          scheduled_date: occurrence.scheduled_date,
          priority: undefined, // Calendar events don't have priority
          status: 'pending',
          metadata: {
            ...occurrence.metadata,
            categoryName: event.tools_ce_categories?.name,
            categoryColor: event.tools_ce_categories?.card_color,
          },
          tools: event.tool_id ? { id: event.tool_id, name: 'Calendar Events' } : undefined,
        });
      }
    }

    // Sort by scheduled_date
    allOccurrences.sort((a, b) => 
      new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
    );

    console.log(`Expanded ${events.length} calendar events into ${allOccurrences.length} occurrences for ${monthParam}`);
    
    return NextResponse.json({ items: allOccurrences });
  } catch (error) {
    console.error('Error in calendar events API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
