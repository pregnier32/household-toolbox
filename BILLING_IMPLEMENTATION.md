# Billing System Implementation Guide

## Overview
This document outlines the complete billing system implementation with `billing_active` and `billing_history` tables, along with automatic syncing and nightly processing.

## Files Created/Modified

### 1. Database Tables
- **File**: `supabase/create-billing-tables.sql`
- **Tables**: `billing_active`, `billing_history`
- **Run this SQL script in Supabase** to create the tables

### 2. Helper Functions
- **File**: `app/lib/billing-sync.ts`
- **Functions**:
  - `calculateBillingPeriod()` - Calculates billing period dates
  - `getUserBillingDay()` - Gets user's billing day from oldest tool
  - `syncUserBillingActive()` - Syncs billing_active for a user
  - `removeToolBillingRecords()` - Removes billing records for a tool

### 3. Updated Endpoints
- **File**: `app/api/tools/buy/route.ts`
  - Added billing sync after tool purchase
  
- **File**: `app/api/my-tools/route.ts`
  - Added billing sync after tool inactivation

### 4. Cron Job
- **File**: `app/api/cron/billing-process/route.ts`
  - Nightly job to move records from `billing_active` to `billing_history`
  - Runs at 2 AM UTC daily

### 5. Initial Sync Script
- **File**: `app/api/admin/billing/sync-all/route.ts`
  - Admin endpoint to sync all users' billing records
  - Can sync specific user or all users

### 6. Vercel Configuration
- **File**: `vercel.json`
  - Configures cron job schedule

## Setup Instructions

### Step 1: Create Database Tables
1. Open Supabase Dashboard
2. Go to SQL Editor
3. Run `supabase/create-billing-tables.sql`

### Step 2: Set Environment Variable
Add to your Vercel environment variables:
```
CRON_SECRET=your-secret-key-here
```
This secret is used to secure the cron endpoint.

### Step 3: Initial Data Sync
After creating tables, run the initial sync:
```bash
# As superadmin, call:
GET /api/admin/billing/sync-all
```

Or sync a specific user:
```bash
GET /api/admin/billing/sync-all?userId=xxx
```

### Step 4: Deploy to Vercel
1. Push changes to Git
2. Vercel will automatically detect `vercel.json` and configure the cron job
3. The cron job will run daily at 2 AM UTC

## How It Works

### When a Tool is Purchased
1. Tool is added to `users_tools` table
2. `syncUserBillingActive()` is called
3. Billing records are created in `billing_active`:
   - Tool subscription record(s)
   - Platform fee (if applicable)

### When a Tool is Inactivated
1. Tool status is updated in `users_tools`
2. `removeToolBillingRecords()` is called
3. Billing records are removed/updated in `billing_active`
4. Platform fee is recalculated

### Nightly Processing
1. Cron job runs at 2 AM UTC
2. Finds all records in `billing_active` where `billing_date <= today` and `status = 'pending'`
3. Moves records to `billing_history` with `status = 'processed'`
4. Deletes records from `billing_active`

## Testing

### Test Tool Purchase
1. Purchase a tool via `/api/tools/buy`
2. Check `billing_active` table for new records
3. Verify tool subscription and platform fee are present

### Test Tool Inactivation
1. Inactivate a tool via `/api/my-tools` (PUT)
2. Check `billing_active` table - records should be removed/updated
3. Verify platform fee is recalculated

### Test Cron Job
1. Manually call `/api/cron/billing-process` with proper authorization header
2. Or wait for scheduled run
3. Check `billing_history` for processed records

## Monitoring

### Check Cron Job Status
- Vercel Dashboard → Cron Jobs section
- View execution logs and history

### Query Billing Data
```sql
-- Active billing records
SELECT * FROM billing_active WHERE user_id = 'xxx';

-- Historical billing records
SELECT * FROM billing_history WHERE user_id = 'xxx' ORDER BY processed_at DESC;
```

## Troubleshooting

### Cron Job Not Running
1. Check `vercel.json` is in root directory
2. Verify cron schedule syntax: `"0 2 * * *"` (2 AM UTC daily)
3. Check Vercel dashboard for cron job status

### Billing Records Not Syncing
1. Check `billing_active` table exists
2. Verify helper functions are working
3. Check API endpoint logs for errors

### Authorization Errors
1. Verify `CRON_SECRET` environment variable is set
2. Check authorization header in cron endpoint

## Next Steps

1. **Payment Processing**: Update `billing_history` status based on actual payment results
2. **Invoicing**: Generate invoices from `billing_history` records
3. **Notifications**: Send billing notifications to users
4. **Reporting**: Create admin dashboard for billing analytics

