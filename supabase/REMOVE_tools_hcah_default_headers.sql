-- Healthcare no longer seeds from this catalog. Per-user headers live in tools_hcah_headers.
-- Safe to rerun.

DROP TABLE IF EXISTS tools_hcah_default_headers CASCADE;
DROP FUNCTION IF EXISTS update_hcah_default_headers_updated_at();

NOTIFY pgrst, 'reload schema';
