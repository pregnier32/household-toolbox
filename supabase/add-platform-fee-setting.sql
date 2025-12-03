-- Add platform fee setting to settings table
-- This fee is charged monthly to users who have at least 1 active tool

INSERT INTO settings (key, value, created_at, updated_at)
VALUES (
  'platform_fee',
  '{"amount": 5.00}'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (key) 
DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = NOW();

