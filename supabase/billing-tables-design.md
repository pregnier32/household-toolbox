# Billing Tables Design & Implementation Plan

## Overview
This document outlines the design for `billing_active` and `billing_history` tables, along with the nightly job to move records from active to history.

## Table Schemas

### 1. `billing_active` Table
Stores current billing records that users see in "My Tools". Each record represents a chargeable item for a user.

```sql
CREATE TABLE IF NOT EXISTS billing_active (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  billing_date DATE NOT NULL, -- The day of month when billing occurs
  item_type TEXT NOT NULL CHECK (item_type IN ('tool_subscription', 'platform_fee')),
  tool_id UUID REFERENCES tools(id) ON DELETE SET NULL, -- NULL for platform_fee
  tool_name TEXT, -- Denormalized for quick access
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
  users_tools_id UUID REFERENCES users_tools(id) ON DELETE SET NULL, -- Link to source subscription
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one platform fee per user per billing period
  CONSTRAINT unique_platform_fee_per_period 
    UNIQUE(user_id, billing_period_start, billing_period_end) 
    WHERE item_type = 'platform_fee',
  
  -- Ensure one tool subscription per users_tools_id per billing period
  CONSTRAINT unique_tool_subscription_per_period 
    UNIQUE(users_tools_id, billing_period_start, billing_period_end) 
    WHERE item_type = 'tool_subscription'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_billing_active_user_id ON billing_active(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_active_billing_date ON billing_active(billing_date);
CREATE INDEX IF NOT EXISTS idx_billing_active_status ON billing_active(status);
CREATE INDEX IF NOT EXISTS idx_billing_active_users_tools_id ON billing_active(users_tools_id);
CREATE INDEX IF NOT EXISTS idx_billing_active_period ON billing_active(billing_period_start, billing_period_end);
```

### 2. `billing_history` Table
Stores historical billing records after they've been processed.

```sql
CREATE TABLE IF NOT EXISTS billing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  billing_date DATE NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('tool_subscription', 'platform_fee')),
  tool_id UUID REFERENCES tools(id) ON DELETE SET NULL,
  tool_name TEXT,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL CHECK (status IN ('processed', 'failed', 'refunded')),
  users_tools_id UUID REFERENCES users_tools(id) ON DELETE SET NULL,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL, -- Original creation date from billing_active
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Add metadata for payment processing
  payment_intent_id TEXT, -- Stripe or other payment processor ID
  invoice_id TEXT,
  notes TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_billing_history_user_id ON billing_history(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_history_billing_date ON billing_history(billing_date);
CREATE INDEX IF NOT EXISTS idx_billing_history_processed_at ON billing_history(processed_at);
CREATE INDEX IF NOT EXISTS idx_billing_history_users_tools_id ON billing_history(users_tools_id);
```

## Implementation Strategy

### Option 1: Supabase Edge Functions + pg_cron (Recommended)
**Pros:**
- Runs directly in Supabase
- No external dependencies
- Reliable and scalable
- Can use database transactions

**Implementation:**
1. Create a Supabase Edge Function for the nightly job
2. Use pg_cron extension to schedule it
3. Function moves records from `billing_active` to `billing_history`

### Option 2: Vercel Cron Jobs
**Pros:**
- Integrated with your Next.js deployment
- Easy to monitor via Vercel dashboard
- Can call Next.js API routes

**Implementation:**
1. Create API route: `/api/cron/billing-process`
2. Configure in `vercel.json` with cron schedule
3. Route calls Supabase to move records

### Option 3: Database Function + pg_cron
**Pros:**
- Fastest execution (runs in database)
- Atomic transactions
- No external API calls

**Implementation:**
1. Create PostgreSQL function to move records
2. Schedule with pg_cron

## Recommended Approach: Option 1 (Supabase Edge Function)

### Step 1: Create Edge Function
Location: `supabase/functions/process-billing/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  try {
    // Get all records from billing_active that should be processed
    // (billing_date is today or in the past)
    const today = new Date().toISOString().split('T')[0]
    
    const { data: recordsToProcess, error: fetchError } = await supabase
      .from('billing_active')
      .select('*')
      .lte('billing_date', today)
      .eq('status', 'pending')
    
    if (fetchError) {
      throw fetchError
    }
    
    if (!recordsToProcess || recordsToProcess.length === 0) {
      return new Response(JSON.stringify({ message: 'No records to process' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }
    
    // Move records to billing_history
    const historyRecords = recordsToProcess.map(record => ({
      ...record,
      processed_at: new Date().toISOString(),
      status: 'processed', // or determine based on payment processing result
    }))
    
    const { error: insertError } = await supabase
      .from('billing_history')
      .insert(historyRecords)
    
    if (insertError) {
      throw insertError
    }
    
    // Delete from billing_active
    const idsToDelete = recordsToProcess.map(r => r.id)
    const { error: deleteError } = await supabase
      .from('billing_active')
      .delete()
      .in('id', idsToDelete)
    
    if (deleteError) {
      throw deleteError
    }
    
    return new Response(
      JSON.stringify({ 
        message: `Processed ${recordsToProcess.length} billing records`,
        count: recordsToProcess.length 
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
```

### Step 2: Schedule with pg_cron
```sql
-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the function to run daily at 2 AM UTC
SELECT cron.schedule(
  'process-billing-records',
  '0 2 * * *', -- Daily at 2 AM
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-billing',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

## Sync Logic: Update billing_active When Tools Change

### When Tool is Added (Purchase)
Location: `app/api/tools/buy/route.ts`

After successfully inserting into `users_tools`, add logic to:
1. Calculate billing period (based on user's billing day)
2. Insert tool subscription record into `billing_active`
3. Check if platform fee should be added (if this is user's first active/trial tool)
4. Insert platform fee record if needed

### When Tool is Removed/Inactivated
Location: `app/api/my-tools/route.ts` (PUT endpoint)

After updating `users_tools` status to 'inactive', add logic to:
1. Find related records in `billing_active` for this `users_tools_id`
2. Delete or mark as cancelled (depending on business logic)
3. Recalculate platform fee (remove if no active tools remain)

### Helper Function: Sync User's Billing Active
Create a utility function that rebuilds `billing_active` for a user based on their current `users_tools`:

```typescript
// app/lib/billing-sync.ts
export async function syncUserBillingActive(userId: string, billingDay: number) {
  // 1. Get all active/trial tools for user
  // 2. Calculate billing periods
  // 3. Clear existing billing_active for user
  // 4. Rebuild billing_active records
  // 5. Add platform fee if applicable
}
```

## API Endpoints Needed

1. **GET /api/billing/active** - Get current billing for user (what they see in My Tools)
2. **GET /api/billing/history** - Get billing history for user
3. **POST /api/billing/sync** - Manual sync for a user (admin only)
4. **POST /api/cron/billing-process** - Nightly job endpoint (if using Vercel Cron)

## Migration Strategy

1. Create tables with SQL scripts
2. Create helper functions for syncing
3. Update tool purchase/inactivation endpoints
4. Create initial sync script to populate `billing_active` from existing `users_tools`
5. Deploy nightly job
6. Monitor and test

## Next Steps

1. Review and approve this design
2. Create SQL migration files
3. Implement sync logic in tool purchase/inactivation
4. Create nightly job
5. Test thoroughly
6. Deploy

