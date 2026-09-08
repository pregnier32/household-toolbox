/**
 * Home Maintenance Schedule — types, frequency math, and DB mapping.
 * Persists via /api/tools/home-maintenance-schedule (tools_hms_* tables).
 * Occurrences are expanded in memory for the visible date window only.
 */

export type HmsFrequencyKind =
  | 'every_x_days'
  | 'weekly'
  | 'every_x_weeks'
  | 'monthly'
  | 'every_x_months'
  | 'quarterly'
  | 'every_6_months'
  | 'annually'
  | 'every_x_years'
  | 'specific_months'
  | 'custom';

export type HmsFrequency = {
  kind: HmsFrequencyKind;
  intervalCount?: number;
  intervalUnit?: 'days' | 'weeks' | 'months' | 'years';
  daysOfWeek?: number[];
  dayOfMonth?: number;
  months?: number[];
  intervalYears?: number;
};

export type HmsCategory = {
  id: string;
  name: string;
  isDefault: boolean;
};

export type HmsLibraryItem = {
  id: string;
  name: string;
  categoryId: string;
  description: string;
  notes: string;
  defaultLocation: string;
  isDefault: boolean;
  isHidden: boolean;
};

export type HmsServiceProvider = {
  name: string;
  phone: string;
  website: string;
  notes: string;
};

export type HmsScheduledTask = {
  id: string;
  libraryItemId: string;
  frequency: HmsFrequency;
  nextDueDate: string;
  lastCompletedDate: string | null;
  location: string;
  notes: string;
  descriptionOverride: string;
  serviceProvider: HmsServiceProvider;
  isActive: boolean;
  dateAdded: string;
  dateInactivated?: string;
};

export type HmsCompletion = {
  id: string;
  scheduledTaskId: string;
  scheduledDate: string;
  completedDate: string;
  notes: string;
  cost: number | null;
  lateness: 'Early' | 'On time' | 'Late';
};

export type HmsScheduleData = {
  categories: HmsCategory[];
  items: HmsLibraryItem[];
  tasks: HmsScheduledTask[];
  completions: HmsCompletion[];
};

export const HMS_FREQUENCY_KINDS: HmsFrequencyKind[] = [
  'every_x_days',
  'weekly',
  'every_x_weeks',
  'monthly',
  'every_x_months',
  'quarterly',
  'every_6_months',
  'annually',
  'every_x_years',
  'specific_months',
  'custom',
];

const FREQUENCY_KIND_SET = new Set<string>(HMS_FREQUENCY_KINDS);

export const MONTHS = [
  { value: 1, label: 'January', short: 'Jan' },
  { value: 2, label: 'February', short: 'Feb' },
  { value: 3, label: 'March', short: 'Mar' },
  { value: 4, label: 'April', short: 'Apr' },
  { value: 5, label: 'May', short: 'May' },
  { value: 6, label: 'June', short: 'Jun' },
  { value: 7, label: 'July', short: 'Jul' },
  { value: 8, label: 'August', short: 'Aug' },
  { value: 9, label: 'September', short: 'Sep' },
  { value: 10, label: 'October', short: 'Oct' },
  { value: 11, label: 'November', short: 'Nov' },
  { value: 12, label: 'December', short: 'Dec' },
];

export function emptyServiceProvider(): HmsServiceProvider {
  return { name: '', phone: '', website: '', notes: '' };
}

export function isProviderEmpty(provider: HmsServiceProvider | undefined): boolean {
  if (!provider) return true;
  return !provider.name.trim() && !provider.phone.trim() && !provider.website.trim() && !provider.notes.trim();
}

export function createHmsId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function todayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function asDateOnly(value: string | null | undefined): string {
  if (!value) return '';
  return value.split('T')[0];
}

export function parseLocalDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function toIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(iso: string, days: number): string {
  const date = parseLocalDate(iso);
  date.setDate(date.getDate() + days);
  return toIso(date);
}

export function addMonthsSetDay(iso: string, months: number, dayOfMonth?: number): string {
  const date = parseLocalDate(iso);
  const totalMonths = date.getFullYear() * 12 + date.getMonth() + months;
  const year = Math.floor(totalMonths / 12);
  const month = ((totalMonths % 12) + 12) % 12;
  const day = dayOfMonth ?? date.getDate();
  const lastDay = new Date(year, month + 1, 0).getDate();
  return toIso(new Date(year, month, Math.min(day, lastDay)));
}

export function compareIso(a: string, b: string): number {
  return a.localeCompare(b);
}

export function nextWeeklyAfter(iso: string, daysOfWeek: number[]): string {
  const selected = [...new Set(daysOfWeek)].sort((a, b) => a - b);
  if (selected.length === 0) return addDays(iso, 7);
  for (let offset = 1; offset <= 7; offset += 1) {
    const candidate = addDays(iso, offset);
    if (selected.includes(parseLocalDate(candidate).getDay())) return candidate;
  }
  return addDays(iso, 7);
}

function clampMonthDay(year: number, month1to12: number, day: number): string {
  const lastDay = new Date(year, month1to12, 0).getDate();
  return toIso(new Date(year, month1to12 - 1, Math.min(day, lastDay)));
}

export function nextSpecificMonthsAfter(
  iso: string,
  months: number[],
  intervalYears: number,
  dayOfMonth?: number
): string {
  const selected = [...new Set(months.filter((month) => month >= 1 && month <= 12))].sort((a, b) => a - b);
  if (selected.length === 0) return addMonthsSetDay(iso, 12, dayOfMonth);
  const years = Math.max(1, intervalYears);
  const date = parseLocalDate(iso);
  const day = dayOfMonth ?? date.getDate();
  const startYear = date.getFullYear();

  for (const month of selected) {
    const candidate = clampMonthDay(startYear, month, day);
    if (compareIso(candidate, iso) > 0) return candidate;
  }
  return clampMonthDay(startYear + years, selected[0], day);
}

export function advanceFrom(basisIso: string, frequency: HmsFrequency): string {
  const count = Math.max(1, frequency.intervalCount ?? 1);
  switch (frequency.kind) {
    case 'every_x_days':
      return addDays(basisIso, count);
    case 'weekly':
      return nextWeeklyAfter(basisIso, frequency.daysOfWeek ?? []);
    case 'every_x_weeks':
      return addDays(basisIso, count * 7);
    case 'monthly':
      return addMonthsSetDay(basisIso, 1, frequency.dayOfMonth);
    case 'every_x_months':
      return addMonthsSetDay(basisIso, count, frequency.dayOfMonth);
    case 'quarterly':
      return addMonthsSetDay(basisIso, 3, frequency.dayOfMonth);
    case 'every_6_months':
      return addMonthsSetDay(basisIso, 6, frequency.dayOfMonth);
    case 'annually':
      return addMonthsSetDay(basisIso, 12, frequency.dayOfMonth);
    case 'every_x_years':
      return addMonthsSetDay(basisIso, count * 12, frequency.dayOfMonth);
    case 'specific_months':
      return nextSpecificMonthsAfter(
        basisIso,
        frequency.months ?? [],
        frequency.intervalYears ?? 1,
        frequency.dayOfMonth
      );
    case 'custom':
      if (frequency.intervalUnit === 'weeks') return addDays(basisIso, count * 7);
      if (frequency.intervalUnit === 'months') return addMonthsSetDay(basisIso, count, frequency.dayOfMonth);
      if (frequency.intervalUnit === 'years') return addMonthsSetDay(basisIso, count * 12, frequency.dayOfMonth);
      return addDays(basisIso, count);
    default:
      return addDays(basisIso, 1);
  }
}

export function latenessFor(scheduledDate: string, completedDate: string): HmsCompletion['lateness'] {
  if (compareIso(completedDate, scheduledDate) < 0) return 'Early';
  if (completedDate === scheduledDate) return 'On time';
  return 'Late';
}

export function isFrequencyValid(frequency: HmsFrequency): boolean {
  if (!FREQUENCY_KIND_SET.has(frequency.kind)) return false;
  if (frequency.kind === 'weekly') return Array.isArray(frequency.daysOfWeek) && frequency.daysOfWeek.length > 0;
  if (
    frequency.kind === 'every_x_days' ||
    frequency.kind === 'every_x_weeks' ||
    frequency.kind === 'every_x_months' ||
    frequency.kind === 'every_x_years' ||
    frequency.kind === 'custom'
  ) {
    if (!Number.isInteger(frequency.intervalCount) || (frequency.intervalCount ?? 0) < 1) return false;
  }
  if (frequency.kind === 'monthly') {
    return Number.isInteger(frequency.dayOfMonth) && (frequency.dayOfMonth ?? 0) >= 1 && (frequency.dayOfMonth ?? 0) <= 31;
  }
  if (frequency.kind === 'specific_months') {
    const months = frequency.months ?? [];
    const years = frequency.intervalYears ?? 1;
    return months.length > 0 && months.every((month) => month >= 1 && month <= 12) && Number.isInteger(years) && years >= 1;
  }
  if (frequency.kind === 'custom') {
    return (
      frequency.intervalUnit === 'days' ||
      frequency.intervalUnit === 'weeks' ||
      frequency.intervalUnit === 'months' ||
      frequency.intervalUnit === 'years'
    );
  }
  return true;
}

function parseDaysOfWeek(value: unknown): number[] | undefined {
  if (!value) return undefined;
  const raw = typeof value === 'string' ? JSON.parse(value) : value;
  if (!Array.isArray(raw)) return undefined;
  const days = raw.map((day) => Number(day)).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
  return days.length ? days : undefined;
}

function parseMonths(value: unknown): number[] | undefined {
  if (!value) return undefined;
  const raw = typeof value === 'string' ? JSON.parse(value) : value;
  if (!Array.isArray(raw)) return undefined;
  const months = raw.map((month) => Number(month)).filter((month) => Number.isInteger(month) && month >= 1 && month <= 12);
  return months.length ? months : undefined;
}

export function dbToFrequency(row: {
  frequency: string;
  interval_count?: number | null;
  interval_unit?: string | null;
  days_of_week?: unknown;
  day_of_month?: number | null;
  months?: unknown;
  interval_years?: number | null;
}): HmsFrequency {
  const frequency: HmsFrequency = {
    kind: FREQUENCY_KIND_SET.has(row.frequency) ? (row.frequency as HmsFrequencyKind) : 'annually',
  };
  if (row.interval_count != null) frequency.intervalCount = row.interval_count;
  if (
    row.interval_unit === 'days' ||
    row.interval_unit === 'weeks' ||
    row.interval_unit === 'months' ||
    row.interval_unit === 'years'
  ) {
    frequency.intervalUnit = row.interval_unit;
  }
  const days = parseDaysOfWeek(row.days_of_week);
  if (days) frequency.daysOfWeek = days;
  if (row.day_of_month != null) frequency.dayOfMonth = row.day_of_month;
  const months = parseMonths(row.months);
  if (months) frequency.months = months;
  if (row.interval_years != null) frequency.intervalYears = row.interval_years;
  return frequency;
}

export function frequencyToDb(frequency: HmsFrequency) {
  const needsCount =
    frequency.kind === 'every_x_days' ||
    frequency.kind === 'every_x_weeks' ||
    frequency.kind === 'every_x_months' ||
    frequency.kind === 'every_x_years' ||
    frequency.kind === 'custom';
  const needsDay =
    frequency.kind === 'monthly' ||
    frequency.kind === 'every_x_months' ||
    frequency.kind === 'quarterly' ||
    frequency.kind === 'every_6_months' ||
    frequency.kind === 'annually' ||
    frequency.kind === 'every_x_years' ||
    frequency.kind === 'specific_months';

  return {
    frequency: frequency.kind,
    interval_count: needsCount ? Math.max(1, frequency.intervalCount ?? 1) : null,
    interval_unit: frequency.kind === 'custom' ? frequency.intervalUnit ?? 'days' : null,
    days_of_week: frequency.kind === 'weekly' ? frequency.daysOfWeek ?? [] : null,
    day_of_month: needsDay ? frequency.dayOfMonth ?? null : null,
    months: frequency.kind === 'specific_months' ? frequency.months ?? [] : null,
    interval_years: frequency.kind === 'specific_months' ? Math.max(1, frequency.intervalYears ?? 1) : null,
  };
}

export function formatCost(value: number | null | undefined): string {
  if (value == null) return '—';
  if (Number.isInteger(value)) return `$${value}`;
  return `$${value.toFixed(2)}`;
}

export function sumCosts(completions: HmsCompletion[]): number | null {
  const amounts = completions.map((row) => row.cost).filter((cost): cost is number => cost != null);
  if (amounts.length === 0) return null;
  return amounts.reduce((total, cost) => total + cost, 0);
}

export function seasonWindow(today: string): { start: string; end: string } {
  const date = parseLocalDate(today);
  const year = date.getFullYear();
  const month = date.getMonth();
  if (month === 11 || month <= 1) {
    if (month === 11) {
      return { start: `${year}-12-01`, end: toIso(new Date(year + 1, 2, 0)) };
    }
    return { start: `${year - 1}-12-01`, end: toIso(new Date(year, 2, 0)) };
  }
  if (month >= 2 && month <= 4) return { start: `${year}-03-01`, end: `${year}-05-31` };
  if (month >= 5 && month <= 7) return { start: `${year}-06-01`, end: `${year}-08-31` };
  return { start: `${year}-09-01`, end: `${year}-11-30` };
}

export function yearWindow(today: string): { start: string; end: string } {
  const year = parseLocalDate(today).getFullYear();
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

type SeedItem = {
  name: string;
  description: string;
  categorySlug: string;
};

const DEFAULT_CATEGORIES: { slug: string; name: string }[] = [
  { slug: 'appliances', name: 'Appliances' },
  { slug: 'electrical', name: 'Electrical' },
  { slug: 'exterior', name: 'Exterior' },
  { slug: 'garage', name: 'Garage' },
  { slug: 'heating-cooling', name: 'Heating & Cooling' },
  { slug: 'lawn-yard', name: 'Lawn & Yard' },
  { slug: 'other', name: 'Other' },
  { slug: 'plumbing', name: 'Plumbing' },
  { slug: 'roof-gutters', name: 'Roof & Gutters' },
  { slug: 'safety', name: 'Safety' },
  { slug: 'seasonal', name: 'Seasonal' },
  { slug: 'water-systems', name: 'Water Systems' },
];

const DEFAULT_ITEMS: SeedItem[] = [
  { categorySlug: 'heating-cooling', name: 'Replace furnace/HVAC filter', description: 'Swap the furnace or HVAC filter for a new one.' },
  { categorySlug: 'heating-cooling', name: 'Schedule furnace inspection/service', description: 'Book annual furnace inspection or service.' },
  { categorySlug: 'heating-cooling', name: 'Schedule air-conditioner inspection/service', description: 'Book seasonal AC inspection or service.' },
  { categorySlug: 'heating-cooling', name: 'Clean outdoor AC condenser', description: 'Clear debris from the outdoor condenser coils.' },
  { categorySlug: 'heating-cooling', name: 'Clean vents and registers', description: 'Vacuum and wipe supply vents and return registers.' },
  { categorySlug: 'heating-cooling', name: 'Inspect/clean air exchanger or HRV', description: 'Check and clean the HRV or air exchanger.' },
  { categorySlug: 'heating-cooling', name: 'Replace humidifier filter/pad', description: 'Install a new humidifier filter or pad.' },
  { categorySlug: 'heating-cooling', name: 'Inspect thermostat batteries', description: 'Check thermostat batteries and replace if needed.' },
  { categorySlug: 'heating-cooling', name: 'Schedule chimney inspection/cleaning', description: 'Book chimney inspection and cleaning.' },
  { categorySlug: 'plumbing', name: 'Flush water heater', description: 'Drain and flush sediment from the water heater.' },
  { categorySlug: 'plumbing', name: 'Inspect water heater', description: 'Check the water heater for leaks, rust, and settings.' },
  { categorySlug: 'plumbing', name: 'Inspect under sinks for leaks', description: 'Look under sinks for drips or moisture.' },
  { categorySlug: 'plumbing', name: 'Inspect toilets for leaks', description: 'Check toilets for running water or base leaks.' },
  { categorySlug: 'plumbing', name: 'Inspect exposed plumbing for leaks', description: 'Scan visible pipes for drips or corrosion.' },
  { categorySlug: 'plumbing', name: 'Winterize outdoor faucets', description: 'Shut off and drain outdoor faucets before freeze.' },
  { categorySlug: 'plumbing', name: 'Turn outdoor water back on', description: 'Restore outdoor water and check for leaks.' },
  { categorySlug: 'water-systems', name: 'Replace water softener salt', description: 'Refill the water softener with salt.' },
  { categorySlug: 'water-systems', name: 'Clean/inspect water softener', description: 'Clean and inspect the water softener system.' },
  { categorySlug: 'water-systems', name: 'Replace whole-house water filter', description: 'Swap the whole-house water filter cartridge.' },
  { categorySlug: 'water-systems', name: 'Replace refrigerator water filter', description: 'Install a new refrigerator water filter.' },
  { categorySlug: 'water-systems', name: 'Test sump pump', description: 'Pour water into the pit to confirm the pump runs.' },
  { categorySlug: 'water-systems', name: 'Clean sump pump pit', description: 'Remove debris from the sump pump pit.' },
  { categorySlug: 'electrical', name: 'Inspect electrical panel', description: 'Check the panel for tripped breakers and scorch marks.' },
  { categorySlug: 'electrical', name: 'Inspect outdoor outlets and covers', description: 'Check outdoor outlets and weather covers.' },
  { categorySlug: 'electrical', name: 'Test backup generator', description: 'Run the backup generator and check fuel.' },
  { categorySlug: 'appliances', name: 'Clean refrigerator coils', description: 'Vacuum dust from refrigerator condenser coils.' },
  { categorySlug: 'appliances', name: 'Clean range hood filter', description: 'Wash or replace the range hood filter.' },
  { categorySlug: 'appliances', name: 'Inspect dishwasher', description: 'Check the dishwasher for leaks and spray-arm clogs.' },
  { categorySlug: 'appliances', name: 'Inspect garbage disposal', description: 'Run and check the disposal for leaks or jams.' },
  { categorySlug: 'appliances', name: 'Clean dryer lint trap', description: 'Clean the dryer lint trap and housing.' },
  { categorySlug: 'safety', name: 'Test smoke detectors', description: 'Press the test button on each smoke detector.' },
  { categorySlug: 'safety', name: 'Test carbon monoxide detectors', description: 'Test each carbon monoxide detector.' },
  { categorySlug: 'safety', name: 'Replace smoke detector batteries', description: 'Install fresh smoke detector batteries.' },
  { categorySlug: 'safety', name: 'Replace CO detector batteries', description: 'Install fresh carbon monoxide detector batteries.' },
  { categorySlug: 'safety', name: 'Check fire extinguishers', description: 'Confirm extinguishers are charged and accessible.' },
  { categorySlug: 'safety', name: 'Test GFCI outlets', description: 'Test and reset GFCI outlets.' },
  { categorySlug: 'safety', name: 'Test sump pump backup/battery', description: 'Test the backup sump pump or battery pack.' },
  { categorySlug: 'safety', name: 'Inspect dryer vent', description: 'Check the dryer vent for lint buildup.' },
  { categorySlug: 'safety', name: 'Clean dryer exhaust duct', description: 'Clean the dryer exhaust duct to the exterior.' },
  { categorySlug: 'safety', name: 'Check emergency supplies', description: 'Review flashlights, water, and the emergency kit.' },
  { categorySlug: 'exterior', name: 'Inspect siding', description: 'Walk the house and check siding for damage.' },
  { categorySlug: 'exterior', name: 'Inspect exterior caulking', description: 'Check caulk at windows, doors, and trim.' },
  { categorySlug: 'exterior', name: 'Inspect windows and doors', description: 'Check seals, locks, and operation.' },
  { categorySlug: 'exterior', name: 'Inspect foundation for cracks', description: 'Look for new or widening foundation cracks.' },
  { categorySlug: 'exterior', name: 'Pressure wash siding', description: 'Pressure wash siding and rinse thoroughly.' },
  { categorySlug: 'exterior', name: 'Wash exterior windows', description: 'Wash exterior window glass and frames.' },
  { categorySlug: 'exterior', name: 'Inspect deck', description: 'Check deck boards, rails, and fasteners.' },
  { categorySlug: 'exterior', name: 'Clean/seal deck', description: 'Clean the deck and apply sealer if needed.' },
  { categorySlug: 'exterior', name: 'Inspect driveway', description: 'Check the driveway for cracks and settling.' },
  { categorySlug: 'exterior', name: 'Seal driveway', description: 'Clean and seal the driveway.' },
  { categorySlug: 'exterior', name: 'Inspect exterior lighting', description: 'Test outdoor lights and replace bulbs.' },
  { categorySlug: 'exterior', name: 'Touch up exterior paint', description: 'Touch up peeling or faded exterior paint.' },
  { categorySlug: 'roof-gutters', name: 'Inspect roof', description: 'Check shingles, flashing, and signs of wear.' },
  { categorySlug: 'roof-gutters', name: 'Clean gutters', description: 'Clear leaves and debris from gutters.' },
  { categorySlug: 'roof-gutters', name: 'Inspect downspouts', description: 'Confirm downspouts are clear and directed away.' },
  { categorySlug: 'garage', name: 'Inspect garage door and opener', description: 'Test the door, opener, and auto-reverse.' },
  { categorySlug: 'garage', name: 'Lubricate garage door hardware', description: 'Lubricate rollers, hinges, and tracks.' },
  { categorySlug: 'garage', name: 'Inspect garage door weather sealing', description: 'Check the bottom seal and side weatherstrip.' },
  { categorySlug: 'lawn-yard', name: 'Spring lawn fertilizer', description: 'Apply spring lawn fertilizer.' },
  { categorySlug: 'lawn-yard', name: 'Summer lawn fertilizer', description: 'Apply summer lawn fertilizer.' },
  { categorySlug: 'lawn-yard', name: 'Fall lawn fertilizer', description: 'Apply fall lawn fertilizer.' },
  { categorySlug: 'lawn-yard', name: 'Apply weed control', description: 'Treat lawn weeds as directed.' },
  { categorySlug: 'lawn-yard', name: 'Aerate lawn', description: 'Aerate compacted lawn areas.' },
  { categorySlug: 'lawn-yard', name: 'Overseed lawn', description: 'Overseed thin or bare lawn areas.' },
  { categorySlug: 'lawn-yard', name: 'Inspect sprinkler/irrigation system', description: 'Check heads, coverage, and leaks.' },
  { categorySlug: 'lawn-yard', name: 'Winterize sprinkler system', description: 'Blow out and shut down the sprinkler system.' },
  { categorySlug: 'lawn-yard', name: 'Start sprinkler system in spring', description: 'Restart and adjust the sprinkler system.' },
  { categorySlug: 'lawn-yard', name: 'Trim trees', description: 'Trim trees away from the house and walkways.' },
  { categorySlug: 'lawn-yard', name: 'Trim shrubs', description: 'Shape and trim shrubs.' },
  { categorySlug: 'lawn-yard', name: 'Inspect trees for dead/damaged branches', description: 'Look for dead or hanging branches.' },
  { categorySlug: 'lawn-yard', name: 'Clean landscaping beds', description: 'Weed and tidy landscaping beds.' },
  { categorySlug: 'lawn-yard', name: 'Fall leaf cleanup', description: 'Rake and remove fallen leaves.' },
  { categorySlug: 'seasonal', name: 'Prepare home for winter', description: 'Walk through winter prep for pipes, heat, and drafts.' },
  { categorySlug: 'seasonal', name: 'Prepare home for spring', description: 'Walk through spring prep for exterior and systems.' },
  { categorySlug: 'seasonal', name: 'Remove/store garden hoses', description: 'Drain and store garden hoses.' },
  { categorySlug: 'seasonal', name: 'Install/remove window screens', description: 'Put up or take down window screens.' },
  { categorySlug: 'seasonal', name: 'Inspect snowblower before winter', description: 'Service the snowblower before first snow.' },
  { categorySlug: 'seasonal', name: 'Inspect lawn mower before spring', description: 'Service the mower before mowing season.' },
  { categorySlug: 'seasonal', name: 'Clean/store lawn mower', description: 'Clean and store the mower for the off-season.' },
  { categorySlug: 'seasonal', name: 'Clean/store patio furniture', description: 'Clean and store patio furniture.' },
  { categorySlug: 'seasonal', name: 'Prepare grill for winter/storage', description: 'Clean and cover or store the grill.' },
  { categorySlug: 'seasonal', name: 'Inspect weather stripping', description: 'Check door and window weather stripping.' },
  { categorySlug: 'seasonal', name: 'Check exterior drainage before spring thaw', description: 'Confirm downspouts and grading drain away.' },
  { categorySlug: 'seasonal', name: 'Inspect home after winter', description: 'Walk the house for winter damage.' },
  { categorySlug: 'other', name: 'Inspect attic', description: 'Check the attic for leaks, pests, and insulation gaps.' },
  { categorySlug: 'other', name: 'Inspect crawlspace', description: 'Check the crawlspace for moisture and pests.' },
  { categorySlug: 'other', name: 'Inspect basement for moisture', description: 'Look for damp spots, odors, or standing water.' },
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function createSeedData(): Pick<HmsScheduleData, 'categories' | 'items'> {
  const categories: HmsCategory[] = DEFAULT_CATEGORIES.map((category) => ({
    id: `hms-cat-${category.slug}`,
    name: category.name,
    isDefault: true,
  }));
  const categoryIdBySlug = new Map(categories.map((category, index) => [DEFAULT_CATEGORIES[index].slug, category.id]));
  const items: HmsLibraryItem[] = DEFAULT_ITEMS.map((item) => ({
    id: `hms-item-${slugify(item.name)}`,
    name: item.name,
    categoryId: categoryIdBySlug.get(item.categorySlug) ?? categories[0].id,
    description: item.description,
    notes: '',
    defaultLocation: '',
    isDefault: true,
    isHidden: false,
  }));
  return { categories, items };
}
