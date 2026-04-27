-- Add add_to_dashboard column to appointments table
ALTER TABLE tools_PCS_appointments
ADD COLUMN IF NOT EXISTS add_to_dashboard BOOLEAN DEFAULT true;

