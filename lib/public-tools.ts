/**
 * Public tool marketing catalog.
 *
 * Source of truth for what a tool does: the description shown inside that tool,
 * plus behavior implemented in its component, API, and system_design.md.
 * Do not add a feature here unless it exists in the application.
 *
 * Adding a public tool later:
 * 1. Add one object to PUBLIC_TOOLS (name, slug, category, copy, SEO, indexable).
 * 2. Use the in-app tool name and only describe features that are implemented.
 * 3. Set indexable: true when the page should be crawled.
 * 4. Point relatedTools at other slugs in this list.
 * 5. The tool then appears on /tools, at /tools/[slug], and in the sitemap.
 *    Featured homepage cards use FEATURED_TOOL_SLUGS.
 *
 * Store icons live in the database and are loaded after sign-in. Public pages
 * use Lucide icons (the same icon set as the app) so they render without an account.
 */

export const PUBLIC_TOOL_CATEGORIES = [
  'Home',
  'Health & Care',
  'Money & Events',
  'Plans & Lists',
  'People & Records',
] as const;

export type PublicToolCategory = (typeof PUBLIC_TOOL_CATEGORIES)[number];

export type PublicToolFeature = {
  title: string;
  description: string;
};

export type PublicToolStep = {
  title: string;
  description: string;
};

export type PublicToolFaq = {
  question: string;
  answer: string;
};

export type PublicTool = {
  name: string;
  slug: string;
  category: PublicToolCategory;
  /** Lucide icon name used on public pages. */
  icon: string;
  shortDescription: string;
  headline: string;
  intro: string;
  leadHeading: string;
  featuresTitle: string;
  features: PublicToolFeature[];
  howItWorks: PublicToolStep[];
  useCasesTitle: string;
  useCasesIntro: string;
  useCases: string[];
  faq: PublicToolFaq[];
  relatedTools: string[];
  seoTitle: string;
  seoDescription: string;
  keywords: string[];
  indexable: boolean;
};

export const FEATURED_TOOL_SLUGS = [
  'home-maintenance-schedule',
  'cleaning-schedule',
  'important-documents',
  'hsa-tracker',
  'subscription-tracker',
  'meal-planner',
  'travel-log',
  'end-of-life-planner',
] as const;

const SIGNUP_NOTE =
  'Your first two tools have no monthly charge. Each tool after that is $2 a month.';

export const PUBLIC_SIGNUP_NOTE = SIGNUP_NOTE;

export const PUBLIC_TOOLS: PublicTool[] = [
  {
    name: 'Cleaning Schedule',
    slug: 'cleaning-schedule',
    category: 'Home',
    icon: 'SprayCan',
    shortDescription:
      'Activate household cleaning tasks, set a recurring schedule, and see what is due next.',
    headline: 'House Cleaning Schedule',
    intro:
      'Keep repeating housework on a plan instead of trying to remember it. Activate tasks from a library, choose how often they repeat, and mark them complete as you go.',
    leadHeading: 'Keep household cleaning on a schedule',
    featuresTitle: 'What you can do',
    features: [
      {
        title: 'Start from a cleaning library',
        description:
          'Activate ready-made tasks for kitchens, bathrooms, floors, laundry, and other rooms, or add your own.',
      },
      {
        title: 'Set a repeating schedule',
        description:
          'Choose daily, weekly, monthly, quarterly, annual, custom, or the first weekend of each month.',
      },
      {
        title: 'See what is due next',
        description: 'Filter the schedule by overdue, this week, this month, the next three months, or all active tasks.',
      },
      {
        title: 'Set a reminder before the due date',
        description: 'Store a reminder of how many days before a task is due. This is kept on the task in the app.',
      },
      {
        title: 'Record completions',
        description: 'Mark an occurrence complete and keep a history, including photos saved with that completion.',
      },
      {
        title: 'Keep instructions with the task',
        description: 'Attach standing photos or instructions to the library item. They stay with the item when a schedule changes.',
      },
      {
        title: 'Organize by category',
        description: 'Group tasks into categories and hide default items you do not use.',
      },
      {
        title: 'Pin dates and export a PDF',
        description: 'Add a cleaning date to the household calendar, and export a PDF of the schedule you choose.',
      },
    ],
    howItWorks: [
      {
        title: 'Choose the cleaning tasks',
        description: 'Activate items from the library or add a custom task and category.',
      },
      {
        title: 'Set how often each one repeats',
        description: 'Pick a frequency and the next time it should be done.',
      },
      {
        title: 'Complete tasks as they come due',
        description: 'Check the schedule, mark work finished, and keep that history.',
      },
    ],
    useCasesTitle: 'Cleaning that is easy to forget',
    useCasesIntro: 'A cleaning schedule is useful for repeating work that does not belong on a one-time to-do list.',
    useCases: [
      'Bathrooms, kitchens, and floors',
      'Changing bed sheets',
      'Appliance wipe-downs such as the oven, microwave, or refrigerator',
      'Laundry and living areas',
      'Windows, baseboards, and entryways',
      'Outdoor or garage cleaning',
    ],
    faq: [
      {
        question: 'Can I create a recurring cleaning schedule?',
        answer:
          'Yes. Each activated task has a frequency, including every day, weekly, monthly, quarterly, annually, a custom interval, or the first weekend of each month.',
      },
      {
        question: 'Does Cleaning Schedule include suggested tasks?',
        answer:
          'Yes. The library includes predefined cleaning items by room and appliance. You can activate the ones you want, hide the rest, and add your own.',
      },
      {
        question: 'Can I see which cleaning is overdue?',
        answer: 'Yes. The schedule can be filtered to overdue tasks, this week, this month, the next three months, or all active tasks.',
      },
      {
        question: 'Can I keep photos with a cleaning task?',
        answer:
          'Yes. Standing photos or instructions stay on the library item. A completion can also keep photos as proof of that one occurrence.',
      },
      {
        question: 'Can I export my cleaning schedule?',
        answer: 'Yes. You can export a PDF of the cleaning schedule. Attachment file names are listed at the end of the report.',
      },
    ],
    relatedTools: ['home-maintenance-schedule', 'to-do-list', 'calendar-events', 'shopping-list'],
    seoTitle: 'House Cleaning Schedule | Household Toolbox',
    seoDescription:
      'Build a house cleaning schedule from ready-made or custom tasks, set how often each one repeats, and keep a record of what you finished.',
    keywords: ['cleaning schedule app', 'house cleaning schedule', 'recurring cleaning checklist'],
    indexable: true,
  },
  {
    name: 'Home Maintenance Schedule',
    slug: 'home-maintenance-schedule',
    category: 'Home',
    icon: 'Wrench',
    shortDescription:
      'Activate home, exterior, garage, and yard maintenance, set a recurring schedule, and see what is due next.',
    headline: 'Home Maintenance Schedule & Tracker',
    intro:
      'Keep filters, inspections, appliance care, seasonal jobs, and other repeating home maintenance on a schedule, and keep a history of the work you finish.',
    leadHeading: 'Keep home maintenance on schedule',
    featuresTitle: 'What you can track',
    features: [
      {
        title: 'Build a maintenance schedule',
        description: 'Activate tasks and see what is overdue, due this week, this month, this season, or later in the year.',
      },
      {
        title: 'Use predefined maintenance items',
        description:
          'Start from a library that includes heating and cooling, plumbing, electrical, roof and gutters, safety, appliances, and yard work.',
      },
      {
        title: 'Add custom maintenance tasks',
        description: 'Add your own items and categories when the library does not cover something in your home.',
      },
      {
        title: 'Schedule recurring maintenance',
        description:
          'Set weekly, monthly, quarterly, twice-yearly, annual, every-few-years, or specific-month schedules.',
      },
      {
        title: 'Track seasonal work',
        description: 'Use the This Season view and specific-month schedules for work that belongs to part of the year.',
      },
      {
        title: 'Set a reminder before the due date',
        description: 'Save how many days before a task is due you want to be reminded. The reminder is stored on the task.',
      },
      {
        title: 'Record a service provider',
        description: 'Keep a provider name, phone, website, and notes on the scheduled task.',
      },
      {
        title: 'Store manuals, invoices, and photos',
        description: 'Attach standing files to the maintenance item, and attach dated proof when you complete an occurrence.',
      },
      {
        title: 'Keep a completion history',
        description: 'Mark work complete and review completed occurrences later, including files saved with that completion.',
      },
      {
        title: 'Add dates to the household calendar',
        description: 'Pin a maintenance date so it shows on the dashboard calendar with your other household dates.',
      },
      {
        title: 'Export maintenance records',
        description: 'Export a PDF of the maintenance records you choose. Attachment file names are listed at the end.',
      },
    ],
    howItWorks: [
      {
        title: 'Add or choose the items you want to track',
        description: 'Activate predefined maintenance items or create your own.',
      },
      {
        title: 'Set when each task should occur',
        description: 'Choose a frequency, the next due date, and a reminder if you want one.',
      },
      {
        title: 'Complete tasks and keep the history',
        description: 'Mark work done, save files from that visit, and build a record over time.',
      },
    ],
    useCasesTitle: 'Why keep a home maintenance history?',
    useCasesIntro:
      'These are the kinds of jobs the schedule is built to hold. The library already includes many of them, and you can add others.',
    useCases: [
      'Furnace and HVAC filters',
      'Furnace and air-conditioner service',
      'Water heater flushing and inspection',
      'Smoke and carbon monoxide detector checks',
      'Gutters, roof, and exterior work',
      'Appliance maintenance',
      'Lawn and yard work',
      'Seasonal jobs such as outdoor faucets',
    ],
    faq: [
      {
        question: 'What home maintenance should I track?',
        answer:
          'The library includes heating and cooling, plumbing, water systems, electrical, safety, appliances, roof and gutters, exterior, garage, lawn and yard, and seasonal items. You can also add custom tasks.',
      },
      {
        question: 'Can I create recurring maintenance tasks?',
        answer:
          'Yes. Frequencies include every so many days or weeks, weekly, monthly, quarterly, every six months, annually, every few years, specific months, and custom.',
      },
      {
        question: 'Can I track seasonal home maintenance?',
        answer:
          'Yes. You can schedule tasks for specific months and filter the schedule by this season, this year, or the next three months.',
      },
      {
        question: 'Can I save manuals and invoices?',
        answer:
          'Yes. Manuals, invoices, and photos can be attached to the maintenance item. Files saved when you complete a task stay with that completion.',
      },
      {
        question: 'Can I keep a maintenance history?',
        answer: 'Yes. Completed occurrences stay in the history, including the date and any files you attached when you marked the task complete.',
      },
      {
        question: 'Can I export my maintenance records?',
        answer: 'Yes. Export a PDF of the records you choose. Attachment file names are listed at the end of the report.',
      },
    ],
    relatedTools: ['repair-history', 'important-documents', 'calendar-events', 'to-do-list'],
    seoTitle: 'Home Maintenance Schedule & Tracker | Household Toolbox',
    seoDescription:
      'Keep furnace filters, seasonal jobs, and other home maintenance on a schedule, with a history of completed work and files on each item.',
    keywords: ['home maintenance schedule', 'home maintenance tracker', 'seasonal home maintenance checklist'],
    indexable: true,
  },
  {
    name: 'Repair History',
    slug: 'repair-history',
    category: 'Home',
    icon: 'Hammer',
    shortDescription: 'Track repairs and replacements for your home and vehicles.',
    headline: 'Home Repair History',
    intro:
      'When something is fixed or replaced, write down the job, the cost, the warranty, and the files that go with it. Repair History keeps home and vehicle repairs in one log.',
    leadHeading: 'Keep a record of repairs and replacements',
    featuresTitle: 'What you can record',
    features: [
      {
        title: 'Log home and vehicle repairs',
        description: 'Use Home and Auto categories, with predefined items and items you add yourself.',
      },
      {
        title: 'Record cost and warranty',
        description: 'Save what the repair cost and the warranty end date, when you have one.',
      },
      {
        title: 'Note insurance details',
        description: 'Record whether a repair was submitted to insurance, the carrier, and the amount insurance paid.',
      },
      {
        title: 'Attach receipts, warranties, and photos',
        description: 'Keep those files on the repair record instead of in a separate folder.',
      },
      {
        title: 'Save a manual link',
        description: 'Home items can keep a link to the manual.',
      },
      {
        title: 'Pin a warranty date',
        description: 'When a repair has a warranty end date, you can add that date to the household calendar.',
      },
      {
        title: 'Export the repair log',
        description: 'Export a PDF of the repair records you choose.',
      },
    ],
    howItWorks: [
      {
        title: 'Choose the item that was repaired',
        description: 'Pick a home or vehicle item, or add one that is not in the list.',
      },
      {
        title: 'Write down the job',
        description: 'Add the details, cost, warranty date, and any insurance notes.',
      },
      {
        title: 'Keep the paperwork with the repair',
        description: 'Attach receipts, warranty files, or photos so they stay on that record.',
      },
    ],
    useCasesTitle: 'Repairs worth writing down',
    useCasesIntro: 'A repair log helps when a warranty question, an insurance claim, or the next owner asks what was done.',
    useCases: [
      'Appliance repair and replacement',
      'Plumbing and electrical work',
      'Roof, window, and exterior repairs',
      'Vehicle maintenance and repairs',
      'Warranty end dates',
      'Insurance claims on a repair',
    ],
    faq: [
      {
        question: 'Can I track both home and vehicle repairs?',
        answer: 'Yes. Repair History uses Home and Auto categories, and each category has its own items.',
      },
      {
        question: 'Can I save receipts and warranty documents?',
        answer: 'Yes. Receipts, warranties, and photos are attached to the repair record.',
      },
      {
        question: 'Can I record what a repair cost?',
        answer: 'Yes. Each repair can store a cost, a warranty end date, and insurance details such as the carrier and the amount paid.',
      },
      {
        question: 'Can I put a warranty date on the calendar?',
        answer: 'Yes. A repair with a warranty end date can be added to the household dashboard calendar.',
      },
      {
        question: 'Can I export my repair history?',
        answer: 'Yes. You can export a PDF of the repair records you choose.',
      },
    ],
    relatedTools: ['home-maintenance-schedule', 'important-documents', 'calendar-events'],
    seoTitle: 'Home Repair History | Household Toolbox',
    seoDescription:
      'Keep a repair log for the house and vehicles, including cost, warranty dates, insurance notes, and the receipts or photos for each job.',
    keywords: ['home repair history', 'home maintenance records', 'track home repairs'],
    indexable: true,
  },
  {
    name: 'Healthcare Appts & History',
    slug: 'healthcare-appts-history',
    category: 'Health & Care',
    icon: 'Stethoscope',
    shortDescription: 'Track upcoming appointments and healthcare history for each family member.',
    headline: 'Healthcare Appointments & History',
    intro:
      'Keep visits by family member, with upcoming appointments separate from past ones. Bills, referrals, and visit notes can stay on the appointment they belong to.',
    leadHeading: 'Keep family healthcare visits in one place',
    featuresTitle: 'What you can track',
    features: [
      {
        title: 'Separate each family member',
        description: 'Add a person and keep that person’s appointments on their own list.',
      },
      {
        title: 'Track upcoming visits and history',
        description: 'The same record can sit in Upcoming or History, so a visit does not disappear after the date passes.',
      },
      {
        title: 'Save provider details',
        description: 'Keep provider information on the appointment.',
      },
      {
        title: 'Attach bills and visit files',
        description: 'Add bills, explanations of benefits, referrals, and visit photos to the appointment.',
      },
      {
        title: 'Add a visit to the calendar',
        description: 'Pin an appointment date to the household dashboard calendar.',
      },
      {
        title: 'Create an HSA expense from a visit',
        description:
          'Add to HSA creates an expense in HSA Tracker. Files stay on the appointment and are not copied to the expense.',
      },
      {
        title: 'Export the appointment list',
        description: 'Export a PDF of the healthcare appointments you choose.',
      },
    ],
    howItWorks: [
      {
        title: 'Add each family member',
        description: 'Create a card for the person whose visits you want to track.',
      },
      {
        title: 'Add the appointment',
        description: 'Record an upcoming visit or a past one, with the provider and any files.',
      },
      {
        title: 'Keep the history as visits pass',
        description: 'Move a visit to history when it is over, and leave the files on that record.',
      },
    ],
    useCasesTitle: 'Visits households usually need to remember',
    useCasesIntro: 'Use one list per person so checkups, follow-ups, and paperwork do not get mixed together.',
    useCases: [
      'Annual checkups',
      'Dental and vision visits',
      'Specialist follow-ups',
      'Kids’ appointments',
      'Bills and explanations of benefits',
      'Referrals and visit photos',
    ],
    faq: [
      {
        question: 'Can I track appointments for more than one person?',
        answer: 'Yes. Each family member has their own list of upcoming appointments and history.',
      },
      {
        question: 'Can I keep past visits, not only upcoming ones?',
        answer: 'Yes. An appointment can be upcoming or history, and the files stay on that record either way.',
      },
      {
        question: 'Can I save bills with the visit?',
        answer: 'Yes. You can attach bills, explanations of benefits, referrals, and photos to the appointment.',
      },
      {
        question: 'Can a visit be added to my HSA records?',
        answer:
          'Yes. Add to HSA creates an HSA expense from the visit. The appointment files stay on the appointment and are not copied over.',
      },
      {
        question: 'Can I export healthcare appointments?',
        answer: 'Yes. You can export a PDF of the appointments you choose.',
      },
    ],
    relatedTools: ['hsa-tracker', 'important-documents', 'calendar-events', 'pet-care-schedule'],
    seoTitle: 'Healthcare Appointments & History | Household Toolbox',
    seoDescription:
      'Track upcoming appointments and past healthcare visits for each family member, and keep bills or visit files on the appointment.',
    keywords: ['healthcare appointment tracker', 'family medical appointment history'],
    indexable: true,
  },
  {
    name: 'Pet Care Schedule',
    slug: 'pet-care-schedule',
    category: 'Health & Care',
    icon: 'PawPrint',
    shortDescription: 'Manage pet care from basic information through veterinary records, food, shots, and documents.',
    headline: 'Pet Care Schedule',
    intro:
      'Keep food, shots, veterinary visits, appointments, and documents together for each pet, instead of spreading them across notes and folders.',
    leadHeading: 'Keep each pet’s care in one schedule',
    featuresTitle: 'What you can track',
    features: [
      {
        title: 'One record per pet',
        description: 'Add each pet and keep that pet’s info, photo, and files on the pet card.',
      },
      {
        title: 'Food and care plans',
        description: 'Record food and care-plan items for the pet.',
      },
      {
        title: 'Veterinary contacts',
        description: 'Save veterinary records and move older ones to history when you are done with them.',
      },
      {
        title: 'Vaccinations and appointments',
        description: 'Track shots and appointments, with files on those rows.',
      },
      {
        title: 'Pet documents and notes',
        description: 'Keep named documents and notes with the pet they belong to.',
      },
      {
        title: 'Pin dated care to the calendar',
        description: 'Add dated pet care to the household dashboard calendar.',
      },
      {
        title: 'Export pet care records',
        description: 'Export a PDF of the pet care records you choose.',
      },
    ],
    howItWorks: [
      {
        title: 'Add the pet',
        description: 'Create a pet card and add the basic information and photo.',
      },
      {
        title: 'Fill in the care you want to remember',
        description: 'Add food, veterinary contacts, vaccinations, appointments, documents, and notes.',
      },
      {
        title: 'Update it as care happens',
        description: 'Edit records, move older veterinary items to history, and keep the files with the pet.',
      },
    ],
    useCasesTitle: 'Pet details that are easy to lose',
    useCasesIntro: 'Pet Care Schedule is for the ongoing record, not a one-time reminder.',
    useCases: [
      'Food and feeding notes',
      'Vaccination history',
      'Vet appointments',
      'Veterinary contact information',
      'Adoption, license, or medical documents',
      'Care instructions for a pet sitter',
    ],
    faq: [
      {
        question: 'Can I track more than one pet?',
        answer: 'Yes. Each pet has its own card, and food, veterinary records, shots, appointments, documents, and notes stay with that pet.',
      },
      {
        question: 'Can I store vaccination records?',
        answer: 'Yes. Vaccinations are their own list, and you can attach files to a vaccination row.',
      },
      {
        question: 'Can I save vet documents and a pet photo?',
        answer: 'Yes. Pet photos and other pet files stay on the pet. Named documents, veterinary rows, vaccinations, and appointments can have their own files.',
      },
      {
        question: 'Can pet appointments go on the household calendar?',
        answer: 'Yes. Dated pet care can be added to the dashboard calendar.',
      },
      {
        question: 'Can I export pet care records?',
        answer: 'Yes. You can export a PDF of the pet care records you choose.',
      },
    ],
    relatedTools: ['healthcare-appts-history', 'calendar-events', 'important-documents'],
    seoTitle: 'Pet Care Schedule | Household Toolbox',
    seoDescription:
      'Keep food, shots, veterinary visits, appointments, and documents for each pet in one schedule, and pin dated care to your calendar.',
    keywords: ['pet care schedule', 'pet vaccination tracker', 'pet care records'],
    indexable: true,
  },
  {
    name: 'HSA Tracker',
    slug: 'hsa-tracker',
    category: 'Health & Care',
    icon: 'Receipt',
    shortDescription: 'Track HSA deposits and expenses across accounts, including receipts and reimbursements.',
    headline: 'HSA Expense & Receipt Tracker',
    intro:
      'Follow health savings account deposits, expenses, receipts, and reimbursements by account, so you can see what went in, what came out, and which expenses still need a receipt.',
    leadHeading: 'Keep HSA money and receipts together',
    featuresTitle: 'What you can track',
    features: [
      {
        title: 'Track more than one HSA account',
        description: 'Keep deposits and expenses under the account they belong to.',
      },
      {
        title: 'Record deposits',
        description: 'Log money added to the account.',
      },
      {
        title: 'Record expenses',
        description: 'Log what was spent, then mark whether it has been reimbursed and the reimbursement date.',
      },
      {
        title: 'Attach receipts',
        description: 'Save receipts or explanations of benefits on the expense. A warning shows when a receipt is still needed.',
      },
      {
        title: 'Review a summary',
        description: 'Use the summary to see deposits and expenses for the account you are viewing.',
      },
      {
        title: 'Export HSA records',
        description: 'Export a PDF of the HSA records you choose.',
      },
    ],
    howItWorks: [
      {
        title: 'Add the HSA account',
        description: 'Create an account so deposits and expenses have a place to live.',
      },
      {
        title: 'Log deposits and expenses',
        description: 'Enter money in and money out, and attach a receipt when you have one.',
      },
      {
        title: 'Mark reimbursements',
        description: 'Note whether an expense has been reimbursed, and keep the receipt on that expense.',
      },
    ],
    useCasesTitle: 'Why track HSA expenses',
    useCasesIntro: 'HSA Tracker is a household record of the account. It does not file taxes or submit claims for you.',
    useCases: [
      'Doctor, dental, and vision expenses',
      'Receipts you may need later',
      'Expenses waiting on reimbursement',
      'Deposits into the account',
      'More than one HSA account',
      'A PDF copy of the records',
    ],
    faq: [
      {
        question: 'Can I track HSA receipts?',
        answer:
          'Yes. Each expense can have receipt or explanation-of-benefits files. If you flag that a receipt is still needed and none is attached, the expense shows a reminder.',
      },
      {
        question: 'Can I track reimbursements?',
        answer: 'Yes. An expense can be marked reimbursed or not, with a reimbursement date.',
      },
      {
        question: 'Can I track deposits as well as spending?',
        answer: 'Yes. Deposits and expenses are separate lists under each account, and the summary shows both.',
      },
      {
        question: 'Can I track more than one HSA?',
        answer: 'Yes. You can add more than one account and switch between them.',
      },
      {
        question: 'Does this file my taxes or pay a claim?',
        answer:
          'No. HSA Tracker stores the deposits, expenses, receipts, and reimbursement notes you enter. It does not file taxes or submit insurance claims.',
      },
    ],
    relatedTools: ['healthcare-appts-history', 'important-documents'],
    seoTitle: 'HSA Expense & Receipt Tracker | Household Toolbox',
    seoDescription:
      'Track HSA deposits, expenses, receipts, and reimbursements by account, including which expenses still need a receipt attached.',
    keywords: ['HSA expense tracker', 'HSA receipt tracker', 'HSA reimbursement tracker'],
    indexable: true,
  },
  {
    name: 'Subscription Tracker',
    slug: 'subscription-tracker',
    category: 'Money & Events',
    icon: 'CreditCard',
    shortDescription: 'Track and manage household subscriptions in one place.',
    headline: 'Subscription Tracker for Household Expenses',
    intro:
      'List repeating bills with the amount, how often they bill, and when they renew. Contracts and receipts can stay on the subscription they belong to.',
    leadHeading: 'See recurring household bills in one list',
    featuresTitle: 'What you can track',
    features: [
      {
        title: 'List each subscription',
        description: 'Save the name, amount, category, and notes for a recurring bill.',
      },
      {
        title: 'Record monthly, quarterly, or annual billing',
        description: 'Set the frequency and the billed date. Annual subscriptions can also store a renewal date.',
      },
      {
        title: 'See a monthly equivalent',
        description: 'Quarterly and annual amounts can be shown as a monthly equivalent so the list is easier to compare.',
      },
      {
        title: 'Attach contracts and receipts',
        description: 'Keep renewal notices, contracts, and receipts on the subscription.',
      },
      {
        title: 'Move canceled subscriptions to history',
        description: 'Inactive subscriptions stay in history and can be reactivated later. Their files stay with them.',
      },
      {
        title: 'Pin a date to the calendar',
        description: 'Add a subscription date to the household dashboard calendar.',
      },
      {
        title: 'Export the list',
        description: 'Export a PDF of the subscriptions you choose.',
      },
    ],
    howItWorks: [
      {
        title: 'Add the subscription',
        description: 'Enter the name, amount, and whether it bills monthly, quarterly, or annually.',
      },
      {
        title: 'Set the billing and renewal dates',
        description: 'Save the billed date and, for annual bills, the renewal date.',
      },
      {
        title: 'Keep or retire it',
        description: 'Leave it active, or move a canceled subscription to history without deleting the record.',
      },
    ],
    useCasesTitle: 'Bills that renew when you are not looking',
    useCasesIntro: 'Subscription Tracker is for recurring charges, not a full bank or budget.',
    useCases: [
      'Streaming and software',
      'Memberships and clubs',
      'Insurance premiums billed on a schedule',
      'Annual renewals you want a date for',
      'Contracts and receipt files',
      'A monthly view of quarterly or annual bills',
    ],
    faq: [
      {
        question: 'Can I track monthly and annual subscriptions?',
        answer: 'Yes. Each subscription can be monthly, quarterly, or annual. Annual subscriptions can store a renewal date.',
      },
      {
        question: 'Can I see what an annual bill costs per month?',
        answer: 'Yes. Quarterly and annual amounts can be shown as a monthly equivalent.',
      },
      {
        question: 'Can I save receipts or contracts?',
        answer: 'Yes. Receipts, contracts, and renewal notices can be attached to the subscription.',
      },
      {
        question: 'What happens when I cancel a subscription?',
        answer: 'You can move it to history. History can be reactivated later, and the files stay on that subscription.',
      },
      {
        question: 'Can I export my subscriptions?',
        answer: 'Yes. You can export a PDF of the subscriptions you choose.',
      },
    ],
    relatedTools: ['event-budget-planner', 'calendar-events', 'important-documents'],
    seoTitle: 'Subscription Tracker for Household Expenses | Household Toolbox',
    seoDescription:
      'Track household subscriptions, billing dates, and renewals, keep contracts or receipts on each one, and compare them as a monthly amount.',
    keywords: ['subscription tracker', 'recurring expense tracker', 'household subscription tracker'],
    indexable: true,
  },
  {
    name: 'Event Budget Planner',
    slug: 'event-budget-planner',
    category: 'Money & Events',
    icon: 'PartyPopper',
    shortDescription:
      'Organize the money side of an event by tracking planned and actual expenses in one place.',
    headline: 'Event Budget Planner',
    intro:
      'Set a budget for a party, trip, or other occasion, then record vendors and expenses so you can see what you planned to spend and what you actually spent.',
    leadHeading: 'Plan the money for an event',
    featuresTitle: 'What you can track',
    features: [
      {
        title: 'Create an event with a budget',
        description: 'Name the event, set the date and type, and enter the budget amount.',
      },
      {
        title: 'Track vendors',
        description: 'Keep a vendor list and split an expense across vendors when more than one is involved.',
      },
      {
        title: 'Record planned and actual expenses',
        description: 'Enter expenses against the event so spending stays with that occasion.',
      },
      {
        title: 'Use categories and types',
        description: 'Organize spending with categories and event types you can edit.',
      },
      {
        title: 'Attach invitations, contracts, and receipts',
        description: 'Event files stay on the event. Receipts and invoices stay on the expense.',
      },
      {
        title: 'Move past events to history',
        description: 'Inactive events stay in history. You can reactivate one when you need to edit it again.',
      },
      {
        title: 'Pin the date and export a PDF',
        description: 'Add the event date to the household calendar, and export a PDF of the budget you choose.',
      },
    ],
    howItWorks: [
      {
        title: 'Create the event',
        description: 'Add the name, date, type, and budget.',
      },
      {
        title: 'Add vendors and expenses',
        description: 'Record who you are paying and what each expense costs.',
      },
      {
        title: 'Compare the plan with the spending',
        description: 'Keep planned and actual expenses on the event, then export a PDF if you want a copy.',
      },
    ],
    useCasesTitle: 'Occasions with a lot of small costs',
    useCasesIntro: 'Use one event record so the budget, vendors, and receipts stay together.',
    useCases: [
      'Parties and celebrations',
      'Weddings and showers',
      'Holidays and hosting',
      'Vendor deposits and final payments',
      'Receipts and contracts',
      'A budget you want to look back on',
    ],
    faq: [
      {
        question: 'Can I set a budget for a party or other event?',
        answer: 'Yes. Each event has a budget amount, a date, a type, and its own expenses.',
      },
      {
        question: 'Can I track vendors?',
        answer: 'Yes. You can keep vendors and assign expenses to them, including a split across more than one vendor.',
      },
      {
        question: 'Can I save receipts and contracts?',
        answer: 'Yes. Invitations and contracts can be attached to the event. Receipts and invoices can be attached to an expense.',
      },
      {
        question: 'Can I keep events after they are over?',
        answer: 'Yes. Move an event to history when it is done. Reactivate it if you need to edit the expenses again.',
      },
      {
        question: 'Can I export an event budget?',
        answer: 'Yes. You can export a PDF of the event budget you choose.',
      },
    ],
    relatedTools: ['subscription-tracker', 'calendar-events', 'shopping-list'],
    seoTitle: 'Event Budget Planner | Household Toolbox',
    seoDescription:
      'Set a budget for a party or other event, list vendors, and record planned and actual expenses so the costs stay together.',
    keywords: ['event budget planner', 'party budget planner', 'event expense tracker'],
    indexable: true,
  },
  {
    name: 'Calendar Events',
    slug: 'calendar-events',
    category: 'Plans & Lists',
    icon: 'CalendarDays',
    shortDescription: 'Save household dates by category, including one-time and repeating events.',
    headline: 'Household Calendar Events',
    intro:
      'Keep birthdays, renewals, and other household dates in categories. Events can repeat, hold files, and be pinned to the dashboard calendar.',
    leadHeading: 'Keep household dates you do not want to miss',
    featuresTitle: 'What you can save',
    features: [
      {
        title: 'Group events into categories',
        description: 'Create categories and keep related dates together.',
      },
      {
        title: 'Set one-time or repeating dates',
        description: 'An event can be one time, weekly, monthly, or annual.',
      },
      {
        title: 'Add notes',
        description: 'Store a note on the event series.',
      },
      {
        title: 'Attach files to the event',
        description: 'Files belong to the event, including when it repeats. There is not a separate file for each occurrence.',
      },
      {
        title: 'Move old events to history',
        description: 'History is view and download only until you reactivate the event.',
      },
      {
        title: 'Pin a date to the dashboard calendar',
        description: 'Add the event so it shows with the other dates on the household calendar.',
      },
      {
        title: 'Export the list',
        description: 'Export a PDF of the calendar events you choose.',
      },
    ],
    howItWorks: [
      {
        title: 'Add a category',
        description: 'Group dates the way your household thinks about them.',
      },
      {
        title: 'Add the event and how often it repeats',
        description: 'Choose one time, weekly, monthly, or annual, and add a note or file if you need one.',
      },
      {
        title: 'Pin it or archive it',
        description: 'Show the date on the dashboard calendar, or move an event you no longer use to history.',
      },
    ],
    useCasesTitle: 'Dates that are not a full schedule',
    useCasesIntro: 'Calendar Events is for dates you want to remember. Cleaning and maintenance schedules stay in their own tools.',
    useCases: [
      'Birthdays and anniversaries',
      'School and activity dates',
      'Annual renewals',
      'Weekly recurring dates',
      'One-time appointments that are not healthcare visits',
      'Files that belong with a date',
    ],
    faq: [
      {
        question: 'Can events repeat?',
        answer: 'Yes. Frequency can be one time, weekly, monthly, or annual. Weekly events can use selected days, and monthly events can use a day of the month.',
      },
      {
        question: 'Is this the same as the dashboard calendar?',
        answer:
          'No. Calendar Events is where you save event records. You can pin a date from this tool, or from other tools, onto the dashboard calendar.',
      },
      {
        question: 'Can I attach a file to a repeating event?',
        answer: 'Yes. Files are stored on the event series, so a repeating event shares those files rather than creating a new set for each occurrence.',
      },
      {
        question: 'Can I hide an event without deleting it?',
        answer: 'Yes. Move it to history. Reactivate it later if you want to edit it again.',
      },
      {
        question: 'Can I export calendar events?',
        answer: 'Yes. You can export a PDF of the events you choose.',
      },
    ],
    relatedTools: ['to-do-list', 'home-maintenance-schedule', 'subscription-tracker', 'cleaning-schedule'],
    seoTitle: 'Household Calendar Events | Household Toolbox',
    seoDescription:
      'Save one-time, weekly, monthly, and annual household dates by category, attach files, and pin them to the dashboard calendar.',
    keywords: ['household calendar', 'recurring household events', 'family calendar events'],
    indexable: true,
  },
  {
    name: 'To Do List',
    slug: 'to-do-list',
    category: 'Plans & Lists',
    icon: 'ListChecks',
    shortDescription: 'Manage tasks by category, with a due date, priority, and status.',
    headline: 'Household To Do List',
    intro:
      'Keep open household work in categories. Each task can have a due date, a priority, and a status, and a dated task can be pinned to the calendar.',
    leadHeading: 'Keep open household tasks in one list',
    featuresTitle: 'What you can do',
    features: [
      {
        title: 'Organize tasks by category',
        description: 'Add and edit categories, then keep tasks inside the category they belong to.',
      },
      {
        title: 'Set due date, priority, and status',
        description: 'Give a task a due date, a priority, and a status such as not started.',
      },
      {
        title: 'Sort and filter the list',
        description: 'Sort by priority or due date, and filter by the statuses you want to see.',
      },
      {
        title: 'Attach files to a task',
        description: 'Keep a file on the task it belongs to.',
      },
      {
        title: 'Pin a dated task to the calendar',
        description: 'A task needs a due date before it can be added to the dashboard calendar.',
      },
      {
        title: 'Export the list',
        description: 'Export a PDF of the to-do list you choose.',
      },
    ],
    howItWorks: [
      {
        title: 'Add a category',
        description: 'Group work such as home, errands, or anything else you want to separate.',
      },
      {
        title: 'Add the task',
        description: 'Enter the task, then set a due date, priority, and status if you want them.',
      },
      {
        title: 'Work through the list',
        description: 'Update the status as you go, and export a PDF when you want a copy.',
      },
    ],
    useCasesTitle: 'Tasks that are not a repeating schedule',
    useCasesIntro: 'Use To Do List for open work. Use Cleaning Schedule or Home Maintenance Schedule when the work repeats on a plan.',
    useCases: [
      'Errands',
      'Home projects that happen once',
      'Things to do before a trip or event',
      'Tasks with a due date',
      'Higher-priority work you want at the top',
      'A list to export and share',
    ],
    faq: [
      {
        question: 'Can I organize to-dos into categories?',
        answer: 'Yes. You add categories, then add tasks inside a category.',
      },
      {
        question: 'Can a task have a due date and priority?',
        answer: 'Yes. Each task can store a due date, a priority, and a status. You can sort by priority or due date.',
      },
      {
        question: 'Can a task show up on the household calendar?',
        answer: 'Yes, once it has a due date. The calendar pin stays off until a due date is set.',
      },
      {
        question: 'Can I attach a file to a task?',
        answer: 'Yes. Files can be attached to the task.',
      },
      {
        question: 'Can I export my to-do list?',
        answer: 'Yes. You can export a PDF of the list you choose.',
      },
    ],
    relatedTools: ['goals-tracking', 'calendar-events', 'cleaning-schedule', 'home-maintenance-schedule'],
    seoTitle: 'Household To Do List | Household Toolbox',
    seoDescription:
      'Keep household to-dos in categories with a due date, priority, and status, and pin a dated task to the dashboard calendar.',
    keywords: ['household to do list', 'family task list', 'home to-do list'],
    indexable: true,
  },
  {
    name: 'Goals Tracking',
    slug: 'goals-tracking',
    category: 'Plans & Lists',
    icon: 'Target',
    shortDescription: 'Create goals by category, track progress with phases and tasks, and get reminders when updates are due.',
    headline: 'Household Goals Tracking',
    intro:
      'Break a longer aim into phases and tasks, write updates as you go, and flag a goal when it has gone too long without an update.',
    leadHeading: 'Track longer household goals',
    featuresTitle: 'What you can track',
    features: [
      {
        title: 'Create goals by category',
        description: 'Start from categories such as home, finance, health, career, and personal, or add your own.',
      },
      {
        title: 'Break a goal into phases and tasks',
        description: 'Phases and tasks show progress as tasks are completed.',
      },
      {
        title: 'Log updates',
        description: 'Add an update note and attach photos or other evidence to that update.',
      },
      {
        title: 'Set an update reminder',
        description:
          'Choose how many days can pass without an update. The goal is flagged in the app when that reminder is overdue.',
      },
      {
        title: 'Keep standing documents on the goal',
        description: 'Attach plans or other files to the goal itself, separate from update files.',
      },
      {
        title: 'Pin a goal date to the calendar',
        description: 'Add the goal to the household dashboard calendar.',
      },
      {
        title: 'Export goals',
        description: 'Export a PDF of the goals you choose.',
      },
    ],
    howItWorks: [
      {
        title: 'Add the goal',
        description: 'Name it, put it in a category, and attach any standing documents.',
      },
      {
        title: 'Add phases and tasks',
        description: 'Split the work so progress is visible as tasks are checked off.',
      },
      {
        title: 'Post updates',
        description: 'Write an update when something changes, and set a reminder if you want a nudge after quiet stretches.',
      },
    ],
    useCasesTitle: 'Goals that take more than a checklist',
    useCasesIntro: 'Goals Tracking is for work that unfolds over time. One-off tasks fit better in To Do List.',
    useCases: [
      'Home projects with several steps',
      'Savings or other financial goals',
      'Health goals you want to update',
      'Career or personal aims',
      'Plans and documents that belong with the goal',
      'A reminder when a goal has gone quiet',
    ],
    faq: [
      {
        question: 'Can I break a goal into steps?',
        answer: 'Yes. A goal can have phases and tasks. Progress is based on the tasks you mark complete.',
      },
      {
        question: 'Can I write updates as a goal moves along?',
        answer: 'Yes. Update history stores notes, and each update can have its own photos or files.',
      },
      {
        question: 'What does the reminder do?',
        answer:
          'You can set how many days may pass without an update. If that time passes, the goal is flagged in the app. This is not an email or phone notification.',
      },
      {
        question: 'Can I attach a plan or policy to the goal?',
        answer: 'Yes. Standing files stay on the goal. Files that belong to one update stay on that update.',
      },
      {
        question: 'Can I export my goals?',
        answer: 'Yes. You can export a PDF of the goals you choose.',
      },
    ],
    relatedTools: ['to-do-list', 'calendar-events', 'notes'],
    seoTitle: 'Household Goals Tracking | Household Toolbox',
    seoDescription:
      'Break longer household goals into phases and tasks, log updates with files, and flag a goal that has gone too long without an update.',
    keywords: ['household goals tracker', 'goal progress tracker', 'family goals'],
    indexable: true,
  },
  {
    name: 'Meal Planner',
    slug: 'meal-planner',
    category: 'Plans & Lists',
    icon: 'UtensilsCrossed',
    shortDescription: 'Create a weekly meal plan, manage meals and ingredients, and generate a shopping list for the week.',
    headline: 'Meal Planner & Grocery Planning Tool',
    intro:
      'Lay breakfast, lunch, and dinner onto a week, keep recipes with the meals, and turn that week into a shopping list.',
    leadHeading: 'Plan meals for the week',
    featuresTitle: 'What you can do',
    features: [
      {
        title: 'Build a weekly meal plan',
        description: 'Assign meals to days. Breakfast, lunch, and dinner are the starting meal slots.',
      },
      {
        title: 'Save meals and ingredients',
        description: 'Keep a meal library with ingredients, meal types, and a scale for the recipe.',
      },
      {
        title: 'Attach recipe photos or PDFs',
        description: 'Files stay on the meal, including meals you mark inactive.',
      },
      {
        title: 'Make a shopping list from the week',
        description: 'Review the ingredients for a plan, then save them as a list in Shopping List.',
      },
      {
        title: 'Print or export the plan',
        description: 'Print a meal plan or export a PDF of the meal planner records you choose.',
      },
    ],
    howItWorks: [
      {
        title: 'Add meals you actually cook',
        description: 'Save the meal, its type, and the ingredients it uses.',
      },
      {
        title: 'Place meals on the week',
        description: 'Assign meals to days on a weekly plan.',
      },
      {
        title: 'Turn the week into a shopping list',
        description: 'Open the grocery list for the plan and save it to Shopping List when you want a store list.',
      },
    ],
    useCasesTitle: 'Why plan meals in the same toolbox',
    useCasesIntro: 'The useful part is the handoff from the week of meals to a shopping list you can take to the store.',
    useCases: [
      'A weekly dinner plan',
      'Breakfasts and lunches you repeat',
      'Recipes with a photo or PDF',
      'Ingredient lists for the week',
      'A saved shopping list for the store',
      'A printed copy of the plan',
    ],
    faq: [
      {
        question: 'Can I plan a week of meals?',
        answer: 'Yes. A meal plan assigns meals to days. Breakfast, lunch, and dinner are included, and you can manage meal types.',
      },
      {
        question: 'Can I keep recipes with the meal?',
        answer: 'Yes. A meal can store ingredients and attached photos or PDFs.',
      },
      {
        question: 'Can Meal Planner create a shopping list?',
        answer: 'Yes. You can view the ingredients for a plan and save them as a list in the Shopping List tool.',
      },
      {
        question: 'Can I hide a meal without deleting it?',
        answer: 'Yes. Marking a meal inactive hides it from the picker. The meal and its files stay available to edit.',
      },
      {
        question: 'Can I print or export a meal plan?',
        answer: 'Yes. You can print a plan and export a PDF of the meal planner records you choose.',
      },
    ],
    relatedTools: ['shopping-list', 'calendar-events', 'notes'],
    seoTitle: 'Meal Planner & Grocery Planning Tool | Household Toolbox',
    seoDescription:
      'Plan breakfast, lunch, and dinner for the week, keep recipe photos with each meal, and save the ingredients as a shopping list.',
    keywords: ['weekly meal planner', 'meal planning tool', 'grocery list from meal plan'],
    indexable: true,
  },
  {
    name: 'Shopping List',
    slug: 'shopping-list',
    category: 'Plans & Lists',
    icon: 'ShoppingCart',
    shortDescription: 'Create shopping lists from a master list of items, and keep active lists and history.',
    headline: 'Household Shopping List',
    intro:
      'Keep a master list of what you buy, build a list for each store run, and check items off. Finished lists can stay in history.',
    leadHeading: 'Build a list for each store run',
    featuresTitle: 'What you can do',
    features: [
      {
        title: 'Keep a master list of items',
        description: 'Save items and their categories once, then reuse them on later lists.',
      },
      {
        title: 'Build a list for a trip',
        description: 'Add master items to a shopping list and set a quantity and unit on the line.',
      },
      {
        title: 'Check items off',
        description: 'Mark lines as you shop.',
      },
      {
        title: 'Keep list history',
        description: 'Move a list to history and reactivate or edit it later. Files stay on the list.',
      },
      {
        title: 'Attach receipts or a photo of a list',
        description: 'Receipts, store flyers, and photos of a handwritten list can be attached to the list.',
      },
      {
        title: 'Start from Meal Planner',
        description: 'A weekly meal plan can save its ingredients as a shopping list.',
      },
      {
        title: 'Print or export',
        description: 'Print a list or export a PDF of the shopping lists you choose.',
      },
    ],
    howItWorks: [
      {
        title: 'Add items you buy more than once',
        description: 'Put them on the master list with a category.',
      },
      {
        title: 'Create a list for this trip',
        description: 'Pick items, set quantities, and check them off at the store.',
      },
      {
        title: 'Keep the list or file it',
        description: 'Leave it active, move it to history, or export a PDF when you want a copy.',
      },
    ],
    useCasesTitle: 'Lists that should not start from scratch',
    useCasesIntro: 'The master list is the part that saves time on the next trip.',
    useCases: [
      'A weekly grocery run',
      'Separate lists for different stores',
      'Quantities and units on a line',
      'A list created from the meal plan',
      'Receipts or a photo of a paper list',
      'Older lists you may want to repeat',
    ],
    faq: [
      {
        question: 'Can I reuse items instead of retyping them?',
        answer: 'Yes. Items live on a master list. A shopping list is built by adding those items.',
      },
      {
        question: 'Can I set a quantity?',
        answer: 'Yes. A line on a list can store a quantity and a unit.',
      },
      {
        question: 'Can Meal Planner add items to a shopping list?',
        answer: 'Yes. From a meal plan you can save that week’s ingredients as a shopping list. Files are not copied onto the new list.',
      },
      {
        question: 'Can I keep old lists?',
        answer: 'Yes. Lists can be moved to history and edited or reactivated later.',
      },
      {
        question: 'Can I print or export a shopping list?',
        answer: 'Yes. You can print a list and export a PDF of the lists you choose.',
      },
    ],
    relatedTools: ['meal-planner', 'event-budget-planner', 'to-do-list'],
    seoTitle: 'Household Shopping List | Household Toolbox',
    seoDescription:
      'Build each store run from a master list of items, track quantities, check items off, and keep finished shopping lists in history.',
    keywords: ['household shopping list', 'grocery list app', 'reusable shopping list'],
    indexable: true,
  },
  {
    name: 'Address Book',
    slug: 'address-book',
    category: 'People & Records',
    icon: 'BookUser',
    shortDescription: 'Store, tag, and manage mailing addresses for your household.',
    headline: 'Household Address Book',
    intro:
      'Keep mailing addresses in one place, tag them, and export labels or a PDF when you need to send something.',
    leadHeading: 'Keep mailing addresses together',
    featuresTitle: 'What you can do',
    features: [
      {
        title: 'Store mailing addresses',
        description: 'Save the addresses your household uses and open one when you need it.',
      },
      {
        title: 'Tag addresses',
        description: 'Create tags and use them to group addresses for an export.',
      },
      {
        title: 'Attach a file to an address',
        description: 'Files stay on the address record.',
      },
      {
        title: 'Move an address to history',
        description: 'History can be restored later. Files come back with the address.',
      },
      {
        title: 'Export mailing labels',
        description: 'Export labels, including a Word document you can edit before printing.',
      },
      {
        title: 'Export a PDF',
        description: 'Export a PDF of the addresses you choose, filtered by tag if you want.',
      },
    ],
    howItWorks: [
      {
        title: 'Add the address',
        description: 'Enter the mailing details and any tags you want on it.',
      },
      {
        title: 'Tag the ones that belong together',
        description: 'Tags make it easier to export a group, such as holiday cards.',
      },
      {
        title: 'Export labels or a PDF',
        description: 'Print labels from an editable Word file, or export a PDF of the selected addresses.',
      },
    ],
    useCasesTitle: 'Addresses you look up more than once',
    useCasesIntro: 'Address Book is a mailing list, not a full contact manager for every phone number in your life.',
    useCases: [
      'Family and friends',
      'Holiday card lists',
      'Service providers you mail',
      'Tags for a specific group',
      'Mailing labels',
      'A PDF copy of selected addresses',
    ],
    faq: [
      {
        question: 'Can I organize addresses with tags?',
        answer: 'Yes. Addresses can have tags, and an export can use all tags or only the tags you select.',
      },
      {
        question: 'Can I print mailing labels?',
        answer: 'Yes. You can export mailing labels, including a Word document that can be edited before you print.',
      },
      {
        question: 'Can I export addresses to PDF?',
        answer: 'Yes. The PDF export can include the addresses you choose, and it can include history if you turn that on.',
      },
      {
        question: 'Can I hide an old address without deleting it?',
        answer: 'Yes. Move it to history and restore it later. Files on that address come back with it.',
      },
      {
        question: 'Can I attach a file to an address?',
        answer: 'Yes. Files can be attached to the address record.',
      },
    ],
    relatedTools: ['important-documents', 'notes', 'end-of-life-planner'],
    seoTitle: 'Household Address Book | Household Toolbox',
    seoDescription:
      'Store household mailing addresses, organize them with tags, and export mailing labels or a PDF when you need to send mail.',
    keywords: ['household address book', 'mailing address organizer', 'mailing labels'],
    indexable: true,
  },
  {
    name: 'Important Documents',
    slug: 'important-documents',
    category: 'People & Records',
    icon: 'FileStack',
    shortDescription: 'Upload, tag, and manage important household documents.',
    headline: 'Important Document Organizer',
    intro:
      'Keep policies, warranties, IDs, and other papers on a document record. Tag them, and password-protect a file when it should not open without a password.',
    leadHeading: 'Keep important papers with the record they belong to',
    featuresTitle: 'What you can do',
    features: [
      {
        title: 'Upload a document',
        description: 'Each document record holds one file, such as a PDF or image.',
      },
      {
        title: 'Tag documents',
        description: 'Create tags and use them to group papers and to choose what a PDF export includes.',
      },
      {
        title: 'Password-protect a file',
        description:
          'View, download, replace, and remove can require the document password. Recovery uses security questions you set.',
      },
      {
        title: 'Keep active documents and history',
        description: 'Move a document to history when you no longer want it in the active list.',
      },
      {
        title: 'Export a PDF index',
        description: 'Export a PDF of the document records you choose. The export lists the records, not a merged copy of every file.',
      },
    ],
    howItWorks: [
      {
        title: 'Add the document',
        description: 'Name it, attach the file, and add tags.',
      },
      {
        title: 'Protect it if you need to',
        description: 'Set a password and security questions for a file that should stay locked.',
      },
      {
        title: 'Find it later by tag',
        description: 'Filter with tags, open the file, or export a PDF of the records you select.',
      },
    ],
    useCasesTitle: 'Papers households hunt for',
    useCasesIntro: 'This is a document organizer for files you upload. It is not a scan of papers you have not added.',
    useCases: [
      'Insurance policies',
      'Warranties',
      'IDs and certificates',
      'Tax or financial PDFs you want filed',
      'Password-protected files',
      'Tagged groups for an export',
    ],
    faq: [
      {
        question: 'What kinds of files can I store?',
        answer:
          'Documents use the shared attachment types: images, PDFs, Word, and Excel, up to 10 MB each. Each Important Documents record holds one file.',
      },
      {
        question: 'Can I organize documents with tags?',
        answer: 'Yes. You can create tags, put them on documents, and use tags when you export.',
      },
      {
        question: 'Can I password-protect a document?',
        answer:
          'Yes. A protected document asks for its password before view, download, replace, or remove. You set security questions for password recovery.',
      },
      {
        question: 'Are my documents public?',
        answer:
          'No. Document files are stored for your account and are not part of these public pages. Opening a file requires you to be signed in, and a password if you set one.',
      },
      {
        question: 'Can I export a list of documents?',
        answer: 'Yes. PDF export covers the document records you choose. It is an export of those records, not a single merged file of every upload.',
      },
    ],
    relatedTools: ['notes', 'hsa-tracker', 'home-maintenance-schedule', 'end-of-life-planner'],
    seoTitle: 'Important Document Organizer | Household Toolbox',
    seoDescription:
      'Upload policies, warranties, and other household papers, organize them with tags, and password-protect a file that should stay locked.',
    keywords: ['household document organizer', 'important document storage', 'family document organizer'],
    indexable: true,
  },
  {
    name: 'Notes',
    slug: 'notes',
    category: 'People & Records',
    icon: 'StickyNote',
    shortDescription: 'Create, tag, and manage household notes.',
    headline: 'Household Notes',
    intro:
      'Keep notes that need their own page. Tag them, attach a file, and password-protect a note when it should stay private.',
    leadHeading: 'Keep household notes you need to find again',
    featuresTitle: 'What you can do',
    features: [
      {
        title: 'Write notes',
        description: 'Create a note and come back to edit it.',
      },
      {
        title: 'Tag notes',
        description: 'Add tags and use them when you export.',
      },
      {
        title: 'Attach files',
        description: 'Keep files on the note they belong to.',
      },
      {
        title: 'Password-protect a note',
        description:
          'View and edit can require a password. Recovery uses security questions you set on that note.',
      },
      {
        title: 'Move a note to history',
        description: 'Inactive notes leave the active list and can be brought back.',
      },
      {
        title: 'Export notes',
        description: 'Export a PDF of all notes or of the note and tags you select.',
      },
    ],
    howItWorks: [
      {
        title: 'Create the note',
        description: 'Write it and add tags or files if they help you find it later.',
      },
      {
        title: 'Lock it if it is private',
        description: 'Set a password and security questions for a note that should not open freely.',
      },
      {
        title: 'Export a copy when you want one',
        description: 'Choose all notes or a narrower set and export a PDF.',
      },
    ],
    useCasesTitle: 'Notes that do not belong in a task list',
    useCasesIntro: 'Use Notes for reference. Use To Do List when the note is really a task with a due date.',
    useCases: [
      'Instructions for the house',
      'Wi-Fi, gate, or appliance notes',
      'Private notes with a password',
      'Tagged reference pages',
      'A file that belongs with a note',
      'A PDF copy of selected notes',
    ],
    faq: [
      {
        question: 'Can I organize notes with tags?',
        answer: 'Yes. Notes have tags, and export can use the tags you select.',
      },
      {
        question: 'Can I password-protect a note?',
        answer:
          'Yes. A note can require a password to view or edit. You set security questions so the password can be reset.',
      },
      {
        question: 'Can I attach a file to a note?',
        answer: 'Yes. Files can be attached to the note.',
      },
      {
        question: 'Can I export my notes?',
        answer: 'Yes. PDF export can include all notes or a note and tags you choose.',
      },
      {
        question: 'Are notes visible on the public website?',
        answer: 'No. Notes are stored in your account. These public pages only describe the tool.',
      },
    ],
    relatedTools: ['important-documents', 'address-book', 'goals-tracking', 'end-of-life-planner'],
    seoTitle: 'Household Notes | Household Toolbox',
    seoDescription:
      'Write household notes, organize them with tags, attach a file, and password-protect a note that should stay private to your account.',
    keywords: ['household notes', 'family notes organizer', 'private household notes'],
    indexable: true,
  },
  {
    name: 'Travel Log',
    slug: 'travel-log',
    category: 'People & Records',
    icon: 'Luggage',
    shortDescription: 'Record trips and vacations, including destinations, lodging, journal notes, and memories.',
    headline: 'Travel Log & Trip Journal',
    intro:
      'Write down a trip while you still remember it: where you went, where you stayed, what it cost, and the notes you want to keep.',
    leadHeading: 'Keep a journal of household trips',
    featuresTitle: 'What you can record',
    features: [
      {
        title: 'Log each trip',
        description: 'Save the trip name, destination, dates, trip type, companions, and how you traveled.',
      },
      {
        title: 'Record lodging',
        description: 'Add lodging stays on the trip.',
      },
      {
        title: 'Keep a budget note',
        description: 'Store a planned budget, the total trip cost, and budget notes.',
      },
      {
        title: 'Write journal notes and memories',
        description: 'Add dated journal notes, plus a best memory, surprise, highlight, and whether you would return or recommend it.',
      },
      {
        title: 'Attach tickets and photos',
        description: 'Tickets, boarding passes, photos, and receipts can be attached to the trip.',
      },
      {
        title: 'Rate the trip and pin the dates',
        description: 'Save a rating and add the trip dates to the household calendar.',
      },
      {
        title: 'Export the travel log',
        description: 'Export a PDF of the trips you choose.',
      },
    ],
    howItWorks: [
      {
        title: 'Add the trip',
        description: 'Enter the destination, dates, and the other details you want to remember.',
      },
      {
        title: 'Add lodging, notes, and files',
        description: 'Record where you stayed, write journal notes, and attach tickets or photos.',
      },
      {
        title: 'Look back later',
        description: 'Open the trip history when you want the details, or export a PDF.',
      },
    ],
    useCasesTitle: 'Trips worth writing down',
    useCasesIntro: 'Travel Log is a trip journal. It does not book flights or hotels.',
    useCases: [
      'Vacations',
      'Weekend trips',
      'Lodging you may want again',
      'Tickets and boarding passes',
      'What the trip cost',
      'Notes about whether you would go back',
    ],
    faq: [
      {
        question: 'Can I keep a trip journal?',
        answer: 'Yes. Each trip can have dated journal notes, a best memory, a surprise, a highlight, and notes on whether you would return or recommend it.',
      },
      {
        question: 'Can I record lodging and travel companions?',
        answer: 'Yes. A trip can store lodging records, companions, transportation, departure, and destination.',
      },
      {
        question: 'Can I save tickets and photos?',
        answer: 'Yes. Tickets, boarding passes, photos, and receipts can be attached to the trip.',
      },
      {
        question: 'Can I track what a trip cost?',
        answer: 'Yes. A trip can store a planned budget, the total trip cost, and budget notes.',
      },
      {
        question: 'Can I export my travel log?',
        answer: 'Yes. You can export a PDF of the trips you choose.',
      },
    ],
    relatedTools: ['calendar-events', 'important-documents', 'notes', 'address-book'],
    seoTitle: 'Travel Log & Trip Journal | Household Toolbox',
    seoDescription:
      'Record trips with destinations, lodging, budget notes, and a journal, and keep tickets or photos on the trip they belong to.',
    keywords: ['travel log', 'trip journal', 'travel history tracker'],
    indexable: true,
  },
  {
    name: 'End of Life Planner',
    slug: 'end-of-life-planner',
    category: 'People & Records',
    icon: 'ScrollText',
    shortDescription: 'Create a plan for each person and record the information loved ones may need.',
    headline: 'End of Life Planner & Organizer',
    intro:
      'Keep a private plan for what someone else would need: contacts, documents, accounts, household details, and wishes. You fill in only the sections you want.',
    leadHeading: 'Leave a practical plan in one place',
    featuresTitle: 'What you can record',
    features: [
      {
        title: 'One plan per person',
        description: 'Create a plan for someone in the household and archive a plan you are not actively editing.',
      },
      {
        title: 'Personal and contact details',
        description: 'Record a personal record and the people who should be contacted, in the order you choose.',
      },
      {
        title: 'Devices and online accounts',
        description: 'Note devices, online accounts, and where a password is stored. This is a record you type in, not a password manager sync.',
      },
      {
        title: 'Documents, insurance, and money',
        description: 'List important documents, insurance policies, and financial accounts, including where papers are kept.',
      },
      {
        title: 'Home details, wishes, and letters',
        description: 'Record home information, next steps, end-of-life wishes, personal wishes, and letters.',
      },
      {
        title: 'Attach scans where a section allows files',
        description:
          'Document, insurance, letter, personal-item, and other-record rows can hold files. Contacts and login rows do not.',
      },
      {
        title: 'Export a PDF of the plan',
        description: 'Export a PDF of the plan you choose.',
      },
    ],
    howItWorks: [
      {
        title: 'Create a plan for a person',
        description: 'Start a plan and open the sections you are ready to fill in.',
      },
      {
        title: 'Add the details someone else would need',
        description: 'Contacts, documents, accounts, home information, and wishes each have their own section.',
      },
      {
        title: 'Update it over time',
        description: 'Come back to unfinished sections, attach scans where files are supported, and export a PDF when you want a copy.',
      },
    ],
    useCasesTitle: 'Information someone else may need',
    useCasesIntro:
      'The planner is a private household record. It does not replace a will, an attorney, or a financial institution.',
    useCases: [
      'Who to contact first',
      'Where important papers are kept',
      'Insurance policies',
      'Accounts and where logins are stored',
      'Home utilities, providers, and vehicles',
      'Wishes and letters',
    ],
    faq: [
      {
        question: 'Who is End of Life Planner for?',
        answer:
          'It is for a household that wants a private written plan of the contacts, documents, accounts, home details, and wishes someone else may need.',
      },
      {
        question: 'Can I make a plan for more than one person?',
        answer: 'Yes. You can create a plan for each person and archive a plan you are not currently using.',
      },
      {
        question: 'What sections are included?',
        answer:
          'Plans include a personal record, important contacts, device and online logins, documents, insurance, financial information, home information, next steps, wishes, letters, and an other section. You can also add custom sections.',
      },
      {
        question: 'Can I store scans of documents and policies?',
        answer:
          'Yes, on document, insurance, letter, personal-item, and other-record rows. Contact rows and device or online login rows do not take file attachments.',
      },
      {
        question: 'Does this replace a will or a lawyer?',
        answer:
          'No. It stores the information you enter so it is easier to find. It is not legal, medical, or financial advice, and it does not file documents for you.',
      },
      {
        question: 'Can I export the plan?',
        answer: 'Yes. You can export a PDF of the plan you choose.',
      },
    ],
    relatedTools: ['important-documents', 'address-book', 'notes'],
    seoTitle: 'End of Life Planner & Organizer | Household Toolbox',
    seoDescription:
      'Create a private plan for each person and record the contacts, documents, accounts, home details, and wishes someone else may need.',
    keywords: ['end of life planner', 'end of life organizer', 'end of life planning checklist'],
    indexable: true,
  },
];

function assertPublicTools(tools: PublicTool[]) {
  const slugs = new Set<string>();
  const titles = new Set<string>();
  const descriptions = new Set<string>();

  for (const tool of tools) {
    if (slugs.has(tool.slug)) {
      throw new Error(`Duplicate public tool slug: ${tool.slug}`);
    }
    slugs.add(tool.slug);

    if (titles.has(tool.seoTitle)) {
      throw new Error(`Duplicate SEO title: ${tool.seoTitle}`);
    }
    titles.add(tool.seoTitle);

    if (descriptions.has(tool.seoDescription)) {
      throw new Error(`Duplicate SEO description: ${tool.seoDescription}`);
    }
    descriptions.add(tool.seoDescription);

    if (!PUBLIC_TOOL_CATEGORIES.includes(tool.category)) {
      throw new Error(`Unknown category for ${tool.slug}`);
    }
  }

  for (const tool of tools) {
    for (const related of tool.relatedTools) {
      if (!slugs.has(related) || related === tool.slug) {
        throw new Error(`Invalid related tool "${related}" on ${tool.slug}`);
      }
    }
  }

  for (const slug of FEATURED_TOOL_SLUGS) {
    if (!slugs.has(slug)) {
      throw new Error(`Featured tool is missing from the catalog: ${slug}`);
    }
  }
}

assertPublicTools(PUBLIC_TOOLS);

export function getPublicTools(): PublicTool[] {
  return PUBLIC_TOOLS.filter((tool) => tool.indexable);
}

export function getPublicTool(slug: string): PublicTool | undefined {
  return PUBLIC_TOOLS.find((tool) => tool.slug === slug && tool.indexable);
}

export function getFeaturedPublicTools(): PublicTool[] {
  return FEATURED_TOOL_SLUGS.map((slug) => getPublicTool(slug)).filter((tool): tool is PublicTool => Boolean(tool));
}

export function getRelatedPublicTools(tool: PublicTool): PublicTool[] {
  return tool.relatedTools
    .map((slug) => getPublicTool(slug))
    .filter((related): related is PublicTool => Boolean(related));
}

export function getPublicToolsByCategory(): Array<{ category: PublicToolCategory; tools: PublicTool[] }> {
  return PUBLIC_TOOL_CATEGORIES.map((category) => ({
    category,
    tools: getPublicTools().filter((tool) => tool.category === category),
  })).filter((group) => group.tools.length > 0);
}

export function categoryAnchorId(category: PublicToolCategory): string {
  return `category-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}
