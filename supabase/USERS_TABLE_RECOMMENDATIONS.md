# Users Table Analysis & Recommendations

## Current Table Structure

Based on the TypeScript types and codebase analysis, your `users` table has the following fields:

- `id` (UUID, Primary Key)
- `user_id` (UUID) - **⚠️ Potentially redundant**
- `email` (TEXT)
- `password` (TEXT) - Hashed password
- `first_name` (TEXT)
- `last_name` (TEXT)
- `active` (TEXT - 'Y'/'N')
- `user_status` (TEXT)
- `guest_admin_id` (INTEGER, nullable) - **⚠️ Appears unused**
- `created_at` (TIMESTAMP)

## Critical Issues Found

### 1. **Missing Indexes** ⚠️ HIGH PRIORITY

Your table is missing critical indexes that will significantly impact performance:

- **`email` index** - Most frequently queried field (sign in, sign up, password reset, profile updates)
- **`active` index** - Used in session validation and stats queries
- **`user_status` index** - Used in admin authorization checks
- **`created_at` index** - Useful for sorting and analytics

**Impact:** Without these indexes, queries will perform full table scans, which will get slower as your user base grows.

### 2. **Missing Unique Constraint on Email** ⚠️ HIGH PRIORITY

While your code checks for duplicate emails, there's no database-level constraint preventing duplicates. This is a data integrity risk.

**Recommendation:** Add `UNIQUE` constraint on `email` column.

### 3. **Missing `updated_at` Timestamp** ⚠️ MEDIUM PRIORITY

No way to track when user records are modified. Useful for:
- Audit trails
- Debugging
- Analytics

**Recommendation:** Add `updated_at` column with auto-update trigger.

## Field Analysis

### Potentially Redundant Fields

1. **`user_id`** - This field appears to be set to the same value as `id` in your signup code. Consider:
   - Removing it if not used elsewhere
   - Or adding a check constraint: `CHECK (user_id = id)`
   - Or documenting its purpose if it serves a different function

### Unused Fields

1. **`guest_admin_id`** - Only found in TypeScript types, not in any actual queries. Consider:
   - Removing if not needed
   - Or implementing the feature that uses it
   - Or documenting its purpose

### Data Type Improvements

1. **`active` field** - Currently TEXT ('Y'/'N'), but should ideally be BOOLEAN
   - **Current:** `active TEXT`
   - **Recommended:** `active BOOLEAN DEFAULT TRUE`
   - **Note:** This is a breaking change - only do if you can update all code references

2. **`user_status`** - Could benefit from a CHECK constraint to ensure only valid values
   - Example: `CHECK (user_status IN ('admin', 'superadmin', 'guest'))`

## Query Patterns Analyzed

Based on codebase analysis, here are the most common query patterns:

1. **Email lookups** (most frequent)
   - Sign in: `.eq('email', ...)`
   - Sign up: `.eq('email', ...)` (duplicate check)
   - Password reset: `.eq('email', ...)`
   - Profile update: `.eq('email', ...)` (duplicate check)

2. **ID lookups**
   - Session validation: `.eq('id', ...)`
   - Profile updates: `.eq('id', ...)`
   - Password changes: `.eq('id', ...)`

3. **Active user filtering**
   - Session validation: `.eq('active', 'Y')`
   - Stats queries: `.eq('active', 'Y')`

4. **Status checks**
   - Admin authorization: `.eq('user_status', 'superadmin')`

## Recommended Actions

### Immediate (Run the SQL script)

1. ✅ Add indexes on `email`, `active`, `user_status`, `created_at`
2. ✅ Add unique constraint on `email`
3. ✅ Add `updated_at` column with auto-update trigger
4. ✅ Add check constraint on `active` field

### Future Considerations

1. **Consider converting `active` to BOOLEAN** - Requires code changes
2. **Review `user_id` field** - Determine if it's needed or can be removed
3. **Review `guest_admin_id`** - Implement feature or remove
4. **Add CHECK constraint on `user_status`** - Define valid statuses

## How to Apply

Run the SQL script: `supabase/users-table-improvements.sql`

This script is idempotent (safe to run multiple times) and includes:
- All necessary indexes
- Unique constraint on email
- `updated_at` column with trigger
- Check constraints
- Detailed comments

## Performance Impact

After applying these improvements, you should see:
- **Faster sign-in/sign-up** (email index)
- **Faster session validation** (active index)
- **Faster admin checks** (user_status index)
- **Better data integrity** (unique constraint)
- **Audit trail** (updated_at)

## Notes

- The script uses `IF NOT EXISTS` and `IF EXISTS` checks to be safe
- All changes are backward compatible (won't break existing code)
- The script includes verification queries you can run to confirm improvements

