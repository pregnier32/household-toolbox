# Household Toolbox

The digital toolbox for your whole household. Track maintenance schedules, organize important documents, and coordinate checklists so nothing around the house slips through the cracks.

## Features

- 🧰 **Maintenance Timeline** - Track filters, gutters, inspections, and more with reminders
- 📂 **Important Documents** - Keep warranties, policies, and records organized and easy to find
- ✅ **Shared Checklists** - Coordinate move-in, hosting, packing, and seasonal checklists with your whole household
- 👥 **Collaboration** - Share responsibility with partners, roommates, or family

## Tech Stack

- **Framework:** Next.js 16 with App Router
- **Language:** TypeScript
- **Styling:** Tailwind CSS 4
- **Database:** Supabase
- **Deployment:** Ready for Vercel

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm, yarn, pnpm, or bun
- A Supabase account and project

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd household-toolbox
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
   - Copy `.env.example` to `.env.local`
   - Fill in your Supabase credentials:
     ```env
     NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
     ```

4. Set up Supabase:
   - Create a `waitlist` table in your Supabase database:
     ```sql
     CREATE TABLE waitlist (
       id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
       email TEXT UNIQUE NOT NULL,
       created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
     );
     ```
   - Enable Row Level Security (RLS) and create a policy to allow inserts:
     ```sql
     ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
     
     CREATE POLICY "Allow public inserts" ON waitlist
       FOR INSERT
       TO anon
       WITH CHECK (true);
     ```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
household-toolbox/
├── app/
│   ├── components/      # React components
│   ├── layout.tsx       # Root layout
│   └── page.tsx         # Home page
├── lib/
│   └── supabaseClient.ts  # Supabase client configuration
├── public/              # Static assets
└── env/                 # Environment files (legacy - use .env.local)
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anonymous/public key |

## Deployment

The easiest way to deploy is using [Vercel](https://vercel.com):

1. Push your code to GitHub
2. Import your repository in Vercel
3. Add your environment variables in Vercel's project settings
4. Deploy!

For more details, see the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying).

## License

Private project - All rights reserved.
