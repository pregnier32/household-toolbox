import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';

type DbTrip = {
  id: string;
  trip_name: string;
  destination: string;
  start_date: string;
  end_date: string;
  trip_rating: number;
  trip_type: string | null;
  trip_goal: string | null;
  trip_goal_other: string;
  transportation_methods: string[];
  departure_location: string;
  primary_destination: string;
  travel_companions: string;
  planned_budget: number | string | null;
  total_trip_cost: number | string | null;
  budget_notes: string;
  best_memory: string;
  biggest_surprise: string;
  highlight_of_trip: string;
  would_return: string | null;
  would_recommend: string | null;
  include_in_travel_counts: boolean | null;
  created_at: string;
};

type DbLodging = {
  id: string;
  trip_id: string;
  name: string;
  lodging_type: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
  notes: string;
  rating: number;
};

type DbJournalNote = {
  id: string;
  trip_id: string;
  name: string;
  note_date: string;
  note_text: string;
};

type LodgingInput = {
  id?: string;
  name: string;
  type?: string;
  checkInDate?: string;
  checkOutDate?: string;
  notes?: string;
  rating?: number;
};

type JournalInput = {
  id?: string;
  name: string;
  noteDate: string;
  text: string;
};

type TripInput = {
  tripName: string;
  destination?: string;
  startDate: string;
  endDate: string;
  tripRating?: number;
  tripType?: string;
  tripGoal?: string;
  tripGoalOther?: string;
  transportationMethods?: string[];
  departureLocation?: string;
  primaryDestination?: string;
  travelCompanions?: string;
  lodging?: LodgingInput[];
  plannedBudget?: string;
  totalTripCost?: string;
  budgetNotes?: string;
  journalNotes?: JournalInput[];
  bestMemory?: string;
  biggestSurprise?: string;
  highlightOfTrip?: string;
  wouldReturn?: string;
  wouldRecommend?: string;
  includeInTravelCounts?: string;
};

function parseCurrencyToNumber(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const numeric = value.replace(/[^0-9.]/g, '');
  if (!numeric) return null;
  const num = parseFloat(numeric);
  return Number.isNaN(num) ? null : num;
}

function formatNumericAsCurrencyDisplay(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(num)) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function emptyToNull(value: string | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : trimmed;
}

function includeCountsToBoolean(value: string | undefined): boolean | null {
  if (value === 'Yes') return true;
  if (value === 'No') return false;
  return null;
}

function booleanToIncludeCounts(value: boolean | null): 'Yes' | 'No' | '' {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return '';
}

function buildTripRow(userId: string, toolId: string, trip: TripInput) {
  return {
    user_id: userId,
    tool_id: toolId,
    trip_name: trip.tripName.trim(),
    destination: (trip.destination ?? '').trim(),
    start_date: trip.startDate,
    end_date: trip.endDate,
    trip_rating: trip.tripRating ?? 0,
    trip_type: emptyToNull(trip.tripType),
    trip_goal: emptyToNull(trip.tripGoal),
    trip_goal_other: trip.tripGoal === 'Other' ? (trip.tripGoalOther ?? '').trim() : '',
    transportation_methods: trip.transportationMethods ?? [],
    departure_location: (trip.departureLocation ?? '').trim(),
    primary_destination: (trip.primaryDestination ?? '').trim(),
    travel_companions: (trip.travelCompanions ?? '').trim(),
    planned_budget: parseCurrencyToNumber(trip.plannedBudget),
    total_trip_cost: parseCurrencyToNumber(trip.totalTripCost),
    budget_notes: (trip.budgetNotes ?? '').trim(),
    best_memory: (trip.bestMemory ?? '').trim(),
    biggest_surprise: (trip.biggestSurprise ?? '').trim(),
    highlight_of_trip: (trip.highlightOfTrip ?? '').trim(),
    would_return: emptyToNull(trip.wouldReturn),
    would_recommend: emptyToNull(trip.wouldRecommend),
    include_in_travel_counts: includeCountsToBoolean(trip.includeInTravelCounts),
  };
}

function buildLodgingInsertRows(tripId: string, lodging: LodgingInput[]) {
  return lodging.map((row) => ({
    trip_id: tripId,
    name: row.name.trim(),
    lodging_type: emptyToNull(row.type),
    check_in_date: row.checkInDate?.trim() ? row.checkInDate.trim() : null,
    check_out_date: row.checkOutDate?.trim() ? row.checkOutDate.trim() : null,
    notes: (row.notes ?? '').trim(),
    rating: row.rating ?? 0,
  }));
}

function buildJournalInsertRows(tripId: string, notes: JournalInput[]) {
  return notes.map((row) => ({
    trip_id: tripId,
    name: row.name.trim(),
    note_date: row.noteDate,
    note_text: row.text.trim(),
  }));
}

function mapTripToUi(
  trip: DbTrip,
  lodging: DbLodging[],
  journalNotes: DbJournalNote[]
) {
  return {
    id: trip.id,
    tripName: trip.trip_name,
    destination: trip.destination,
    startDate: trip.start_date,
    endDate: trip.end_date,
    tripRating: trip.trip_rating,
    tripType: trip.trip_type ?? '',
    tripGoal: trip.trip_goal ?? '',
    tripGoalOther: trip.trip_goal_other,
    transportationMethods: trip.transportation_methods ?? [],
    departureLocation: trip.departure_location,
    primaryDestination: trip.primary_destination,
    travelCompanions: trip.travel_companions,
    lodging: lodging
      .filter((l) => l.trip_id === trip.id)
      .map((l) => ({
        id: l.id,
        name: l.name,
        type: l.lodging_type ?? '',
        checkInDate: l.check_in_date ?? '',
        checkOutDate: l.check_out_date ?? '',
        notes: l.notes,
        rating: l.rating,
      })),
    plannedBudget: formatNumericAsCurrencyDisplay(trip.planned_budget),
    totalTripCost: formatNumericAsCurrencyDisplay(trip.total_trip_cost),
    budgetNotes: trip.budget_notes,
    journalNotes: journalNotes
      .filter((n) => n.trip_id === trip.id)
      .map((n) => ({
        id: n.id,
        name: n.name,
        noteDate: n.note_date,
        text: n.note_text,
      })),
    bestMemory: trip.best_memory,
    biggestSurprise: trip.biggest_surprise,
    highlightOfTrip: trip.highlight_of_trip,
    wouldReturn: trip.would_return ?? '',
    wouldRecommend: trip.would_recommend ?? '',
    includeInTravelCounts: booleanToIncludeCounts(trip.include_in_travel_counts),
    dateAdded: trip.created_at,
  };
}

async function replaceLodging(tripId: string, lodging: LodgingInput[]) {
  const { error: deleteError } = await supabaseServer
    .from('tools_tl_lodging')
    .delete()
    .eq('trip_id', tripId);

  if (deleteError) {
    throw deleteError;
  }

  if (lodging.length === 0) return;

  const { error: insertError } = await supabaseServer
    .from('tools_tl_lodging')
    .insert(buildLodgingInsertRows(tripId, lodging));

  if (insertError) {
    throw insertError;
  }
}

async function replaceJournalNotes(tripId: string, notes: JournalInput[]) {
  const { error: deleteError } = await supabaseServer
    .from('tools_tl_journal_notes')
    .delete()
    .eq('trip_id', tripId);

  if (deleteError) {
    throw deleteError;
  }

  if (notes.length === 0) return;

  const { error: insertError } = await supabaseServer
    .from('tools_tl_journal_notes')
    .insert(buildJournalInsertRows(tripId, notes));

  if (insertError) {
    throw insertError;
  }
}

export async function GET(request: NextRequest) {
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const toolId = searchParams.get('toolId');

    if (!toolId) {
      return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });
    }

    const { data: trips, error: tripsError } = await supabaseServer
      .from('tools_tl_trips')
      .select('*')
      .eq('user_id', user.id)
      .eq('tool_id', toolId)
      .order('start_date', { ascending: false });

    if (tripsError) {
      console.error('Error fetching travel log trips:', tripsError);
      return NextResponse.json({ error: 'Failed to fetch trips' }, { status: 500 });
    }

    const tripIds = (trips ?? []).map((t) => t.id);
    let lodging: DbLodging[] = [];
    let journalNotes: DbJournalNote[] = [];

    if (tripIds.length > 0) {
      const [lodgingRes, journalRes] = await Promise.all([
        supabaseServer.from('tools_tl_lodging').select('*').in('trip_id', tripIds),
        supabaseServer.from('tools_tl_journal_notes').select('*').in('trip_id', tripIds),
      ]);

      if (lodgingRes.error) {
        console.error('Error fetching lodging:', lodgingRes.error);
        return NextResponse.json({ error: 'Failed to fetch lodging' }, { status: 500 });
      }

      if (journalRes.error) {
        console.error('Error fetching journal notes:', journalRes.error);
        return NextResponse.json({ error: 'Failed to fetch journal notes' }, { status: 500 });
      }

      lodging = (lodgingRes.data ?? []) as DbLodging[];
      journalNotes = (journalRes.data ?? []) as DbJournalNote[];
    }

    const mappedTrips = (trips ?? []).map((trip) =>
      mapTripToUi(trip as DbTrip, lodging, journalNotes)
    );

    return NextResponse.json({ trips: mappedTrips });
  } catch (error: unknown) {
    console.error('Error in GET /api/tools/travel-log:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { toolId, tripId, action, trip } = body as {
      toolId?: string;
      tripId?: string;
      action?: 'create' | 'update' | 'delete';
      trip?: TripInput;
    };

    if (!toolId) {
      return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });
    }

    if (action === 'delete') {
      if (!tripId) {
        return NextResponse.json({ error: 'Trip ID is required' }, { status: 400 });
      }

      const { error } = await supabaseServer
        .from('tools_tl_trips')
        .delete()
        .eq('id', tripId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);

      if (error) {
        console.error('Error deleting trip:', error);
        return NextResponse.json({ error: 'Failed to delete trip' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (!trip?.tripName?.trim()) {
      return NextResponse.json({ error: 'Trip name is required' }, { status: 400 });
    }

    if (!trip.startDate || !trip.endDate) {
      return NextResponse.json({ error: 'Start and end dates are required' }, { status: 400 });
    }

    if (action === 'create') {
      const tripRow = buildTripRow(user.id, toolId, trip);

      const { data: created, error: createError } = await supabaseServer
        .from('tools_tl_trips')
        .insert(tripRow)
        .select('*')
        .single();

      if (createError || !created) {
        console.error('Error creating trip:', createError);
        return NextResponse.json({ error: 'Failed to create trip' }, { status: 500 });
      }

      try {
        await replaceLodging(created.id, trip.lodging ?? []);
        await replaceJournalNotes(created.id, trip.journalNotes ?? []);
      } catch (childError) {
        console.error('Error saving trip children:', childError);
        await supabaseServer.from('tools_tl_trips').delete().eq('id', created.id);
        return NextResponse.json({ error: 'Failed to save trip details' }, { status: 500 });
      }

      const { data: lodgingRows } = await supabaseServer
        .from('tools_tl_lodging')
        .select('*')
        .eq('trip_id', created.id);
      const { data: journalRows } = await supabaseServer
        .from('tools_tl_journal_notes')
        .select('*')
        .eq('trip_id', created.id);

      return NextResponse.json({
        success: true,
        trip: mapTripToUi(
          created as DbTrip,
          (lodgingRows ?? []) as DbLodging[],
          (journalRows ?? []) as DbJournalNote[]
        ),
      });
    }

    if (action === 'update') {
      if (!tripId) {
        return NextResponse.json({ error: 'Trip ID is required' }, { status: 400 });
      }

      const tripRow = buildTripRow(user.id, toolId, trip);

      const { data: updated, error: updateError } = await supabaseServer
        .from('tools_tl_trips')
        .update(tripRow)
        .eq('id', tripId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId)
        .select('*')
        .single();

      if (updateError || !updated) {
        console.error('Error updating trip:', updateError);
        return NextResponse.json({ error: 'Failed to update trip' }, { status: 500 });
      }

      try {
        await replaceLodging(tripId, trip.lodging ?? []);
        await replaceJournalNotes(tripId, trip.journalNotes ?? []);
      } catch (childError) {
        console.error('Error updating trip children:', childError);
        return NextResponse.json({ error: 'Failed to save trip details' }, { status: 500 });
      }

      const { data: lodgingRows } = await supabaseServer
        .from('tools_tl_lodging')
        .select('*')
        .eq('trip_id', tripId);
      const { data: journalRows } = await supabaseServer
        .from('tools_tl_journal_notes')
        .select('*')
        .eq('trip_id', tripId);

      return NextResponse.json({
        success: true,
        trip: mapTripToUi(
          updated as DbTrip,
          (lodgingRows ?? []) as DbLodging[],
          (journalRows ?? []) as DbJournalNote[]
        ),
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: unknown) {
    console.error('Error in POST /api/tools/travel-log:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
