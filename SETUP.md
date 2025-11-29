# Setup Guide

This guide will help you set up your Household Toolbox project from scratch.

## Step 1: Environment Variables

1. Create a `.env.local` file in the root of your project (copy from `.env.example` if it exists)
2. Add your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

You can find these values in your Supabase project settings under "API" → "Project API keys".
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: The anon/public key (safe to expose to client)
- `SUPABASE_SERVICE_ROLE_KEY`: The service_role key (NEVER expose to client - server-side only)

**Important:** The service role key bypasses Row Level Security and should only be used in server-side code (like server actions).

## Step 2: Supabase Database Setup

### Create the Waitlist Table

1. Go to your Supabase project dashboard
2. Navigate to "SQL Editor"
3. Run the following SQL to create the `waitlist` table:

```sql
CREATE TABLE waitlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Set Up Row Level Security (RLS)

1. Enable RLS on the table:

```sql
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
```

2. Create a policy to allow public inserts (for the waitlist form):

```sql
CREATE POLICY "Allow public inserts" ON waitlist
  FOR INSERT
  TO anon
  WITH CHECK (true);
```

**Note:** This allows anyone to insert into the waitlist. For production, you may want to add additional validation or rate limiting.

### Set Up Row Level Security for Users Table

1. Enable RLS on the `users` table (if not already enabled):

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
```

2. Create a policy to allow public user registration:

```sql
CREATE POLICY "Allow public user registration" ON users
  FOR INSERT
  TO anon
  WITH CHECK (true);
```

**Note:** This allows anonymous users to create accounts. For production, you may want to add additional validation, rate limiting, or use Supabase Auth instead of custom authentication.

Alternatively, you can run the SQL file provided in `supabase/users-rls-policy.sql`.

## Step 3: Install Dependencies

```bash
npm install
```

## Step 4: Run the Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see your app.

## Troubleshooting

### "Missing env.NEXT_PUBLIC_SUPABASE_URL" error

- Make sure you created `.env.local` (not `.env` or `env/local`)
- Restart your development server after creating/updating `.env.local`
- Check that the variable names match exactly (case-sensitive)

### Supabase connection errors

- Verify your Supabase URL and anon key are correct
- Check that your Supabase project is active
- Ensure the `waitlist` table exists and RLS policies are set up correctly

### Form submission errors

- Check the browser console for detailed error messages
- Verify the `waitlist` table exists in your Supabase database
- Ensure RLS policies allow inserts from anonymous users

### "new row violates row-level security policy" error

- This error occurs when trying to insert into the `users` table without proper RLS policies
- **Solution 1 (Recommended):** Use the service role key for server actions (already implemented)
  - Make sure you've added `SUPABASE_SERVICE_ROLE_KEY` to your `.env.local` file
  - The service role key bypasses RLS and is secure for server-side operations
- **Solution 2:** Create an RLS policy to allow public inserts
  - Run the SQL in `supabase/users-rls-policy-fix.sql` in your Supabase SQL Editor
  - Verify the policy exists by checking your Supabase dashboard under "Authentication" → "Policies"

